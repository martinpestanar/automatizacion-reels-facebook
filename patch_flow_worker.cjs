const fs = require('fs');

let code = fs.readFileSync('C:/Users/Martin/Documents/Korat-Flow-Agencia/Mr. Green/vps_worker_flow.js', 'utf8');

// 1. In project open: Prefer creating a fresh project so previous tiles do not interfere
const oldProjectOpen = `    console.log('📂 Buscando proyecto en Google Flow...');
    const projectLocator = page.locator('a.project-thumbnail-container, a[aria-label*="proyecto" i], a[aria-label*="project" i]').first();
    const hasProject = await projectLocator.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasProject) {
      console.log('Abriendo proyecto existente...');
      await projectLocator.click();
    } else {
      console.log('Creando nuevo proyecto en Google Flow...');
      const newBtn = page.locator('button.new-project-button, button:has-text("Nuevo proyecto"), button:has-text("New project")').first();
      await newBtn.click();
    }`;

const newProjectOpen = `    console.log('📂 Creando proyecto limpio para este video en Google Flow...');
    const newBtn = page.locator('button.new-project-button, button:has-text("Nuevo proyecto"), button:has-text("New project")').first();
    if (await newBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await newBtn.click();
    } else {
      const projectLocator = page.locator('a.project-thumbnail-container, a[aria-label*="proyecto" i], a[aria-label*="project" i]').first();
      if (await projectLocator.isVisible({ timeout: 4000 }).catch(() => false)) {
        await projectLocator.click();
      }
    }`;

if (code.includes(oldProjectOpen)) {
  code = code.replace(oldProjectOpen, newProjectOpen);
  console.log('Project open patched!');
} else {
  console.warn('Project open target not found exactly');
}

// 2. In scene close: Make sure modal is fully closed and input area is restored
const oldModalClose = `      // Volver a la galería para la siguiente escena (cerrar modal o volver atrás)
      const closeOrBackBtn = page.locator('button[aria-label*="Cerrar" i], button[aria-label*="Close" i], button[aria-label*="Atrás" i], button[aria-label*="Volver" i], button[aria-label*="Back" i], button:has-text("arrow_back"), button:has-text("close")').first();
      if (await closeOrBackBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await closeOrBackBtn.click().catch(() => {});
        await page.waitForTimeout(1500);
      } else {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1000);
      }`;

const newModalClose = `      // Volver a la galería para la siguiente escena cerrando el visor de forma garantizada
      console.log(\`🔄 Cerrando visor de Escena \${sc.num} para volver al editor...\`);
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        const closeOrBackBtn = page.locator('button[aria-label*="Cerrar" i], button[aria-label*="Close" i], button[aria-label*="Atrás" i], button[aria-label*="Volver" i], button[aria-label*="Back" i], button:has-text("arrow_back"), button:has-text("close")').first();
        if (await closeOrBackBtn.isVisible({ timeout: 500 }).catch(() => false)) {
          await closeOrBackBtn.click({ force: true }).catch(() => {});
        }
      }
      // Asegurar que el input de prompt esté libre y visible
      const promptInput = page.locator('.ProseMirror, [contenteditable="true"]').first();
      await promptInput.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(800);`;

if (code.includes(oldModalClose)) {
  code = code.replace(oldModalClose, newModalClose);
  console.log('Modal close patched!');
} else {
  console.warn('Modal close target not found exactly');
}

fs.writeFileSync('C:/Users/Martin/Documents/Korat-Flow-Agencia/Mr. Green/vps_worker_flow_fixed.js', code);
console.log('Done!');
