import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { stitchScenes } from './stitcher/index.js';
import { getAvailableAccount, recordAccountUsage } from './accounts/rotator.js';

dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CHROME_PATH = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/google-chrome-stable';

async function getFlowSettings() {
  const { data } = await supabase
    .from('image_formats')
    .select('description')
    .eq('code', 'flow_settings_config')
    .maybeSingle();

  if (data && data.description) {
    try {
      return JSON.parse(data.description);
    } catch (e) {
      console.warn('Error parsing settings');
    }
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

export async function executeFlowRender(jobId = null, mode = 'full_video_3_scenes', onProgress = null) {
  const report = (stage, pct, message) => {
    if (onProgress) onProgress({ stage, pct, message, jobId });
  };

  console.log(`\n======================================================`);
  console.log(`🚀 Iniciando Generación de Video en Google Flow`);
  console.log(`Modo: ${mode === 'single_scene_1' ? 'Escena 1 Individual' : 'Video Completo (3 escenas)'}`);
  console.log(`======================================================\n`);

  let query = supabase.from('video_jobs').select('*');
  if (jobId) {
    query = query.eq('id', jobId);
  } else {
    query = query.in('status', ['ready_to_publish', 'rendering', 'needs_review']).is('final_video_url', null).order('created_at', { ascending: false });
  }
  const { data: job, error: jobError } = await query.limit(1).single();

  if (jobError || !job) {
    console.log('ℹ️ No hay video pendiente.');
    report('idle', 0, 'Sin tareas pendientes');
    return;
  }

  // Marcar estado en DB como rendering para que el dashboard lo muestre de inmediato
  await supabase.from('video_jobs').update({
    status: 'rendering',
    error_message: null
  }).eq('id', job.id);

  report('starting', 5, 'Seleccionando cuenta de Google disponible...');

  // Rotación inteligente de cuentas
  const selectedAccount = await getAvailableAccount();
  const profileDir = path.resolve(selectedAccount.profile_dir || `profiles/${selectedAccount.alias}`);
  console.log(`👤 Sesión asignada: ${selectedAccount.alias} (${selectedAccount.tier.toUpperCase()}) en ${profileDir}`);

  await supabase.from('video_jobs').update({
    google_account_id: selectedAccount.id
  }).eq('id', job.id);

  const settings = await getFlowSettings();
  console.log('⚙️ Parámetros Flow a aplicar:', settings);

  let context = null;

  try {
    const launchArgs = [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check'
    ];

    context = await chromium.launchPersistentContext(profileDir, {
      executablePath: CHROME_PATH,
      headless: true,
      viewport: { width: 1440, height: 900 },
      args: launchArgs
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    const tempDir = path.resolve('temp_renders');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    report('navigating', 10, 'Accediendo a Google Flow...');
    await page.goto('https://flow.google.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3500);

    // 1. ABRIR PROYECTO EXISTENTE O CREAR NUEVO (soporta ES y EN)
    console.log('📂 Buscando proyecto en Google Flow...');
    const projectLocator = page.locator('a.project-thumbnail-container, a[aria-label*="proyecto" i], a[aria-label*="project" i]').first();
    const hasProject = await projectLocator.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasProject) {
      console.log('Abriendo proyecto existente...');
      await projectLocator.click();
    } else {
      console.log('Creando nuevo proyecto en Google Flow...');
      const newBtn = page.locator('button.new-project-button, button:has-text("Nuevo proyecto"), button:has-text("New project")').first();
      await newBtn.click();
    }

    await page.waitForTimeout(4000);
    console.log('URL de área de trabajo activa:', page.url());

    // Si hay un modal, backdrop o barra de cookies activa (glue-cookie-notification-bar), cerrarlo/removerlo
    try {
      await page.evaluate(() => {
        // Remover banners de cookies que interceptan clics
        const cookieBars = document.querySelectorAll('.glue-cookie-notification-bar, #glue-cookie-notification-bar-1');
        cookieBars.forEach(el => el.remove());
        // Descartar backdrops
        document.querySelectorAll('.cdk-overlay-backdrop').forEach(el => el.remove());
      }).catch(() => {});

      const activeBackdrops = page.locator('.cdk-overlay-backdrop');
      const backdropCount = await activeBackdrops.count();
      if (backdropCount > 0) {
        console.log(`Detectados ${backdropCount} backdrop(s) residuales de overlay, descartando...`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    } catch (e) {
      console.warn('Aviso limpiando backdrops y banners de cookies:', e.message);
    }

    // Si el panel de agente/chat está abierto en el proyecto, cerrarlo de forma segura
    try {
      const closeAgentPanel = page.locator('button.header-action:has-text("close"), button[aria-label="Cerrar"], button[aria-label="Close"]').first();
      if (await closeAgentPanel.isVisible({ timeout: 1500 }).catch(() => false)) {
        console.log('Cerrando panel lateral del agente...');
        // Intentar cerrar con Escape primero para no colisionar con overlays
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
        
        // Si sigue visible, clic forzado o vía JS click sin ser interceptado
        if (await closeAgentPanel.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeAgentPanel.dispatchEvent('click').catch(async () => {
            await closeAgentPanel.click({ timeout: 2000, force: true }).catch(() => {});
          });
        }
        await page.waitForTimeout(600);
      }
    } catch (closeErr) {
      console.warn('Aviso cerrando panel de agente:', closeErr.message);
      await page.keyboard.press('Escape');
    }

    // Si está en modo Agente (oculta el activador de ajustes), cambiar a modo Estudio haciendo clic en el chip 'Agente'
    const agentIndicator = page.locator('button[aria-label*="Instrucciones del agente" i]').first();
    if (await agentIndicator.isVisible({ timeout: 2000 }).catch(() => false)) {
      console.log('🔄 Desactivando modo Agente para pasar al modo Estudio de Google Flow...');
      const agentChip = page.locator('.agent-mode-chip, button:has-text("Agente"), button:has-text("Agent")').first();
      if (await agentChip.isVisible()) {
        await agentChip.click();
        await page.waitForTimeout(1000);
      }
    }

    // 2. CONFIGURAR PARÁMETROS DE GOOGLE FLOW SEGÚN EL MÓDULO DE AJUSTES
    console.log('📐 Configurando parámetros de video según módulo de ajustes...', settings);
    report('configuring', 12, `Aplicando modelo ${settings.modelName || 'Omni 1.1 Flash'} y parámetros...`);

    const trigger = page.locator('button.settings-trigger-button').first();
    await trigger.waitFor({ state: 'visible', timeout: 15000 });
    await trigger.click();
    await page.waitForTimeout(1000);

      // 2.1 Modo Vídeo / Imagen
      if (settings.mediaType === 'image') {
        const imgToggle = page.locator('mat-button-toggle:has-text("Imagen"), mat-button-toggle:has-text("Image")').first();
        if (await imgToggle.isVisible()) await imgToggle.click();
      } else {
        const videoToggle = page.locator('mat-button-toggle:has-text("Vídeo"), mat-button-toggle:has-text("Video")').first();
        if (await videoToggle.isVisible()) await videoToggle.click();
      }
      await page.waitForTimeout(500);

      // 2.2 Tipo de vídeo (Fotogramas vs Ingredientes)
      if (settings.generationMode === 'frames') {
        const framesToggle = page.locator('mat-button-toggle:has-text("Fotogramas"), mat-button-toggle:has-text("Frames")').first();
        if (await framesToggle.isVisible()) await framesToggle.click();
      } else {
        const ingToggle = page.locator('mat-button-toggle:has-text("Ingredientes"), mat-button-toggle:has-text("Ingredients")').first();
        if (await ingToggle.isVisible()) await ingToggle.click();
      }
      await page.waitForTimeout(500);

      // 2.3 Relación de aspecto (16:9 vs 9:16)
      if (settings.aspectRatio === '16:9') {
        const toggle169 = page.locator('mat-button-toggle:has-text("16:9"), mat-button-toggle:has-text("crop_16_9")').first();
        if (await toggle169.isVisible()) await toggle169.click();
      } else {
        const toggle916 = page.locator('mat-button-toggle:has-text("9:16"), mat-button-toggle:has-text("crop_9_16")').first();
        if (await toggle916.isVisible()) await toggle916.click();
      }
      await page.waitForTimeout(500);

      // 2.4 Selección del Modelo (Omni 1.1 Flash, Veo 3.1 - Lite, Veo 3.1 - Fast, Veo 3.1 - Quality)
      const modelBtn = page.locator('.cdk-overlay-container button[aria-label="Seleccionar familia de modelos"], .cdk-overlay-container button:has(mat-icon:has-text("arrow_drop_down"))').first();
      if (await modelBtn.isVisible()) {
        await modelBtn.click();
        await page.waitForTimeout(1000);

        let modelSelector = 'button[role="menuitem"]:has-text("Omni")';
        if (settings.modelName?.includes('Lite')) {
          modelSelector = 'button[role="menuitem"]:has-text("Lite")';
        } else if (settings.modelName?.includes('Fast')) {
          modelSelector = 'button[role="menuitem"]:has-text("Fast")';
        } else if (settings.modelName?.includes('Quality')) {
          modelSelector = 'button[role="menuitem"]:has-text("Quality")';
        } else if (settings.modelName?.includes('Omni')) {
          modelSelector = 'button[role="menuitem"]:has-text("Omni")';
        }

        const modelOption = page.locator(modelSelector).first();
        if (await modelOption.isVisible()) {
          console.log(`Aplicando modelo seleccionado: ${modelSelector}...`);
          await modelOption.click();
          await page.waitForTimeout(1200);
        } else {
          console.warn(`Modelo no encontrado para ${modelSelector}, manteniendo el actual.`);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(500);
        }
      }

      // 2.5 Resolución (si está disponible para el modelo seleccionado, ej: Omni)
      if (settings.resolution === '360p') {
        const res360 = page.locator('mat-button-toggle:has-text("360p")').first();
        if (await res360.isVisible()) await res360.click();
      } else {
        const res720 = page.locator('mat-button-toggle:has-text("720p")').first();
        if (await res720.isVisible()) await res720.click();
      }
      await page.waitForTimeout(400);

      // 2.6 Duración (para modelos que lo soportan como Omni: 4s, 6s, 8s, 10s)
      const durNum = settings.duration?.replace('s', '').trim() || '8';
      const durToggle = page.locator(`mat-button-toggle:has-text("${durNum} s"), mat-button-toggle:has-text("${durNum}s")`).first();
      if (await durToggle.isVisible()) {
        console.log(`Configurando duración a ${durNum}s...`);
        await durToggle.click();
        await page.waitForTimeout(400);
      }

      // 2.7 Variantes (x1, x2, x3, x4)
      const varStr = settings.variants || 'x1';
      const varToggle = page.locator(`mat-button-toggle:has-text("${varStr}")`).first();
      if (await varToggle.isVisible()) {
        await varToggle.click();
        await page.waitForTimeout(400);
      }

      // Cerrar menú con Escape y asegurar que no queden backdrops abiertos
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

      const triggerText = await trigger.innerText();
      console.log('✅ Parámetros Flow activados:', triggerText.replace(/\n/g, ' '));

    const scenesToProcess = mode === 'single_scene_1' 
      ? [{ num: 1, prompt: job.scene_1_prompt, key: 'scene_1_video_url' }]
      : [
          { num: 1, prompt: job.scene_1_prompt, key: 'scene_1_video_url' },
          { num: 2, prompt: job.scene_2_prompt, key: 'scene_2_video_url' },
          { num: 3, prompt: job.scene_3_prompt, key: 'scene_3_video_url' }
        ];

    const downloadedClips = [];

    for (let i = 0; i < scenesToProcess.length; i++) {
      const sc = scenesToProcess[i];
      const basePct = mode === 'single_scene_1' ? 20 : Math.round(15 + (i / scenesToProcess.length) * 65);
      report(`scene_${sc.num}`, basePct, `Renderizando Escena ${sc.num}/${scenesToProcess.length} en Google Flow...`);
      console.log(`\n🎬 Generando Escena ${sc.num}/${scenesToProcess.length} en 9:16: "${sc.prompt.slice(0, 70)}..."`);

      // Asegurar que no haya backdrops residuales
      const lingeringBackdrop = page.locator('.cdk-overlay-backdrop').first();
      if (await lingeringBackdrop.isVisible().catch(() => false)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }

      const input = page.locator('.ProseMirror, [contenteditable="true"]').first();
      await input.waitFor({ state: 'visible', timeout: 20000 });
      await input.click({ force: true });
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.insertText(sc.prompt);
      await page.waitForTimeout(800);

      const submitBtn = page.locator('button.generate-icon-button, button[aria-label*="generación" i], button[aria-label*="generate" i], button:has-text("arrow_forward")').first();
      if (await submitBtn.isVisible() && !(await submitBtn.isDisabled())) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }

      console.log(`⏳ Esperando generación de Escena ${sc.num} en Google Flow...`);
      report(`scene_${sc.num}_generating`, basePct + 5, `Esperando generación de Escena ${sc.num}...`);
      
      // Espera inicial breve para que Flow cree el tile en la galería
      await page.waitForTimeout(6000);

      console.log(`⏳ Esperando a que el render de Escena ${sc.num} finalice en la galería...`);
      report(`scene_${sc.num}_processing`, basePct + 5, `Generando video en Google Flow (esperando 100%)...`);

      // 1. Esperar en la galería a que la tarjeta termine de generar (desaparezca el spinner o aparezca play_circle / 100%)
      const tile = page.locator('flow-video-tile, flow-grid-tile-container').first();
      await tile.waitFor({ state: 'visible', timeout: 30000 });

      let tileReady = false;
      for (let attempt = 0; attempt < 45; attempt++) {
        // Verificar si la tarjeta ya tiene play_circle o ya no muestra progreso %
        const text = await tile.innerText().catch(() => '');
        if (text.includes('play_circle') || (!text.includes('%') && text.trim().length > 0)) {
          tileReady = true;
          break;
        }
        await page.waitForTimeout(4000);
      }

      // Si aún no detectó play_circle, esperar un respiro prudencial
      await page.waitForTimeout(3000);

      // 2. Abrir la tarjeta ya generada
      console.log(`🔍 Abriendo tarjeta de Escena ${sc.num}...`);
      await tile.click({ force: true });
      await page.waitForTimeout(2500);

      // 3. Botón Descargar en el modal
      console.log(`⏳ Localizando botón de descarga en el modal de Escena ${sc.num}...`);
      const dlBtn = page.locator('button[aria-label*="Descargar" i], button[aria-label*="Download" i], button:has-text("download")').first();
      await dlBtn.waitFor({ state: 'visible', timeout: 30000 });

      let isReady = false;
      for (let attempt = 0; attempt < 25; attempt++) {
        const disabled = await dlBtn.isDisabled().catch(() => true);
        if (!disabled) {
          isReady = true;
          break;
        }
        await page.waitForTimeout(3000);
      }

      if (!isReady) {
        throw new Error(`Timeout esperando a que Google Flow complete el video de la Escena ${sc.num}`);
      }

      console.log(`✅ Video de Escena ${sc.num} listo. Abriendo menú de descarga...`);
      await dlBtn.click();
      await page.waitForTimeout(1000);

      // Opción 720p dentro del menú de descarga de Angular Material
      const opt720 = page.locator('.cdk-overlay-container button[role="menuitem"]:has-text("720p"), button[role="menuitem"]:has-text("720p")').first();
      await opt720.waitFor({ state: 'visible', timeout: 10000 });

      const clipPath = path.join(tempDir, `clip_${job.id}_s${sc.num}.mp4`);

      console.log(`📥 Descargando archivo de Escena ${sc.num}...`);
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 35000 }),
        opt720.click()
      ]);

      await download.saveAs(clipPath);

      // Verificación de integridad: Evitar que Flow entregue el clip anterior por error de caché
      const clipBuffer = fs.readFileSync(clipPath);
      const currentHash = crypto.createHash('md5').update(clipBuffer).digest('hex');
      console.log(`🔍 Verificando integridad de Escena ${sc.num} (MD5: ${currentHash.slice(0, 8)}...)`);

      if (downloadedClips.length > 0) {
        const prevClipPath = downloadedClips[downloadedClips.length - 1];
        const prevHash = crypto.createHash('md5').update(fs.readFileSync(prevClipPath)).digest('hex');
        if (currentHash === prevHash) {
          console.warn(`⚠️ ALERTA: La Escena ${sc.num} es IDÉNTICA a la anterior (duplicado en Flow). Reintentando descarga del último tile...`);
          // Cerrar modal actual
          await page.keyboard.press('Escape');
          await page.waitForTimeout(1000);
          // Tomar el tile más reciente de nuevo
          const freshTile = page.locator('flow-video-tile, flow-grid-tile-container').first();
          await freshTile.click({ force: true });
          await page.waitForTimeout(2000);
          const freshDl = page.locator('button[aria-label*="Descargar" i], button[aria-label*="Download" i]').first();
          await freshDl.waitFor({ state: 'visible', timeout: 15000 });
          await freshDl.click();
          await page.waitForTimeout(1000);
          const freshOpt = page.locator('.cdk-overlay-container button[role="menuitem"]:has-text("720p"), button[role="menuitem"]:has-text("720p")').first();
          const [retryDl] = await Promise.all([
            page.waitForEvent('download', { timeout: 35000 }),
            freshOpt.click()
          ]);
          await retryDl.saveAs(clipPath);
        }
      }

      downloadedClips.push(clipPath);
      console.log(`✅ Escena ${sc.num} descargada y validada correctamente: ${clipPath}`);

      // Subir de inmediato este clip individual a Supabase Storage
      try {
        const sceneBuffer = fs.readFileSync(clipPath);
        const sceneFileName = `clip_${job.id}_s${sc.num}_${Date.now()}.mp4`;
        await supabase.storage.from('mrgreen-videos').upload(sceneFileName, sceneBuffer, { contentType: 'video/mp4', upsert: true });
        const { data: scenePubData } = supabase.storage.from('mrgreen-videos').getPublicUrl(sceneFileName);
        const sceneUrl = scenePubData.publicUrl;

        await supabase.from('video_jobs').update({
          [sc.key]: sceneUrl
        }).eq('id', job.id);
        console.log(`☁️ Escena ${sc.num} vinculada a la BD: ${sceneUrl}`);
      } catch (uploadErr) {
        console.warn(`Aviso al subir clip ${sc.num} a Supabase:`, uploadErr.message);
      }

      // Volver a la galería para la siguiente escena cerrando el visor de forma garantizada
      console.log(`🔒 Cerrando visor de Escena ${sc.num} para volver al editor...`);
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const closeOrBackBtn = page.locator('button[aria-label*="Cerrar" i], button[aria-label*="Close" i], button[aria-label*="Atrás" i], button[aria-label*="Volver" i], button[aria-label*="Back" i], button:has-text("arrow_back"), button:has-text("close")').first();
        if (await closeOrBackBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeOrBackBtn.click({ force: true }).catch(() => {});
        }
      }
      // Asegurar que el input de prompt esté libre y visible
      const promptInput = page.locator('.ProseMirror, [contenteditable="true"]').first();
      await promptInput.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(800);
    }

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
      console.log('🎞️ Uniendo 3 clips con FFmpeg a 9:16 vertical...');
      await stitchScenes(downloadedClips, stitchedPath);

      report('uploading', 92, 'Subiendo video maestro concatenado...');
      const buffer = fs.readFileSync(stitchedPath);
      const uploadName = `full_video_${job.id}_${Date.now()}.mp4`;
      await supabase.storage.from('mrgreen-videos').upload(uploadName, buffer, { contentType: 'video/mp4', upsert: true });
      const { data: pubData } = supabase.storage.from('mrgreen-videos').getPublicUrl(uploadName);
      finalVideoUrl = pubData.publicUrl;
      console.log('🎉 Video Final subido a Supabase:', finalVideoUrl);
    }

    if (finalVideoUrl) {
      report('done', 96, '¡Video listo! Verificando imagen satélite Nano Banana...');
      await supabase.from('video_jobs').update({
        final_video_url: finalVideoUrl,
        aspect_ratio: '9:16',
        status: 'ready_to_publish',
        error_message: null
      }).eq('id', job.id);

      // Auto-eliminar del banco de contenido cuando el video ya está 100% renderizado
      try {
        await supabase.from('content_vault').delete().eq('title', job.title);
        console.log(`[Cleaner] 🗑️ Removido de content_vault tras render exitoso: "${job.title}"`);
      } catch (cleanErr) {
        console.warn('[Cleaner] Error limpiando content_vault:', cleanErr.message);
      }
    }

    // 4. GENERACIÓN AUTOMÁTICA DE IMAGEN SATÉLITE EN GOOGLE FLOW (NANO BANANA - 0 CRÉDITOS)
    if (job.image_prompt && job.image_prompt.trim()) {
      try {
        console.log('\n🍌 Iniciando generación de Imagen Satélite en Google Flow (Nano Banana)...');
        report('generating_image', 97, 'Generando Imagen Satélite en Flow con Nano Banana (0 créditos)...');

        // Abrir panel de ajustes para cambiar a modo Imagen
        const triggerSettings = page.locator('button.settings-trigger-button').first();
        if (await triggerSettings.isVisible({ timeout: 2000 }).catch(() => false)) {
          await triggerSettings.click();
          await page.waitForTimeout(600);

          // Cambiar a Imagen
          const imgToggle = page.locator('mat-button-toggle:has-text("Imagen"), mat-button-toggle:has-text("Image")').first();
          if (await imgToggle.isVisible({ timeout: 1500 }).catch(() => false)) {
            await imgToggle.click();
            await page.waitForTimeout(400);
          }

          // Cerrar menú con Escape
          await page.keyboard.press('Escape');
          await page.waitForTimeout(400);
        }

        // Inyectar el prompt de imagen en el campo de texto de Flow (.ProseMirror o textarea)
        let imgInput = page.locator('.ProseMirror, [contenteditable="true"]').first();
        if (!(await imgInput.isVisible({ timeout: 3000 }).catch(() => false))) {
          imgInput = page.locator('textarea[placeholder*="Describe" i], textarea[aria-label*="prompt" i], textarea').first();
        }

        if (await imgInput.isVisible({ timeout: 3000 }).catch(() => false)) {
          await imgInput.click({ force: true });
          await page.keyboard.press('Control+A');
          await page.keyboard.press('Backspace');
          await page.keyboard.insertText(job.image_prompt.trim());
          await page.waitForTimeout(600);

          // Clic en Generar o Submit
          const submitBtn = page.locator('button.generate-icon-button, button[aria-label*="generaci" i], button[aria-label*="generate" i], button:has-text("Generar"), button:has-text("Crear"), button:has-text("arrow_forward")').first();
          if (await submitBtn.isVisible() && !(await submitBtn.isDisabled())) {
            await submitBtn.click();
          } else {
            await page.keyboard.press('Enter');
          }
          console.log('⏳ Esperando procesamiento de imagen Nano Banana en Google Flow...');
          await page.waitForTimeout(10000); // Esperar que Flow renderice la imagen

            // Buscar la última imagen en la galería de Flow
            console.log('🖼️ Localizando tarjeta de imagen generada en la galería de Flow...');
            const generatedCard = page.locator('flow-image-tile, flow-grid-tile-container, flow-video-tile, .asset-card, .gallery-item, mat-card').first();
            await generatedCard.waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});

            if (await generatedCard.isVisible().catch(() => false)) {
              await generatedCard.click({ force: true });
              await page.waitForTimeout(2000);

              // Descargar imagen
              const dlBtn = page.locator('button[aria-label*="Descargar" i], button[aria-label*="Download" i]').first();
              if (await dlBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
                await dlBtn.click();
                const download = await downloadPromise;

                if (download) {
                  const imgSavePath = path.join(tempDir, `image_satelite_${job.id}.png`);
                  await download.saveAs(imgSavePath);
                  console.log('✅ Imagen descargada localmente de Flow:', imgSavePath);

                  const imgBuffer = fs.readFileSync(imgSavePath);
                  const imgUploadName = `image_${job.id}_${Date.now()}.png`;
                  await supabase.storage.from('mrgreen-videos').upload(imgUploadName, imgBuffer, { contentType: 'image/png', upsert: true });
                  const { data: imgPubData } = supabase.storage.from('mrgreen-videos').getPublicUrl(imgUploadName);

                  if (imgPubData && imgPubData.publicUrl) {
                    await supabase.from('video_jobs').update({
                      image_url: imgPubData.publicUrl
                    }).eq('id', job.id);
                    console.log('✅ Imagen Satélite Nano Banana guardada en Supabase:', imgPubData.publicUrl);

                    // AUTO-DESPACHO A FACEBOOK POR DEFAULT
                    try {
                      console.log('🚀 Despachando automáticamente imagen complementaria a Facebook vía n8n...');
                      fetch('https://n8n.koratflow.agency/webhook/publish-now', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          id: job.id,
                          publish_target: 'photo',
                          image_url: imgPubData.publicUrl,
                          copy_text: job.image_copy_text || job.copy_text || '¿Qué opinas sobre este proceso? #MrGreen #HuertoEnCasa',
                          title: job.title,
                          brand_id: job.brand_id || '06a68062-00c0-413d-b41f-b2229b9d52da'
                        })
                      }).then(async (pubRes) => {
                        console.log('📡 Facebook Webhook Imagen respondio:', pubRes.status);
                        await supabase.from('video_jobs').update({
                          image_status: 'published',
                          image_published_at: new Date().toISOString()
                        }).eq('id', job.id);
                      }).catch(err => {
                        console.warn('[Auto-Publish Image] Aviso despachando imagen a Facebook:', err.message);
                      });
                    } catch (pubErr) {
                      console.warn('[Auto-Publish Image] Error:', pubErr.message);
                    }
                  }).eq('id', job.id);
                    console.log('🎉 Imagen Satélite Nano Banana guardada en Supabase:', imgPubData.publicUrl);
                  }
                }
              }
            }
          }
        }
      } catch (imgErr) {
        console.warn('Aviso en generación de imagen Nano Banana (continuando):', imgErr.message);
      }
    }

    report('done', 100, '¡Video e Imagen completados!');

    // Descontar créditos a la cuenta utilizada
    const creditsCost = mode === 'single_scene_1' ? 12 : 36;
    await recordAccountUsage(selectedAccount.id, creditsCost);
    console.log(`📊 +${creditsCost} créditos descontados a ${selectedAccount.alias} (${selectedAccount.tier}).`);

  } catch (err) {
    console.error('❌ Error durante ejecución del render en Google Flow:', err);
    report('error', 0, err.message || 'Error en Google Flow');

    // Registrar el error en la base de datos para que la interfaz lo muestre y no quede congelada
    await supabase.from('video_jobs').update({
      status: 'error',
      error_message: err.message || 'Error inesperado durante el render'
    }).eq('id', job.id);

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
