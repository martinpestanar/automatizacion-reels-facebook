import { chromium } from 'playwright-core';
import path from 'path';
import fs from 'fs';

// Ruta por defecto para Chrome instalado en Windows
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

/**
 * Lanza una ventana de navegador conectada a una cuenta específica de Google
 * para hacer el login por primera vez de forma asistida y persistir la sesión.
 * @param {string} accountAlias - e.g. 'google_account_1'
 */
export async function launchLoginSession(accountAlias) {
  const projectRoot = path.resolve(import.meta.dirname, '../../');
  const profileDir = path.join(projectRoot, 'profiles', accountAlias);
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // Eliminar lockfile zombie si quedó de una sesión previa
  const lockfile = path.join(profileDir, 'lockfile');
  if (fs.existsSync(lockfile)) {
    try { fs.unlinkSync(lockfile); } catch (e) {}
  }

  console.log(`\n======================================================`);
  console.log(` Iniciando navegador para: ${accountAlias}`);
  console.log(` Carpeta de sesión: ${profileDir}`);
  console.log(` Inicia sesión en Google y abre https://flow.google.com/`);
  console.log(` Una vez logueado, puedes cerrar la ventana.`);
  console.log(`======================================================\n`);

  const context = await chromium.launchPersistentContext(profileDir, {
    executablePath: CHROME_PATH,
    headless: false,
    viewport: null,
    args: [
      '--start-maximized',
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox'
    ]
  });

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  await page.goto('https://flow.google.com/', { waitUntil: 'domcontentloaded' });

  // Mantener la sesión viva hasta que el usuario cierre la ventana manualmente
  context.on('close', () => {
    console.log(`🚪 Navegador cerrado por el usuario para ${accountAlias}.`);
  });

  return { context, page };
}

// Si se ejecuta directamente desde CLI: node src/accounts/setup.js google_account_1
const targetAccount = process.argv[2];
if (targetAccount) {
  launchLoginSession(targetAccount).catch(console.error);
}
