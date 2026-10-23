import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function downloadVerticalScene() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  const localFile = path.resolve('temp_renders/scene1_vertical.mp4');

  page.on('download', async (dl) => {
    await dl.saveAs(localFile);
    console.log('✅ Archivo vertical descargado localmente:', localFile);
  });

  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // Click en la primera tarjeta vertical (coordenadas del thumbnail 9:16 recién generado)
  // En la captura: X: 265, Y: 300
  console.log('Abriendo video vertical...');
  await page.mouse.click(265, 300);
  await page.waitForTimeout(3000);

  // Click en descarga
  const dlBtn = page.locator('button[aria-label*="Download" i], button:has-text("download")').first();
  if (await dlBtn.isVisible()) {
    await dlBtn.click();
    await page.waitForTimeout(1000);
    const opt720 = page.locator('div, button, span, li').filter({ hasText: /^720p/ }).first();
    if (await opt720.isVisible()) {
      await opt720.click();
      console.log('720p seleccionado para descarga...');
    }
  }

  await page.waitForTimeout(12000);

  if (fs.existsSync(localFile)) {
    console.log('Subiendo video 9:16 a Supabase Storage...');
    const buffer = fs.readFileSync(localFile);
    const fileName = `scene_916_vertical_${Date.now()}.mp4`;
    await supabase.storage.from('mrgreen-videos').upload(fileName, buffer, {
      contentType: 'video/mp4',
      upsert: true
    });

    const { data: pubData } = supabase.storage.from('mrgreen-videos').getPublicUrl(fileName);
    console.log('🌐 URL Pública Vertical:', pubData.publicUrl);

    // Actualizar job en Supabase
    await supabase.from('video_jobs').update({
      final_video_url: pubData.publicUrl,
      aspect_ratio: '9:16',
      status: 'ready_to_publish'
    }).eq('id', 'a95a99f6-1571-4205-953b-689985bb14ed');

    console.log('🎉 Job actualizado con video vertical en Supabase!');
  }

  await context.close();
}

downloadVerticalScene().catch(console.error);
