import { chromium } from 'playwright-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function checkRenderStatus() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // Buscar elementos de video generados
  const videoElements = await page.locator('video').all();
  console.log('Videos encontrados en la página de Flow:', videoElements.length);

  const videoSrcs = [];
  for (const v of videoElements) {
    const src = await v.getAttribute('src');
    if (src) videoSrcs.push(src);
  }
  console.log('Video sources:', videoSrcs);

  await page.screenshot({ path: 'flow_rendered_scene.png' });
  console.log('Captura tomada en flow_rendered_scene.png');

  await context.close();
}

checkRenderStatus().catch(console.error);
