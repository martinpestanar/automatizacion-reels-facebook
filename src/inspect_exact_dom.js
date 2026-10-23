import { chromium } from 'playwright-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function inspectExactDOM() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // Click en el trigger button
  const trigger = page.locator('button.settings-trigger-button, button[aria-label="Settings trigger"]').first();
  console.log('Trigger visible:', await trigger.isVisible());
  await trigger.click();
  await page.waitForTimeout(2000);

  // Inspeccionar todo el overlay / dialog / menu
  const overlayElements = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('*')).map(el => {
      const text = el.innerText?.trim();
      const aria = el.getAttribute('aria-label');
      const role = el.getAttribute('role');
      const tag = el.tagName;
      return { tag, text: text?.slice(0, 30), aria, role, className: el.className };
    }).filter(e => e.text && (e.text.includes('9:16') || e.text.includes('16:9') || e.text.includes('6s') || e.text.includes('crop_')));
  });

  console.log('Overlay elements:', JSON.stringify(overlayElements.slice(0, 25), null, 2));

  await page.screenshot({ path: 'flow_open_menu_exact.png' });
  console.log('Screenshot guardada flow_open_menu_exact.png');

  await context.close();
}

inspectExactDOM().catch(console.error);
