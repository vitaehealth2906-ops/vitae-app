/**
 * Remove todas as pills das seções + a seção inteira "05 depoimento"
 * + atualiza headline da seção problema.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'site-oficial.html');
const BAK = FILE + '.bak-strip-pills-' + Date.now();

const raw = fs.readFileSync(FILE, 'utf8');
const reTemplate = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
const m = raw.match(reTemplate);
if (!m) { console.error('✗ template não encontrado'); process.exit(1); }

const before = m[1];
let decoded = JSON.parse(m[2].trim());
const after = m[3];

console.log('✓ tamanho inicial:', decoded.length);

// ───────────────────────────────────────────────────────────────
// 1. Atualizar headline da seção problema
// ───────────────────────────────────────────────────────────────
const oldHead = 'De 10 a 15 minutos de cada consulta <span class="grad-text">são gastos com anamnese.</span>';
const newHead = 'Economize tempo coletando anamnese e <span class="grad-text">preenchendo prontuários.</span>';
if (!decoded.includes(oldHead)) { console.error('✗ headline antigo não encontrado'); process.exit(1); }
decoded = decoded.replace(oldHead, newHead);
console.log('✓ headline atualizado');

// ───────────────────────────────────────────────────────────────
// 2. Remover pills das seções principais
// ───────────────────────────────────────────────────────────────
const pillsToRemove = [
  '<span class="tag">O problema</span>',
  '<span class="tag">A solução</span>',
  '<span class="tag">O custo real</span>',
  '<span class="tag">Dúvidas frequentes</span>',
];
for (const p of pillsToRemove) {
  if (!decoded.includes(p)) { console.warn('⚠ pill não encontrada:', p); continue; }
  decoded = decoded.replace(p, '');
  console.log('✓ removido:', p.replace(/<[^>]+>/g, ''));
}

// ───────────────────────────────────────────────────────────────
// 3. Remover seção 05 depoimento inteira
// ───────────────────────────────────────────────────────────────
const depMarker = 'data-screen-label="05 depoimento"';
const depIdx = decoded.indexOf(depMarker);
if (depIdx < 0) { console.error('✗ seção depoimento não encontrada'); process.exit(1); }
const sectStart = decoded.lastIndexOf('<section', depIdx);
const sectEnd = decoded.indexOf('</section>', depIdx) + '</section>'.length;
const removedSect = decoded.substring(sectStart, sectEnd);
console.log('✓ removendo seção depoimento ·', removedSect.length, 'chars');
decoded = decoded.substring(0, sectStart) + decoded.substring(sectEnd);

// Limpa também o comentário "<!-- DEPOIMENTO -->" se houver
decoded = decoded.replace(/<!--\s*DEPOIMENTO\s*-->\s*/g, '');

console.log('✓ tamanho final:', decoded.length, '· diff:', decoded.length - (m[2].trim().length - 2));

// ───────────────────────────────────────────────────────────────
// Reescreve template
// ───────────────────────────────────────────────────────────────
const newBody = JSON.stringify(decoded).replace(/<\/script>/g, '<\\/script>');

fs.writeFileSync(BAK, raw, 'utf8');
console.log('✓ backup →', BAK);

const fullMatch = m[0];
const templateStart = raw.indexOf(fullMatch);
const newRaw = raw.substring(0, templateStart) + before + newBody + after + raw.substring(templateStart + fullMatch.length);

// Valida JSON
try {
  const m2 = newRaw.match(reTemplate);
  JSON.parse(m2[2].trim());
  console.log('✓ JSON válido após reescrita');
} catch (e) {
  console.error('✗ JSON inválido:', e.message);
  process.exit(1);
}

fs.writeFileSync(FILE, newRaw, 'utf8');
console.log('✓ site-oficial.html atualizado · diff', (newRaw.length - raw.length), 'chars');
