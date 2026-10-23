import { chromium } from 'playwright-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function inspectVideoTab() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // Abre el menú
  const modelBadge = page.locator('button:has-text("Nano Banana")').first();
  await modelBadge.click();
  await page.waitForTimeout(1000);

  // Click en Video tab
  const videoTab = page.locator('button:has-text("Video")').first();
  await videoTab.click();
  await page.waitForTimeout(1500);

  await page.screenshot({ path: 'flow_video_tab.png' });
  console.log('Captura de pestaña Video guardada en flow_video_tab.png');

  await context.close();
}

inspectVideoTab().catch(console.error);
