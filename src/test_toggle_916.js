import { chromium } from 'playwright-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function testToggle916() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://flow.google.com/project/162312d2-5a3c-4555-a33a-fd1f6adcc052', { waitUntil: 'networkidle' });

  // 1. Abrir menú de configuración de video
  const trigger = page.locator('button.settings-trigger-button, button[aria-label="Settings trigger"]').first();
  await trigger.click();
  await page.waitForTimeout(1000);

  // 2. Click exacto en el toggle 9:16
  const toggle916 = page.locator('mat-button-toggle:has(span.toggle-text:has-text("9:16")), mat-button-toggle:has-text("crop_9_16")').first();
  console.log('Toggle 9:16 visible:', await toggle916.isVisible());
  await toggle916.click();
  await page.waitForTimeout(500);

  // 3. Click en la duración 6s
  const toggle6s = page.locator('mat-button-toggle:has-text("6s")').first();
  if (await toggle6s.isVisible()) {
    await toggle6s.click();
    console.log('Duración 6s clickeada!');
  }

  // 4. Cerrar menú con Escape
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // 5. Verificar el texto del botón trigger
  const newTriggerText = await trigger.innerText();
  console.log('NUEVO ESTADO DEL BOTÓN TRIGGER:', newTriggerText);

  await page.screenshot({ path: 'flow_verified_vertical_916.png' });
  console.log('Screenshot guardada flow_verified_vertical_916.png');

  await context.close();
}

testToggle916().catch(console.error);
