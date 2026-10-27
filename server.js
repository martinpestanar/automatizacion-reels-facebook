import { generateVaultBatch } from './src/generator/vault_generator_24s.js';
import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { executeFlowRender } from './src/worker_flow.js';
import { launchLoginSession } from './src/accounts/setup.js';
import { checkAndRender } from './cron_autofill.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/renders', express.static(path.resolve('temp_renders')));

let isRunning = false;
let currentProgress = {
  jobId: null,
  stage: 'idle',
  pct: 0,
  message: 'Listo',
  isRunning: false
};
const serverStartTime = new Date();

// ─── Render endpoint ──────────────────────────────────────────────────────────
app.post('/api/flow/render', async (req, res) => {
  const { jobId, mode } = req.body;
  if (isRunning) {
    return res.status(429).json({ error: 'Ya hay un render en proceso en Google Flow.' });
  }

  isRunning = true;
  currentProgress = {
    jobId,
    mode,
    stage: 'queued',
    pct: 5,
    message: 'Iniciando conexión con Flow...',
    isRunning: true
  };

  res.json({ success: true, message: 'Worker iniciado', jobId, mode });

  try {
    console.log(`📡 Recibida petición de render para Job: ${jobId}, Modo: ${mode}`);
    await executeFlowRender(jobId, mode === 'scene_1' ? 'single_scene_1' : 'full_video_3_scenes', (prog) => {
      currentProgress = { ...currentProgress, ...prog, isRunning: true };
    });
  } catch (err) {
    console.error('Error ejecutando render desde API:', err);
    currentProgress = {
      jobId,
      stage: 'error',
      pct: 0,
      message: err.message || 'Error en el render',
      isRunning: false
    };
  } finally {
    isRunning = false;
    currentProgress.isRunning = false;

    // Disparar el siguiente en cola con 3s de pausa
    setTimeout(() => {
      checkAndRender().catch(err => console.warn('[Autofill Next] Error:', err.message));
    }, 3000);
  }
});

// ─── Status endpoint ──────────────────────────────────────────────────────────
app.get('/api/flow/status', (req, res) => {
  res.json({ isRunning, progress: currentProgress });
});

// ─── Health-check endpoint ────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  const uptimeMs = Date.now() - serverStartTime.getTime();
  const uptimeMin = Math.round(uptimeMs / 60000);
  res.json({
    status: 'ok',
    uptime_minutes: uptimeMin,
    isRunning,
    currentJob: currentProgress.jobId || null,
    stage: currentProgress.stage,
    timestamp: new Date().toISOString()
  });
});

