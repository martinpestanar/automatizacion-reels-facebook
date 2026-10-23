const fs = require('fs');

let code = fs.readFileSync('/opt/mrgreen-flow/src/worker_flow.js', 'utf8');

// Replace the submit logic:
const oldSubmit = `      const submitBtn = page.locator('button.generate-icon-button, button[aria-label*="generación" i], button[aria-label*="generate" i], button:has-text("arrow_forward")').first();
      if (await submitBtn.isVisible() && !(await submitBtn.isDisabled())) {
        await submitBtn.click();
      } else {
        await page.keyboard.press('Enter');
      }`;

const newSubmit = `      // Presionar Enter directamente dentro del campo de texto
      await input.focus();
      await page.keyboard.press('Enter');
      console.log('⌨️ Tecla Enter enviada para iniciar render de escena...');`;

if (code.includes('button.generate-icon-button')) {
  code = code.replace(oldSubmit, newSubmit);
  fs.writeFileSync('/opt/mrgreen-flow/src/worker_flow.js', code);
  console.log('PATCH WORKER FLOW SUBMIT SUCCESS');
} else {
  console.log('TARGET SUBMIT NOT FOUND');
}
