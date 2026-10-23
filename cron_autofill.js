import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getConfig() {
  try {
    const { data } = await supabase
      .from('image_formats')
      .select('description')
      .eq('code', 'flow_settings_config')
      .single();
    if (data && data.description) {
      return JSON.parse(data.description);
    }
  } catch (e) {
    console.warn('[Autofill] Advertencia cargando configuración:', e.message);
  }
  return {
    automation_enabled: true,
    daily_target_videos: 5,
    min_queue_buffer: 3
  };
}

async function checkAndRender() {
  try {
    const config = await getConfig();

    // 1. Interruptor Maestro (Kill-Switch)
    if (config.automation_enabled === false) {
      console.log('[Autofill] ⏸️ Automatización en PAUSA por configuración de administrador.');
      return;
    }

    const minBuffer = Number(config.min_queue_buffer) || 3;

    // 2. Revisar cuántos videos listos para publicar existen en video_jobs
    const { data: readyVideos, error: readyErr } = await supabase
      .from('video_jobs')
      .select('id')
      .eq('status', 'ready_to_publish')
      .not('final_video_url', 'is', null);

    if (readyErr) {
      console.error('[Autofill] Error consultando ready_to_publish:', readyErr.message);
      return;
    }

    const readyCount = readyVideos?.length || 0;
    console.log(`[Autofill] Videos listos en cola: ${readyCount} (Mínimo requerido: ${minBuffer})`);

    // Si hay menos del buffer configurado (ej: 3, 5, 7), alimentar la cola
    if (readyCount < minBuffer) {
      // Prioridad A: video_jobs existentes que aún no tienen final_video_url
      let { data: pendingJob } = await supabase
        .from('video_jobs')
        .select('id, title')
        .is('final_video_url', null)
        .in('status', ['ready_to_publish', 'needs_review', 'rendering'])
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      // Prioridad B: Si no hay video_jobs pendientes, tomar el siguiente de content_vault
      if (!pendingJob) {
        const { data: vaultItem, error: vaultErr } = await supabase
          .from('content_vault')
          .select('*')
          .eq('status', 'stored')
          .neq('title', 'El Error de la Cáscara de Huevo')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (vaultErr) {
          console.error('[Autofill] Error consultando content_vault:', vaultErr.message);
          return;
        }

        if (vaultItem) {
          console.log(`[Autofill] Promoviendo idea del Vault a video_jobs: "${vaultItem.title}"`);
          const { data: createdJob, error: createErr } = await supabase
            .from('video_jobs')
            .insert({
              title: vaultItem.title,
              topic: vaultItem.pilar || vaultItem.title,
              pilar: vaultItem.pilar,
              angulo: vaultItem.angulo,
              clima_luz: vaultItem.clima_luz,
              copy_text: vaultItem.copy_text,
              hashtags: vaultItem.hashtags || [],
              scene_1_prompt: vaultItem.scene_1_prompt,
              scene_2_prompt: vaultItem.scene_2_prompt,
              scene_3_prompt: vaultItem.scene_3_prompt,
              image_prompt: vaultItem.image_prompt,
              image_copy_text: vaultItem.image_copy_text,
              status: 'ready_to_publish',
              aspect_ratio: '9:16',
              target_platforms: ['facebook'],
              brand_id: vaultItem.brand_id || '06a68062-00c0-413d-b41f-b2229b9d52da'
            })
            .select()
            .single();

          if (createErr) {
            console.error('[Autofill] Error creando video_job:', createErr.message);
            return;
          }

          // Marcar el item del vault como 'promoted'
          await supabase
            .from('content_vault')
            .update({ status: 'promoted' })
            .eq('id', vaultItem.id);

          pendingJob = createdJob;
        }
      }

      if (pendingJob) {
        console.log(`[Autofill] Disparando render en Flow Engine para: ${pendingJob.id} - ${pendingJob.title}`);
        try {
          const res = await fetch('http://localhost:3001/api/flow/render', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ jobId: pendingJob.id, mode: 'full' })
          });
          const resJson = await res.json();
          console.log('[Autofill] Respuesta de API Flow:', resJson);
        } catch (fetchErr) {
          console.warn('[Autofill] No se pudo conectar a Flow API (posiblemente ocupado):', fetchErr.message);
        }
      } else {
        console.log('[Autofill] No hay contenido pendiente ni en video_jobs ni en content_vault.');
      }
    }
  } catch (err) {
    console.error('[Autofill] Error inesperado:', err.message);
  }
}

// Ejecutar de inmediato y luego cada 5 minutos
checkAndRender();
setInterval(checkAndRender, 5 * 60 * 1000);
