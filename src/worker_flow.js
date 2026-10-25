import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import https from 'https';
import crypto from 'crypto';
import { execSync } from 'child_process';
import { stitchScenes } from './stitcher/index.js';
import { getAvailableAccount, recordAccountUsage } from './accounts/rotator.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CHROME_PATH = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/google-chrome-stable';

// ─── Timeouts configurables ───────────────────────────────────────────────────
const TILE_APPEAR_ATTEMPTS  = 30;  // 30 × 2 s = 60 s para que aparezca el nuevo tile
const TILE_APPEAR_INTERVAL  = 2000;
const TILE_READY_ATTEMPTS   = 120; // 120 × 3 s = 6 min para que el tile llegue al 100 %
const TILE_READY_INTERVAL   = 3000;
const DOWNLOAD_TIMEOUT      = 90000; // 90 s para descargar el clip

async function getFlowSettings() {
  const { data } = await supabase
    .from('image_formats')
    .select('description')
    .eq('code', 'flow_settings_config')
    .maybeSingle();

  if (data && data.description) {
    try { return JSON.parse(data.description); } catch (e) { /* ignore */ }
  }

  return {
    mediaType: 'video',
    generationMode: 'ingredients',
    aspectRatio: '9:16',
    modelName: 'Omni 1.1 Flash',
    resolution: '720p',
    duration: '8s',
    variants: 'x1'
  };
}

// ─── Descarga un archivo de una URL a disco (para reanudar desde checkpoint) ──
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// ─── Lanza y configura el contexto del navegador ─────────────────────────────
async function launchBrowser(profileDir) {
  const launchArgs = [
    '--disable-blink-features=AutomationControlled',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check'
  ];

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: launchArgs
  });

  return context;
}

