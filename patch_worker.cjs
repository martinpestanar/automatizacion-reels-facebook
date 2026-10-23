const fs = require('fs');

let code = fs.readFileSync('/opt/mrgreen-flow/src/worker_flow.js', 'utf8');

const oldTarget = `      // 1. Esperar en la galería a que la tarjeta termine de generar (desaparezca el spinner o aparezca play_circle / 100%)
      const tile = page.locator('flow-video-tile, flow-grid-tile-container, flow-media-tile, flow-card, div:has(> [play_circle])').first();
      await tile.waitFor({ state: 'visible', timeout: 30000 });`;

const newTarget = `      // 1. Esperar en la galería a que la tarjeta termine de generar (desaparezca el spinner o aparezca play_circle / 100%)
      const tile = page.locator('flow-video-tile, flow-grid-tile-container, flow-media-tile, flow-card, div.media-tile, div[role="button"]:has(video), div:has(> [play_circle])').first();
      try {
        await tile.waitFor({ state: 'visible', timeout: 60000 });
      } catch (err) {
        await page.screenshot({ path: '/tmp/tile_error.png' }).catch(() => {});
        throw err;
      }`;

if (code.includes('const tile = page.locator')) {
  code = code.replace(oldTarget, newTarget);
  fs.writeFileSync('/opt/mrgreen-flow/src/worker_flow.js', code);
  console.log('PATCH SUCCESS');
} else {
  console.log('TARGET NOT FOUND');
}
