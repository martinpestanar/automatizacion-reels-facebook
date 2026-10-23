import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function download720pVideo() {
  console.log('Iniciando descarga de video 720p desde Google Flow...');
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();

  const targetDir = path.resolve('dashboard/public');
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
  const localVideoPath = path.join(targetDir, 'flow_scene_1.mp4');

  page.on('download', async (download) => {
    console.log('Descarga iniciada...');
    await download.saveAs(localVideoPath);
    console.log('✅ Archivo guardado localmente en:', localVideoPath);
  });

  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // Click en la escena
  await page.mouse.click(360, 270);
  await page.waitForTimeout(2000);

  // Click en el botón de descarga
  const downloadBtn = page.locator('button[aria-label*="Download" i], button:has-text("download")').first();
  await downloadBtn.click();
  await page.waitForTimeout(1000);

  // Seleccionar la opción 720p Original size
  console.log('Seleccionando 720p Original size...');
  const option720p = page.locator('div, button, span, li').filter({ hasText: /^720p/ }).first();
  await option720p.click();

  // Esperar a que se complete la descarga
  console.log('Esperando descarga del archivo...');
  await page.waitForTimeout(10000);

  if (fs.existsSync(localVideoPath)) {
    console.log('Subiendo video a Supabase Storage (mrgreen-videos)...');
    const fileBuffer = fs.readFileSync(localVideoPath);
    const fileName = `generated_scene_${Date.now()}.mp4`;

    const { error: uploadError } = await supabase.storage
      .from('mrgreen-videos')
      .upload(fileName, fileBuffer, {
        contentType: 'video/mp4',
        upsert: true
      });

    if (uploadError) {
      console.error('Error subiendo a Supabase:', uploadError);
    } else {
      const { data: publicUrlData } = supabase.storage
        .from('mrgreen-videos')
        .getPublicUrl(fileName);

      const videoUrl = publicUrlData.publicUrl;
      console.log('🌐 URL Pública de Video:', videoUrl);

      // Actualizar el video pendiente en la base de datos
      const { data: job } = await supabase
        .from('video_jobs')
        .select('id')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (job) {
        await supabase
          .from('video_jobs')
          .update({
            final_video_url: videoUrl,
            status: 'ready_to_publish'
          })
          .eq('id', job.id);
        console.log('🎉 Video enlazado al Job en Supabase con éxito!');
      }
    }
  } else {
    console.log('El archivo aún no aparece en disco.');
  }

  await context.close();
}

download720pVideo().catch(console.error);
