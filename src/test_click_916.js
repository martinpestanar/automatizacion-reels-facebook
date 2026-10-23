import { chromium } from 'playwright-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function testClick916() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // Badge click
  const badge = page.locator('button:has-text("Nano Banana"), button:has-text("Omni"), button:has-text("Video")').first();
  await badge.click();
  await page.waitForTimeout(1000);

  const videoTab = page.locator('button:has-text("Video")').first();
  await videoTab.click();
  await page.waitForTimeout(1000);

  // Buscar todos los botones en el popover
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button')).map(b => ({
      text: b.innerText,
      aria: b.getAttribute('aria-label'),
      className: b.className
    })).filter(b => b.text.includes('9:16') || b.text.includes('16:9') || b.text.includes('6s') || b.text.includes('8s'));
  });
  console.log('Botones de formato encontrados:', buttons);

  // Hacer click en 9:16
  const ratio916 = page.locator('button:has-text("9:16")').first();
  await ratio916.click();
  await page.waitForTimeout(1000);

  // Hacer click en 6s
  const btn6s = page.locator('button:has-text("6s")').first();
  if (await btn6s.isVisible()) {
    await btn6s.click();
    console.log('Clicked 6s');
  }

  await page.screenshot({ path: 'flow_selected_916.png' });
  console.log('Captura guardada flow_selected_916.png');

  await context.close();
}

testClick916().catch(console.error);