// ─── Sesiones de cuentas ──────────────────────────────────────────────────────
app.get('/api/accounts/sessions', (req, res) => {
  const profilesDir = path.resolve('profiles');
  const sessionStatus = {};
  const detectedEmails = {};

  try {
    if (fs.existsSync(profilesDir)) {
      const items = fs.readdirSync(profilesDir, { withFileTypes: true });
      for (const item of items) {
        if (item.isDirectory()) {
          const alias = item.name;
          const c1 = path.join(profilesDir, alias, 'Default', 'Network', 'Cookies');
          const c2 = path.join(profilesDir, alias, 'Default', 'Cookies');
          const hasCookies = (fs.existsSync(c1) && fs.statSync(c1).size > 0) || (fs.existsSync(c2) && fs.statSync(c2).size > 0);
          sessionStatus[alias] = hasCookies;

          const prefPath = path.join(profilesDir, alias, 'Default', 'Preferences');
          if (fs.existsSync(prefPath)) {
            try {
              const prefText = fs.readFileSync(prefPath, 'utf8');
              const matches = prefText.match(/[a-zA-Z0-9._%+-]+@gmail\.com|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
              const valid = matches.filter(e => !e.includes('google.com') && !e.includes('chromium.org'));
              if (valid.length > 0) detectedEmails[alias] = valid[0];
            } catch (e) {}
          }
        }
      }
    }
    res.json({ success: true, sessions: sessionStatus, emails: detectedEmails });
  } catch (err) {
    res.status(500).json({ error: err.message, sessions: {}, emails: {} });
  }
});

// ─── Login asistido ───────────────────────────────────────────────────────────
app.post('/api/accounts/login', async (req, res) => {
  const { alias } = req.body;
  if (!alias) return res.status(400).json({ error: 'Alias de cuenta requerido' });

  try {
    console.log(`🌐 Abriendo navegador asistido para login en: ${alias}`);
    launchLoginSession(alias).catch(err => {
      console.error(`Error en sesión de login para ${alias}:`, err);
    });
    res.json({ success: true, message: `Navegador abierto para ${alias}. Inicia sesión en Google y ciérralo cuando termines.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ─── Generación de Cards para Content Vault ───────────────────────────────────
app.post('/api/vault/generate', async (req, res) => {
  const count = parseInt(req.body?.count, 10) || 10;
  const pilar = req.body?.pilar || null;
  const focusCrops = Array.isArray(req.body?.focusCrops) ? req.body.focusCrops : null;

  try {
    console.log(`🎨 Petición recibida para generar ${count} cards en el Vault...`);
    if (pilar) console.log(`   Pilar: ${pilar}`);
    if (focusCrops) console.log(`   Cultivos: ${focusCrops.join(', ')}`);

    generateVaultBatch(count, { pilar, focusCrops }).catch(err => console.error('[Vault API Async Error]', err.message));
    res.json({ success: true, message: `Generación de ${count} cards iniciada con éxito.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Arranque del servidor ────────────────────────────────────────────────────
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`🚀 Flow Engine Local API escuchando en http://localhost:${PORT}`);
  console.log(`❤️  Health-check disponible en http://localhost:${PORT}/api/health`);

  // Primera ejecución inmediata al arrancar
  checkAndRender().catch(e => console.error('[Autofill Arranque]', e.message));

  
  // ─── CRON DE AUTOLIMPIEZA CADA 24 HORAS (Archivos temporales y jobs huérfanos) ──
  const purgeOldTempFiles = () => {
    try {
      const tempPath = path.resolve('temp_renders');
      if (fs.existsSync(tempPath)) {
        const files = fs.readdirSync(tempPath);
        const now = Date.now();
        const MAX_AGE = 24 * 60 * 60 * 1000; // 24 horas
        for (const file of files) {
          const filePath = path.join(tempPath, file);
          const stats = fs.statSync(filePath);
          if (now - stats.mtimeMs > MAX_AGE) {
            fs.unlinkSync(filePath);
            console.log(`🧹 [AutoLimpieza 24h] Eliminado temporal antiguo: ${file}`);
          }
        }
      }
    } catch (e) {
      console.warn('[AutoLimpieza 24h Error]:', e.message);
    }
  };

  // Ejecutar limpieza cada 24 horas (y una al inicio)
  purgeOldTempFiles();
  setInterval(purgeOldTempFiles, 24 * 60 * 60 * 1000);

  // ─── CRON MATUTINO DIARIO (07:00 AM): Auto-generar 10 cards en content_vault ──
  let lastVaultGenerationDate = null;
  setInterval(async () => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    if (now.getHours() === 7 && now.getMinutes() < 5 && lastVaultGenerationDate !== todayStr) {
      lastVaultGenerationDate = todayStr;
      console.log(`🌅 [07:00 AM] Disparando generación matutina de 10 cards para el Vault...`);
      try {
        await generateVaultBatch(10);
      } catch (err) {
        console.error('[Vault Morning Cron Error]', err.message);
      }
    }
  }, 60 * 1000);

  // Cron cada 60 segundos (el finally del render ya dispara el siguiente inmediatamente)
  setInterval(async () => {
    if (!isRunning) {
      try {
        await checkAndRender();
      } catch (e) {
        console.error('[Autofill Cron]', e.message);
      }
    }
  }, 60 * 1000);
});
