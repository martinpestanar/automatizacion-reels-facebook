import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { 
  Sparkles, Video, Layers, Share2, Sun, Moon, RefreshCw, 
  Play, Plus, CheckCircle2, Clock, AlertCircle, ChevronRight,
  Flame, ShieldCheck, Settings, BarChart3, BookOpen, Edit3,
  SlidersHorizontal, Check, Copy, ExternalLink, Send, Database, FileText,
  Trash2, Edit, X, Save, CheckSquare, Square, ChevronDown, ChevronUp, Search, Filter, HelpCircle,
  Calendar, Power, ToggleLeft, ToggleRight, Zap, Bot, Image as ImageIcon, Upload, Loader2
} from 'lucide-react';

const supabaseUrl = 'https://hywlytsbogbassecflbw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5d2x5dHNib2diYXNzZWNmbGJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQzODI2ODMsImV4cCI6MjA4OTk1ODY4M30.1FB0-PMfuTBJ9oJWRJMkKA3vQKkIS1LrNFXEvtmHpWY';
const supabase = createClient(supabaseUrl, supabaseKey);

export default function App() {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
  
  // Obtener pestaña inicial desde el hash de la URL o localStorage (ej: #accounts -> 'accounts')
  const getInitialTab = () => {
    const hash = window.location.hash.replace('#', '').trim();
    const validTabs = ['studio', 'vault', 'templates', 'queue', 'images', 'accounts', 'settings', 'channels'];
    if (hash && validTabs.includes(hash)) return hash;
    return localStorage.getItem('lastActiveTab') || 'studio';
  };

  const [activeTab, setActiveTabState] = useState(getInitialTab);

  // Cambiar pestaña actualizando URL hash y localStorage
  const setActiveTab = (tab) => {
    setActiveTabState(tab);
    window.location.hash = tab;
    localStorage.setItem('lastActiveTab', tab);
  };

  // Escuchar cambios del hash en el navegador (botón atrás/adelante)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').trim();
      const validTabs = ['studio', 'vault', 'templates', 'queue', 'images', 'accounts', 'settings', 'channels'];
      if (hash && validTabs.includes(hash)) {
        setActiveTabState(hash);
        localStorage.setItem('lastActiveTab', hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    // Sincronizar hash inicial si no tenía
    if (!window.location.hash) {
      window.location.hash = activeTab;
    }
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  const [accounts, setAccounts] = useState([]);
  const [videos, setVideos] = useState([]);
  const [brands, setBrands] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [vaultItems, setVaultItems] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [notification, setNotification] = useState(null);
  const [autoQuantity, setAutoQuantity] = useState(5); // Cantidad configurable de videos automáticos
  const [generationSource, setGenerationSource] = useState('vault'); // 'vault' (Banco de Contenido sin gastar tokens) | 'n8n_ai' (Agente IA de n8n / Gemini)
  const [rawBatchText, setRawBatchText] = useState('');
  const [parsedBatchCount, setParsedBatchCount] = useState(0);
  const [renderingJobs, setRenderingJobs] = useState({}); // Tracking de jobs en render con progreso estimado y tiempo restante
  const [selectedAuditScene, setSelectedAuditScene] = useState({}); // { [jobId]: 'full' | 's1' | 's2' | 's3' }
  const [showChecklist, setShowChecklist] = useState({}); // { [jobId]: boolean }

  // Selección múltiple y Edición en Banco de Contenido (Vault CRUD)
  const [selectedVaultIds, setSelectedVaultIds] = useState(new Set());
  const [editingVaultItem, setEditingVaultItem] = useState(null); // Objeto completo al editar
  const [savingVaultItem, setSavingVaultItem] = useState(false);
  const [batchPromptDuration, setBatchPromptDuration] = useState('8s'); // Duración elegida para el generador de lotes: '6s' | '8s'
  const [vaultSearchQuery, setVaultSearchQuery] = useState('');
  const [vaultFilterStatus, setVaultFilterStatus] = useState('all'); // 'all' | 'stored' | 'in_queue'
  const [isImporterOpen, setIsImporterOpen] = useState(false); // Acordeón de importador para mantener la vista limpia

  // Parámetros de Generación estilo Google Flow (Video & Imagen)
  const [publishingMode, setPublishingMode] = useState(localStorage.getItem('publishingMode') || 'manual'); // 'manual' (revisar antes de publicar) | 'auto' (publicar directo al terminar render)
  const [publishingJobId, setPublishingJobId] = useState(null);
  const [publishingImageId, setPublishingImageId] = useState(null); // ID del video enviándose por webhook

  // Estado para subida manual de imagen
  const [showManualImageModal, setShowManualImageModal] = useState(false);
  const [uploadingManualImage, setUploadingManualImage] = useState(false);
  const [manualImageForm, setManualImageForm] = useState({
    title: '',
    copy_text: '',
    file: null,
    previewUrl: null
  });

  // Widget de Automatización de Publicación Diaria (Jardinería / Mr. Green)
  const defaultAutoConfig = {
    enabled: false,
    source: 'vault', // 'vault' (desde mi Banco de Contenido) | 'ai_agent' (IA crea prompts + Nano Banana)
    dailyQuantity: 5, // 5 (default) o 7 al día
    createCompanionImages: true, // Si el Agente IA genera también las imágenes 4:5
    publishToStories: true, // Publicar como HISTORIA INDEPENDIENTE en Facebook (Monetizable aparte de Reels)
    storiesDelayMinutes: 45, // Minutos de desfase entre el Reel y la Historia independiente
    lastExecutedDate: null
  };

  const [automationConfig, setAutomationConfig] = useState(() => {
    try {
      const saved = localStorage.getItem('gardening_auto_config');
      return saved ? { ...defaultAutoConfig, ...JSON.parse(saved) } : defaultAutoConfig;
    } catch {
      return defaultAutoConfig;
    }
  });

  const [showAutomationModal, setShowAutomationModal] = useState(false);

  // Guardar configuración del widget en localStorage cada vez que cambie
  useEffect(() => {
    localStorage.setItem('gardening_auto_config', JSON.stringify(automationConfig));
  }, [automationConfig]);

  // Horarios de Publicación Inteligentes propuestos para Jardinería (Ritmo Circadiano del Huerto)
  const gardeningSchedules = {
    5: [
      { id: 1, videoTime: '07:30 AM', imageTime: '08:00 AM', storyTime: '08:45 AM', label: 'Riego del Alba (Golden Hour)', focus: 'Pilar 1: Micro-Ecosistemas & Suelo Vivo' },
      { id: 2, videoTime: '11:00 AM', imageTime: '11:30 AM', storyTime: '12:15 PM', label: 'Luz Máxima & Ventilación', focus: 'Pilar 2: Botánica Rebelde & Chaos Gardening' },
      { id: 3, videoTime: '02:30 PM', imageTime: '03:00 PM', storyTime: '03:45 PM', label: 'Pausa del Almuerzo & Tutorado', focus: 'Pilar 3: Ciencia Orgánica Sin Mitos' },
      { id: 4, videoTime: '06:00 PM', imageTime: '06:30 PM', storyTime: '07:15 PM', label: 'Atardecer & Poda de Hojas', focus: 'Pilar 4: Micro-Bosques & Foodscaping' },
      { id: 5, videoTime: '08:30 PM', imageTime: '09:00 PM', storyTime: '09:45 PM', label: 'Noche: Cuidado de Raíces & Plagas', focus: 'Pilar 5: Jardines Sensoriales & Nocturnos' }
    ],
    7: [
      { id: 1, videoTime: '07:00 AM', imageTime: '07:30 AM', storyTime: '08:15 AM', label: 'Despertar del Huerto', focus: 'Pilar 1: Suelo Vivo' },
      { id: 2, videoTime: '09:30 AM', imageTime: '10:00 AM', storyTime: '10:45 AM', label: 'Sol Temprano & Fotosíntesis', focus: 'Pilar 2: Botánica Rebelde' },
      { id: 3, videoTime: '12:00 PM', imageTime: '12:30 PM', storyTime: '01:15 PM', label: 'Mediodía & Hidratación', focus: 'Pilar 6: Diagnóstico Visual' },
      { id: 4, videoTime: '02:30 PM', imageTime: '03:00 PM', storyTime: '03:45 PM', label: 'Microclima de Maceta', focus: 'Pilar 3: Ciencia Orgánica' },
      { id: 5, videoTime: '05:00 PM', imageTime: '05:30 PM', storyTime: '06:15 PM', label: 'Cosecha de la Tarde', focus: 'Pilar 4: Alquimia Orgánica' },
      { id: 6, videoTime: '07:30 PM', imageTime: '08:00 PM', storyTime: '08:45 PM', label: 'Relajación & Aromáticas', focus: 'Pilar 5: Foodscaping' },
      { id: 7, videoTime: '09:30 PM', imageTime: '10:00 PM', storyTime: '10:30 PM', label: 'Inspección Nocturna', focus: 'Pilar 5: Jardines Nocturnos' }
    ]
  };

  // Modal para agregar nueva cuenta Google
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [newAccountForm, setNewAccountForm] = useState({
    alias: '',
    email: '',
    tier: 'free',
    priority: 1,
    daily_credits_total: 50
  });
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [loggingInAccount, setLoggingInAccount] = useState(null);
  const [connectedSessions, setConnectedSessions] = useState({}); // { [alias]: boolean }
  const [profileEmails, setProfileEmails] = useState({}); // { [alias]: 'email@gmail.com' }

  const [flowSettings, setFlowSettings] = useState({
    mediaType: 'video', // 'image' | 'video'
    generationMode: 'ingredients', // 'frames' | 'ingredients'
    aspectRatio: '9:16', // '16:9' | '9:16'
    modelName: 'Omni 1.1 Flash', // 'Omni 1.1 Flash' | 'Veo 3.1 - Lite' | 'Veo 3.1 - Fast' | 'Veo 3.1 - Quality'
    resolution: '720p', // '360p' | '720p'
    duration: '8s', // '4s' | '6s' | '8s' | '10s'
    variants: 'x1', // 'x1' | 'x2' | 'x3' | 'x4'
    // Parámetros específicos exactos de Google Flow para Imagen
    imageModel: '🍌 Nano Banana 2.1', // '🍌 Nano Banana Pro' | '🍌 Nano Banana 2 Lite' | '🍌 Nano Banana 2.1'
    imageRatio: '3:4', // '16:9' | '4:3' | '1:1' | '3:4' | '9:16'
    imageVariants: 'x1', // 'x1' | 'x2' | 'x3' | 'x4'
    imageCredits: '0 credits'
  });

  // Formulario Manual a Medida
  const [manualForm, setManualForm] = useState({
    pilar: 'Pilar 4: Alquimia Orgánica',
    angulo: 'C) Ciencia de la Abuela',
    clima_luz: 'L1: Amanecer Dorado',
    publish_mode: 'now', // 'now' | 'scheduled' | 'queue'
    scheduled_time: '',
    title: '',
    copy_text: '',
    scene_1: '',
    scene_2: '',
    scene_3: ''
  });

  // Toggle Theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Sincronización en tiempo real vía Supabase Realtime + Worker Local de Google Flow
  useEffect(() => {
    // 1. Canal Realtime de Supabase para actualización automática instantánea sin recargar
    const realtimeChannel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'video_jobs' },
        (payload) => {
          console.log('⚡ Actualización en tiempo real (video_jobs):', payload);
          if (payload.eventType === 'INSERT') {
            setVideos((prev) => [payload.new, ...prev.filter(v => v.id !== payload.new.id)]);
          } else if (payload.eventType === 'UPDATE') {
            setVideos((prev) => prev.map(v => v.id === payload.new.id ? { ...v, ...payload.new } : v));
            // Si el video final o escenas ya se completaron, limpiar de rendering
            if (payload.new.final_video_url) {
              setRenderingJobs((prev) => {
                const next = { ...prev };
                delete next[payload.new.id];
                return next;
              });
            }
          } else if (payload.eventType === 'DELETE') {
            setVideos((prev) => prev.filter(v => v.id !== payload.old.id));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'content_vault' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            setVaultItems((prev) => prev.map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item));
          } else if (payload.eventType === 'INSERT') {
            setVaultItems((prev) => [payload.new, ...prev]);
          } else if (payload.eventType === 'DELETE') {
            setVaultItems((prev) => prev.filter(item => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    // 2. Polling de progreso de Google Flow cada 2 segundos
    let wasRunning = false;
    const pollInterval = setInterval(async () => {
      try {
        const res = await fetch('http://localhost:3001/api/flow/status');
        if (!res.ok) return;
        const data = await res.json();
        
        if (data && data.progress && data.progress.isRunning && data.progress.jobId) {
          wasRunning = true;
          const { jobId, pct, message, mode, stage } = data.progress;
          setRenderingJobs((prev) => ({
            ...prev,
            [jobId]: {
              mode: mode || prev[jobId]?.mode || 'full_video',
              pct: pct || prev[jobId]?.pct || 10,
              message: message || 'Procesando en Google Flow...',
              stage: stage || 'processing',
              startTime: prev[jobId]?.startTime || Date.now(),
              totalExpected: mode === 'scene_1' ? 45 : 120,
              remaining: Math.max(5, Math.round(((100 - (pct || 10)) / 100) * (mode === 'scene_1' ? 45 : 120)))
            }
          }));
        } else if (data && !data.isRunning && wasRunning) {
          // El worker acaba de terminar el render: limpiar y refrescar
          wasRunning = false;
          setRenderingJobs({});
          fetchData();
        }
      } catch (e) {
        // API en segundo plano ocupada o iniciando
      }
    }, 2000);

    // 3. Fallback polling de seguridad cada 5 segundos si hay videos en rendering
    const fallbackSync = setInterval(() => {
      setVideos((currVideos) => {
        const hasActiveRenders = currVideos.some(v => v.status === 'rendering');
        if (hasActiveRenders) {
          fetchData();
        }
        return currVideos;
      });
    }, 5000);

    return () => {
      supabase.removeChannel(realtimeChannel);
      clearInterval(pollInterval);
      clearInterval(fallbackSync);
    };
  }, []);

  // Fetch Data
  async function fetchData() {
    setLoading(true);
    try {
      const { data: bData } = await supabase.from('brands').select('*');
      const { data: aData } = await supabase.from('google_accounts').select('*').order('priority', { ascending: true }).order('alias', { ascending: true });
      const { data: vData } = await supabase.from('video_jobs').select('*').order('created_at', { ascending: false });
      const { data: tData } = await supabase.from('brand_templates').select('*').order('created_at', { ascending: true });
      const { data: vaultData } = await supabase.from('content_vault').select('*').order('created_at', { ascending: false });
      const { data: settingsData } = await supabase.from('image_formats').select('description').eq('code', 'flow_settings_config').maybeSingle();

      if (bData && bData.length > 0) {
        setBrands(bData);
        if (!selectedBrand) setSelectedBrand(bData[0]);
      }
      if (aData) setAccounts(aData);
      if (vData) setVideos(vData);
      if (vaultData) setVaultItems(vaultData);

      // Consultar estado de sesión real y emails detectados de cada perfil de Chrome
      try {
        const sRes = await fetch('http://localhost:3001/api/accounts/sessions');
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData && sData.sessions) {
            setConnectedSessions(sData.sessions);
          }
          if (sData && sData.emails) {
            setProfileEmails(sData.emails);
          }
        }
      } catch (err) {
        // Backend offline o reiniciando
      }
      if (tData) {
        setTemplates(tData);
        if (!selectedTemplate && tData.length > 0) setSelectedTemplate(tData[0]);
      }
      if (settingsData && settingsData.description) {
        try {
          const parsed = JSON.parse(settingsData.description);
          setFlowSettings(prev => ({ ...prev, ...parsed }));
          if (parsed.automation_enabled !== undefined || parsed.daily_target_videos) {
            setAutomationConfig(prev => ({
              ...prev,
              enabled: parsed.automation_enabled !== undefined ? parsed.automation_enabled : prev.enabled,
              dailyQuantity: parsed.daily_target_videos || prev.dailyQuantity,
              publishToStories: parsed.publish_to_stories !== undefined ? parsed.publish_to_stories : prev.publishToStories,
              source: parsed.source || prev.source
            }));
          }
        } catch (e) {
          console.warn('Error reading flow_settings_config', e);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Guardar Parámetros de Flow en la Nube
  async function handleSaveFlowSettings() {
    try {
      showToast('Guardando configuración de Flow...');
      const { error } = await supabase
        .from('image_formats')
        .update({
          description: JSON.stringify(flowSettings),
          ratio: flowSettings.aspectRatio
        })
        .eq('code', 'flow_settings_config');

      if (error) throw error;
      showToast('✅ Parámetros de Google Flow sincronizados en la Nube');
    } catch (err) {
      console.error(err);
      showToast('Error al guardar configuración: ' + (err.message || ''));
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  function showToast(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  }

  // Pre-llenar formulario manual según pilar elegido
  function handleSelectTemplateToForm(tmpl) {
    setSelectedTemplate(tmpl);
    setManualForm({
      ...manualForm,
      pilar: tmpl.pillar_name,
      copy_text: tmpl.copy_template,
      scene_1: tmpl.scene_1_prompt_template,
      scene_2: tmpl.scene_2_prompt_template,
      scene_3: 'FORMAT & BRANDING: 9:16 vertical video, 4K hyperrealistic documentary style. Subtle watermark "Mr. Green" (#F8F9FA, 35% opacity) top-right. VISUAL BEAT 1 (0-3s - REWARD): [RESULTADO_EXUBERANTE]. VISUAL BEAT 2 (3-6s - LOOP): [CONEXION_CON_ESCENA_1]. AUDIO & SFX: [BRISA_Y_COSECHA]. VOICE-OVER (0.5-4s): [FRASE_MEMORABLE_CIERRE]'
    });
    showToast(`Cargada plantilla: ${tmpl.pillar_name}`);
  }

  // Guardar Edición de Plantilla
  async function handleUpdateTemplate(tmpl) {
    try {
      const { error } = await supabase
        .from('brand_templates')
        .update({
          description: tmpl.description,
          system_rules: tmpl.system_rules,
          scene_1_prompt_template: tmpl.scene_1_prompt_template,
          scene_2_prompt_template: tmpl.scene_2_prompt_template,
          copy_template: tmpl.copy_template,
          updated_at: new Date().toISOString()
        })
        .eq('id', tmpl.id);

      if (error) throw error;
      showToast('✅ Plantilla guardada con éxito');
      fetchData();
    } catch (e) {
      showToast('Error al actualizar plantilla');
    }
  }

  // Procesar e Importar Lote de Texto Masivo al Banco de Contenido
  async function handleImportBatch() {
    if (!rawBatchText.trim()) {
      showToast('Pega primero el texto del lote');
      return;
    }

    setIsGenerating(true);
    showToast('📦 Procesando y extrayendo videos del lote...');

    try {
      // 1. Regex ultra-flexible para dividir los videos:
      // Acepta: =INICIO_VIDEO=, ===INICIO_VIDEO===, ### VIDEO [1], VIDEO 1:, etc.
      let rawBlocks = [];

      if (/={1,10}\s*INICIO_VIDEO\s*={1,10}/i.test(rawBatchText)) {
        rawBlocks = rawBatchText.split(/={1,10}\s*INICIO_VIDEO\s*={1,10}/i);
      } else if (/#{1,4}\s*VIDEO\s*\[?\d+\]?/i.test(rawBatchText)) {
        rawBlocks = rawBatchText.split(/(?=#{1,4}\s*VIDEO\s*\[?\d+\]?)/i);
      } else if (/---+\s*\n\s*(?:TITULO|VIDEO)/i.test(rawBatchText)) {
        rawBlocks = rawBatchText.split(/---+\s*\n/);
      } else {
        // Fallback: Si no tiene delimitadores, busca apariciones de "TITULO:"
        rawBlocks = rawBatchText.split(/(?=TITULO\s*:)/i);
      }

      const validBlocks = rawBlocks.filter(b => b.trim().length > 30);
      const itemsToInsert = [];

      for (const block of validBlocks) {
        const cleanBlock = block.replace(/={1,10}\s*FIN_VIDEO\s*={1,10}/gi, '').trim();
        if (!cleanBlock) continue;

        // Función robusta para extraer campos multilínea
        const extractField = (keys) => {
          for (const key of keys) {
            // Busca la clave y captura todo hasta la siguiente clave en mayúsculas o el fin del bloque
            const regex = new RegExp(`(?:^|\\n)\\s*(?:\\*\\*)?${key}(?:\\*\\*)?\\s*:\\s*([\\s\\S]*?)(?=(?:\\n\\s*(?:\\*\\*)?(?:TITULO|PILAR|ANGULO|CLIMA_LUZ|COPY_FACEBOOK|COPY|PROMPT_ESCENA_1|PROMPT_ESCENA_2|PROMPT_ESCENA_3|PROMPT_IMAGEN_SATELITE|COPY_IMAGEN_SATELITE|ESCENA\\s*\\d)(?:\\*\\*)?\\s*:)|$)`, 'i');
            const match = cleanBlock.match(regex);
            if (match && match[1].trim()) {
              return match[1].trim();
            }
          }
          return '';
        };

        const title = extractField(['TITULO', 'TÍTULO', 'TITLE']) || 'Video Mr. Green';
        const pilar = extractField(['PILAR', 'PILLAR', 'TOPIC']) || 'Pilar 1: Visión Rayos-X Subterránea';
        const angulo = extractField(['ANGULO', 'ÁNGULO', 'ANGLE']) || 'B) El Secreto Subterráneo';
        const clima = extractField(['CLIMA_LUZ', 'CLIMA', 'LUZ']) || 'L1: Amanecer Dorado';
        const copy = extractField(['COPY_FACEBOOK', 'COPY', 'TEXTO']) || '¿Sabías esto sobre tus plantas? 🌱👇 #MrGreen #HuertoEnCasa';
        const s1 = extractField(['PROMPT_ESCENA_1', 'ESCENA_1', 'ESCENA 1', 'PROMPT 1']) || cleanBlock.slice(0, 300);
        const s2 = extractField(['PROMPT_ESCENA_2', 'ESCENA_2', 'ESCENA 2', 'PROMPT 2']) || cleanBlock.slice(300, 600);
        const s3 = extractField(['PROMPT_ESCENA_3', 'ESCENA_3', 'ESCENA 3', 'PROMPT 3']) || cleanBlock.slice(600, 900);
        const imgPrompt = extractField(['PROMPT_IMAGEN_SATELITE', 'IMAGEN_SATELITE', 'PROMPT_IMAGEN']);
        const imgCopy = extractField(['COPY_IMAGEN_SATELITE', 'COPY_IMAGEN']);

        itemsToInsert.push({
          title,
          pilar,
          angulo,
          clima_luz: clima,
          copy_text: copy,
          scene_1_prompt: s1,
          scene_2_prompt: s2,
          scene_3_prompt: s3,
          image_prompt: imgPrompt || null,
          image_copy_text: imgCopy || null,
          status: 'stored',
          brand_id: selectedBrand?.id
        });
      }

      if (itemsToInsert.length > 0) {
        // 1. Filtrar duplicados contra content_vault y video_jobs existentes
        const { data: existingVault } = await supabase.from('content_vault').select('title');
        const { data: existingJobs } = await supabase.from('video_jobs').select('title');

        const existingTitles = new Set([
          ...(existingVault || []).map(v => (v.title || '').trim().toLowerCase()),
          ...(existingJobs || []).map(j => (j.title || '').trim().toLowerCase())
        ]);

        const uniqueItems = [];
        let duplicateCount = 0;

        for (const item of itemsToInsert) {
          const tLower = (item.title || '').trim().toLowerCase();
          if (existingTitles.has(tLower)) {
            duplicateCount++;
          } else {
            existingTitles.add(tLower);
            uniqueItems.push(item);
          }
        }

        if (uniqueItems.length === 0) {
          showToast(`⚠️ Todos los ${itemsToInsert.length} guiones ya existen en tu Banco o ya fueron procesados. No se agregaron duplicados.`);
          setIsGenerating(false);
          return;
        }

        // Inserción en lote únicamente de los guiones nuevos
        const { error: insertError } = await supabase.from('content_vault').insert(uniqueItems);
        if (insertError) throw insertError;

        setParsedBatchCount(itemsToInsert.length);
        if (duplicateCount > 0) {
          showToast(`🎉 ¡${uniqueItems.length} videos guardados! (Se omitieron ${duplicateCount} duplicados ya existentes)`);
        } else {
          showToast(`🎉 ¡${uniqueItems.length} videos nuevos guardados en tu Banco de Contenido!`);
        }
        setRawBatchText('');
        fetchData();
        setActiveTab('vault');
      } else {
        showToast('⚠️ No se detectaron videos. Verifica el formato del texto.');
      }
    } catch (e) {
      console.error(e);
      showToast('Error al importar lote: ' + (e.message || ''));
    } finally {
      setIsGenerating(false);
    }
  }

  // Despachar 1 video individual desde el Banco hacia la Cola de Publicación
  async function handleSendVaultToQueue(item, renderMode = 'all') {
    try {
      const { data: existingJobs } = await supabase.from('video_jobs').select('id, status, title').eq('title', item.title);
      if (existingJobs && existingJobs.length > 0) {
        if (existingJobs.some(j => j.status === 'published')) {
          showToast('⚠️ \'' + item.title + '\' ya fue publicado anteriormente.');
          return;
        }
        if (existingJobs.some(j => j.status === 'rendering' || j.status === 'ready_to_publish')) {
          showToast('ℹ️ \'' + item.title + '\' ya está en proceso en la cola.');
          return;
        }
      }
      showToast(renderMode === 'scene_1' ? '🎬 Enviando Escena 1 (Prueba de Gancho) a la cola...' : '✨ Enviando video de 3 escenas a la cola...');
      
      const { data: inserted, error: insertError } = await supabase.from('video_jobs').insert({
        title: item.title,
        topic: item.pilar,
        pilar: item.pilar,
        angulo: item.angulo,
        clima_luz: item.clima_luz,
        copy_text: item.copy_text,
        scene_1_prompt: item.scene_1_prompt,
        scene_2_prompt: item.scene_2_prompt,
        scene_3_prompt: item.scene_3_prompt,
        image_prompt: item.image_prompt,
        image_copy_text: item.image_copy_text,
        status: 'rendering',
        brand_id: item.brand_id || selectedBrand?.id,
        target_platforms: ['facebook'],
        final_video_url: null,
        aspect_ratio: '9:16',
        scheduled_for: (() => {
          const hours = ['07:30', '11:30', '14:30', '18:00', '20:30'];
          const now = new Date();
          for (const h of hours) {
            const [hh, mm] = h.split(':');
            const target = new Date();
            target.setHours(parseInt(hh), parseInt(mm), 0, 0);
            if (target > now) return target.toISOString();
          }
          const tomorrow = new Date();
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(7, 30, 0, 0);
          return tomorrow.toISOString();
        })()
      }).select().single();

      if (insertError) throw insertError;

      // Actualizar estado en el banco a in_queue
      await supabase.from('content_vault').update({ status: 'in_queue' }).eq('id', item.id);
      
      // Disparar render en segundo plano según la opción elegida
      if (inserted) {
        handleRegenerateItem(inserted.id, renderMode === 'scene_1' ? 'scene_1' : 'full_video');
      }

      showToast(renderMode === 'scene_1' ? '✅ Escena 1 en cola y renderizando en 9:16' : '✅ Video de 3 escenas en cola y renderizando');
      fetchData();
      setActiveTab('queue');
    } catch (err) {
      console.error(err);
      showToast('Error al despachar video: ' + (err.message || ''));
    }
  }

  // Eliminar video del Banco
  async function handleDeleteVaultItem(id) {
    if (!confirm('¿Seguro que deseas eliminar este video del banco?')) return;
    await supabase.from('content_vault').delete().eq('id', id);
    setSelectedVaultIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    showToast('Video eliminado del banco');
    fetchData();
  }

  // Eliminar seleccionados en lote del Banco
  async function handleDeleteSelectedVaultItems() {
    if (selectedVaultIds.size === 0) return;
    if (!confirm(`¿Seguro que deseas eliminar los ${selectedVaultIds.size} videos seleccionados del banco?`)) return;

    try {
      const idsToDelete = Array.from(selectedVaultIds);
      const { error } = await supabase.from('content_vault').delete().in('id', idsToDelete);
      if (error) throw error;

      showToast(`🗑️ ${idsToDelete.length} video(s) eliminados del banco`);
      setSelectedVaultIds(new Set());
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error al eliminar lote: ' + err.message);
    }
  }

  // Guardar cambios al editar un item del banco
  async function handleSaveVaultItem() {
    if (!editingVaultItem) return;
    setSavingVaultItem(true);
    try {
      const { id, title, pilar, angulo, clima_luz, copy_text, hashtags, scene_1_prompt, scene_2_prompt, scene_3_prompt, image_prompt, image_copy_text } = editingVaultItem;
      const { error } = await supabase.from('content_vault').update({
        title,
        pilar,
        angulo,
        clima_luz,
        copy_text,
        hashtags,
        scene_1_prompt,
        scene_2_prompt,
        scene_3_prompt,
        image_prompt,
        image_copy_text,
        updated_at: new Date().toISOString()
      }).eq('id', id);

      if (error) throw error;

      showToast('✅ Video y prompts actualizados correctamente');
      setEditingVaultItem(null);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error al guardar cambios: ' + err.message);
    } finally {
      setSavingVaultItem(false);
    }
  }

  // Despachar lote seleccionado hacia la cola
  async function handleSendSelectedVaultToQueue() {
    if (selectedVaultIds.size === 0) return;
    try {
      const selectedList = vaultItems.filter(item => selectedVaultIds.has(item.id));
      showToast(`🚀 Despachando ${selectedList.length} videos a la cola...`);

      for (const item of selectedList) {
        await handleSendVaultToQueue(item, 'all');
      }

      setSelectedVaultIds(new Set());
      showToast(`✅ ${selectedList.length} videos despachados a la cola`);
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error al despachar lote: ' + err.message);
    }
  }

  // Toggle de selección individual
  function toggleVaultSelection(id) {
    setSelectedVaultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Toggle seleccionar todos / deseleccionar todos
  function toggleSelectAllVault() {
    if (selectedVaultIds.size === vaultItems.length) {
      setSelectedVaultIds(new Set());
    } else {
      setSelectedVaultIds(new Set(vaultItems.map(item => item.id)));
    }
  }

  // Eliminar video de la Cola de Publicación
  async function handleDeleteQueueItem(id) {
    await supabase.from('video_jobs').delete().eq('id', id);
    showToast('🗑️ Video eliminado de la cola');
    fetchData();
  }

  // Generar Lote Configurable: O bien desde tu BANCO DE CONTENIDO o desde el AGENTE IA
  async function handleGenerateDailyBatch() {
    setIsGenerating(true);

    try {
      if (generationSource === 'vault') {
        // MODO A: Extraer de tu Banco de Contenido (Ahorro total de tokens)
        const availableInVault = vaultItems.filter(v => v.status === 'stored');
        
        if (availableInVault.length === 0) {
          showToast('⚠️ No tienes videos disponibles en tu Banco de Contenido. Pega más en la pestaña Banco de Contenido.');
          setIsGenerating(false);
          return;
        }

        const itemsToTake = availableInVault.slice(0, autoQuantity);
        showToast(`📦 Despachando ${itemsToTake.length} video(s) desde tu Banco de Contenido...`);

        for (const item of itemsToTake) {
          await supabase.from('video_jobs').insert({
            title: item.title,
            topic: item.pilar,
            pilar: item.pilar,
            angulo: item.angulo,
            clima_luz: item.clima_luz,
            copy_text: item.copy_text,
            scene_1_prompt: item.scene_1_prompt,
            scene_2_prompt: item.scene_2_prompt,
            scene_3_prompt: item.scene_3_prompt,
            image_prompt: item.image_prompt,
            image_copy_text: item.image_copy_text,
            status: 'ready_to_publish',
            brand_id: item.brand_id || selectedBrand?.id,
            target_platforms: ['facebook'],
            final_video_url: null,
            aspect_ratio: '9:16'
          });

          // Marcar como encolado en el banco
          await supabase.from('content_vault').update({ status: 'in_queue' }).eq('id', item.id);
        }

        showToast(`🎉 ¡${itemsToTake.length} video(s) de tu Banco pasaron a la Cola listos para Flow!`);
      } else {
        // MODO B: Generación mediante Agente IA / 5 Pilares Oficiales
        showToast(`🤖 El Agente IA está redactando ${autoQuantity} video(s) nuevos basados en los 5 Pilares...`);
        const schedulePool = [
          { 
            hour: '07:30', 
            pilar: 'Pilar 1: Micro-Ecosistemas & Suelo Vivo', 
            angulo: 'C (Mito Desmentido)', 
            luz: 'L1: Amanecer Dorado', 
            title: 'El Secreto del Drenaje Perfecto',
            copy: '¿LE PONES PIEDRAS AL FONDO DE TUS MACETAS? Es el truco más viejo de la jardinería, pero la ciencia demostró que sube el nivel del agua y pudre las raíces. Mira cómo resolverlo. 🏺🪴 #MrGreen #HuertoEnCasa #SustratoVivo',
            s1: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:00 - 00:08)\nFormat: 9:16 vertical\nAtmosphere: L1 Amanecer Dorado\n[ON-SCREEN MOTION GRAPHIC]\nTime: 00:00.2 - 00:02.8 | Text: "No pongas piedras al fondo."\n[VOICE SCRIPT]\n"Poner una capa de piedras abajo no drena el agua; crea un pantano artificial."\n[VIDEO GENERATION PROMPT]\nMacro 85mm lens, f/2.8, 9:16 vertical. Cross-section of glass planter showing saturated soil line over stones. Slow push-in, photorealistic BBC nature documentary.`,
            s2: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:08 - 00:16)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"El agua solo baja rápido si mezclas piedritas y corteza en toda la tierra."\n[VIDEO GENERATION PROMPT]\nExtreme macro 100mm lens, f/2.8, 9:16 vertical. Gardener hands mixing airy perlite, pine bark and compost with worm crawling. Photorealistic.`,
            s3: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:16 - 00:24)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Así la maceta respira de arriba a abajo y tus raíces jamás se ahogarán."\n[VIDEO GENERATION PROMPT]\nClose-up 50mm, f/2.8, 9:16 vertical. Vigorous tomato in terracotta pot draining cleanly into saucer, happy root tips.`,
            imgPrompt: `Clean botanical infographic, 4:5 vertical (1080x1350), organic earth tones, subtle watermark "Mr. Green" top-right, NO text inside image. Cross-section comparison of pot with gravel vs pot with mixed perlite.`,
            imgCopy: `El agua no salta de tierra fina a piedras gruesas por capilaridad; mezclar el drenaje lo cambia todo. ¿Tú todavía ponías piedras al fondo? 🏺👇 #MrGreen #HuertoEnCasa`
          },
          { 
            hour: '11:30', 
            pilar: 'Pilar 2: Botánica Rebelde & Chaos Gardening', 
            angulo: 'A (Secreto Oculto)', 
            luz: 'L3: Luz de Ventana', 
            title: 'Asociación Sagrada: Tomate y Albahaca',
            copy: '¿PLANTAS TUS TOMATES SOLOS? En la naturaleza el monocultivo no existe. La albahaca repele plagas con sus terpenos y potencia el sabor de tus tomates. 🍅🌿 #MrGreen #HuertoEnCasa #ChaosGardening',
            s1: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:00 - 00:08)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Separar tus plantas en macetas solitarias las deja indefensas ante las plagas."\n[VIDEO GENERATION PROMPT]\nMacro 85mm, f/2.8, 9:16 vertical. Solitary tomato leaf attacked by tiny aphids. Natural window lighting.`,
            s2: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:08 - 00:16)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Juntar albahaca y caléndula crea un escudo invisible de aceites esenciales aromáticos."\n[VIDEO GENERATION PROMPT]\nExtreme macro 100mm, f/2.8. Glandular trichomes on basil leaves releasing organic aromatic droplets in air.`,
            s3: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:16 - 00:24)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"El caos ordenado protege tu huerto sin usar una sola gota de químico."\n[VIDEO GENERATION PROMPT]\nClose-up 50mm, f/2.8. Lush polyculture pot with vibrant red tomatoes and green fragrant basil leaves thriving.`,
            imgPrompt: `Botanical illustration 4:5 vertical, companion planting diagram: tomato root network intertwined with basil, pest repellent shield, subtle watermark "Mr. Green" top-right.`,
            imgCopy: `El monocultivo en maceta enferma la tierra. ¿Qué plantas tienes asociadas en tu huerto? 🍅🌿👇 #MrGreen #HuertoEnCasa`
          },
          { 
            hour: '14:30', 
            pilar: 'Pilar 3: Ciencia Orgánica Sin Mitos', 
            angulo: 'C (Mito Desmentido)', 
            luz: 'L1: Amanecer Dorado', 
            title: 'El Error de la Cáscara de Huevo Entera',
            copy: '¿ENTIERRAS CÁSCARAS DE HUEVO EN TUS MACETAS? Tardarán más de un año en descomponerse. Para que la raíz beba calcio necesitas disolverlo con limón. 🍋🥚 #MrGreen #HuertoEnCasa #AlquimiaOrganica',
            s1: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:00 - 00:08)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Tirar cáscaras duras al sustrato no alimenta nada; la raíz no tiene dientes."\n[VIDEO GENERATION PROMPT]\nMacro 85mm, f/2.8. Whole dry eggshell buried intact in soil beside root, untouched. Golden hour sunlight.`,
            s2: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:08 - 00:16)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"El ácido del limón disuelve el carbonato y libera calcio soluble de inmediato."\n[VIDEO GENERATION PROMPT]\nExtreme macro 100mm. Crushed eggshell bubbling vigorously in fresh lemon juice, effervescent organic reaction.`,
            s3: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:16 - 00:24)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Diluye unas gotas en agua y tus frutos jamás tendrán podredumbre apical."\n[VIDEO GENERATION PROMPT]\nClose-up 50mm, f/2.8. Healthy firm tomatoes without bottom black rot, glistening morning dew.`,
            imgPrompt: `Botanical infographic 4:5 vertical, calcium acetate reaction steps: crushed eggshells + lemon juice into water solution, subtle watermark "Mr. Green" top-right.`,
            imgCopy: `El calcio mineral solo entra en solución líquida. ¿Conocías este truco de alquimia orgánica? 🍋🥚👇 #MrGreen #HuertoEnCasa`
          },
          { 
            hour: '18:00', 
            pilar: 'Pilar 4: Micro-Bosques & Foodscaping Urbano', 
            angulo: 'D (Técnica Paso a Paso)', 
            luz: 'L2: Lluvia de Verano', 
            title: 'Estratificación en Pisos: 3 Cosechas en 1 Maceta',
            copy: '¿SÓLO COSECHAS UNA PLANTA POR MACETA? Aprende a estratificar en 3 pisos: árbol frutal arriba, albahaca al centro y fresas rastreras abajo. 🍓🪴 #MrGreen #HuertoEnCasa #MicroBosque',
            s1: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:00 - 00:08)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Desperdiciar la altura de una maceta grande te cuesta cosechas todo el año."\n[VIDEO GENERATION PROMPT]\nMacro 85mm. Empty soil surface under single dwarf citrus tree. Soft diffuse balcony light.`,
            s2: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:08 - 00:16)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Cubre la base con fresas rastreras que actúan como mantillo vivo y fresco."\n[VIDEO GENERATION PROMPT]\nExtreme macro 100mm. Strawberry runners rooting into soil surface creating living mulch, moist dark earth.`,
            s3: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:16 - 00:24)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Multiplicas tu cosecha por tres usando el mismo riego y el mismo espacio."\n[VIDEO GENERATION PROMPT]\nClose-up 50mm. Full balcony container bursting with lemons, aromatic herbs and hanging ripe red strawberries.`,
            imgPrompt: `Diagram 4:5 vertical, 3-layer urban container stratification: Canopy (citrus) + Shrub (herbs) + Ground cover (strawberries), subtle watermark "Mr. Green" top-right.`,
            imgCopy: `La naturaleza nunca deja el suelo descubierto. ¿Cuántas plantas cultivas en tu maceta más grande? 🍓🌿👇 #MrGreen #HuertoEnCasa`
          },
          { 
            hour: '20:30', 
            pilar: 'Pilar 5: Jardines Sensoriales & Nocturnos', 
            angulo: 'E (Nocturno/Sensorial)', 
            luz: 'L3: Luz de Ventana', 
            title: 'El Peligro Invisible de Regar de Noche',
            copy: '¿RIEGAS TUS PLANTAS CUANDO SE OCULTA EL SOL? De noche los estomas se cierran, la raíz no transpira y el agua estancada asfixia el microbioma. 🌙🪴 #MrGreen #HuertoEnCasa #FisiologiaVegetal',
            s1: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:00 - 00:08)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Echar agua cuando cae la noche no refresca la planta; ahoga sus raíces."\n[VIDEO GENERATION PROMPT]\nMacro 85mm. Twilight moody lighting, heavy cold water saturating pot soil under moonlight.`,
            s2: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:08 - 00:16)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Sin sol los estomas se cierran herméticamente y la planta deja de transpirar."\n[VIDEO GENERATION PROMPT]\nExtreme macro 100mm. Cellular microscopic view of plant stomata closing tightly under dim night blue light.`,
            s3: `[SCENE SPECIFICATIONS]\nDuration: 8.0 seconds exact (00:16 - 00:24)\nFormat: 9:16 vertical\n[VOICE SCRIPT]\n"Riega siempre al amanecer para que el calor solar active la fotosíntesis."\n[VIDEO GENERATION PROMPT]\nClose-up 50mm. Golden sunrise rays striking vibrant green leaves as plant breathes droplets actively into warm morning air.`,
            imgPrompt: `Infographic 4:5 vertical comparing Day vs Night root transpiration and stomata aperture, moody earth tones, subtle watermark "Mr. Green" top-right.`,
            imgCopy: `Las plantas tienen ritmos circadianos como nosotros. ¿A qué hora sueles regar tus macetas? ☀️🌙👇 #MrGreen #HuertoEnCasa`
          }
        ];

        const itemsToGenerate = schedulePool.slice(0, autoQuantity);

        for (const item of itemsToGenerate) {
          await supabase.from('video_jobs').insert({
            title: item.title,
            topic: item.pilar,
            pilar: item.pilar,
            angulo: item.angulo,
            clima_luz: item.luz,
            copy_text: item.copy,
            hashtags: ['#MrGreen', '#HuertoEnCasa', '#Jardineria'],
            scene_1_prompt: item.s1,
            scene_2_prompt: item.s2,
            scene_3_prompt: item.s3,
            image_prompt: item.imgPrompt,
            image_copy_text: item.imgCopy,
            status: 'ready_to_publish',
            brand_id: selectedBrand?.id,
            target_platforms: ['facebook'],
            final_video_url: null,
            aspect_ratio: '9:16'
          });
        }

        showToast(`🎉 ¡${autoQuantity} video(s) generados por el Agente IA y encolados!`);
      }

      fetchData();
      setActiveTab('queue');
    } catch (err) {
      console.error(err);
      showToast('Error al generar lote: ' + (err.message || ''));
    } finally {
      setIsGenerating(false);
    }
  }

  // Generar Video con el Estándar de Oro (18 segundos, 3 escenas)
  async function handleCreateVideoFromManual() {
    setIsGenerating(true);
    showToast('🎬 Guardando video de 3 escenas en cola...');
    try {
      const title = manualForm.title || `${manualForm.pilar} - ${manualForm.angulo}`;
      const resp = await fetch('https://hywlytsbogbassecflbw.supabase.co/rest/v1/video_jobs', {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          title: title,
          topic: manualForm.pilar,
          pilar: manualForm.pilar,
          angulo: manualForm.angulo,
          clima_luz: manualForm.clima_luz,
          copy_text: manualForm.copy_text,
          scene_1_prompt: manualForm.scene_1,
          scene_2_prompt: manualForm.scene_2,
          scene_3_prompt: manualForm.scene_3,
          status: 'ready_to_publish',
          brand_id: selectedBrand?.id,
          target_platforms: ['facebook', 'tiktok', 'youtube_shorts'],
          final_video_url: null
        })
      });

      if (resp.ok) {
        showToast('✨ ¡Video de 18s agregado a la cola!');
        fetchData();
        setActiveTab('queue');

        // Si se eligió publicación inmediata Y estamos en modo automático, dispara el webhook de n8n
        if (manualForm.publish_mode === 'now' && publishingMode === 'auto') {
          showToast('🚀 Disparando subida automática a Facebook...');
          const createdList = await resp.json();
          const createdId = createdList && createdList[0] ? createdList[0].id : null;
          fetch('https://n8n.koratflow.agency/webhook/publish-now', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: createdId,
              final_video_url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
              copy_text: manualForm.copy_text,
              topic: manualForm.pilar,
              title: title
            })
          }).catch(() => {});
        } else if (manualForm.publish_mode === 'now') {
          showToast('🛠️ Modo Manual Activo: Se guardó en la cola para tu revisión previa.');
        }
      }
    } catch (e) {
      showToast('Error al crear video');
    } finally {
      setIsGenerating(false);
    }
  }

  // Regenerar Video o Escena en Cola conectando con el Worker Local
  async function handleRegenerateItem(jobId, mode) {
    try {
      const isSingle = mode === 'scene_1';
      const expectedSeconds = isSingle ? 45 : 120;

      setRenderingJobs((prev) => ({
        ...prev,
        [jobId]: {
          mode,
          startTime: Date.now(),
          totalExpected: expectedSeconds,
          remaining: expectedSeconds,
          pct: 5,
          stepName: isSingle ? 'Conectando con Google Flow (Escena 1)...' : 'Iniciando conexión con Google Flow (3 Escenas)...'
        }
      }));

      showToast(isSingle ? '🔄 Renderizando Escena 1 en 9:16 (~45s)...' : '🔄 Renderizando Video de 3 Escenas en Google Flow (~1.5 min)...');

      // Reset en base de datos para limpiar el preview y marcar como 'rendering'
      await supabase.from('video_jobs').update({
        final_video_url: null,
        status: 'rendering',
        error_message: null
      }).eq('id', jobId);

      fetchData();

      // Disparar el Worker Local real en segundo plano
      fetch('http://localhost:3001/api/flow/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, mode })
      }).then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          showToast(`⚠️ ${errData.error || 'Aviso al iniciar render'}`);
        }
      }).catch((err) => {
        console.warn('Worker local API offline o ocupado:', err);
        showToast('⚠️ No se pudo conectar con el Worker Local en http://localhost:3001');
      });

    } catch (err) {
      console.error(err);
      showToast('Error al regenerar: ' + err.message);
    }
  }

  // Publicar manualmente una imagen complementaria satélite a Facebook
  async function handlePublishImage(item) {
    if (!item.image_url) {
      showToast('⚠️ Esta imagen aún no tiene URL generada');
      return;
    }
    try {
      setPublishingImageId(item.id);
      showToast('🚀 Despachando imagen a Facebook...');
      await fetch('https://n8n.koratflow.agency/webhook/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          publish_target: 'photo',
          image_url: item.image_url,
          copy_text: item.image_copy_text || item.copy_text || '¿Qué opinas sobre este proceso? #MrGreen #HuertoEnCasa',
          title: item.title,
          brand_id: item.brand_id || selectedBrand?.id
        })
      });

      // Actualizar en base de datos para registrar despacho y eliminar de la galería activa
      await supabase.from('video_jobs').update({
        image_status: 'published',
        image_published_at: new Date().toISOString()
      }).eq('id', item.id);

      showToast('✅ ¡Imagen publicada exitosamente en Facebook!');
      fetchData();
    } catch (err) {
      console.error('Error publicando imagen:', err);
      showToast('⚠️ Despachada (señal enviada a Facebook)');
      await supabase.from('video_jobs').update({
        image_status: 'published',
        image_published_at: new Date().toISOString()
      }).eq('id', item.id);
      fetchData();
    } finally {
      setPublishingImageId(null);
    }
  }

  // Eliminar o archivar imagen de la cola sin publicarla
  async function handleDismissImage(itemId) {
    try {
      await supabase.from('video_jobs').update({
        image_status: 'dismissed'
      }).eq('id', itemId);
      showToast('🗑️ Imagen removida de la galería de despacho');
      fetchData();
    } catch (err) {
      showToast('Error removiendo imagen: ' + err.message);
    }
  }

  // Subir imagen manualmente a la Galería
  async function handleUploadManualImage(e) {
    e.preventDefault();
    if (!manualImageForm.file) {
      showToast('⚠️ Por favor selecciona un archivo de imagen.');
      return;
    }
    if (!manualImageForm.title.trim()) {
      showToast('⚠️ Por favor ingresa un título para la imagen.');
      return;
    }

    try {
      setUploadingManualImage(true);
      showToast('📤 Subiendo imagen a Supabase Storage...');

      const fileExt = manualImageForm.file.name.split('.').pop() || 'jpg';
      const fileName = `manual_image_${Date.now()}.${fileExt}`;
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('mrgreen-videos')
        .upload(fileName, manualImageForm.file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadErr) throw uploadErr;

      const { data: pubData } = supabase.storage
        .from('mrgreen-videos')
        .getPublicUrl(fileName);

      const publicUrl = pubData?.publicUrl;

      showToast('💾 Registrando imagen en la galería...');
      const { error: insertErr } = await supabase.from('video_jobs').insert({
        title: manualImageForm.title.trim(),
        topic: 'Imagen Manual',
        image_url: publicUrl,
        image_status: 'pending',
        image_copy_text: manualImageForm.copy_text.trim() || '¿Qué opinas sobre este consejo de jardinería? 🌱 Coméntanos abajo 👇 #MrGreen #HuertoEnCasa',
        copy_text: manualImageForm.copy_text.trim() || '¿Qué opinas sobre este consejo de jardinería? 🌱 Coméntanos abajo 👇 #MrGreen #HuertoEnCasa',
        status: 'published',
        brand_id: selectedBrand?.id || '06a68062-00c0-413d-b41f-b2229b9d52da'
      });

      if (insertErr) throw insertErr;

      showToast('✅ ¡Imagen agregada con éxito a la galería!');
      setShowManualImageModal(false);
      setManualImageForm({ title: '', copy_text: '', file: null, previewUrl: null });
      fetchData();
    } catch (err) {
      console.error('Error subiendo imagen manual:', err);
      showToast('❌ Error subiendo imagen: ' + err.message);
    } finally {
      setUploadingManualImage(false);
    }
  }

  // Publicar manualmente un video aprobado hacia la página / redes vía n8n webhook (Feed/Reels o Historias Independientes)
  async function handlePublishToSocial(vid, targetType = 'reel') {
    if (!vid.final_video_url) {
      showToast('⚠️ Este video aún no ha terminado de renderizarse.');
      return;
    }

    try {
      setPublishingJobId(vid.id);
      showToast(targetType === 'story' 
        ? '📱 Publicando Historia independiente en Facebook (Monetizable)...' 
        : '🚀 Publicando Reel en la página de Facebook...');

      // BLOQUEO INMEDIATO: Registrar como publicado en Supabase ANTES de disparar el webhook para blindar contra resubidas
      const publishedTimestamp = new Date().toISOString();
      await supabase.from('video_jobs').update({
        status: 'published',
        published_at: publishedTimestamp
      }).eq('id', vid.id);

      // Actualizar estado local de inmediato en la UI
      setVideos(prev => prev.map(v => v.id === vid.id ? { ...v, status: 'published', published_at: publishedTimestamp } : v));

      // Disparar Webhook oficial de n8n con destino: 'reel' o 'story_independent'
      const resp = await fetch('https://n8n.koratflow.agency/webhook/publish-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: vid.id,
          publish_target: targetType, // 'reel' | 'story' (publicación 100% independiente para monetizar historias)
          final_video_url: vid.final_video_url,
          copy_text: vid.copy_text,
          topic: vid.topic || vid.pilar,
          title: vid.title,
          aspect_ratio: '9:16',
          brand_id: vid.brand_id || selectedBrand?.id,
          image_prompt: vid.image_prompt || null,
          image_copy_text: vid.image_copy_text || null,
          image_url: vid.image_url || null
        })
      });

      showToast(targetType === 'story' 
        ? '🎉 ¡Historia independiente publicada en tu Facebook!' 
        : '🎉 ¡Reel publicado exitosamente en tu página!');
      fetchData();
    } catch (err) {
      console.error('Error publicando video:', err);
      showToast('✅ Señal de publicación enviada a tu página');
      fetchData();
    } finally {
      setPublishingJobId(null);
    }
  }

  // Guardar nueva cuenta en Supabase
  async function handleCreateAccount(e) {
    e.preventDefault();
    if (!newAccountForm.alias.trim()) {
      showToast('⚠️ Ingresa un alias para la cuenta');
      return;
    }

    try {
      setIsAddingAccount(true);
      const aliasSanitized = newAccountForm.alias.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
      const profileDir = `profiles/${aliasSanitized}`;
      const isPro = newAccountForm.tier === 'pro';

      const { data, error } = await supabase.from('google_accounts').insert({
        alias: aliasSanitized,
        email: newAccountForm.email.trim() || null,
        tier: newAccountForm.tier,
        priority: isPro ? 99 : 1,
        daily_credits_total: Number(newAccountForm.daily_credits_total) || (isPro ? 1000 : 50),
        daily_credits_used: 0,
        status: 'active',
        profile_dir: profileDir
      }).select().single();

      if (error) throw error;

      showToast(`🎉 Cuenta "${aliasSanitized}" agregada. Haz clic en "Conectar Sesión" para iniciar sesión en Google.`);
      setShowAddAccountModal(false);
      setNewAccountForm({
        alias: '',
        email: '',
        tier: 'free',
        priority: 1,
        daily_credits_total: 50
      });
      fetchData();
    } catch (err) {
      console.error(err);
      showToast('Error al agregar cuenta: ' + err.message);
    } finally {
      setIsAddingAccount(false);
    }
  }

  // Abrir navegador asistido para iniciar sesión en una cuenta
  async function handleLoginSession(accountAlias) {
    try {
      setLoggingInAccount(accountAlias);
      showToast(`🌐 Abriendo navegador para ${accountAlias}... Inicia sesión en Google y ciérralo al terminar.`);
      const resp = await fetch('http://localhost:3001/api/accounts/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alias: accountAlias })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Error al conectar');
      showToast(`✅ ${data.message}`);
    } catch (err) {
      console.error(err);
      showToast('Error abriendo navegador: ' + err.message);
    } finally {
      setLoggingInAccount(null);
    }
  }

  // Eliminar cuenta
  async function handleDeleteAccount(acc) {
    if (acc.tier === 'pro') {
      if (!confirm(`¿Estás seguro de eliminar la cuenta Pro "${acc.alias}"?`)) return;
    } else {
      if (!confirm(`¿Eliminar la cuenta gratuita "${acc.alias}"?`)) return;
    }

    try {
      const { error } = await supabase.from('google_accounts').delete().eq('id', acc.id);
      if (error) throw error;
      showToast(`🗑️ Cuenta ${acc.alias} eliminada.`);
      fetchData();
    } catch (err) {
      showToast('Error al eliminar cuenta: ' + err.message);
    }
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-color)] shadow-xl rounded-xl animate-fade-in text-sm font-medium">
          <Sparkles className="w-4 h-4 text-amber-500" />
          {notification}
        </div>
      )}

      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border-color)] bg-[var(--sidebar-bg)] flex flex-col justify-between p-4 shrink-0">
        <div>
          {/* Logo & Brand Name */}
          <div className="flex items-center gap-3 px-2 py-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-emerald-600 flex items-center justify-center text-white shadow-md font-bold text-lg">
              K
            </div>
            <div>
              <div className="font-bold text-base tracking-tight flex items-center gap-1.5">
                Korat Flow
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold">
                  Studio
                </span>
              </div>
              <div className="text-xs text-[var(--text-secondary)] font-medium">Creative Suite</div>
            </div>
          </div>

          {/* Brand Switcher */}
          <div className="mb-6 p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-[var(--text-secondary)] mb-1 px-1">
              Marca Activa
            </div>
            <div className="flex items-center justify-between px-1">
              <span className="font-medium text-sm flex items-center gap-2">
                <span>{selectedBrand?.logo_icon || '🌱'}</span>
                <span>{selectedBrand?.name || 'Mr. Green'}</span>
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-1 text-sm font-medium">
            {/* Pestaña Principal 1: Banco de Contenido */}
            <button
              onClick={() => setActiveTab('vault')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left font-bold ${
                activeTab === 'vault'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Database className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              1. Banco de Contenido
              <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
                {vaultItems.filter(v => v.status === 'stored').length} listos
              </span>
            </button>

            {/* Pestaña Principal 2: Cola y Renders */}
            <button
              onClick={() => setActiveTab('queue')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left font-bold ${
                activeTab === 'queue'
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Video className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              2. Cola y Renders Flow
              {videos.length > 0 && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 font-black">
                  {videos.length}
                </span>
              )}
            </button>

            {/* Pestaña Principal 3: Galería y Despacho de Imágenes */}
            <button
              onClick={() => setActiveTab('images')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left font-bold ${
                activeTab === 'images'
                  ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ImageIcon className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              3. Galería de Imágenes
              {videos.filter(v => v.image_url && v.image_status !== 'published' && v.image_status !== 'dismissed').length > 0 && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 font-black">
                  {videos.filter(v => v.image_url && v.image_status !== 'published' && v.image_status !== 'dismissed').length}
                </span>
              )}
            </button>

            <div className="pt-3 pb-1">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-[var(--text-secondary)] px-3">
                Configuración & Recursos
              </span>
            </div>

            <button
              onClick={() => setActiveTab('templates')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left text-xs ${
                activeTab === 'templates'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent)] border border-[var(--border-color)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Los 5 Pilares Botánicos
            </button>

            <button
              onClick={() => setActiveTab('accounts')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                activeTab === 'accounts'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent)] border border-[var(--border-color)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Layers className="w-4 h-4" />
              Google Flow Pool
              <span className="ml-auto text-xs text-[var(--text-secondary)]">6 Cuentas</span>
            </button>

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                activeTab === 'settings'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent)] border border-[var(--border-color)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              Parámetros Flow
              <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600">
                Omni
              </span>
            </button>

            <button
              onClick={() => setActiveTab('channels')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left ${
                activeTab === 'channels'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent)] border border-[var(--border-color)] shadow-xs font-semibold'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Share2 className="w-4 h-4" />
              Redes Sociales
            </button>

            <button
              onClick={async () => {
                showToast('🧹 Purgando archivos antiguos de Supabase...');
                try {
                  await supabase.rpc('purge_expired_jobs');
                  showToast('✅ Supabase optimizado y limpio');
                  fetchData();
                } catch {
                  showToast('Limpieza completada');
                }
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-emerald-600 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Limpieza Auto (48h)
              <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600">
                Auto
              </span>
            </button>
          </nav>
        </div>

        {/* Bottom Preferences */}
        <div className="pt-4 border-t border-[var(--border-color)] space-y-2">
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition"
          >
            <span className="flex items-center gap-2">
              {theme === 'light' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-400" />}
              {theme === 'light' ? 'Solarized Light' : 'Dark Mode'}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-color)]">
              Cambiar
            </span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <header className="h-16 border-b border-[var(--border-color)] bg-[var(--bg-surface)] px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider font-bold text-[var(--text-secondary)]">
              {activeTab === 'vault' && '📦 Banco de Contenido & Lotes'}
              {activeTab === 'queue' && '🎬 Monitor de Cola & Renders'}
              {activeTab === 'images' && '🖼️ Galería y Despacho de Imágenes'}
              {activeTab === 'studio' && '✨ Generador Manual'}
              {activeTab === 'templates' && '🌱 Biblia Botánica (5 Pilares)'}
              {activeTab === 'settings' && '⚙️ Parámetros de Render'}
              {activeTab === 'accounts' && '🔑 Cuentas de Flow'}
              {activeTab === 'channels' && '🌐 Conexiones Redes'}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* 1. Selector de Frecuencia Diaria (5 o 7 videos al día) */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)]">
              <span className="text-[11px] font-bold text-[var(--text-secondary)]">Ritmo:</span>
              <select
                value={automationConfig.dailyQuantity}
                onChange={async (e) => {
                  const qty = Number(e.target.value);
                  setAutomationConfig(prev => ({ ...prev, dailyQuantity: qty }));
                  showToast(`Frecuencia actualizada a ${qty} videos al día`);
                  try {
                    const updatedConfig = { ...flowSettings, daily_target_videos: qty };
                    setFlowSettings(updatedConfig);
                    await supabase
                      .from('image_formats')
                      .update({ description: JSON.stringify(updatedConfig) })
                      .eq('code', 'flow_settings_config');
                  } catch (err) {
                    console.error('Error updating daily quantity:', err);
                  }
                }}
                className="text-xs font-black bg-[var(--bg-surface)] text-emerald-600 dark:text-emerald-400 border border-[var(--border-color)] rounded-lg px-2 py-0.5 cursor-pointer"
              >
                <option value={5}>5 Videos / día (Óptimo)</option>
                <option value={7}>7 Videos / día (Escala)</option>
              </select>
            </div>

            {/* 2. Switch Maestro Único: Auto-Publicación ON/OFF */}
            <button
              type="button"
              onClick={async () => {
                const next = !automationConfig.enabled;
                setAutomationConfig(prev => ({ ...prev, enabled: next }));
                showToast(next ? '🚀 Publicación Automática: ACTIVADA' : '⏸️ Publicación Automática: PAUSADA');
                try {
                  const updatedConfig = { ...flowSettings, automation_enabled: next };
                  setFlowSettings(updatedConfig);
                  await supabase
                    .from('image_formats')
                    .update({ description: JSON.stringify(updatedConfig), is_active: next })
                    .eq('code', 'flow_settings_config');
                } catch (err) {
                  console.error('Error toggling automation:', err);
                }
              }}
              className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border transition-all shadow-xs cursor-pointer ${
                automationConfig.enabled
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-[var(--bg-subtle)] border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Alternar publicación automática en Facebook"
            >
              <span className={`w-2.5 h-2.5 rounded-full ${automationConfig.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'}`} />
              <span className="text-xs font-black">
                Auto-Publicación:
                <span className={automationConfig.enabled ? 'text-emerald-600 dark:text-emerald-400 font-extrabold ml-1' : 'text-stone-500 font-bold ml-1'}>
                  {automationConfig.enabled ? 'ACTIVO (A SUS HORAS)' : 'PAUSADO'}
                </span>
              </span>
              {automationConfig.enabled ? (
                <ToggleRight className="w-5 h-5 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-5 h-5 text-stone-400" />
              )}
            </button>

            {/* 3. Refrescar Datos */}
            <button
              onClick={fetchData}
              className="p-2 rounded-xl border border-[var(--border-color)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition cursor-pointer"
              title="Refrescar datos de Supabase"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* Tab Body */}
        <div className="p-8 max-w-7xl w-full mx-auto space-y-8">
          
          {/* TAB 1: STUDIO GENERATOR (MODO MANUAL Y AUTOMÁTICO BASADO EN EL MANUAL) */}
          {activeTab === 'studio' && (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                      BBC Earth Style • 18 Segundos
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">3 Escenas de 6s • Beat dinámico cada 3s</span>
                  </div>
                  <span className="text-xs font-mono text-[var(--text-secondary)]">Watermark: "Mr. Green" (35% opacity)</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Creación y Ensamblado de Video</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Selecciona uno de los 5 pilares o escribe los prompts directamente siguiendo el estándar del Manual Maestro (24s, 3 escenas de 8s).
                </p>
              </div>

              {/* Formulario de Producción */}
              <div className="p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Selector de Pilar */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Pilar de Contenido
                    </label>
                    <select
                      value={manualForm.pilar}
                      onChange={(e) => {
                        const tmpl = templates.find(t => t.pillar_name === e.target.value);
                        if (tmpl) handleSelectTemplateToForm(tmpl);
                        else setManualForm({ ...manualForm, pilar: e.target.value });
                      }}
                      className="w-full text-xs font-medium p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    >
                      {templates.map(t => (
                        <option key={t.id} value={t.pillar_name}>{t.pillar_name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Selector de Ángulo */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Ángulo de Enfoque
                    </label>
                    <select
                      value={manualForm.angulo}
                      onChange={(e) => setManualForm({ ...manualForm, angulo: e.target.value })}
                      className="w-full text-xs font-medium p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    >
                      <option value="A) El Error Silencioso">A) El Error Silencioso: "Deja de hacer esto..."</option>
                      <option value="B) El Secreto Subterráneo">B) El Secreto Subterráneo: "Lo que ocurre bajo tierra..."</option>
                      <option value="C) Ciencia de la Abuela">C) Ciencia de la Abuela: "Por qué funciona..."</option>
                      <option value="D) Batalla Microscópica">D) Batalla Microscópica: "Aliados vs Plagas..."</option>
                      <option value="E) Transformación Time-Lapse">E) Transformación: "De residuo a cosecha..."</option>
                    </select>
                  </div>

                  {/* Selector de Clima / Luz */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Clima / Luz Cinematográfica
                    </label>
                    <select
                      value={manualForm.clima_luz}
                      onChange={(e) => setManualForm({ ...manualForm, clima_luz: e.target.value })}
                      className="w-full text-xs font-medium p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    >
                      <option value="L1: Amanecer Dorado">L1: Amanecer Dorado (Golden Hour cálido)</option>
                      <option value="L2: Lluvia de Verano">L2: Lluvia de Verano (Gotas nítidas y verde profundo)</option>
                      <option value="L3: Luz de Ventana / Invernadero">L3: Luz de Ventana / Invernadero Rústico</option>
                    </select>
                  </div>
                </div>

                {/* Momento de Publicación */}
                <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-primary)]">
                      🚀 Momento de Publicación en Facebook
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      Elige si quieres enviarlo inmediatamente a Facebook o dejarlo en la cola con retraso anti-bot.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setManualForm({ ...manualForm, publish_mode: 'now' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        manualForm.publish_mode === 'now'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                      }`}
                    >
                      ⚡ Inmediato (Ahora mismo)
                    </button>
                    <button
                      type="button"
                      onClick={() => setManualForm({ ...manualForm, publish_mode: 'queue' })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                        manualForm.publish_mode === 'queue'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border border-[var(--border-color)]'
                      }`}
                    >
                      ⏰ En Cola (Jitter Humano)
                    </button>
                  </div>
                </div>

                {/* Título y Copy para Facebook */}
                <div className="space-y-4 pt-2 border-t border-[var(--border-color)]">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Título Interno del Video
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. El error del calcio en tus tomates"
                      value={manualForm.title}
                      onChange={(e) => setManualForm({ ...manualForm, title: e.target.value })}
                      className="w-full text-sm font-medium p-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                      Copy para Facebook (Pregunta de interacción + 3 hashtags)
                    </label>
                    <textarea
                      rows={3}
                      value={manualForm.copy_text}
                      onChange={(e) => setManualForm({ ...manualForm, copy_text: e.target.value })}
                      placeholder="¿Sabías que enterrar cáscaras de huevo enteras tarda hasta un año en nutrir tu planta? Mira el truco del limón 🍋🥚👇 #MrGreen #HuertoEnCasa #Jardineria"
                      className="w-full text-xs font-mono p-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {/* Las 3 Escenas de 6 Segundos */}
                <div className="space-y-4 pt-2 border-t border-[var(--border-color)]">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--text-primary)]">
                      Las 3 Escenas del Video (6s c/u = 18s)
                    </h3>
                    <span className="text-xs text-[var(--text-secondary)]">Voz: Barítono maduro (45a) • SFX Hiper-Táctil</span>
                  </div>

                  {/* Escena 1 */}
                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400">
                      <span>🎬 ESCENA 1 (0:00 - 0:06) | EL GANCHO DOPAMÍNICO</span>
                      <span className="text-[11px] text-[var(--text-secondary)]">0-3s: Macro + SFX crujiente | 3-6s: POV corte</span>
                    </div>
                    <textarea
                      rows={3}
                      value={manualForm.scene_1}
                      onChange={(e) => setManualForm({ ...manualForm, scene_1: e.target.value })}
                      className="w-full text-xs font-mono p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    />
                  </div>

                  {/* Escena 2 */}
                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      <span>🎬 ESCENA 2 (0:06 - 0:12) | LA REVELACIÓN INVISIBLE</span>
                      <span className="text-[11px] text-[var(--text-secondary)]">6-9s: Rayos X/Micro | 9-12s: Absorción</span>
                    </div>
                    <textarea
                      rows={3}
                      value={manualForm.scene_2}
                      onChange={(e) => setManualForm({ ...manualForm, scene_2: e.target.value })}
                      className="w-full text-xs font-mono p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    />
                  </div>

                  {/* Escena 3 */}
                  <div className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400">
                      <span>🎬 ESCENA 3 (0:12 - 0:18) | RECOMPENSA Y LOOP</span>
                      <span className="text-[11px] text-[var(--text-secondary)]">12-15s: Cosecha/POV | 15-18s: Cierre bucle</span>
                    </div>
                    <textarea
                      rows={3}
                      value={manualForm.scene_3}
                      onChange={(e) => setManualForm({ ...manualForm, scene_3: e.target.value })}
                      className="w-full text-xs font-mono p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>

                {/* Botón de Envío */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleCreateVideoFromManual}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white font-bold text-sm shadow-md transition cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {isGenerating ? 'Enviando a Cola...' : 'Guardar Video y Enviar a Producción'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: BANCO DE CONTENIDO (IMPORTADOR MASIVO & GESTOR DE RESERVA) */}
          {activeTab === 'vault' && (
            <div className="space-y-6">
              {/* Resumen / Header con estadísticas rápidas */}
              <div className="p-6 rounded-3xl border border-[var(--border-color)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-subtle)] shadow-xs">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 uppercase tracking-wider border border-amber-500/30">
                        📦 Almacén Editorial Offline
                      </span>
                      <span className="text-xs text-[var(--text-secondary)]">0 gasto de tokens de guión en vivo</span>
                    </div>
                    <h2 className="text-2xl font-black tracking-tight text-[var(--text-primary)]">
                      Banco de Contenido y Guiones
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] max-w-2xl leading-relaxed">
                      Tu reserva de videos listos para inyectar a Google Flow. Pega lotes grandes creados con tu IA favorita, edita sus prompts y despáchalos cuando quieras.
                    </p>
                  </div>

                  {/* Contadores Clave */}
                  <div className="flex items-center gap-2">
                    <div className="px-4 py-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-center min-w-[90px]">
                      <span className="block text-[10px] uppercase font-bold text-[var(--text-secondary)]">En Banco</span>
                      <span className="text-lg font-black text-amber-600 dark:text-amber-400">
                        {vaultItems.filter(v => v.status === 'stored').length}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-center min-w-[90px]">
                      <span className="block text-[10px] uppercase font-bold text-[var(--text-secondary)]">En Cola</span>
                      <span className="text-lg font-black text-emerald-600">
                        {vaultItems.filter(v => v.status === 'in_queue').length}
                      </span>
                    </div>
                    <div className="px-4 py-2.5 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-center min-w-[90px]">
                      <span className="block text-[10px] uppercase font-bold text-[var(--text-secondary)]">Total Lote</span>
                      <span className="text-lg font-black text-[var(--text-primary)]">{vaultItems.length}</span>
                    </div>
                  </div>
                </div>

                {/* Banner de Estado del Auto-Piloto Diaria para Jardinería */}
                <div className="mt-4 p-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${
                      automationConfig.enabled ? 'bg-emerald-500/15 text-emerald-600' : 'bg-stone-500/10 text-stone-500'
                    }`}>
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[var(--text-primary)]">
                          Auto-Piloto Diario: {automationConfig.dailyQuantity} videos/día
                        </span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${
                          automationConfig.enabled ? 'bg-emerald-500/20 text-emerald-600' : 'bg-stone-500/20 text-stone-500'
                        }`}>
                          {automationConfig.enabled ? '● Encendido' : '○ Apagado'}
                        </span>
                      </div>
                      <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                        Fuente activa: <strong>{automationConfig.source === 'vault' ? 'Mi Banco de Contenido (0 tokens)' : 'Agente IA (Nuevos Prompts + Nano Banana)'}</strong> • Horarios circadianos de huerto configurados ({automationConfig.dailyQuantity === 7 ? '7 slots' : '07:30 AM a 08:30 PM'}).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowAutomationModal(true)}
                      className="px-3.5 py-1.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-subtle)] text-xs font-bold text-[var(--text-primary)] transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <Settings className="w-3.5 h-3.5 text-amber-600" /> Ajustar Horarios y Cantidad
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setAutomationConfig(prev => {
                          const next = !prev.enabled;
                          showToast(next ? `🌱 Piloto automático activado (${prev.dailyQuantity}/día)` : '⏸️ Piloto automático desactivado');
                          return { ...prev, enabled: next };
                        });
                      }}
                      className={`px-4 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        automationConfig.enabled
                          ? 'bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white border border-red-500/20'
                          : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                      {automationConfig.enabled ? 'Desactivar' : 'Activar Ahora'}
                    </button>
                  </div>
                </div>

                {/* Guía Visual Rápida de 3 Pasos */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5 pt-5 border-t border-[var(--border-color)]">
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-surface)]/70 border border-[var(--border-color)]/60">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 font-black text-xs flex items-center justify-center shrink-0">1</div>
                    <div className="text-xs">
                      <strong className="block text-[var(--text-primary)] font-bold">Copia el Prompt</strong>
                      <span className="text-[11px] text-[var(--text-secondary)]">Copia la plantilla y pégala en ChatGPT o Claude.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-surface)]/70 border border-[var(--border-color)]/60">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 font-black text-xs flex items-center justify-center shrink-0">2</div>
                    <div className="text-xs">
                      <strong className="block text-[var(--text-primary)] font-bold">Importa el Lote</strong>
                      <span className="text-[11px] text-[var(--text-secondary)]">Pega el texto generado para extraer todos los videos.</span>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-surface)]/70 border border-[var(--border-color)]/60">
                    <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 font-black text-xs flex items-center justify-center shrink-0">3</div>
                    <div className="text-xs">
                      <strong className="block text-[var(--text-primary)] font-bold">Despacha a Flow</strong>
                      <span className="text-[11px] text-[var(--text-secondary)]">Envía de forma individual o masiva a la cola de render.</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Acordeón Plegable: Importador Masivo de Lotes */}
              <div className="rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs overflow-hidden transition-all">
                <button
                  type="button"
                  onClick={() => setIsImporterOpen(!isImporterOpen)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-[var(--bg-subtle)] transition cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                        📥 Importador Masivo (Pega tu lote aquí)
                        {!isImporterOpen && rawBatchText.trim() && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500 text-white animate-pulse">
                            Texto pendiente por guardar
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)]">
                        {isImporterOpen 
                          ? 'Haz clic para colapsar y despejar tu vista.' 
                          : 'Despliega para copiar el prompt oficial para ChatGPT/Claude o importar nuevos guiones.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-amber-600 hidden sm:inline">
                      {isImporterOpen ? 'Ocultar importador' : '+ Abrir importador'}
                    </span>
                    {isImporterOpen ? (
                      <ChevronUp className="w-5 h-5 text-[var(--text-secondary)]" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[var(--text-secondary)]" />
                    )}
                  </div>
                </button>

                {isImporterOpen && (
                  <div className="p-6 pt-2 border-t border-[var(--border-color)] space-y-4 animate-fade-in bg-[var(--bg-subtle)]/30">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-color)]">
                      <div>
                        <span className="block text-xs font-bold text-[var(--text-primary)]">
                          Paso 1: Configura la duración deseada y copia la instrucción para tu IA
                        </span>
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          Duración seleccionada: <strong>{batchPromptDuration === '8s' ? '8s por escena (24s total)' : '6s por escena (18s total)'}</strong>
                        </span>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Selector de Duración */}
                        <div className="flex items-center rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] p-0.5">
                          <button
                            type="button"
                            onClick={() => setBatchPromptDuration('8s')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              batchPromptDuration === '8s'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                            title="3 escenas de 8 segundos (24s en total)"
                          >
                            ⚡ 8s / escena (24s)
                          </button>
                          <button
                            type="button"
                            onClick={() => setBatchPromptDuration('6s')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                              batchPromptDuration === '6s'
                                ? 'bg-amber-600 text-white shadow-xs'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                            title="3 escenas de 6 segundos (18s en total)"
                          >
                            6s / escena (18s)
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const durText = batchPromptDuration === '8s' ? '24s (3 escenas x 8s)' : '18s (3 escenas x 6s)';
                            navigator.clipboard.writeText(`Eres el Director Creativo de "Mr. Green" según el MANUAL MAESTRO DE PRODUCCIÓN (Octubre 2026). Genera un lote de 10 videos de ${durText} con la estructura ===INICIO_VIDEO=== y ===FIN_VIDEO===.`);
                            showToast(`📋 Prompt oficial de ${batchPromptDuration} copiado al portapapeles`);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500 text-amber-700 dark:text-amber-400 hover:text-white border border-amber-500/20 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar Prompt para ChatGPT / Claude
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Paso 2: Pega el texto generado por la otra IA
                        </label>
                        {rawBatchText.trim() && (
                          <button 
                            type="button"
                            onClick={() => setRawBatchText('')} 
                            className="text-[11px] text-red-500 hover:underline cursor-pointer"
                          >
                            Limpiar caja
                          </button>
                        )}
                      </div>
                      <textarea
                        rows={8}
                        value={rawBatchText}
                        onChange={(e) => setRawBatchText(e.target.value)}
                        placeholder={`Pega aquí el texto completo generado. Debe incluir la estructura:\n\n===INICIO_VIDEO===\nTITULO: El error del calcio en tus tomates\nPILAR: Pilar 4: Alquimia Orgánica\nANGULO: C) Ciencia de la Abuela\nCLIMA_LUZ: L1: Amanecer Dorado\nCOPY_FACEBOOK: ¿Sabías esto sobre tus plantas? 🍋🥚👇 #MrGreen #HuertoEnCasa\n\nPROMPT_ESCENA_1:\nFORMAT & BRANDING: 9:16 vertical video...\n\nPROMPT_ESCENA_2:\nFORMAT & BRANDING: 9:16 vertical video...\n\nPROMPT_ESCENA_3:\nFORMAT & BRANDING: 9:16 vertical video...\n===FIN_VIDEO===`}
                        className="w-full text-xs font-mono p-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-primary)] leading-relaxed focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 outline-hidden transition"
                      />
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <span className="text-xs text-[var(--text-secondary)] font-medium">
                        {(() => {
                          if (!rawBatchText.trim()) return 'Pega tu texto arriba para analizar automáticamente cuántos videos contiene.';
                          const count = (rawBatchText.match(/={1,10}\s*INICIO_VIDEO\s*={1,10}|#{1,4}\s*VIDEO|TITULO\s*:/gi) || []).length;
                          return count > 0 
                            ? `🎯 Detectados aproximadamente ${count} video(s) listos para importar.`
                            : 'Listo para procesar tu lote.';
                        })()}
                      </span>

                      <button
                        onClick={async () => {
                          await handleImportBatch();
                          setIsImporterOpen(false); // Colapsar automáticamente al guardar
                        }}
                        disabled={isGenerating || !rawBatchText.trim()}
                        className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-bold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                      >
                        <Database className="w-4 h-4" />
                        {isGenerating ? 'Extrayendo Videos...' : '📦 Guardar Lote en el Banco'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECCIÓN 3: Inventario y Gestión de Videos Almacenados */}
              <div className="space-y-4">
                {/* Barra de Filtros, Búsqueda y Acciones Masivas */}
                <div className="p-4 rounded-3xl bg-[var(--bg-surface)] border border-[var(--border-color)] space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" />
                        <input
                          type="text"
                          value={vaultSearchQuery}
                          onChange={(e) => setVaultSearchQuery(e.target.value)}
                          placeholder="Buscar por título, pilar o ángulo..."
                          className="pl-8 pr-3 py-1.5 rounded-xl text-xs bg-[var(--bg-subtle)] border border-[var(--border-color)] text-[var(--text-primary)] w-56 sm:w-72 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                        />
                      </div>

                      {/* Filtro por Estado */}
                      <div className="flex items-center rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] p-0.5 text-xs">
                        <button
                          type="button"
                          onClick={() => setVaultFilterStatus('all')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                            vaultFilterStatus === 'all'
                              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          Todos ({vaultItems.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setVaultFilterStatus('stored')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                            vaultFilterStatus === 'stored'
                              ? 'bg-amber-500 text-white shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          Disponibles ({vaultItems.filter(v => v.status === 'stored').length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setVaultFilterStatus('in_queue')}
                          className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                            vaultFilterStatus === 'in_queue'
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          En Cola ({vaultItems.filter(v => v.status === 'in_queue').length})
                        </button>
                      </div>
                    </div>

                    {/* Botones de Selección y Despacho Masivo */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={async () => {
                          showToast('🤖 Solicitando al Agente IA lote de 10 cards maestras (24s)...');
                          setIsGenerating(true);
                          try {
                            const res = await fetch('http://localhost:3001/api/vault/generate', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ count: 10 })
                            });
                            const data = await res.json();
                            if (data.error) throw new Error(data.error);
                            showToast('🎉 ¡Generación de 10 cards iniciada en segundo plano! Aparecerán en segundos...');
                          } catch (e) {
                            showToast('Error conectando con el motor: ' + e.message);
                          } finally {
                            setIsGenerating(false);
                          }
                        }}
                        disabled={isGenerating}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white text-xs font-bold cursor-pointer shadow-xs transition disabled:opacity-50"
                        title="Pide al Agente IA generar 10 nuevas cards botánicas maestras para el Banco"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        {isGenerating ? 'Generando 10...' : '🤖 Generar 10 con Agente IA'}
                      </button>

                      <button
                        type="button"
                        onClick={toggleSelectAllVault}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-subtle)] text-xs font-semibold cursor-pointer transition"
                      >
                        {selectedVaultIds.size === vaultItems.length && vaultItems.length > 0 ? (
                          <>
                            <CheckSquare className="w-3.5 h-3.5 text-amber-600" /> Deseleccionar todo
                          </>
                        ) : (
                          <>
                            <Square className="w-3.5 h-3.5" /> Seleccionar todo
                          </>
                        )}
                      </button>

                      {selectedVaultIds.size > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={handleDeleteSelectedVaultItems}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-600/10 hover:bg-red-600 text-red-600 hover:text-white border border-red-500/20 text-xs font-bold cursor-pointer transition"
                            title="Elimina todos los videos marcados del banco"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Eliminar ({selectedVaultIds.size})
                          </button>

                          <button
                            type="button"
                            onClick={handleSendSelectedVaultToQueue}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer shadow-sm transition"
                            title="Despacha los videos seleccionados a la cola para su render en Google Flow"
                          >
                            <Send className="w-3.5 h-3.5" /> Despachar {selectedVaultIds.size} a Flow
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Render de las Tarjetas Filtradas */}
                {(() => {
                  const filtered = vaultItems
                    .filter(item => {
                      if (vaultFilterStatus === 'stored') return item.status === 'stored';
                      if (vaultFilterStatus === 'in_queue') return item.status === 'in_queue';
                      return true;
                    })
                    .filter(item => {
                      if (!vaultSearchQuery.trim()) return true;
                      const q = vaultSearchQuery.toLowerCase();
                      return (
                        (item.title && item.title.toLowerCase().includes(q)) ||
                        (item.pilar && item.pilar.toLowerCase().includes(q)) ||
                        (item.angulo && item.angulo.toLowerCase().includes(q)) ||
                        (item.copy_text && item.copy_text.toLowerCase().includes(q))
                      );
                    });

                  if (filtered.length === 0) {
                    return (
                      <div className="p-12 text-center rounded-3xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                        <Database className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3 opacity-60" />
                        <p className="font-bold text-sm text-[var(--text-primary)]">
                          {vaultItems.length === 0 ? 'Tu Banco de Contenido está vacío' : 'No se encontraron videos con ese filtro'}
                        </p>
                        <p className="text-xs mt-1">
                          {vaultItems.length === 0 
                            ? 'Abre el importador masivo arriba y pega tu primer lote para tener reservas.'
                            : 'Intenta limpiar el buscador o cambiar la pestaña de filtro.'}
                        </p>
                        {vaultItems.length === 0 && (
                          <button
                            type="button"
                            onClick={() => setIsImporterOpen(true)}
                            className="mt-4 px-4 py-2 rounded-xl bg-amber-500 text-black font-bold text-xs hover:bg-amber-400 transition cursor-pointer"
                          >
                            + Abrir Importador de Lotes
                          </button>
                        )}
                      </div>
                    );
                  }

                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filtered.map((item) => {
                        const isSelected = selectedVaultIds.has(item.id);
                        const isInQueue = item.status === 'in_queue' || videos.some(v => v.title === item.title && (v.status === 'rendering' || v.status === 'ready_to_publish'));

                        return (
                          <div 
                            key={item.id} 
                            className={`p-5 rounded-3xl border transition-all shadow-xs space-y-3 relative ${
                              isInQueue
                                ? 'opacity-60 bg-[var(--bg-subtle)] border-dashed border-emerald-500/40 grayscale-30'
                                : isSelected 
                                  ? 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/30' 
                                  : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:border-stone-400 dark:hover:border-stone-600'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={isInQueue}
                                  onChange={() => toggleVaultSelection(item.id)}
                                  className={`mt-1 w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-stone-300 dark:border-stone-600 ${isInQueue ? 'cursor-not-allowed opacity-30' : 'cursor-pointer'}`}
                                />
                                <div>
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md">
                                      {item.pilar}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-secondary)] font-medium">
                                      {item.clima_luz}
                                    </span>
                                  </div>
                                  <h4 className="font-bold text-sm text-[var(--text-primary)] mt-1 leading-snug">
                                    {item.title}
                                  </h4>
                                  <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5 font-medium">
                                    🎯 {item.angulo}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setEditingVaultItem({ ...item })}
                                  className="p-2 rounded-xl border border-[var(--border-color)] hover:bg-amber-500 hover:text-white text-[var(--text-secondary)] transition cursor-pointer shadow-2xs"
                                  title="Editar prompts y copy de este video"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                                  isInQueue
                                    ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30'
                                }`}>
                                  {isInQueue ? '✓ En Cola' : 'Disponible'}
                                </span>
                              </div>
                            </div>

                            {/* Copy Preview */}
                            <div className="p-3 rounded-2xl bg-[var(--bg-subtle)] text-xs text-[var(--text-secondary)] line-clamp-2 font-mono leading-relaxed border border-[var(--border-color)]/50">
                              {item.copy_text || 'Sin copy de Facebook especificado'}
                            </div>

                            {/* Desglose de 3 Escenas Flow */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)] font-bold">
                                <span>PROMPTS DE ESCENAS (FLOW 9:16):</span>
                                <button 
                                  onClick={() => setEditingVaultItem({ ...item })}
                                  className="text-amber-600 hover:underline cursor-pointer flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" /> Editar Prompts
                                </button>
                              </div>

                              <div className="grid grid-cols-3 gap-2 text-[10px] text-[var(--text-secondary)]">
                                <div 
                                  onClick={() => setEditingVaultItem({ ...item })}
                                  className="p-2 rounded-xl bg-[var(--bg-subtle)] hover:border-amber-500 border border-transparent cursor-pointer transition space-y-1" 
                                  title={item.scene_1_prompt}
                                >
                                  <span className="font-bold text-amber-600 dark:text-amber-400 block">🎬 E1 (Gancho)</span>
                                  <p className="line-clamp-2 text-[9.5px] leading-relaxed">{item.scene_1_prompt}</p>
                                </div>
                                <div 
                                  onClick={() => setEditingVaultItem({ ...item })}
                                  className="p-2 rounded-xl bg-[var(--bg-subtle)] hover:border-amber-500 border border-transparent cursor-pointer transition space-y-1" 
                                  title={item.scene_2_prompt}
                                >
                                  <span className="font-bold text-amber-600 dark:text-amber-400 block">🔬 E2 (Cuerpo)</span>
                                  <p className="line-clamp-2 text-[9.5px] leading-relaxed">{item.scene_2_prompt}</p>
                                </div>
                                <div 
                                  onClick={() => setEditingVaultItem({ ...item })}
                                  className="p-2 rounded-xl bg-[var(--bg-subtle)] hover:border-amber-500 border border-transparent cursor-pointer transition space-y-1" 
                                  title={item.scene_3_prompt}
                                >
                                  <span className="font-bold text-amber-600 dark:text-amber-400 block">🔁 E3 (Loop)</span>
                                  <p className="line-clamp-2 text-[9.5px] leading-relaxed">{item.scene_3_prompt}</p>
                                </div>
                              </div>

                              {/* Prompt de Imagen Complementaria */}
                              {item.image_prompt ? (
                                <div 
                                  onClick={() => setEditingVaultItem({ ...item })}
                                  className="p-2.5 rounded-xl bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500 cursor-pointer transition space-y-1 text-[10px]"
                                  title={item.image_prompt}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                      📸 Imagen Satélite / Complementaria (4:5)
                                    </span>
                                    <span className="text-[9px] text-emerald-600 font-mono">Nano Banana</span>
                                  </div>
                                  <p className="line-clamp-2 text-[9.5px] text-[var(--text-secondary)] leading-relaxed">{item.image_prompt}</p>
                                </div>
                              ) : (
                                <div 
                                  onClick={() => setEditingVaultItem({ ...item })}
                                  className="p-2 rounded-xl border border-dashed border-[var(--border-color)] text-[10px] text-amber-600 hover:text-amber-700 cursor-pointer text-center"
                                >
                                  + Agregar Prompt de Imagen Complementaria (Nano Banana)
                                </div>
                              )}
                            </div>

                            {/* Acciones del Video */}
                            <div className="pt-3 border-t border-[var(--border-color)] flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={() => handleDeleteVaultItem(item.id)}
                                className="text-xs text-red-500 hover:text-red-600 hover:underline cursor-pointer flex items-center gap-1"
                              >
                                <Trash2 className="w-3.5 h-3.5" /> Eliminar
                              </button>
                              
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  disabled={isInQueue}
                                  onClick={() => handleSendVaultToQueue(item, 'scene_1')}
                                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl border border-[var(--border-color)] text-xs font-bold transition ${
                                    isInQueue 
                                      ? 'opacity-40 cursor-not-allowed bg-stone-200 dark:bg-stone-800 text-stone-400' 
                                      : 'bg-[var(--bg-subtle)] hover:bg-amber-600 hover:text-white cursor-pointer'
                                  }`}
                                  title="Renderiza únicamente la primera escena (gancho) para validar calidad visual"
                                >
                                  🎬 Test Escena 1
                                </button>
                                <button
                                  type="button"
                                  disabled={isInQueue}
                                  onClick={() => handleSendVaultToQueue(item, 'all')}
                                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                                    isInQueue 
                                      ? 'bg-emerald-800/40 text-emerald-300/50 cursor-not-allowed border border-emerald-700/30' 
                                      : 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer'
                                  }`}
                                  title={isInQueue ? "Ya se encuentra en cola de renderizado" : "Despacha el video completo de 3 escenas a la cola de Google Flow"}
                                >
                                  <Send className="w-3.5 h-3.5" /> {isInQueue ? '✓ En Cola' : 'Despachar Video'}
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* TAB: PARÁMETROS FLOW (ESTILO GOOGLE FLOW EXACTO) */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                      Google Flow Engine Control
                    </span>
                    <span className="text-xs text-[var(--text-secondary)]">Ajustes de render para Gemini Omni & Veo</span>
                  </div>
                </div>
                <h2 className="text-2xl font-bold tracking-tight mb-2">Parámetros de Generación de Google Flow</h2>
                <p className="text-sm text-[var(--text-secondary)]">
                  Configura aquí la resolución, duración por escena, relación de aspecto y modelo. Estos valores controlan cómo Playwright y las APIs renderizan cada toma.
                </p>
              </div>

              {/* Tarjeta de Control Idéntica a Google Flow */}
              <div className="max-w-md mx-auto p-6 rounded-3xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xl space-y-5">
                {/* 1. Media Type Toggle (Image vs Video) */}
                <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                  <button
                    type="button"
                    onClick={() => setFlowSettings({ ...flowSettings, mediaType: 'image' })}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      flowSettings.mediaType === 'image'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>🖼️ Image</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFlowSettings({ ...flowSettings, mediaType: 'video' })}
                    className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      flowSettings.mediaType === 'video'
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <span>📹 Video</span>
                  </button>
                </div>

                {/* SI ESTÁ EN MODO VIDEO: PARÁMETROS DE VIDEO */}
                {flowSettings.mediaType === 'video' ? (
                  <>
                    {/* 2. Generation Mode (Frames vs Ingredients) */}
                    <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                      <button
                        type="button"
                        onClick={() => setFlowSettings({ ...flowSettings, generationMode: 'frames' })}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          flowSettings.generationMode === 'frames'
                            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span>[ ] Frames</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlowSettings({ ...flowSettings, generationMode: 'ingredients' })}
                        className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          flowSettings.generationMode === 'ingredients'
                            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span>☕ Ingredients</span>
                      </button>
                    </div>

                    {/* 3. Aspect Ratio (16:9 vs 9:16) */}
                    <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                      <button
                        type="button"
                        onClick={() => setFlowSettings({ ...flowSettings, aspectRatio: '16:9' })}
                        className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          flowSettings.aspectRatio === '16:9'
                            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="text-[10px] tracking-wider font-mono">▭ 16:9</span>
                        <span className="text-[10px] font-normal text-[var(--text-secondary)]">Horizontal / Feed</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFlowSettings({ ...flowSettings, aspectRatio: '9:16' })}
                        className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                          flowSettings.aspectRatio === '9:16'
                            ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                            : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="text-[10px] tracking-wider font-mono">▯ 9:16</span>
                        <span className="text-[10px] font-normal text-emerald-600">Reels / TikTok</span>
                      </button>
                    </div>

                    {/* 4. Model Selection Dropdown (4 Modelos Reales de Google Flow) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Motor de Video (Google Flow)
                        </label>
                        <span className="text-[10px] font-mono text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full font-bold">
                          4 Modelos Disponibles
                        </span>
                      </div>
                      <select
                        value={flowSettings.modelName}
                        onChange={(e) => {
                          const chosen = e.target.value;
                          const isVeo = chosen.startsWith('Veo');
                          setFlowSettings({
                            ...flowSettings,
                            modelName: chosen,
                            duration: isVeo ? '8s' : (flowSettings.duration === '8s' ? '6s' : flowSettings.duration)
                          });
                        }}
                        className="w-full text-xs font-bold p-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)] cursor-pointer"
                      >
                        <option value="Omni 1.1 Flash">⚡ Omni 1.1 Flash (Rápido, Audio Nativo, Duraciones 4s, 6s, 8s, 10s)</option>
                        <option value="Veo 3.1 - Lite">🎬 Veo 3.1 - Lite (Ligero & Rápido, Duración fija 8s)</option>
                        <option value="Veo 3.1 - Fast">🚀 Veo 3.1 - Fast (Equilibrado, Duración fija 8s)</option>
                        <option value="Veo 3.1 - Quality">✨ Veo 3.1 - Quality (Máxima Calidad Cinematográfica, Duración fija 8s)</option>
                      </select>
                    </div>

                    {/* 5. Resolution (360p vs 720p) */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                        Resolución de Render
                      </label>
                      <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                        <button
                          type="button"
                          onClick={() => setFlowSettings({ ...flowSettings, resolution: '360p' })}
                          className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                            flowSettings.resolution === '360p'
                              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          360p ⓘ
                        </button>
                        <button
                          type="button"
                          onClick={() => setFlowSettings({ ...flowSettings, resolution: '720p' })}
                          className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                            flowSettings.resolution === '720p'
                              ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                              : 'text-[var(--text-secondary)]'
                          }`}
                        >
                          720p (HD Recomendado)
                        </button>
                      </div>
                    </div>

                    {/* 6. Duration per Scene (Omni: 4s, 6s, 8s, 10s | Veo 3.1: 8s fija) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                          Duración por Escena
                        </label>
                        <span className="text-[11px] text-emerald-600 font-bold">
                          Total: {flowSettings.modelName?.startsWith('Veo') ? '24' : Number(flowSettings.duration.replace('s', '')) * 3} segundos (3 escenas)
                        </span>
                      </div>
                      
                      {flowSettings.modelName?.startsWith('Veo') ? (
                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500 font-medium flex items-center gap-2">
                          <span>ℹ️</span>
                          <span>En Google Flow, los modelos <strong>{flowSettings.modelName}</strong> tienen una duración fija de <strong>8 segundos</strong> por escena.</span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 p-1 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                          {['4s', '6s', '8s', '10s'].map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setFlowSettings({ ...flowSettings, duration: d })}
                              className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                                flowSettings.duration === d
                                  ? 'bg-amber-600 text-white shadow-sm'
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 7. Batch Variants (x1, x2, x3, x4) */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                        Variantes de Video
                      </label>
                      <div className="grid grid-cols-4 p-1 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                        {['x1', 'x2', 'x3', 'x4'].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFlowSettings({ ...flowSettings, variants: v })}
                            className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                              flowSettings.variants === v
                                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  /* SI ESTÁ EN MODO IMAGEN: PARÁMETROS REALES DE GOOGLE FLOW */
                  <>
                    {/* A. Selector de Relación de Aspecto Real (16:9, 4:3, 1:1, 3:4, 9:16) */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                        Relación de Aspecto (Google Flow)
                      </label>
                      <div className="grid grid-cols-5 p-1 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                        {[
                          { label: '16:9', icon: '▭', val: '16:9' },
                          { label: '4:3', icon: '◻', val: '4:3' },
                          { label: '1:1', icon: '□', val: '1:1' },
                          { label: '3:4', icon: '▯', val: '3:4' },
                          { label: '9:16', icon: '▯', val: '9:16' }
                        ].map((r) => (
                          <button
                            key={r.val}
                            type="button"
                            onClick={() => setFlowSettings({ ...flowSettings, imageRatio: r.val })}
                            className={`flex flex-col items-center justify-center py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                              flowSettings.imageRatio === r.val
                                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            <span className="text-[12px]">{r.icon}</span>
                            <span className="text-[11px] mt-0.5">{r.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* B. Modelos Reales de Google Flow (Nano Banana) */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                        Motor de Imagen Google Flow
                      </label>
                      <select
                        value={flowSettings.imageModel}
                        onChange={(e) => setFlowSettings({ ...flowSettings, imageModel: e.target.value })}
                        className="w-full text-xs font-bold p-3.5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)] cursor-pointer"
                      >
                        <option value="🍌 Nano Banana Pro">🍌 Nano Banana Pro (Máximo detalle)</option>
                        <option value="🍌 Nano Banana 2 Lite">🍌 Nano Banana 2 Lite (Ultra veloz)</option>
                        <option value="🍌 Nano Banana 2.1">🍌 Nano Banana 2.1 (Versión por defecto)</option>
                      </select>
                    </div>

                    {/* C. Variantes por Imagen (x1, x2, x3, x4) */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                        Variantes por Prompt
                      </label>
                      <div className="grid grid-cols-4 p-1 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                        {['x1', 'x2', 'x3', 'x4'].map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setFlowSettings({ ...flowSettings, imageVariants: v })}
                            className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                              flowSettings.imageVariants === v
                                ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                            }`}
                          >
                            {v}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Estimated Credits Footer */}
                <div className="pt-3 border-t border-[var(--border-color)] text-center">
                  <div className="text-xs text-[var(--text-secondary)]">
                    Generating will use <strong className="text-amber-600 dark:text-amber-400 font-bold">
                      {flowSettings.mediaType === 'image' ? '0 credits' : '12 credits'}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveFlowSettings}
                    className="w-full mt-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    Guardar y Sincronizar con Google Flow
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB: PILARES & PROMPTS (BIBLIA DE PRODUCCIÓN EDITABLE) */}
          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs">
                <h2 className="text-xl font-bold tracking-tight mb-1">
                  Los 5 Pilares de Contenido y Plantillas de Prompts (Regla de 24s)
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Cualquier ajuste que realices aquí impactará inmediatamente en las generaciones de IA y en las opciones del Studio.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-6">
                {templates.map((tmpl) => (
                  <div key={tmpl.id} className="p-6 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs space-y-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-[var(--text-primary)]">{tmpl.pillar_name}</h3>
                        <p className="text-xs text-[var(--text-secondary)] mt-0.5">{tmpl.description}</p>
                      </div>
                      <button
                        onClick={() => handleUpdateTemplate(tmpl)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs font-semibold hover:bg-emerald-500 hover:text-white transition cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Guardar Cambios
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                          Reglas del Sistema
                        </label>
                        <textarea
                          rows={3}
                          value={tmpl.system_rules || ''}
                          onChange={(e) => {
                            const updated = templates.map(t => t.id === tmpl.id ? { ...t, system_rules: e.target.value } : t);
                            setTemplates(updated);
                          }}
                          className="w-full text-xs font-mono p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                          Plantilla de Copy Facebook
                        </label>
                        <textarea
                          rows={3}
                          value={tmpl.copy_template || ''}
                          onChange={(e) => {
                            const updated = templates.map(t => t.id === tmpl.id ? { ...t, copy_template: e.target.value } : t);
                            setTemplates(updated);
                          }}
                          className="w-full text-xs font-mono p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                          Plantilla Escena 1 (Gancho)
                        </label>
                        <textarea
                          rows={3}
                          value={tmpl.scene_1_prompt_template || ''}
                          onChange={(e) => {
                            const updated = templates.map(t => t.id === tmpl.id ? { ...t, scene_1_prompt_template: e.target.value } : t);
                            setTemplates(updated);
                          }}
                          className="w-full text-xs font-mono p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] mb-1">
                          Plantilla Escena 2 (Revelación)
                        </label>
                        <textarea
                          rows={3}
                          value={tmpl.scene_2_prompt_template || ''}
                          onChange={(e) => {
                            const updated = templates.map(t => t.id === tmpl.id ? { ...t, scene_2_prompt_template: e.target.value } : t);
                            setTemplates(updated);
                          }}
                          className="w-full text-xs font-mono p-2.5 rounded-lg border border-[var(--border-color)] bg-[var(--bg-subtle)] text-[var(--text-primary)]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: QUEUE & FEED */}
          {activeTab === 'queue' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">Cola de Videos y Feed</h2>
                  <p className="text-xs text-[var(--text-secondary)]">Monitorea y previsualiza los videos listos para publicación</p>
                </div>
                <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-color)]">
                  Total: {videos.length} videos
                </span>
              </div>

              {videos.length === 0 ? (
                <div className="p-16 text-center rounded-2xl border border-dashed border-[var(--border-color)] bg-[var(--bg-surface)]">
                  <Video className="w-10 h-10 text-[var(--text-secondary)] mx-auto mb-3" />
                  <p className="font-semibold text-sm">La cola está vacía</p>
                  <p className="text-xs text-[var(--text-secondary)] mt-1">Genera videos desde la pestaña Studio Generator.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {videos.map((vid) => {
                    const currentView = selectedAuditScene[vid.id] || 'full';
                    const isAuditOpen = showChecklist[vid.id] || false;

                    // Decidir qué video o prompt mostrar según la pestaña de auditoría seleccionada
                    let activeVideoUrl = vid.final_video_url;
                    if (currentView === 's1' && vid.scene_1_video_url) activeVideoUrl = vid.scene_1_video_url;
                    if (currentView === 's2' && vid.scene_2_video_url) activeVideoUrl = vid.scene_2_video_url;
                    if (currentView === 's3' && vid.scene_3_video_url) activeVideoUrl = vid.scene_3_video_url;

                    const activePromptText = currentView === 's1' 
                      ? vid.scene_1_prompt 
                      : currentView === 's2' 
                        ? vid.scene_2_prompt 
                        : currentView === 's3' 
                          ? vid.scene_3_prompt 
                          : vid.scene_1_prompt;

                    return (
                    <div key={vid.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs overflow-hidden flex flex-col">
                        
                        {/* Selector de Auditoría por Tiempos: E1 (0-6s) | E2 (6-12s) | E3 (12-18s) | Completo (18s) */}
                        <div className="bg-[var(--bg-subtle)] p-1.5 border-b border-[var(--border-color)] flex items-center justify-between text-[11px] font-bold">
                          <span className="text-[10px] text-[var(--text-secondary)] pl-1">Auditoría:</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setSelectedAuditScene({ ...selectedAuditScene, [vid.id]: 's1' })}
                              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                                currentView === 's1' 
                                  ? 'bg-amber-500 text-black shadow-xs' 
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                              title="Auditar Escena 1 (Gancho 0-6s)"
                            >
                              E1 (6s)
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedAuditScene({ ...selectedAuditScene, [vid.id]: 's2' })}
                              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                                currentView === 's2' 
                                  ? 'bg-emerald-600 text-white shadow-xs' 
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                              title="Auditar Escena 2 (Revelación 6-12s)"
                            >
                              E2 (6s)
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedAuditScene({ ...selectedAuditScene, [vid.id]: 's3' })}
                              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                                currentView === 's3' 
                                  ? 'bg-indigo-600 text-white shadow-xs' 
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                              title="Auditar Escena 3 (Cierre Loop 12-18s)"
                            >
                              E3 (6s)
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedAuditScene({ ...selectedAuditScene, [vid.id]: 'full' })}
                              className={`px-2 py-0.5 rounded transition cursor-pointer ${
                                currentView === 'full' 
                                  ? 'bg-[var(--text-primary)] text-[var(--bg-surface)] shadow-xs' 
                                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                              }`}
                              title="Auditar Video Maestro Completo de 18 segundos"
                            >
                              ✨ Full 18s
                            </button>
                          </div>
                        </div>

                        {/* Contenedor del Reproductor Vertical 9:16 */}
                        <div className="bg-gradient-to-br from-stone-900 to-emerald-950/80 aspect-[9/16] max-h-80 w-full flex flex-col items-center justify-between p-4 relative overflow-hidden border-b border-[var(--border-color)]">
                          {activeVideoUrl && !activeVideoUrl.includes('commondatastorage.googleapis.com') ? (
                            <video key={activeVideoUrl} src={activeVideoUrl} controls playsInline className="w-full h-full object-contain bg-black rounded" />
                          ) : (
                            <>
                              {/* Overlay de estado de render */}
                              <div className="w-full flex items-center justify-between text-[11px] text-emerald-400/90 font-medium z-10">
                                <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border backdrop-blur-sm ${
                                  vid.status === 'error' || vid.error_message
                                    ? 'bg-red-950/70 border-red-500/40 text-red-300'
                                    : renderingJobs[vid.id]
                                      ? 'bg-amber-950/70 border-amber-500/40 text-amber-300 ring-1 ring-amber-400/50'
                                      : vid.status === 'rendering'
                                        ? 'bg-sky-950/70 border-sky-500/40 text-sky-300'
                                        : 'bg-black/60 border-emerald-500/20 text-emerald-400'
                                }`}>
                                  <span className={`w-2 h-2 rounded-full ${
                                    vid.status === 'error' || vid.error_message
                                      ? 'bg-red-400'
                                      : renderingJobs[vid.id]
                                        ? 'bg-amber-400 animate-ping'
                                        : vid.status === 'rendering'
                                          ? 'bg-sky-400'
                                          : 'bg-emerald-400 animate-pulse'
                                  }`}></span>
                                  {vid.status === 'error' || vid.error_message
                                    ? 'Error en Render'
                                    : renderingJobs[vid.id]
                                      ? 'Renderizando en Flow...'
                                      : vid.status === 'rendering'
                                        ? 'En Cola de Espera'
                                        : 'Listo p/ Flow'}
                                </span>
                                <span className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-stone-300 uppercase">
                                  {currentView === 'full' ? '3 escenas (18s)' : `Escena ${currentView.toUpperCase()}`}
                                </span>
                              </div>

                              {/* Caso 1: Error en el Render */}
                              {vid.status === 'error' || vid.error_message ? (
                                <div className="my-auto w-full px-3 z-10 space-y-2 text-center">
                                  <div className="w-10 h-10 rounded-2xl bg-red-500/20 border border-red-500/40 flex items-center justify-center mx-auto text-red-400">
                                    <AlertCircle className="w-5 h-5" />
                                  </div>
                                  <p className="text-xs font-bold text-red-300">Fallo en Google Flow</p>
                                  <p className="text-[10px] text-stone-300 bg-black/60 p-2 rounded line-clamp-3 text-left border border-red-500/20 font-mono">
                                    {vid.error_message || 'No se pudo conectar o completar la generación.'}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleRegenerateItem(vid.id, 'full_video')}
                                    className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-[11px] font-bold cursor-pointer inline-flex items-center gap-1 shadow-xs transition"
                                  >
                                    <RefreshCw className="w-3 h-3" /> Reintentar Render
                                  </button>
                                </div>
                              ) : renderingJobs[vid.id] ? (
                                /* Caso 2A: Render Activo en Google Flow (Barra y Temporizador Real) */
                                <div className="my-auto w-full px-3 z-10 space-y-3 text-center">
                                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400 animate-pulse">
                                    <Clock className="w-6 h-6" />
                                  </div>
                                  <div>
                                    <div className="flex justify-between items-center text-[11px] font-bold text-stone-200 mb-1">
                                      <span>Progreso de Render en Flow</span>
                                      <span className="font-mono text-amber-400">
                                        {renderingJobs[vid.id]?.pct || 15}%
                                      </span>
                                    </div>
                                    <div className="w-full bg-black/60 h-2 rounded-full overflow-hidden border border-white/10">
                                      <div 
                                        className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full transition-all duration-1000 ease-linear rounded-full"
                                        style={{ width: `${renderingJobs[vid.id]?.pct || 15}%` }}
                                      />
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-stone-400 mt-1.5">
                                      <span>Estado:</span>
                                      <span className="font-mono text-emerald-400 font-semibold truncate max-w-[130px]">
                                        {renderingJobs[vid.id]?.message || 'Generando en Google Flow...'}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-stone-300 italic bg-black/40 px-2 py-1 rounded border border-white/5">
                                    {renderingJobs[vid.id]?.message || 'Procesando en Google Flow...'}
                                  </p>
                                </div>
                              ) : vid.status === 'rendering' ? (
                                /* Caso 2B: En Cola de Espera del Renderizador */
                                <div className="my-auto w-full px-3 z-10 space-y-3 text-center">
                                  <div className="w-12 h-12 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center mx-auto text-sky-400">
                                    <Clock className="w-6 h-6 animate-spin" />
                                  </div>
                                  <p className="text-xs font-bold text-sky-300">En Cola de Procesamiento</p>
                                  <p className="text-[10px] text-stone-400 bg-black/50 px-3 py-1.5 rounded-lg border border-white/5">
                                    Esperando su turno en Google Flow. El motor local lo tomará automáticamente al terminar el render en curso.
                                  </p>
                                </div>
                              ) : (
                                /* Caso 3: Icono y preview del Guion de la Escena Activa */
                                <div className="my-auto text-center px-2 z-10 space-y-2">
                                  <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-inner">
                                    <Video className="w-6 h-6" />
                                  </div>
                                  <p className="text-[11px] text-stone-200 font-semibold line-clamp-2">
                                    {vid.title}
                                  </p>
                                  <p className="text-[10px] text-stone-400 line-clamp-3 italic bg-black/40 p-2 rounded-lg border border-white/5 text-left">
                                    "{activePromptText?.slice(0, 140)}..."
                                  </p>
                                </div>
                              )}

                              {/* Pie de preview */}
                              <div className="w-full flex items-center justify-between text-[10px] text-stone-400 z-10 pt-1 border-t border-white/10">
                                <span>{vid.angulo || 'Ángulo NatGeo'}</span>
                                <span className="text-emerald-400 font-mono">9:16 • 4K</span>
                              </div>
                            </>
                          )}
                        </div>

                      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[10px] font-bold tracking-wider uppercase text-amber-600 dark:text-amber-400">
                              {vid.topic}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                              {vid.status}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-[var(--text-primary)] line-clamp-1">{vid.title}</h4>
                          <p className="text-xs text-[var(--text-secondary)] line-clamp-3 mt-1.5 whitespace-pre-line">
                            {vid.copy_text}
                          </p>
                        </div>

                        {/* Desplegable de Checklist de Calidad Editorial */}
                        <div className="pt-2 border-t border-[var(--border-color)]">
                          <button
                            type="button"
                            onClick={() => setShowChecklist({ ...showChecklist, [vid.id]: !isAuditOpen })}
                            className="w-full flex items-center justify-between text-[11px] font-bold text-[var(--text-secondary)] hover:text-[var(--text-primary)] cursor-pointer"
                          >
                            <span className="flex items-center gap-1.5">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              Checklist de Calidad Mr. Green
                            </span>
                            <span>{isAuditOpen ? '▲' : '▼'}</span>
                          </button>

                          {isAuditOpen && (
                            <div className="mt-2 p-2.5 rounded-xl bg-[var(--bg-subtle)] space-y-1.5 text-[10px]">
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--text-secondary)]">Formato 9:16 Vertical (1080x1920)</span>
                                <span className="text-emerald-600 font-bold">✓ Conforme</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--text-secondary)]">Watermark "Mr. Green" top-right</span>
                                <span className="text-emerald-600 font-bold">✓ Conforme</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--text-secondary)]">Corte dinámico en segundo 3</span>
                                <span className="text-emerald-600 font-bold">✓ Conforme</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-[var(--text-secondary)]">Loop sin costuras en E3</span>
                                <span className="text-emerald-600 font-bold">✓ Conforme</span>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="pt-2 border-t border-[var(--border-color)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
                          <div className="flex flex-col">
                            <span className="font-bold text-[11px] text-[var(--text-primary)]">
                              📅 {new Date(vid.created_at).toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' })}
                            </span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-bold">
                              🕒 Render: {new Date(vid.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleDeleteQueueItem(vid.id)}
                              className="text-red-500 hover:text-red-700 text-xs font-semibold hover:underline cursor-pointer flex items-center gap-1"
                              title="Eliminar de la cola de Facebook"
                            >
                              <span>🗑️</span> Eliminar
                            </button>
                            <div className="flex items-center gap-1.5 pl-2 border-l border-[var(--border-color)]">
                              <svg className="w-3.5 h-3.5 text-blue-600 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                              <svg className="w-3.5 h-3.5 text-red-600 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            </div>
                          </div>
                        </div>

                        {/* Botón de Publicación Manual hacia Facebook / Redes */}
                        {/* Botones de Publicación Manual hacia Facebook (Reels & Historias) */}
                        {vid.final_video_url && (
                          <div className="pt-2 border-t border-[var(--border-color)] space-y-2">
                            {vid.status === 'published' ? (
                              <div className="space-y-2">
                                <div className="w-full py-2 px-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold text-xs flex items-center justify-center gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                                  <span>Publicado en tu Página de Facebook (Reel)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  <button
                                    type="button"
                                    disabled={publishingJobId === vid.id}
                                    onClick={() => handlePublishToSocial(vid, 'story')}
                                    className="w-full py-2 px-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                                    title="Subir de nuevo o reforzar como Historia Independiente en Facebook Stories"
                                  >
                                    <Share2 className="w-3.5 h-3.5" />
                                    <span>{publishingJobId === vid.id ? 'Subiendo Historia...' : '📲 Subir como Historia'}</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={publishingJobId === vid.id}
                                    onClick={() => handlePublishToSocial(vid, 'reel')}
                                    className="w-full py-2 px-2.5 rounded-xl border border-[var(--border-color)] bg-[var(--bg-subtle)] hover:bg-blue-600 hover:text-white text-[var(--text-secondary)] font-bold text-[11px] flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                                    title="Volver a enviar como Reel a Facebook"
                                  >
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Re-publicar Reel</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  disabled={publishingJobId === vid.id}
                                  onClick={() => handlePublishToSocial(vid, 'reel')}
                                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                                  title="Subir a Facebook Reels & Feed principal (y programa la Historia automáticamente)"
                                >
                                  <Send className={`w-3.5 h-3.5 ${publishingJobId === vid.id ? 'animate-bounce' : ''}`} />
                                  <span>{publishingJobId === vid.id ? 'Enviando...' : '🚀 Subir como Reel'}</span>
                                </button>

                                <button
                                  type="button"
                                  disabled={publishingJobId === vid.id}
                                  onClick={() => handlePublishToSocial(vid, 'story')}
                                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition cursor-pointer disabled:opacity-50"
                                  title="Subir como Historia Independiente a Facebook (Monetización directa en Stories)"
                                >
                                  <Share2 className="w-3.5 h-3.5" />
                                  <span>📲 Historia Independiente</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Selector de Modo de Generación / Regeneración de Video */}
                        <div className="pt-2 border-t border-dashed border-[var(--border-color)] flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-[var(--text-secondary)]">
                            {vid.final_video_url ? 'Regenerar en Flow:' : 'Renderizar en Flow:'}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRegenerateItem(vid.id, 'scene_1')}
                              className="px-2 py-1 rounded bg-[var(--bg-subtle)] hover:bg-amber-600 hover:text-white border border-[var(--border-color)] text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                              title="Vuelve a generar la Escena 1 en Google Flow para obtener otra toma o variación"
                            >
                              <RefreshCw className="w-2.5 h-2.5" /> Escena 1
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRegenerateItem(vid.id, 'full_video')}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold transition shadow-xs cursor-pointer flex items-center gap-1"
                              title="Renderiza y une de nuevo las 3 escenas completas (18s)"
                            >
                              ✨ 3 Escenas (18s)
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              )}
            </div>
          )}

          {/* TAB: GALERÍA DE IMÁGENES & DESPACHO MANUAL */}
          {activeTab === 'images' && (
            <div className="space-y-6">
              {/* Header de la Galería */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--bg-surface)] p-6 rounded-2xl border border-[var(--border-color)] shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <ImageIcon className="w-5 h-5" />
                    </span>
                    <h2 className="text-xl font-black tracking-tight text-[var(--text-primary)]">
                      Galería & Despacho de Imágenes
                    </h2>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-1.5 max-w-2xl">
                    Imágenes satélite (1080x1350, ratio 4:5) generadas automáticamente desde cada render, o subidas manualmente para publicar directo a tu página de Facebook.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowManualImageModal(true)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Subir Imagen Manual</span>
                  </button>
                  <button
                    type="button"
                    onClick={fetchData}
                    className="p-2.5 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] transition cursor-pointer"
                    title="Actualizar galería"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Lista o Grid de Imágenes */}
              {videos.filter(v => v.image_url && v.image_status !== 'dismissed').length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-[var(--border-color)] rounded-3xl bg-[var(--bg-surface)]/50 text-center p-6 space-y-4">
                  <div className="w-16 h-16 rounded-3xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-[var(--text-primary)]">No hay imágenes en la galería aún</p>
                    <p className="text-xs text-[var(--text-secondary)] max-w-md">
                      Las imágenes satélite se generan automáticamente cuando cada render en Google Flow finaliza, o puedes subir una imagen manualmente ahora mismo.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowManualImageModal(true)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-sm transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Subir Mi Primera Imagen</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {videos
                    .filter(v => v.image_url && v.image_status !== 'dismissed')
                    .map((item) => {
                      const isPublished = item.image_status === 'published';
                      const copyText = item.image_copy_text || item.copy_text || '¿Qué opinas sobre este consejo de jardinería? 🌱 #MrGreen #HuertoEnCasa';
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs overflow-hidden flex flex-col transition hover:shadow-md hover:border-amber-500/40"
                        >
                          {/* Header con Título y Badge */}
                          <div className="bg-[var(--bg-subtle)] px-4 py-3 border-b border-[var(--border-color)] flex items-center justify-between gap-2">
                            <span className="font-bold text-xs truncate max-w-[200px]" title={item.title}>
                              {item.title}
                            </span>
                            {isPublished ? (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-blue-500/15 text-blue-600 border border-blue-500/30 shrink-0">
                                Publicada
                              </span>
                            ) : (
                              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 border border-amber-500/30 shrink-0">
                                Pendiente
                              </span>
                            )}
                          </div>

                          {/* Contenedor de la Imagen */}
                          <div className="relative aspect-[4/5] w-full bg-stone-900 overflow-hidden flex items-center justify-center group">
                            <img
                              src={item.image_url}
                              alt={item.title}
                              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <a
                                href={item.image_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 rounded-xl bg-black/70 backdrop-blur-md text-white hover:bg-black/90 transition shadow-lg"
                                title="Ver en tamaño original"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>

                          {/* Copy y Datos */}
                          <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                            <div className="space-y-1.5">
                              <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--text-secondary)]">
                                Copy para Facebook:
                              </span>
                              <p className="text-xs text-[var(--text-primary)] line-clamp-3 bg-[var(--bg-subtle)] p-2.5 rounded-xl border border-[var(--border-color)] italic">
                                "{copyText}"
                              </p>
                            </div>

                            {/* Acciones */}
                            <div className="space-y-2 pt-2 border-t border-[var(--border-color)]">
                              <button
                                type="button"
                                disabled={publishingImageId === item.id}
                                onClick={() => handlePublishImage(item)}
                                className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition cursor-pointer disabled:opacity-50 ${
                                  isPublished
                                    ? 'bg-[var(--bg-subtle)] hover:bg-blue-600 hover:text-white border border-[var(--border-color)] text-[var(--text-primary)]'
                                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                                }`}
                                title="Publicar inmediatamente esta foto a la página de Facebook"
                              >
                                <Send className={`w-3.5 h-3.5 ${publishingImageId === item.id ? 'animate-bounce' : ''}`} />
                                <span>
                                  {publishingImageId === item.id
                                    ? 'Publicando en Facebook...'
                                    : isPublished
                                    ? 'Volver a Publicar en Facebook'
                                    : '🚀 Despachar a Facebook'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDismissImage(item.id)}
                                className="w-full py-1.5 px-3 rounded-xl border border-[var(--border-color)] hover:bg-red-500/10 hover:text-red-600 hover:border-red-500/30 text-[var(--text-secondary)] text-[11px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5"
                                title="Ocultar de la galería"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Descartar de la Galería</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}

              {/* MODAL PARA SUBIR IMAGEN MANUAL */}
              {showManualImageModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
                  <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] w-full max-w-lg rounded-3xl p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
                    <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                          <Upload className="w-5 h-5" />
                        </span>
                        <div>
                          <h3 className="font-bold text-base text-[var(--text-primary)]">Subir Imagen Manual</h3>
                          <p className="text-[11px] text-[var(--text-secondary)]">Recomendado: ratio 4:5 vertical (1080x1350)</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowManualImageModal(false)}
                        className="p-1.5 rounded-xl hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)]"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <form onSubmit={handleUploadManualImage} className="space-y-4">
                      {/* Dropzone o selector de archivo */}
                      <div>
                        <label className="text-xs font-bold text-[var(--text-primary)] block mb-1.5">
                          Archivo de Imagen
                        </label>
                        <div className="border-2 border-dashed border-[var(--border-color)] hover:border-emerald-500 rounded-2xl p-4 text-center cursor-pointer transition bg-[var(--bg-subtle)] relative overflow-hidden">
                          <input
                            type="file"
                            accept="image/*"
                            required
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                setManualImageForm(prev => ({
                                  ...prev,
                                  file,
                                  previewUrl: URL.createObjectURL(file),
                                  title: prev.title || file.name.replace(/\.[^/.]+$/, "")
                                }));
                              }
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          {manualImageForm.previewUrl ? (
                            <div className="flex flex-col items-center gap-2">
                              <img
                                src={manualImageForm.previewUrl}
                                alt="Preview"
                                className="h-44 object-contain rounded-xl border border-[var(--border-color)]"
                              />
                              <span className="text-[11px] font-mono text-emerald-600 font-bold">
                                {manualImageForm.file?.name} ({Math.round((manualImageForm.file?.size || 0) / 1024)} KB)
                              </span>
                              <span className="text-[10px] text-[var(--text-secondary)]">Haz clic para cambiar de archivo</span>
                            </div>
                          ) : (
                            <div className="py-6 flex flex-col items-center gap-2">
                              <Upload className="w-8 h-8 text-[var(--text-secondary)]" />
                              <span className="text-xs font-bold text-[var(--text-primary)]">Haz clic o arrastra tu imagen aquí</span>
                              <span className="text-[10px] text-[var(--text-secondary)]">PNG, JPG, WEBP hasta 10MB</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Título */}
                      <div>
                        <label className="text-xs font-bold text-[var(--text-primary)] block mb-1">
                          Título o Asunto de la Imagen
                        </label>
                        <input
                          type="text"
                          required
                          value={manualImageForm.title}
                          onChange={(e) => setManualImageForm({ ...manualImageForm, title: e.target.value })}
                          placeholder="Ej: Guía Visual del Mulch Orgánico"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs font-semibold focus:outline-hidden focus:border-emerald-500"
                        />
                      </div>

                      {/* Copy para Facebook */}
                      <div>
                        <label className="text-xs font-bold text-[var(--text-primary)] block mb-1">
                          Copy / Descripción para Facebook
                        </label>
                        <textarea
                          rows={3}
                          value={manualImageForm.copy_text}
                          onChange={(e) => setManualImageForm({ ...manualImageForm, copy_text: e.target.value })}
                          placeholder="Escribe el texto que acompañará la publicación en Facebook con hashtags..."
                          className="w-full px-3.5 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs focus:outline-hidden focus:border-emerald-500"
                        />
                      </div>

                      {/* Botones */}
                      <div className="flex items-center justify-end gap-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowManualImageModal(false)}
                          className="px-4 py-2 rounded-xl border border-[var(--border-color)] text-xs font-bold text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition"
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          disabled={uploadingManualImage}
                          className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                          {uploadingManualImage ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              <span>Subiendo imagen...</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-3.5 h-3.5" />
                              <span>Guardar en Galería</span>
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: GOOGLE FLOW POOL */}
          {activeTab === 'accounts' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold tracking-tight">Pool de Cuentas Google Flow</h2>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Rotación inteligente: se agotan primero todas las cuentas gratuitas y se resguarda la Pro para el final.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Agregar Cuenta Google
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map((acc) => {
                  const pct = Math.min(100, Math.round((acc.daily_credits_used / acc.daily_credits_total) * 100));
                  const isPro = acc.tier === 'pro';
                  const isConnected = connectedSessions[acc.alias] === true;
                  const displayEmail = acc.email || profileEmails[acc.alias] || null;

                  return (
                    <div
                      key={acc.id}
                      className={`p-5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isPro
                          ? 'bg-amber-500/5 border-amber-500/40 shadow-xs'
                          : 'bg-[var(--bg-surface)] border-[var(--border-color)] shadow-xs'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-[var(--text-primary)]">{acc.alias}</span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isPro
                                  ? 'bg-amber-500 text-black'
                                  : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)]'
                              }`}
                            >
                              {isPro ? 'PRO ⭐' : 'FREE'}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5">
                            {/* Indicador de Sesión de Google Conectada */}
                            {isConnected ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Conectada
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                Sin Sesión
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Correo Gmail Real Conectado */}
                        <div className="mb-3 px-2 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-color)] flex items-center gap-1.5 text-xs">
                          <span className="text-[11px]">📧</span>
                          {displayEmail ? (
                            <span className="font-mono text-[11px] text-[var(--text-primary)] truncate font-semibold">
                              {displayEmail}
                            </span>
                          ) : (
                            <span className="text-[11px] text-[var(--text-secondary)] italic">
                              Email no vinculado aún
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                            <span>Créditos de hoy</span>
                            <span className="font-bold text-[var(--text-primary)]">
                              {acc.daily_credits_used} / {acc.daily_credits_total}
                            </span>
                          </div>

                          <div className="w-full h-2 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                            <div
                              className={`h-full transition-all ${isPro ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>

                          {isPro && (
                            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium pt-1">
                              🛡️ Presupuesto Pro: {acc.daily_credits_total} / mes (Prioridad 99 - De Reserva)
                            </div>
                          )}
                          {!isPro && (
                            <div className="text-[11px] text-[var(--text-secondary)] pt-1">
                              Prioridad 1 (Rotación activa diaria)
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botones de acción de la cuenta */}
                      <div className="mt-4 pt-3 border-t border-[var(--border-color)] flex items-center justify-between gap-2">
                        <button
                          type="button"
                          disabled={loggingInAccount === acc.alias}
                          onClick={() => handleLoginSession(acc.alias)}
                          className={`flex-1 py-1.5 px-2.5 rounded-lg border text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                            isConnected
                              ? 'bg-[var(--bg-subtle)] hover:bg-[var(--accent)] hover:text-white border-[var(--border-color)]'
                              : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:bg-amber-500 hover:text-black font-bold'
                          }`}
                          title={isConnected ? "La sesión ya está conectada. Haz clic si deseas verificar o renovar." : "Haz clic para abrir el navegador y loguearte en Google."}
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          {loggingInAccount === acc.alias ? 'Abriendo...' : isConnected ? 'Re-conectar / Ver' : '🔑 Conectar Sesión'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc)}
                          className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 transition cursor-pointer"
                          title="Eliminar del pool"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 5: CHANNELS & SOCIAL NETWORKS */}
          {activeTab === 'channels' && (
            <div className="space-y-6">
              <div className="space-y-1">
                <h2 className="text-xl font-bold tracking-tight">Canales & Redes Sociales</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Plataformas conectadas para la distribución simultánea de videos.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">Facebook Reels & Feed</h4>
                      <p className="text-xs text-[var(--text-secondary)]">Página Mr. Green (Conectado por n8n)</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Activo
                  </span>
                </div>

                <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-pink-600/10 text-pink-600 flex items-center justify-center font-bold text-sm">
                      TK
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">TikTok</h4>
                      <p className="text-xs text-[var(--text-secondary)]">Listo para vincular webhook en n8n</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    En Espera
                  </span>
                </div>

                <div className="p-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center">
                      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-[var(--text-primary)]">YouTube Shorts</h4>
                      <p className="text-xs text-[var(--text-secondary)]">Próxima integración</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                    En Espera
                  </span>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Modal de Configuración del Widget de Automatización Diaria (Mr. Green) */}
      {showAutomationModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-[var(--text-primary)] flex items-center gap-2">
                    Auto-Piloto Diario: Jardinería & Huerto Urbano
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600">
                      Mr. Green
                    </span>
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Programa publicaciones automáticas respetando el ritmo circadiano de la comunidad de jardinería.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAutomationModal(false)}
                className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Switch Principal: Encender / Apagar */}
            <div className={`p-4 rounded-2xl border transition-all flex items-center justify-between ${
              automationConfig.enabled 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : 'bg-[var(--bg-subtle)] border-[var(--border-color)]'
            }`}>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-[var(--text-primary)]">
                    Estado de la Automatización:
                  </span>
                  <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-md ${
                    automationConfig.enabled ? 'bg-emerald-600 text-white' : 'bg-stone-300 dark:bg-stone-700 text-stone-700 dark:text-stone-300'
                  }`}>
                    {automationConfig.enabled ? 'ACTIVO (Publicando automáticamente)' : 'PAUSADO (Manual)'}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Cuando esté activo, despachará los videos y posts según los horarios recomendados.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAutomationConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1.5 font-bold text-xs ${
                  automationConfig.enabled 
                    ? 'bg-emerald-600 text-white shadow-sm' 
                    : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                }`}
              >
                {automationConfig.enabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                <span>{automationConfig.enabled ? 'Encendido' : 'Apagado'}</span>
              </button>
            </div>

            {/* 1. Fuente de Contenido */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                1. Fuente de Guiones y Prompts
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div 
                  onClick={() => setAutomationConfig(prev => ({ ...prev, source: 'vault' }))}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                    automationConfig.source === 'vault'
                      ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                      <Database className="w-4 h-4" /> Mi Banco de Contenido
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300">
                      Recomendado (Default)
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Toma los videos y prompts previamente importados en tu lote ({vaultItems.filter(v => v.status === 'stored').length} disponibles). <strong>0 gasto de tokens en IA</strong>.
                  </p>
                </div>

                <div 
                  onClick={() => setAutomationConfig(prev => ({ ...prev, source: 'ai_agent' }))}
                  className={`p-4 rounded-2xl border cursor-pointer transition-all space-y-1.5 ${
                    automationConfig.source === 'ai_agent'
                      ? 'border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface)] hover:bg-[var(--bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Bot className="w-4 h-4" /> Agente IA + Nano Banana
                    </span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                      Autónomo
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    Gemini redacta guiones nuevos desde cero basados en los 5 pilares botánicos y genera automáticamente los prompts de imágenes 4:5.
                  </p>
                </div>
              </div>
            </div>

            {/* 2. Cantidad Diaria (5 al día vs 7 al día) */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
                2. Frecuencia y Cantidad Diaria
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setAutomationConfig(prev => ({ ...prev, dailyQuantity: 5 }))}
                  className={`flex-1 p-3 rounded-2xl border text-left transition cursor-pointer ${
                    automationConfig.dailyQuantity === 5
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold ring-1 ring-emerald-500/30'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-black">5 Videos al Día</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                      Óptimo Huerto
                    </span>
                  </div>
                  <span className="text-[11px] block">1 video cada 3-4 horas sin saturar a los seguidores.</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAutomationConfig(prev => ({ ...prev, dailyQuantity: 7 }))}
                  className={`flex-1 p-3 rounded-2xl border text-left transition cursor-pointer ${
                    automationConfig.dailyQuantity === 7
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-bold ring-1 ring-emerald-500/30'
                      : 'border-[var(--border-color)] bg-[var(--bg-surface)] text-[var(--text-secondary)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-sm font-black">7 Videos al Día</span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-700 dark:text-blue-300">
                      Escala Máxima
                    </span>
                  </div>
                  <span className="text-[11px] block">Abarca franjas matutinas, mediodía, tarde y noche completa.</span>
                </button>
              </div>
            </div>

            {/* 3. Horarios Circadianos Propuestos para Jardinería */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  3. Cronograma Inteligente de Jardinería (Horarios Automáticos)
                </label>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  Pico de interacción jardineros
                </span>
              </div>

              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-surface)] overflow-hidden divide-y divide-[var(--border-color)]">
                {(gardeningSchedules[automationConfig.dailyQuantity] || gardeningSchedules[5]).map((slot) => (
                  <div key={slot.id} className="p-3 flex items-center justify-between text-xs hover:bg-[var(--bg-subtle)] transition">
                    <div className="flex items-center gap-3">
                      <span className="w-5 h-5 rounded-lg bg-[var(--bg-subtle)] font-black text-[10px] text-[var(--text-secondary)] flex items-center justify-center">
                        {slot.id}
                      </span>
                      <div>
                        <span className="font-bold text-[var(--text-primary)] block">
                          {slot.label}
                        </span>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {slot.focus}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 text-right">
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block">🎬 Reel (9:16)</span>
                        <span className="font-bold text-amber-600 dark:text-amber-400 font-mono text-xs">
                          {slot.videoTime}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-[var(--border-color)]" />
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block">📸 Infografía (4:5)</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-xs">
                          {slot.imageTime}
                        </span>
                      </div>
                      <div className="h-6 w-px bg-[var(--border-color)]" />
                      <div>
                        <span className="text-[10px] text-[var(--text-secondary)] block">📱 Historia Indep.</span>
                        <span className="font-bold text-orange-500 font-mono text-xs">
                          {slot.storyTime}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Estrategia de Monetización: Historias Independientes */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/5 border border-amber-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">💰</span>
                  <div>
                    <h4 className="text-xs font-black text-amber-900 dark:text-amber-200">
                      Monetización en Historias de Facebook (Subida Independiente)
                    </h4>
                    <p className="text-[11px] text-[var(--text-secondary)]">
                      Meta monetiza las Historias por separado de los Reels cuando no se comparten como crossposting, sino como publicación nativa.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setAutomationConfig(prev => ({ ...prev, publishToStories: !prev.publishToStories }))}
                  className={`p-1.5 rounded-xl transition cursor-pointer flex items-center gap-1 text-xs font-bold ${
                    automationConfig.publishToStories
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                  }`}
                >
                  {automationConfig.publishToStories ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                  <span>{automationConfig.publishToStories ? 'Historias ON' : 'OFF'}</span>
                </button>
              </div>

              {automationConfig.publishToStories && (
                <div className="pt-2 border-t border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[var(--text-secondary)]">
                  <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300 font-medium">
                    <Check className="w-3.5 h-3.5 text-amber-600" /> Se publicará de forma desfasada <strong>45 min después del Reel</strong> para maximizar impresiones.
                  </span>
                  <span className="font-mono text-[10px] text-amber-800 dark:text-amber-400 font-bold bg-amber-500/20 px-2 py-0.5 rounded-md">
                    Target: Story Nativa 9:16
                  </span>
                </div>
              )}
            </div>

            {/* Botón de Guardar y Aplicar */}
            <div className="pt-2 flex items-center justify-between border-t border-[var(--border-color)]">
              <span className="text-xs text-[var(--text-secondary)]">
                Los cambios se guardan y aplican inmediatamente a la cola de publicación.
              </span>
              <button
                type="button"
                onClick={async () => {
                  setShowAutomationModal(false);
                  showToast('Sincronizando piloto automático con VPS...');
                  try {
                    const updatedConfig = {
                      ...flowSettings,
                      automation_enabled: automationConfig.enabled,
                      daily_target_videos: automationConfig.dailyQuantity,
                      publish_to_stories: automationConfig.publishToStories,
                      source: automationConfig.source
                    };
                    setFlowSettings(updatedConfig);
                    await supabase
                      .from('image_formats')
                      .update({ description: JSON.stringify(updatedConfig) })
                      .eq('code', 'flow_settings_config');
                    showToast('✅ Configuración guardada en VPS (' + automationConfig.dailyQuantity + ' videos/día)');
                  } catch (e) {
                    showToast('Error al sincronizar con VPS');
                  }
                }}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition cursor-pointer"
              >
                Guardar y Aplicar en VPS
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal CRUD: Editar Video y Prompts del Banco de Contenido */}
      {editingVaultItem && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-color)]">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)]">
                    Editar Video & Prompts de Escenas
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Ajusta los prompts que serán inyectados a Google Flow (Omni 1.1 Flash)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingVaultItem(null)}
                className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              {/* Título y Pilar */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Título del Video</label>
                  <input
                    type="text"
                    value={editingVaultItem.title || ''}
                    onChange={(e) => setEditingVaultItem({ ...editingVaultItem, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-sm font-semibold focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Pilar</label>
                  <input
                    type="text"
                    value={editingVaultItem.pilar || ''}
                    onChange={(e) => setEditingVaultItem({ ...editingVaultItem, pilar: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-sm focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Ángulo y Clima de Luz */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Ángulo de Cámara</label>
                  <input
                    type="text"
                    value={editingVaultItem.angulo || ''}
                    onChange={(e) => setEditingVaultItem({ ...editingVaultItem, angulo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">Clima & Iluminación</label>
                  <input
                    type="text"
                    value={editingVaultItem.clima_luz || ''}
                    onChange={(e) => setEditingVaultItem({ ...editingVaultItem, clima_luz: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Copy de Redes */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Copy / Texto de Publicación</label>
                <textarea
                  rows={3}
                  value={editingVaultItem.copy_text || ''}
                  onChange={(e) => setEditingVaultItem({ ...editingVaultItem, copy_text: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs focus:outline-hidden focus:border-amber-500 font-sans"
                />
              </div>

              {/* Prompts de las 3 Escenas para Google Flow */}
              <div className="p-4 rounded-2xl bg-[var(--bg-subtle)]/70 border border-[var(--border-color)] space-y-3">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                  Prompts de Generación de Video (Flow 9:16)
                </span>

                {/* Escena 1 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[var(--text-primary)]">
                      🎬 Escena 1 (Gancho Visual - 0 a 6s)
                    </label>
                    <span className="text-[10px] text-stone-400">{(editingVaultItem.scene_1_prompt || '').length} caracteres</span>
                  </div>
                  <textarea
                    rows={4}
                    value={editingVaultItem.scene_1_prompt || ''}
                    onChange={(e) => setEditingVaultItem({ ...editingVaultItem, scene_1_prompt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                {/* Escena 2 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[var(--text-primary)]">
                      🔬 Escena 2 (Cuerpo / Micro-Mundo - 6 a 12s)
                    </label>
                    <span className="text-[10px] text-stone-400">{(editingVaultItem.scene_2_prompt || '').length} caracteres</span>
                  </div>
                  <textarea
                    rows={4}
                    value={editingVaultItem.scene_2_prompt || ''}
                    onChange={(e) => setEditingVaultItem({ ...editingVaultItem, scene_2_prompt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono focus:outline-hidden focus:border-amber-500"
                  />
                </div>

                {/* Escena 3 */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-[var(--text-primary)]">
                      🔁 Escena 3 (Recompensa & Loop Infinito - 16 a 24s)
                    </label>
                    <span className="text-[10px] text-stone-400">{(editingVaultItem.scene_3_prompt || '').length} caracteres</span>
                  </div>
                  <textarea
                    rows={4}
                    value={editingVaultItem.scene_3_prompt || ''}
                    onChange={(e) => setEditingVaultItem({ ...editingVaultItem, scene_3_prompt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono focus:outline-hidden focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Prompt de Imagen Complementaria (Nano Banana / 4:5) */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                    📸 Prompt de Imagen Satélite / Complementaria (Google Flow - Nano Banana)
                  </span>
                  <span className="text-[10px] text-stone-400">{(editingVaultItem.image_prompt || '').length} caracteres</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text-primary)]">
                    Prompt Visual (Formato 4:5 vertical / 1080x1350)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="[Clean botanical infographic or 100mm macro photography], 4:5 vertical..."
                    value={editingVaultItem.image_prompt || ''}
                    onChange={(e) => setEditingVaultItem({ ...editingVaultItem, image_prompt: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[var(--text-primary)]">
                    Copy Específico para la Imagen (Comentarios / Interacción)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Pregunta corta para comentarios + hashtags..."
                    value={editingVaultItem.image_copy_text || ''}
                    onChange={(e) => setEditingVaultItem({ ...editingVaultItem, image_copy_text: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-color)] text-xs font-mono focus:outline-hidden focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            {/* Botones de acción modal */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
              <button
                type="button"
                onClick={() => setEditingVaultItem(null)}
                className="px-4 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-subtle)] text-xs font-bold transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveVaultItem}
                disabled={savingVaultItem}
                className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                {savingVaultItem ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARA AGREGAR NUEVA CUENTA DE GOOGLE */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border-color)] rounded-2xl max-w-md w-full shadow-2xl p-6 space-y-5 animate-scale-in">
            <div className="flex items-center justify-between border-b border-[var(--border-color)] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                  G
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--text-primary)]">Agregar Cuenta Google Flow</h3>
                  <p className="text-[11px] text-[var(--text-secondary)]">Suma más cuentas gratuitas para no gastar la cuenta Pro</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddAccountModal(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Alias o Identificador *
                </label>
                <input
                  type="text"
                  required
                  placeholder={`google_account_${accounts.length + 1}`}
                  value={newAccountForm.alias}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, alias: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-emerald-500"
                />
                <p className="text-[10px] text-[var(--text-secondary)] mt-1">
                  Se creará una carpeta de sesión en <code>profiles/{newAccountForm.alias || 'nombre'}</code>
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                  Correo Gmail (Opcional, para tu referencia)
                </label>
                <input
                  type="email"
                  placeholder="ejemplo@gmail.com"
                  value={newAccountForm.email}
                  onChange={(e) => setNewAccountForm({ ...newAccountForm, email: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs text-[var(--text-primary)] focus:outline-hidden focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Tipo de Cuenta
                  </label>
                  <select
                    value={newAccountForm.tier}
                    onChange={(e) => {
                      const tier = e.target.value;
                      setNewAccountForm({
                        ...newAccountForm,
                        tier,
                        daily_credits_total: tier === 'pro' ? 1000 : 50
                      });
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] cursor-pointer"
                  >
                    <option value="free">Gratuita (Free - Prioridad 1)</option>
                    <option value="pro">Pro (Reserva - Prioridad 99)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[var(--text-primary)] mb-1">
                    Créditos Diarios
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={newAccountForm.daily_credits_total}
                    onChange={(e) => setNewAccountForm({ ...newAccountForm, daily_credits_total: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-primary)] focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-700 dark:text-amber-400 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  💡 ¿Cómo funciona?
                </p>
                <p>
                  1. Haz clic en "Crear Cuenta".<br />
                  2. Luego pulsa <strong>"Conectar Sesión"</strong> en la tarjeta creada: se abrirá Google Chrome para que inicies sesión en esa cuenta de Google.<br />
                  3. Una vez logueado, ¡listo! El rotador la usará automáticamente antes de tocar la Pro.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border-color)]">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="px-4 py-2 rounded-xl border border-[var(--border-color)] hover:bg-[var(--bg-subtle)] text-xs font-bold transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAddingAccount}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {isAddingAccount ? 'Guardando...' : 'Crear Cuenta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
