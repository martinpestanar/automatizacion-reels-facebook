const fs = require('fs');

let code = fs.readFileSync('/opt/mrgreen-flow/src/worker_flow.js', 'utf8');

// 1. Añadir cierre de cookie banner de Google Flow al entrar a la página
const oldCookieBlock = `    report('navigating', 10, 'Accediendo a Google Flow...');
    await page.goto('https://flow.google.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3500);`;

const newCookieBlock = `    report('navigating', 10, 'Accediendo a Google Flow...');
    await page.goto('https://flow.google.com/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3500);

    // Ocultar / Aceptar banner de cookies de Google para que no tape la barra de prompts
    try {
      const cookieBtn = page.locator('button:has-text("Ocultar"), button:has-text("Aceptar todo"), button:has-text("Accept all"), button:has-text("Hide")').first();
      if (await cookieBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await cookieBtn.click().catch(() => {});
        console.log('🍪 Banner de cookies cerrado');
      }
    } catch (e) {}`;

if (code.includes('Accediendo a Google Flow...')) {
  code = code.replace(oldCookieBlock, newCookieBlock);
}

// 2. Modificar el envío de prompt para asegurar que presione el botón de Start generation o Enter después de tipear
const oldTypeBlock = `      const input = page.locator('.ProseMirror, [contenteditable="true"]').first();
      await input.waitFor({ state: 'visible', timeout: 20000 });
      await input.click({ force: true });
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.insertText(sc.prompt);
      await page.waitForTimeout(800);

      // Cerrar modal de información si estuviera tapando la pantalla
      const closeInfoBtn = page.locator('button[aria-label*="close" i], button:has-text("close")').first();
      if (await closeInfoBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeInfoBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }

      // El botón de submit oficial de Google Flow (comillas escapadas para CSS selector)
      const submitBtn = page.locator('button[aria-label=\\"Start generation\\"], button.generate-icon-button, button:has-text(\\"arrow_forward\\")').first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('🎯 Haciendo clic en botón [Start generation] de Google Flow...');
        await submitBtn.click({ force: true });
      } else {
        await input.focus();
        await page.keyboard.press('Enter');
        console.log('⌨️ Fallback: Tecla Enter enviada para iniciar render...');
      }`;

const newTypeBlock = `      // Cerrar banner de cookies si reaparece abajo
      const cookieBtn = page.locator('button:has-text("Ocultar"), button:has-text("Hide")').first();
      if (await cookieBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await cookieBtn.click().catch(() => {});
      }

      const input = page.locator('.ProseMirror, [contenteditable="true"]').first();
      await input.waitFor({ state: 'visible', timeout: 20000 });
      await input.click({ force: true });
      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await page.keyboard.insertText(sc.prompt);
      await page.waitForTimeout(1000);

      // Cerrar modal de advertencias o overlays flotantes
      const closeInfoBtn = page.locator('button:has-text("close")').first();
      if (await closeInfoBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeInfoBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }

      // 1. Intentar clic directo en el botón de generación
      const submitBtn = page.locator('button.generate-icon-button, button:has-text("arrow_forward")').first();
      let clicked = false;
      if (await submitBtn.isVisible({ timeout: 2500 }).catch(() => false) && !(await submitBtn.isDisabled().catch(() => true))) {
        console.log('🎯 Haciendo clic en botón [generate-icon-button] de Google Flow...');
        await submitBtn.click({ force: true });
        clicked = true;
      }

      // 2. Si no se activó por botón, enfocar el input y presionar Enter
      if (!clicked) {
        console.log('⌨️ Enviando Enter al editor ProseMirror...');
        await input.focus();
        await page.keyboard.press('Enter');
      }`;

if (code.includes('const input = page.locator')) {
  code = code.replace(oldTypeBlock, newTypeBlock);
  fs.writeFileSync('/opt/mrgreen-flow/src/worker_flow.js', code);
  console.log('WORKER_FLOW FULLY PATCHED');
} else {
  console.log('OLD TYPE BLOCK NOT FOUND');
}
