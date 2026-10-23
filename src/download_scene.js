import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function downloadGeneratedVideo() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  
  // Capturar descargas
  page.on('download', async (download) => {
    const targetDir = path.resolve('dashboard/public');
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    const targetPath = path.join(targetDir, 'scene_generated.mp4');
    await download.saveAs(targetPath);
    console.log('✅ Archivo de video descargado exitosamente en:', targetPath);
  });

  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // Click en la escena
  await page.mouse.click(360, 270);
  await page.waitForTimeout(3000);

  // Click en el icono de descarga (download icon en la barra superior)
  const downloadBtn = page.locator('button:has(svg path[d*="M19.35"]), button[aria-label*="Download" i], button:has-text("download")').first();
  console.log('Buscando botón de descarga...');
  
  if (await downloadBtn.isVisible()) {
    console.log('Click en botón de descarga...');
    await downloadBtn.click();
    await page.waitForTimeout(6000);
  } else {
    // Si no tiene texto, click en la posición del botón de descarga superior derecho (icono entre share y delete)
    console.log('Haciendo click por coordenadas en el icono de descarga...');
    // Coordenadas aproximadas del icono de descarga según la captura (X: 745, Y: 52 en viewport 1440)
    const downloadIcons = await page.locator('button').all();
    for (const b of downloadIcons) {
      const html = await b.innerHTML();
      if (html.includes('M5 20h14v-2H5v2z') || html.includes('download') || html.includes('M19 9h-4V3H9v6H5l7 7 7-7z')) {
        console.log('Botón de descarga detectado por SVG!');
        await b.click();
        await page.waitForTimeout(6000);
        break;
      }
    }
  }

  await context.close();
}

downloadGeneratedVideo().catch(console.error);
