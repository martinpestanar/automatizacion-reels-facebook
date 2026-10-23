const fs = require('fs');

let code = fs.readFileSync('/opt/mrgreen-flow/cron_autofill.js', 'utf8');
code = code.replace(
  /\.eq\('status', 'stored'\)/g,
  ".eq('status', 'stored').neq('title', 'El Error de la Cáscara de Huevo')"
);
fs.writeFileSync('/opt/mrgreen-flow/cron_autofill.js', code);
console.log('cron_autofill patched to advance to next topics!');
