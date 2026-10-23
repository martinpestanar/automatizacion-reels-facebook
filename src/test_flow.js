import { chromium } from 'playwright-core';
import path from 'path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profileDir = path.resolve('profiles/google_account_1');

async function testProject() {
  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--disable-blink-features=AutomationControlled']
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://flow.google.com/', { waitUntil: 'networkidle' });

  const links = await page.locator('a[aria-label="Open project"]').all();
  console.log('Proyectos encontrados:', links.length);

  if (links.length > 0) {
    const href = await links[0].getAttribute('href');
    console.log('Abriendo proyecto:', href);
    await links[0].click();
    await page.waitForTimeout(6000);
    console.log('URL tras abrir:', page.url());
    await page.screenshot({ path: 'flow_project_workspace.png' });
    console.log('Captura guardada en flow_project_workspace.png');
  }

  await context.close();
}

testProject().catch(console.error);
