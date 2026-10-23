const fs = require('fs');

let code = fs.readFileSync('/opt/mrgreen-flow/src/worker_flow.js', 'utf8');

const oldSubmitSection = `      // Presionar Enter directamente dentro del campo de texto
      await input.focus();
      await page.keyboard.press('Enter');
      console.log('⌨️ Tecla Enter enviada para iniciar render de escena...');`;

const newSubmitSection = `      // Cerrar modal de información si estuviera tapando la pantalla
      const closeInfoBtn = page.locator('button[aria-label*="close" i], button:has-text("close")').first();
      if (await closeInfoBtn.isVisible({ timeout: 500 }).catch(() => false)) {
        await closeInfoBtn.click().catch(() => {});
        await page.waitForTimeout(300);
      }

      // El botón de submit oficial de Google Flow
      const submitBtn = page.locator('button[aria-label="Start generation"], button.generate-icon-button').first();
      if (await submitBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log('🎯 Haciendo clic en botón [Start generation] de Google Flow...');
        await submitBtn.click({ force: true });
      } else {
        await input.focus();
        await page.keyboard.press('Enter');
        console.log('⌨️ Fallback: Tecla Enter enviada para iniciar render...');
      }`;

if (code.includes('Tecla Enter enviada para iniciar render')) {
  code = code.replace(oldSubmitSection, newSubmitSection);
  fs.writeFileSync('/opt/mrgreen-flow/src/worker_flow.js', code);
  console.log('SUBMIT BUTTON PATCHED WITH Start generation');
} else {
  console.log('TARGET NOT FOUND');
}
