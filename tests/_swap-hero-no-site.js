/**
 * Troca a imagem hero da seção "A SOLUÇÃO" no site-oficial.html.
 *
 * O site é bundled: <script type="__bundler/manifest"> guarda os assets como
 * { UUID: { mime, data: base64, ... } }. A seção #como referencia o UUID
 * 6a805543-5166-4d29-9bbe-769b1689ad39. Em vez de mexer na markup, substituímos
 * o asset binário no manifest — assim a UUID continua válida, só muda a foto.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'site-oficial.html');
const BAK = FILE + '.bak-' + Date.now();
const NEW_PNG = path.join(__dirname, '..', 'docs', 'marketing', 'hero-embed.png');
const TARGET_UUID = '6a805543-5166-4d29-9bbe-769b1689ad39';

const raw = fs.readFileSync(FILE, 'utf8');

// Acha bloco do manifest
const re = /(<script type="__bundler\/manifest">)([\s\S]*?)(<\/script>)/;
const m = raw.match(re);
if (!m) { console.error('✗ manifest não encontrado'); process.exit(1); }

const manifest = JSON.parse(m[2].trim());
const entry = manifest[TARGET_UUID];
if (!entry) { console.error('✗ UUID', TARGET_UUID, 'não está no manifest'); process.exit(1); }

console.log('✓ encontrado asset · mime:', entry.mime, '· tamanho original:', entry.data.length, 'chars base64');

// Lê nova hero, base64
const newBytes = fs.readFileSync(NEW_PNG);
const newBase64 = newBytes.toString('base64');
console.log('✓ nova hero ·', newBytes.length, 'bytes ·', newBase64.length, 'chars base64');

// Substitui
manifest[TARGET_UUID] = {
  ...entry,
  mime: 'image/png',
  data: newBase64,
  compressed: false,
};

// Re-serializa preservando formato compacto (sem indentação, igual ao original)
const newManifest = JSON.stringify(manifest);

const newRaw = raw.replace(re, m[1] + '\n' + newManifest + '\n' + m[3]);

// Backup
fs.writeFileSync(BAK, raw, 'utf8');
console.log('✓ backup salvo →', BAK);

fs.writeFileSync(FILE, newRaw, 'utf8');
console.log('✓ site-oficial.html atualizado · ', (newRaw.length - raw.length), 'chars de diferença');
