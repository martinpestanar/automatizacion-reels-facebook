const fs = require('fs');

let code = fs.readFileSync('C:/Users/Martin/Documents/Korat-Flow-Agencia/Mr. Green/vps_worker_flow_fixed.js', 'utf8');

const oldTile = "const tile = page.locator('flow-video-tile, flow-grid-tile-container').first();";
const newTile = "const tile = page.locator('flow-video-tile, flow-grid-tile-container, flow-media-tile, flow-card, div:has(> [play_circle])').first();";

if (code.includes(oldTile)) {
  code = code.replace(oldTile, newTile);
  console.log('Tile selector replaced!');
} else {
  console.log('Target string not found');
}

fs.writeFileSync('C:/Users/Martin/Documents/Korat-Flow-Agencia/Mr. Green/vps_worker_flow_fixed.js', code);