// ─── Abre Google Flow y configura ajustes ────────────────────────────────────
async function openFlowAndConfigure(context, settings, report) {
  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  report('navigating', 10, 'Accediendo a Google Flow...');
  await page.goto('https://flow.google.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3500);

  // 1. Abrir proyecto existente o crear nuevo
  console.log('📂 Buscando proyecto en Google Flow...');
  const projectLocator = page.locator('a.project-thumbnail-container, a[aria-label*="proyecto" i], a[aria-label*="project" i], div.project-card, .project-tile').first();
  const hasProject = await projectLocator.isVisible({ timeout: 6000 }).catch(() => false);

  if (hasProject) {
    console.log('Abriendo proyecto existente...');
    await projectLocator.click();
  } else {
    console.log('Creando nuevo proyecto en Google Flow...');
    const newBtn = page.locator('button.new-project-button, button:has-text("Nuevo proyecto"), button:has-text("New project"), button:has-text("Crear"), button:has-text("Create"), a:has-text("New project")').first();
    if (await newBtn.isVisible({ timeout: 8000 }).catch(() => false)) {
      await newBtn.click();
    } else {
      console.log('Navegando directamente a nuevo proyecto Flow...');
      await page.goto('https://flow.google.com/project/new', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
    }
  }

  await page.waitForTimeout(4000);
  console.log('URL de área de trabajo activa:', page.url());

  // 2. Limpiar banners y backdrops
  try {
    await page.evaluate(() => {
      document.querySelectorAll('.glue-cookie-notification-bar, #glue-cookie-notification-bar-1').forEach(el => el.remove());
      document.querySelectorAll('.cdk-overlay-backdrop').forEach(el => el.remove());
    }).catch(() => {});

    const activeBackdrops = page.locator('.cdk-overlay-backdrop');
    if ((await activeBackdrops.count()) > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  } catch (e) {
    console.warn('Aviso limpiando backdrops y banners:', e.message);
  }

  // 3. Cerrar panel de agente si está abierto
  try {
    const closeAgentPanel = page.locator('button.header-action:has-text("close"), button[aria-label="Cerrar"], button[aria-label="Close"]').first();
    if (await closeAgentPanel.isVisible({ timeout: 1500 }).catch(() => false)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      if (await closeAgentPanel.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeAgentPanel.dispatchEvent('click').catch(async () => {
          await closeAgentPanel.click({ timeout: 2000, force: true }).catch(() => {});
        });
      }
      await page.waitForTimeout(600);
    }
  } catch (closeErr) {
    await page.keyboard.press('Escape');
  }

  // 4. Desactivar modo Agente si aplica
  const agentIndicator = page.locator('button[aria-label*="Instrucciones del agente" i]').first();
  if (await agentIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
    const agentChip = page.locator('.agent-mode-chip, button:has-text("Agente"), button:has-text("Agent")').first();
    if (await agentChip.isVisible()) {
      await agentChip.click();
      await page.waitForTimeout(1000);
    }
  }

  // 5. Configurar parámetros de Google Flow
  console.log('📐 Configurando parámetros de video...', settings);
  report('configuring', 12, `Aplicando modelo ${settings.modelName || 'Omni 1.1 Flash'}...`);

  const trigger = page.locator('button.settings-trigger-button').first();
  await trigger.waitFor({ state: 'visible', timeout: 15000 });
  await trigger.click();
  await page.waitForTimeout(1000);

  // Modo Vídeo / Imagen
  if (settings.mediaType === 'image') {
    const imgToggle = page.locator('mat-button-toggle:has-text("Imagen"), mat-button-toggle:has-text("Image")').first();
    if (await imgToggle.isVisible()) await imgToggle.click();
  } else {
    const videoToggle = page.locator('mat-button-toggle:has-text("Vídeo"), mat-button-toggle:has-text("Video")').first();
    if (await videoToggle.isVisible()) await videoToggle.click();
  }
  await page.waitForTimeout(500);

  // Tipo de vídeo
  if (settings.generationMode === 'frames') {
    const framesToggle = page.locator('mat-button-toggle:has-text("Fotogramas"), mat-button-toggle:has-text("Frames")').first();
    if (await framesToggle.isVisible()) await framesToggle.click();
  } else {
    const ingToggle = page.locator('mat-button-toggle:has-text("Ingredientes"), mat-button-toggle:has-text("Ingredients")').first();
    if (await ingToggle.isVisible()) await ingToggle.click();
  }
  await page.waitForTimeout(500);

  // Relación de aspecto
  if (settings.aspectRatio === '16:9') {
    const toggle169 = page.locator('mat-button-toggle:has-text("16:9"), mat-button-toggle:has-text("crop_16_9")').first();
    if (await toggle169.isVisible()) await toggle169.click();
  } else {
    const toggle916 = page.locator('mat-button-toggle:has-text("9:16"), mat-button-toggle:has-text("crop_9_16")').first();
    if (await toggle916.isVisible()) await toggle916.click();
  }
  await page.waitForTimeout(500);

  // Modelo
  const modelBtn = page.locator('.cdk-overlay-container button[aria-label="Seleccionar familia de modelos"], .cdk-overlay-container button:has(mat-icon:has-text("arrow_drop_down"))').first();
  if (await modelBtn.isVisible()) {
    await modelBtn.click();
    await page.waitForTimeout(1000);

    let modelSelector = 'button[role="menuitem"]:has-text("Omni")';
    if (settings.modelName?.includes('Lite')) modelSelector = 'button[role="menuitem"]:has-text("Lite")';
    else if (settings.modelName?.includes('Fast')) modelSelector = 'button[role="menuitem"]:has-text("Fast")';
    else if (settings.modelName?.includes('Quality')) modelSelector = 'button[role="menuitem"]:has-text("Quality")';

    const modelOption = page.locator(modelSelector).first();
    if (await modelOption.isVisible()) {
      await modelOption.click();
      await page.waitForTimeout(1200);
    } else {
      console.warn(`Modelo no encontrado: ${modelSelector}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  }

  // Resolución
  if (settings.resolution === '360p') {
    const res360 = page.locator('mat-button-toggle:has-text("360p")').first();
    if (await res360.isVisible()) await res360.click();
  } else {
    const res720 = page.locator('mat-button-toggle:has-text("720p")').first();
    if (await res720.isVisible()) await res720.click();
  }
  await page.waitForTimeout(400);

  // Duración
  const durNum = settings.duration?.replace('s', '').trim() || '6';
  const durToggle = page.locator(`mat-button-toggle:has-text("${durNum} s"), mat-button-toggle:has-text("${durNum}s")`).first();
  if (await durToggle.isVisible()) {
    await durToggle.click();
    await page.waitForTimeout(400);
  }

  // Variantes
  const varStr = settings.variants || 'x1';
  const varToggle = page.locator(`mat-button-toggle:has-text("${varStr}")`).first();
  if (await varToggle.isVisible()) {
    await varToggle.click();
    await page.waitForTimeout(400);
  }

  // Cerrar panel de ajustes
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  const backdrop = page.locator('.cdk-overlay-backdrop').first();
  if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  if (await backdrop.isVisible({ timeout: 1000 }).catch(() => false)) {
    await backdrop.click({ force: true }).catch(() => {});
    await page.waitForTimeout(500);
  }

  const triggerText = await trigger.innerText().catch(() => '');
  console.log('✅ Parámetros Flow activados:', triggerText.replace(/\n/g, ' '));

  return page;
}

// ─── Genera una escena en Google Flow y devuelve la ruta local del clip ───────
async function generateScene(page, sc, job, tempDir, downloadedClips, report, basePct) {
  // Limpiar backdrops residuales
  const lingeringBackdrop = page.locator('.cdk-overlay-backdrop').first();
  if (await lingeringBackdrop.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }

  // Contar tiles antes de enviar el prompt
  const prevTilesCount = await page.locator('flow-video-tile, flow-grid-tile-container').count();

  // Asegurar que el prompt enviado a Google Flow indique explícitamente idioma español
  let finalPrompt = sc.prompt || '';
  if (!finalPrompt.includes('IDIOMA') && !finalPrompt.includes('ESPAÑOL')) {
    finalPrompt = `[DIRECTIVA OBLIGATORIA: Todo texto visible en pantalla y todo audio/voz debe ser EXCLUSIVAMENTE en ESPAÑOL NEUTRO. No usar inglés.]\n` + finalPrompt;
  }

  const input = page.locator('.ProseMirror, [contenteditable="true"]').first();
  await input.waitFor({ state: 'visible', timeout: 20000 });
  await input.click({ force: true });
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Backspace');
  await page.keyboard.insertText(finalPrompt);
  await page.waitForTimeout(800);

  console.log(`⏳ Enviando prompt de Escena ${sc.num} a Google Flow...`);
  report(`scene_${sc.num}_generating`, basePct + 5, `Generando Escena ${sc.num} en Google Flow...`);

  // Intentar enviar hasta 3 veces; esperar hasta 60 s para que aparezca un nuevo tile
  let newTileAppeared = false;
  for (let sendAttempt = 0; sendAttempt < 3; sendAttempt++) {
    const submitBtn = page.locator('button:has(mat-icon:has-text("arrow_forward")), button.generate-icon-button, button[aria-label*="generación" i], button[aria-label*="generate" i], button:has-text("arrow_forward")').first();
    if (await submitBtn.isVisible() && !(await submitBtn.isDisabled())) {
      await submitBtn.click({ force: true });
    } else {
      await input.focus();
      await page.keyboard.press('Enter');
    }

    // Esperar hasta TILE_APPEAR_ATTEMPTS × TILE_APPEAR_INTERVAL que aparezca el nuevo tile
    for (let waitCount = 0; waitCount < TILE_APPEAR_ATTEMPTS; waitCount++) {
      await page.waitForTimeout(TILE_APPEAR_INTERVAL);
      const currentCount = await page.locator('flow-video-tile, flow-grid-tile-container').count();
      if (currentCount > prevTilesCount) {
        console.log(`🆕 Nueva tarjeta de Escena ${sc.num} creada (Total: ${currentCount}, Anterior: ${prevTilesCount})`);
        newTileAppeared = true;
        break;
      }
    }
    if (newTileAppeared) break;
    console.warn(`⚠️ Intento ${sendAttempt + 1}: Flow no creó la nueva tarjeta para Escena ${sc.num}. Reintentando...`);
  }

  if (!newTileAppeared) {
    throw new Error(`Google Flow no inició la generación de la Escena ${sc.num} tras 3 intentos (sin nueva tarjeta en galería).`);
  }

  // Verificar que la tarjeta superior esté renderizando (si hay clips previos)
  if (downloadedClips.length > 0) {
    for (let waitGen = 0; waitGen < 15; waitGen++) {
      const topText = await page.locator('flow-video-tile, flow-grid-tile-container').first().innerText().catch(() => '');
      if (topText.includes('%') || !topText.includes('play_circle')) {
        console.log(`⚡ Tarjeta superior renderizando activamente...`);
        break;
      }
      await page.waitForTimeout(1000);
    }
  }

  console.log(`⏳ Esperando que Escena ${sc.num} llegue al 100%... (máx ${TILE_READY_ATTEMPTS * TILE_READY_INTERVAL / 1000}s)`);
  report(`scene_${sc.num}_processing`, basePct + 5, `Esperando 100% de Escena ${sc.num}...`);

  // Esperar hasta TILE_READY_ATTEMPTS × TILE_READY_INTERVAL (6 min) a que el tile esté listo
  let tileReady = false;
  let targetTile = page.locator('flow-video-tile, flow-grid-tile-container').first();
  for (let attempt = 0; attempt < TILE_READY_ATTEMPTS; attempt++) {
    targetTile = page.locator('flow-video-tile, flow-grid-tile-container').first();
    const text = await targetTile.innerText().catch(() => '');
    const isGenerating = text.includes('%') || text.includes('Generando') || text.includes('Generating') || text.includes('Renderizando');
    
    // Un tile está realmente listo si NO está en progreso (%) Y pasaron al menos 20 segundos
    if (!isGenerating && attempt >= 7 && (text.includes('play_circle') || text.includes('0:08') || text.includes('8s') || text.trim().length > 0)) {
      tileReady = true;
      console.log(`✅ Escena ${sc.num} lista en el intento ${attempt + 1} (${(attempt + 1) * TILE_READY_INTERVAL / 1000}s)`);
      break;
    }
    if (attempt % 5 === 0) {
      console.log(`⏳ Escena ${sc.num} aún renderizando... (${attempt * TILE_READY_INTERVAL / 1000}s / ${TILE_READY_ATTEMPTS * TILE_READY_INTERVAL / 1000}s)`);
    }
    await page.waitForTimeout(TILE_READY_INTERVAL);
  }

  if (!tileReady) {
    throw new Error(`Timeout: Escena ${sc.num} no completó el render en ${TILE_READY_ATTEMPTS * TILE_READY_INTERVAL / 1000}s`);
  }

  await page.waitForTimeout(2000);

  // Abrir la tarjeta haciendo clic en su centro para mostrar la barra de control/acciones
  console.log(`🔍 Abriendo tarjeta de Escena ${sc.num}...`);
  await page.waitForTimeout(1000);
  const currentTile = page.locator('flow-grid-tile-container, flow-video-tile').first();
  await currentTile.scrollIntoViewIfNeeded().catch(() => {});
  const box = await currentTile.boundingBox();
  if (box) {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await currentTile.click({ force: true }).catch(() => {});
  }
  await page.waitForTimeout(2000);

  // Botón Descargar en la barra de la tarjeta seleccionada
  const dlBtn = page.locator('button[aria-label*="Descargar" i], button[aria-label*="Download" i]').first();
  await dlBtn.waitFor({ state: 'visible', timeout: 25000 });
  await dlBtn.click({ force: true });
  await page.waitForTimeout(1000);

  const opt720 = page.locator('.cdk-overlay-container button:has-text("720p"), .cdk-overlay-container [role="menuitem"]:has-text("720p"), button[role="menuitem"]:has-text("720p")').first();
  await opt720.waitFor({ state: 'visible', timeout: 15000 });

  const clipPath = path.join(tempDir, `clip_${job.id}_s${sc.num}.mp4`);
  console.log(`📥 Descargando Escena ${sc.num}...`);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT }),
    opt720.click({ force: true })
  ]);
  await download.saveAs(clipPath);

  // Cerrar cualquier menú residual abierto
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Verificación de integridad MD5
  const clipBuffer = fs.readFileSync(clipPath);
  const currentHash = crypto.createHash('md5').update(clipBuffer).digest('hex');
  console.log(`🔍 Integridad de Escena ${sc.num} (MD5: ${currentHash.slice(0, 8)}...)`);

  if (downloadedClips.length > 0) {
    const prevClipPath = downloadedClips[downloadedClips.length - 1];
    const prevHash = crypto.createHash('md5').update(fs.readFileSync(prevClipPath)).digest('hex');
    if (currentHash === prevHash) {
      console.warn(`⚠️ Escena ${sc.num} es idéntica a la anterior (MD5: ${currentHash.slice(0, 8)}). Reintentando descarga...`);
      for (let k = 0; k < 3; k++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
      await page.waitForTimeout(15000);
      const latestTile = page.locator('flow-video-tile, flow-grid-tile-container').first();
      await latestTile.click({ force: true });
      await page.waitForTimeout(2500);

      const freshDl = page.locator('button[aria-label*="Descargar" i], button[aria-label*="Download" i]').first();
      await freshDl.waitFor({ state: 'visible', timeout: 25000 });
      await freshDl.click();
      await page.waitForTimeout(1000);

      const freshOpt = page.locator('.cdk-overlay-container button[role="menuitem"]:has-text("720p"), button[role="menuitem"]:has-text("720p")').first();
      const [retryDl] = await Promise.all([
        page.waitForEvent('download', { timeout: DOWNLOAD_TIMEOUT }),
        freshOpt.click()
      ]);
      await retryDl.saveAs(clipPath);

      const retryHash = crypto.createHash('md5').update(fs.readFileSync(clipPath)).digest('hex');
      if (retryHash === prevHash) {
        throw new Error(`Escena ${sc.num} duplicó exactamente la escena anterior (hash idéntico)`);
      }
    }
  }

  // Asegurar que el input de prompt esté libre y listo para la siguiente escena
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  const promptInput = page.locator('.ProseMirror, [contenteditable="true"]').first();
  await promptInput.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(800);

  return clipPath;
}

// ─── Auto-limpieza de archivos temporales locales tras render exitoso ─────────
function cleanupTempFiles(filePaths) {
  for (const fp of filePaths) {
    if (fp && fs.existsSync(fp)) {
      fs.unlink(fp, (err) => {
        if (!err) console.log(`🧹 [Limpieza] Borrado temporal: ${path.basename(fp)}`);
      });
    }
  }
}

// ─── Función principal de render ──────────────────────────────────────────────
export async function executeFlowRender(jobId = null, mode = 'full_video_3_scenes', onProgress = null) {
  const report = (stage, pct, message) => {
    if (onProgress) onProgress({ stage, pct, message, jobId });
  };

  console.log(`\n======================================================`);
  console.log(`🚀 Iniciando Generación de Video en Google Flow`);
  console.log(`Modo: ${mode === 'single_scene_1' ? 'Escena 1 Individual' : 'Video Completo (3 escenas)'}`);
  console.log(`======================================================\n`);

  // Cargar el job
  let query = supabase.from('video_jobs').select('*');
  if (jobId) {
    query = query.eq('id', jobId);
  } else {
    query = query
      .in('status', ['ready_to_publish', 'rendering', 'needs_review'])
      .is('final_video_url', null)
      .order('created_at', { ascending: true });
  }
  const { data: job, error: jobError } = await query.limit(1).single();

  if (jobError || !job) {
    console.log('ℹ️ No hay video pendiente.');
    report('idle', 0, 'Sin tareas pendientes');
    return;
  }

  // Marcar como rendering inmediatamente
  await supabase.from('video_jobs').update({
    status: 'rendering',
    error_message: null
  }).eq('id', job.id);

  report('starting', 5, 'Seleccionando cuenta de Google disponible...');

  const tempDir = path.resolve('temp_renders');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const settings = await getFlowSettings();
  console.log('⚙️ Parámetros Flow:', settings);

  // ─── Definir escenas a procesar ─────────────────────────────────────────────
  const allScenes = mode === 'single_scene_1'
    ? [{ num: 1, prompt: job.scene_1_prompt, key: 'scene_1_video_url' }]
    : [
        { num: 1, prompt: job.scene_1_prompt, key: 'scene_1_video_url' },
        { num: 2, prompt: job.scene_2_prompt, key: 'scene_2_video_url' },
        { num: 3, prompt: job.scene_3_prompt, key: 'scene_3_video_url' }
      ];

  const downloadedClips = [];
  const clipsBySceneNum = {};
  let context = null;
  let page = null;
  let selectedAccount = null;

  try {
    // ─── CHECKPOINT: Detectar escenas ya completadas y reutilizarlas ──────────
    let scenesToProcess = [];
    for (const sc of allScenes) {
      const existingUrl = job[sc.key];
      if (existingUrl) {
        // Esta escena ya fue renderizada — descargar el clip del checkpoint
        const clipPath = path.join(tempDir, `clip_${job.id}_s${sc.num}.mp4`);
        if (!fs.existsSync(clipPath)) {
          console.log(`📦 [Checkpoint] Descargando Escena ${sc.num} desde checkpoint de Supabase...`);
          await downloadFile(existingUrl, clipPath).catch(err => {
            console.warn(`Aviso descargando checkpoint Escena ${sc.num}:`, err.message);
          });
        }
        if (fs.existsSync(clipPath) && fs.statSync(clipPath).size > 0) {
          console.log(`✅ [Checkpoint] Escena ${sc.num} reutilizada desde Supabase Storage.`);
          downloadedClips.push(clipPath);
          clipsBySceneNum[sc.num] = clipPath;
        } else {
          console.warn(`⚠️ [Checkpoint] Escena ${sc.num} no se pudo descargar, se re-renderizará.`);
          scenesToProcess.push(sc);
        }
      } else {
        scenesToProcess.push(sc);
      }
    }

    if (scenesToProcess.length === 0) {
      console.log('✅ Todas las escenas ya estaban completadas. Procediendo a unir clips...');
    } else {
      console.log(`🎬 Escenas por renderizar: ${scenesToProcess.map(s => s.num).join(', ')}`);

      // ─── Seleccionar cuenta y abrir navegador ────────────────────────────────
      selectedAccount = await getAvailableAccount();
      const profileDir = path.resolve(selectedAccount.profile_dir || `profiles/${selectedAccount.alias}`);
      console.log(`👤 Sesión asignada: ${selectedAccount.alias} (${selectedAccount.tier.toUpperCase()}) en ${profileDir}`);

      await supabase.from('video_jobs').update({ google_account_id: selectedAccount.id }).eq('id', job.id);

      context = await launchBrowser(profileDir);
      page = await openFlowAndConfigure(context, settings, report);

      // ─── Bucle de escenas con rotación de cuenta mid-render ──────────────────
      let sceneIndex = 0;
      while (sceneIndex < scenesToProcess.length) {
        const sc = scenesToProcess[sceneIndex];
        const basePct = mode === 'single_scene_1'
          ? 20
          : Math.round(15 + (allScenes.findIndex(a => a.num === sc.num) / allScenes.length) * 65);

        report(`scene_${sc.num}`, basePct, `Renderizando Escena ${sc.num}/${allScenes.length}...`);
        console.log(`\n🎬 Generando Escena ${sc.num}/${allScenes.length}: "${sc.prompt.slice(0, 70)}..."`);

        try {
          const clipPath = await generateScene(page, sc, job, tempDir, downloadedClips, report, basePct);

          downloadedClips.push(clipPath);
          clipsBySceneNum[sc.num] = clipPath;
          console.log(`✅ Escena ${sc.num} descargada y validada: ${clipPath}`);

          // Subir clip individual a Supabase Storage (checkpoint)
          try {
            const sceneBuffer = fs.readFileSync(clipPath);
            const sceneFileName = `clip_${job.id}_s${sc.num}_${Date.now()}.mp4`;
            await supabase.storage.from('mrgreen-videos').upload(sceneFileName, sceneBuffer, { contentType: 'video/mp4', upsert: true });
            const { data: scenePubData } = supabase.storage.from('mrgreen-videos').getPublicUrl(sceneFileName);
            const sceneUrl = scenePubData.publicUrl;
            await supabase.from('video_jobs').update({ [sc.key]: sceneUrl }).eq('id', job.id);
            console.log(`☁️ Escena ${sc.num} guardada como checkpoint en BD: ${sceneUrl}`);
          } catch (uploadErr) {
            console.warn(`Aviso al subir checkpoint Escena ${sc.num}:`, uploadErr.message);
          }

          // Descontar créditos parciales por escena completada (12 créditos c/u)
          if (selectedAccount) {
            try {
              await recordAccountUsage(selectedAccount.id, 12);
              console.log(`📊 12 créditos descontados a ${selectedAccount.alias} por Escena ${sc.num}.`);
            } catch (creditErr) {
              console.warn(`Aviso descontando créditos por escena:`, creditErr.message);
            }
          }

          sceneIndex++;

        } catch (sceneErr) {
          const errMsg = sceneErr.message || '';

          // ─── Detectar si es problema de créditos agotados ──────────────────
          const isCreditError = (
            errMsg.toLowerCase().includes('créditos') ||
            errMsg.toLowerCase().includes('credits') ||
            errMsg.toLowerCase().includes('no inició la generación') ||
            errMsg.toLowerCase().includes('nueva tarjeta en galería')
          );

          if (isCreditError) {
            console.warn(`💳 Cuenta ${selectedAccount?.alias} agotó créditos en Escena ${sc.num}. Rotando cuenta...`);

            // Marcar cuenta actual como exhausted
            if (selectedAccount) {
              await recordAccountUsage(selectedAccount.id, 50); // forzar exhausted
              console.log(`📊 Cuenta ${selectedAccount.alias} marcada como exhausted.`);
            }

            // Cerrar navegador actual
            if (context) {
              await context.close().catch(() => {});
              context = null;
              page = null;
            }

            // Intentar obtener la siguiente cuenta disponible
            try {
              selectedAccount = await getAvailableAccount();
              const newProfileDir = path.resolve(selectedAccount.profile_dir || `profiles/${selectedAccount.alias}`);
              console.log(`🔄 Rotando a cuenta: ${selectedAccount.alias} (${selectedAccount.tier.toUpperCase()})`);
              await supabase.from('video_jobs').update({ google_account_id: selectedAccount.id }).eq('id', job.id);

              context = await launchBrowser(newProfileDir);
              page = await openFlowAndConfigure(context, settings, report);
              // NO incrementar sceneIndex — reintenta la misma escena con nueva cuenta
              console.log(`▶️ Reanudando desde Escena ${sc.num} con nueva cuenta ${selectedAccount.alias}...`);

            } catch (rotErr) {
              // No hay más cuentas disponibles
              throw new Error(`Sin cuentas disponibles para continuar. Última escena en proceso: ${sc.num}. ${rotErr.message}`);
            }
          } else {
            // Error no relacionado con créditos — propagar
            throw sceneErr;
          }
        }
      }
    }

    // ─── Unir clips y subir video final ─────────────────────────────────────
    if (downloadedClips.length === 0) {
      throw new Error('No se pudo descargar ningún clip de Google Flow');
    }

    let finalVideoUrl = null;

    if (mode === 'single_scene_1') {
      report('uploading', 90, 'Subiendo Escena 1 como video final...');
      const buffer = fs.readFileSync(downloadedClips[0]);
      const uploadName = `scene1_vertical_${job.id}_${Date.now()}.mp4`;
      await supabase.storage.from('mrgreen-videos').upload(uploadName, buffer, { contentType: 'video/mp4', upsert: true });
      const { data: pubData } = supabase.storage.from('mrgreen-videos').getPublicUrl(uploadName);
      finalVideoUrl = pubData.publicUrl;
    } else {
      report('stitching', 82, 'Uniendo las 3 escenas con FFmpeg...');
      const stitchedPath = path.join(tempDir, `full_video_${job.id}.mp4`);
      console.log('🎞️ Uniendo clips con FFmpeg a 9:16 vertical en orden estricto (1 -> 2 -> 3)...');

      // 🛡️ BLINDAJE CANÓNICO: Asegurar orden 1, 2, 3 sin importar el orden en que se renderizaron o descargaron
      const orderedClips = [1, 2, 3]
        .map(num => clipsBySceneNum[num])
        .filter(p => p && fs.existsSync(p));

      const clipsToStitch = orderedClips.length === 3 ? orderedClips : downloadedClips;
      console.log('Clips ordenados para stitching:', clipsToStitch);
      await stitchScenes(clipsToStitch, stitchedPath);

      report('uploading', 92, 'Subiendo video maestro...');
      const buffer = fs.readFileSync(stitchedPath);
      const uploadName = `full_video_${job.id}_${Date.now()}.mp4`;
      await supabase.storage.from('mrgreen-videos').upload(uploadName, buffer, { contentType: 'video/mp4', upsert: true });
      const { data: pubData } = supabase.storage.from('mrgreen-videos').getPublicUrl(uploadName);
      finalVideoUrl = pubData.publicUrl;
      console.log('🎉 Video Final subido a Supabase:', finalVideoUrl);

      // 🧹 Limpiar clips individuales del disco (ya están en Supabase Storage)
      // Mantener stitchedPath temporalmente para la extracción de imagen 4:5
      cleanupTempFiles(downloadedClips);
    }

    if (finalVideoUrl) {
      report('done', 96, '¡Video listo! Generando imagen satélite vertical 4:5...');
      await supabase.from('video_jobs').update({
        final_video_url: finalVideoUrl,
        aspect_ratio: '9:16',
        status: 'ready_to_publish',
        error_message: null
      }).eq('id', job.id);

      // Limpiar del vault
      try {
        await supabase.from('content_vault').delete().eq('title', job.title);
        console.log(`[Cleaner] 🗑️ Removido de content_vault: "${job.title}"`);
      } catch (cleanErr) {
        console.warn('[Cleaner] Error limpiando content_vault:', cleanErr.message);
      }
    }

    // ─── Generación de Imagen Satélite Vertical 4:5 (1080x1350 para Facebook Feed) ──
    try {
      console.log('\n📸 Generando Imagen Satélite Vertical 4:5 para Facebook Feed...');
      report('generating_image', 97, 'Generando Imagen Satélite Vertical 4:5...');

      const stitchedPath = path.join(tempDir, `full_video_${job.id}.mp4`);
      const img45Path = path.join(tempDir, `satelite_4_5_${job.id}.jpg`);

      // Si existe el video local, extraemos el frame clave en ratio 4:5 (1080x1350)
      if (fs.existsSync(stitchedPath)) {
        const vf = 'scale=1080:1920,crop=1080:1350:0:(in_h-out_h)/2';
        const cmd = `ffmpeg -y -ss 00:00:03.000 -i "${stitchedPath}" -vframes 1 -vf "${vf}" -q:v 2 "${img45Path}"`;
        execSync(cmd);

        if (fs.existsSync(img45Path) && fs.statSync(img45Path).size > 0) {
          const imgBuffer = fs.readFileSync(img45Path);
          const imgUploadName = `satelite_vertical_4_5_${job.id}_${Date.now()}.jpg`;
          await supabase.storage.from('mrgreen-videos').upload(imgUploadName, imgBuffer, { contentType: 'image/jpeg', upsert: true });
          const { data: imgPubData } = supabase.storage.from('mrgreen-videos').getPublicUrl(imgUploadName);

          if (imgPubData?.publicUrl) {
            await supabase.from('video_jobs').update({
              image_url: imgPubData.publicUrl,
              image_status: 'pending'
            }).eq('id', job.id);
            console.log('✅ Imagen Satélite 4:5 (1080x1350) guardada en Supabase:', imgPubData.publicUrl);
          }
          cleanupTempFiles([img45Path, stitchedPath]);
        }
      }
    } catch (satErr) {
      console.warn('Aviso generando imagen satélite 4:5 (continuando):', satErr.message);
    }

    report('done', 100, '¡Video e Imagen completados!');

    // Los créditos ya se descontaron por escena durante el render (12 c/u)
    // No se descuentan de nuevo aquí para evitar doble conteo

  } catch (err) {
    console.error('❌ Error durante render en Google Flow:', err);
    report('error', 0, err.message || 'Error en Google Flow');

    // Incrementar retry_count. Si llega a 3, marcar error definitivo para no volver a intentar
    let retryCount = 1;
    try {
      const { data: currentJob } = await supabase.from('video_jobs')
        .select('retry_count').eq('id', job.id).maybeSingle();
      retryCount = ((currentJob?.retry_count) || 0) + 1;
    } catch (e) {
      retryCount = 1;
    }
    const isDefinitive = retryCount >= 3;

    await supabase.from('video_jobs').update({
      status: isDefinitive ? 'error' : 'ready_to_publish',
      error_message: isDefinitive
        ? `[DEFINITIVO tras ${retryCount} intentos] ${err.message || 'Error inesperado'}`
        : err.message || 'Error inesperado durante el render',
      retry_count: retryCount
    }).eq('id', job.id);

    if (isDefinitive) {
      console.error(`🚫 Job "${job.title}" marcado como error DEFINITIVO tras ${retryCount} intentos.`);
    } else {
      console.warn(`⚠️ Job "${job.title}" reintentará (intento ${retryCount}/3).`);
    }

    throw err;
  } finally {
    if (context) {
      await context.close().catch(() => {});
    }
  }
}

const cliMode = process.argv[2] || 'full_video_3_scenes';
if (process.argv[1]?.endsWith('worker_flow.js')) {
  executeFlowRender(null, cliMode).catch(console.error);
}
