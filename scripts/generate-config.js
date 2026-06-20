const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'config.js');
const example = path.join(root, 'config.example.js');

const url = (process.env.SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_ANON_KEY || '').trim();

function esc(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

if (url && key) {
  const content = `window.CUZCO_CONFIG = {
  SUPABASE_URL: '${esc(url)}',
  SUPABASE_ANON_KEY: '${esc(key)}'
};
`;
  fs.writeFileSync(out, content, 'utf8');
  console.log('config.js generado desde variables de entorno.');
} else if (fs.existsSync(out)) {
  console.log('Variables de entorno no definidas; se mantiene config.js existente.');
} else if (fs.existsSync(example)) {
  fs.copyFileSync(example, out);
  console.log('config.js creado desde config.example.js (rellena Supabase en el panel o en config.js).');
} else {
  fs.writeFileSync(
    out,
    "window.CUZCO_CONFIG = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' };\n",
    'utf8'
  );
  console.warn('config.js vacío: configura Supabase antes de desplegar.');
}