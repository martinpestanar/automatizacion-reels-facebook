import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function extractVideo() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  
  // Escuchar descargas
  let downloadUrl = null;
  page.on('download', async (download) => {
    const savePath = path.resolve('public/flow_scene_1.mp4');
    await download.saveAs(savePath);
    console.log('Video guardado en:', savePath);
  });

  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // Inspeccionar los elementos de media generados
  const items = await page.evaluate(() => {
    const imgs = Array.from(document.querySelectorAll('img')).map(i => i.src);
    const vids = Array.from(document.querySelectorAll('video')).map(v => v.src);
    return { imgs, vids };
  });
  console.log('Media items en DOM:', items);

  // Click en la primera tarjeta de video generada
  const mediaCards = page.locator('div:has(> img), div:has(> video), [role="button"]:has(img)');
  console.log('Media cards count:', await mediaCards.count());

  // Click en el primer elemento con botón play
  const playButton = page.locator('button:has-text("play_arrow"), [aria-label*="play" i], svg').first();
  console.log('Haciendo click en la escena generada...');
  await page.mouse.click(360, 270); // Coordenadas del primer video en pantalla
  await page.waitForTimeout(2000);

  await page.screenshot({ path: 'flow_media_detail.png' });
  console.log('Captura de detalle guardada en flow_media_detail.png');

  await context.close();
}

extractVideo().catch(console.error);
