import { chromium } from 'playwright-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function inspectGridCards() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // Inspeccionar las tarjetas de la galería
  const cards = await page.evaluate(() => {
    // Buscar elementos en la galería
    const elements = Array.from(document.querySelectorAll('div, button, a, [role="button"]')).map((el, i) => {
      const rect = el.getBoundingClientRect();
      const text = el.innerText?.trim();
      const aria = el.getAttribute('aria-label');
      const hasImg = !!el.querySelector('img');
      const hasVid = !!el.querySelector('video');
      return {
        i,
        tag: el.tagName,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
        hasImg,
        hasVid,
        aria,
        text: text?.slice(0, 40)
      };
    }).filter(e => (e.hasImg || e.hasVid) && e.rect.w > 100 && e.rect.h > 150);

    return elements;
  });

  console.log('Tarjetas de medios encontradas:', JSON.stringify(cards, null, 2));

  await page.screenshot({ path: 'flow_gallery_analysis.png' });
  console.log('Screenshot guardada flow_gallery_analysis.png');

  await context.close();
}

inspectGridCards().catch(console.error);
