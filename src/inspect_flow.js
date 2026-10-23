import { chromium } from 'playwright-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function inspectWorkspace() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input, textarea, [contenteditable="true"], [placeholder]')).map(el => ({
      tag: el.tagName,
      placeholder: el.getAttribute('placeholder'),
      className: el.className,
      aria: el.getAttribute('aria-label')
    }));
  });
  console.log('Inputs found:', JSON.stringify(inputs, null, 2));

  // Click en el badge de modelo para ver las opciones de video/imagen
  const modelBadge = page.locator('button:has-text("Nano Banana")').first();
  if (await modelBadge.isVisible()) {
    console.log('Badge encontrado. Haciendo click...');
    await modelBadge.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'flow_model_menu.png' });
    console.log('Menu capturado en flow_model_menu.png');
  }

  await context.close();
}

inspectWorkspace().catch(console.error);
