const fs = require('fs');

let code = fs.readFileSync('/opt/mrgreen-flow/src/worker_flow.js', 'utf8');

const oldCheck = `      // 1. Intentar clic directo en el botón de generación
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

const newCheck = `      // DETECCIÓN TEMPRANA: Verificar si Google Flow muestra advertencia de puntos insuficientes
      const pointsWarning = page.locator('button.prompt-warning-button, button[aria-label*="puntos insuficientes" i], button[aria-label*="insufficient points" i]').first();
      if (await pointsWarning.isVisible({ timeout: 1500 }).catch(() => false)) {
        console.error('⛔ ALERTA: La cuenta actual de Google Flow no tiene créditos suficientes.');
        // Marcar la cuenta en Supabase de inmediato como agotada
        await supabase.from('google_accounts').update({
          status: 'exhausted',
          daily_credits_used: selectedAccount.daily_credits_total
        }).eq('id', selectedAccount.id);
        throw new Error(\`Cuenta \${selectedAccount.alias} sin créditos en Google Flow. Marcada como agotada.\`);
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

if (code.includes('Intentar clic directo en el botón de generación')) {
  code = code.replace(oldCheck, newCheck);
  fs.writeFileSync('/opt/mrgreen-flow/src/worker_flow.js', code);
  console.log('WORKER_FLOW CREDITS GUARD PATCHED!');
} else {
  console.log('TARGET NOT FOUND');
}
