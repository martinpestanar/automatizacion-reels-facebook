import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { getAvailableAccount } from '../accounts/rotator.js';

dotenv.config();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CHROME_PATH = process.platform === 'win32'
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : '/usr/bin/google-chrome-stable';

/**
 * Genera una infografía botánica dopamínica usando Imagen 3 / Nano Banana 2.1 en Google Flow.
 * Consume 0 créditos y genera una imagen en alta definición 3:4 / 4:5 vertical con textos en español.
 */
export async function generateNanoBananaInfographic(job, tempDir = 'temp_renders') {
  console.log(`\n🍌 [Nano Banana 2.1] Iniciando generación de Infografía Botánica para: "${job.title}"...`);
  
  const account = await getAvailableAccount();
  if (!account) throw new Error('No hay cuentas de Google disponibles para generar con Nano Banana.');

  const profileDir = path.resolve(account.profile_dir);
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    viewport: { width: 1440, height: 900 },
    args: ['--disable-blink-features=AutomationControlled', '--no-sandbox']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  
  try {
    await page.goto('https://flow.google.com/', { waitUntil: 'domcontentloaded', timeout: 35000 });
    await page.waitForTimeout(3500);

    // Verificar si la sesión es válida o fue redirigida a login/about
    const currentUrl = page.url();
    if (currentUrl.includes('/about') || currentUrl.includes('accounts.google.com')) {
      console.warn(`⚠️ Sesión expirada para cuenta ${account.alias} (${account.email}). Marcando status='error' en DB...`);
      await supabase.from('google_accounts').update({ status: 'error' }).eq('id', account.id);
      throw new Error(`Sesión expirada en Google Flow para cuenta ${account.alias}`);
    }

    // Abrir proyecto existente o crear nuevo si no estamos dentro de uno
    if (!page.url().includes('/project/')) {
      const projectLocator = page.locator('a.project-thumbnail-container, a[aria-label*="proyecto" i], a[aria-label*="project" i], div.project-card, .project-tile').first();
      if (await projectLocator.isVisible({ timeout: 5000 }).catch(() => false)) {
        await projectLocator.click();
      } else {
        const newBtn = page.locator('button.new-project-button, button:has-text("Nuevo proyecto"), button:has-text("New project"), a:has-text("New project")').first();
        if (await newBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await newBtn.click();
        } else {
          await page.goto('https://flow.google.com/project/new', { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
        }
      }
    }
    await page.waitForTimeout(4000);

    // Limpiar posibles modales/backdrops
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);

    // Abrir configuración (Settings trigger)
    const trigger = page.locator('button.settings-trigger-button').first();
    await trigger.waitFor({ state: 'visible', timeout: 20000 });
    await trigger.click();
    await page.waitForTimeout(800);

    // 1. Activar Modo Imagen (Nano Banana 2.1)
    const imgToggle = page.locator('mat-button-toggle:has-text("Imagen"), mat-button-toggle:has(mat-icon:has-text("image"))').first();
    if (await imgToggle.isVisible()) {
      await imgToggle.click();
      await page.waitForTimeout(400);
    }

    // 2. Relación de aspecto 3:4 vertical
    const ratioToggle = page.locator('mat-button-toggle:has-text("3:4"), mat-button-toggle:has-text("crop_portrait")').first();
    if (await ratioToggle.isVisible()) {
      await ratioToggle.click();
      await page.waitForTimeout(400);
    }

    // Cerrar panel de ajustes
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Contar tarjetas antes de generar
    const prevCount = await page.locator('flow-grid-tile-container').count();

    // Construir prompt de Infografía Botánica Dopamínica en Español
    let fullPrompt = job.image_prompt || '';
    if (!fullPrompt.includes('INFOGRAFÍA') && !fullPrompt.includes('ESPAÑOL')) {
      fullPrompt = `[DIRECTIVA: INFOGRAFÍA BOTÁNICA EDUCATIVA EN ESPAÑOL, NANO BANANA 2.1]
Infografía botánica vertical 3:4 de alto impacto visual y dopamínico para Facebook.
Tema: "${job.title}" (${job.topic || 'Jardinería Orgánica'}).
Título principal en negrita en español: "${job.title.toUpperCase()}".
Diagrama visual y comparativo con llamadas y flechas explicativas con texto 100% en español que aporten gran valor educativo (ej: composición, capas del suelo, raíces, microbios, errores comunes).
Estética editorial moderna, fondo cálido con textura orgánica, colores vivos y contrastados, hiperrealista, nitidez 8K.
Sutil marca 'Mr. Green' en la esquina superior. Todos los textos perfectamente legibles en español neutro.`;
    }

    // Escribir en el input de Flow
    const input = page.locator('.ProseMirror, [contenteditable="true"]').first();
    await input.waitFor({ state: 'visible', timeout: 15000 });
    await input.click({ force: true });
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.insertText(fullPrompt);
    await page.waitForTimeout(600);

    // Enviar prompt
    const submitBtn = page.locator('button:has(mat-icon:has-text("arrow_forward")), button.generate-icon-button, button[aria-label*="generaci" i]').first();
    await submitBtn.click({ force: true });
    console.log('⏳ Prompt enviado a Nano Banana 2.1. Esperando render (5-10s)...');

    // Esperar a que aparezca la nueva tarjeta
    let appeared = false;
    for (let i = 0; i < 25; i++) {
      await page.waitForTimeout(2000);
      const curr = await page.locator('flow-grid-tile-container').count();
      if (curr > prevCount) {
        appeared = true;
        console.log(`✅ Tarjeta de infografía generada en intento ${i + 1}`);
        break;
      }
    }

    if (!appeared) {
      console.warn('⚠️ No se detectó incremento de tiles, esperando renderizado estándar...');
    }

    // Tiempo de renderizado para Nano Banana
    await page.waitForTimeout(8000);

    // Hacer clic en el centro de la tarjeta de imagen para seleccionarla
    const tile = page.locator('flow-grid-tile-container').first();
    await tile.scrollIntoViewIfNeeded().catch(() => {});
    const box = await tile.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    } else {
      await tile.click({ force: true }).catch(() => {});
    }
    await page.waitForTimeout(2000);

    // Abrir menú de descarga
    const dlBtn = page.locator('button[aria-label*="Descargar" i], button[aria-label*="Download" i]').first();
    await dlBtn.waitFor({ state: 'visible', timeout: 20000 });
    await dlBtn.click();
    await page.waitForTimeout(1000);

    // Para imágenes en Google Flow el menú muestra: "1K\nTamaño original", "2K", "4K"
    const optOriginal = page.locator('.cdk-overlay-container button:has-text("1K"), .cdk-overlay-container [role="menuitem"]:has-text("1K"), .cdk-overlay-container [role="menuitem"]').first();
    await optOriginal.waitFor({ state: 'visible', timeout: 10000 });

    const localFileName = `infografia_banana_${job.id}.png`;
    const localFilePath = path.join(path.resolve(tempDir), localFileName);

    console.log(`📥 Descargando infografía de Nano Banana en 1K...`);
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 35000 }),
      optOriginal.click({ force: true })
    ]);
    await download.saveAs(localFilePath);
    console.log(`✅ Infografía guardada localmente: ${localFilePath}`);

    // Subir a Supabase Storage
    const fileBuffer = fs.readFileSync(localFilePath);
    const storageName = `infografia_banana_${job.id}_${Date.now()}.png`;
    const { error: uploadErr } = await supabase.storage
      .from('mrgreen-videos')
      .upload(storageName, fileBuffer, { contentType: 'image/png', upsert: true });

    if (uploadErr) throw uploadErr;

    const { data: pubData } = supabase.storage
      .from('mrgreen-videos')
      .getPublicUrl(storageName);

    const publicImageUrl = pubData?.publicUrl;

    if (publicImageUrl) {
      const copyText = job.image_copy_text || `🌱 ¿Cuál de estos detalles aplicas en tu huerto? Guarda esta infografía 📌 y cuéntanos tu experiencia en los comentarios 👇 #MrGreen #HuertoEnCasa #JardineriaOrganica`;
      await supabase.from('video_jobs').update({
        image_url: publicImageUrl,
        image_copy_text: copyText,
        image_status: 'pending'
      }).eq('id', job.id);

      console.log(`🎉 [Nano Banana] Infografía publicada con éxito en Supabase y Galería:`, publicImageUrl);
    }

    return publicImageUrl;

  } catch (err) {
    console.error('❌ Error generando imagen con Nano Banana 2.1:', err.message);
    throw err;
  } finally {
    await context.close().catch(() => {});
  }
}
