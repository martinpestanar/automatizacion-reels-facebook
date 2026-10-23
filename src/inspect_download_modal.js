import { chromium } from 'playwright-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function inspectDownloadModal() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  
  // Capturar descargas y requests de video
  context.on('request', req => {
    const url = req.url();
    if (url.includes('.mp4') || url.includes('video') || url.includes('googlevideo') || url.includes('blob:')) {
      console.log('Video Request:', url.slice(0, 100));
    }
  });

  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  await page.mouse.click(360, 270);
  await page.waitForTimeout(2000);

  // Click en el icono de descarga
  const downloadBtn = page.locator('button[aria-label*="Download" i], button:has-text("download")').first();
  if (await downloadBtn.isVisible()) {
    await downloadBtn.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'flow_download_popup.png' });
    console.log('Popup capturado');
  }

  // Ver si hay elementos en el diálogo
  const dialogTexts = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="dialog"], [role="menu"], .modal, .dialog')).map(d => d.innerText);
  });
  console.log('Diálogos visibles:', dialogTexts);

  await context.close();
}

inspectDownloadModal().catch(console.error);
