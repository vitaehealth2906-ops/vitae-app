/**
 * Remove o parágrafo "Não porque você quer..." da seção problema.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'site-oficial.html');
const BAK = FILE + '.bak-strip-subtext-' + Date.now();

const raw = fs.readFileSync(FILE, 'utf8');
const reTemplate = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
const m = raw.match(reTemplate);
if (!m) { console.error('✗ template não encontrado'); process.exit(1); }

const before = m[1];
let decoded = JSON.parse(m[2].trim());
const after = m[3];

const target = '<p class="prob-subtext reveal" data-d="2">Não porque você quer. Porque o sistema te obriga. Cada paciente chega como uma página em branco — e você tem 60 minutos para descobrir tudo do zero.</p>';
if (!decoded.includes(target)) { console.error('✗ frase não encontrada'); process.exit(1); }
decoded = decoded.replace(target, '');
// Limpa whitespace excedente da linha onde estava
decoded = decoded.replace(/\n\s*\n\s*<\/div>\n  <\/section>\n\n<!-- A SOLUÇÃO -->/, '\n  </div>\n</section>\n\n<!-- A SOLUÇÃO -->');
console.log('✓ parágrafo removido');

const newBody = JSON.stringify(decoded).replace(/<\/script>/g, '<\\/script>');
fs.writeFileSync(BAK, raw, 'utf8');
console.log('✓ backup →', BAK);

const fullMatch = m[0];
const templateStart = raw.indexOf(fullMatch);
const newRaw = raw.substring(0, templateStart) + before + newBody + after + raw.substring(templateStart + fullMatch.length);

try {
  const m2 = newRaw.match(reTemplate);
  JSON.parse(m2[2].trim());
  console.log('✓ JSON válido');
} catch (e) {
  console.error('✗ JSON inválido:', e.message);
  process.exit(1);
}

fs.writeFileSync(FILE, newRaw, 'utf8');
console.log('✓ site atualizado · diff', (newRaw.length - raw.length), 'chars');
