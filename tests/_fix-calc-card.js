// _fix-calc-card.js
// 2 fixes no card da calculadora "O quanto voce esta perdendo":
//   1. Adiciona overflow:hidden em .calc-card pra faixa gradient nao sair pra fora
//   2. Remove o pill "tempo real" do canto direito do header
// Usa a mesma tecnica do _swap-antes-depois-v07.js (escape de </script>).

const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site-oficial.html');
const BACKUP = `${SITE}.bak-calc-fix-${Date.now()}`;

const html = fs.readFileSync(SITE, 'utf8');
fs.writeFileSync(BACKUP, html);
console.log('backup:', BACKUP);

const tplPattern = /(<script type="__bundler\/template">)([\s\S]+?)(<\/script>)/;
const m = html.match(tplPattern);
if (!m) { console.error('FATAL: template tag nao encontrada'); process.exit(1); }
const oldStr = JSON.parse(m[2].trim());
console.log('template len antes:', oldStr.length);

// ──────────────────────────────────────────────────────────────
// FIX 1: overflow:hidden em .calc-card
// ──────────────────────────────────────────────────────────────
const CALC_CSS_OLD = `.calc-card {
    background: #fff;
    border: 1px solid var(--bg3);
    border-radius: var(--r-lg);
    padding: 26px;
    box-shadow: var(--sh-lg);
    position: relative;
  }`;
const CALC_CSS_NEW = `.calc-card {
    background: #fff;
    border: 1px solid var(--bg3);
    border-radius: var(--r-lg);
    padding: 26px;
    box-shadow: var(--sh-lg);
    position: relative;
    overflow: hidden;
  }`;

if (oldStr.indexOf(CALC_CSS_OLD) < 0) {
  console.error('FATAL: bloco .calc-card CSS nao encontrado no template');
  process.exit(1);
}

// ──────────────────────────────────────────────────────────────
// FIX 2: remover "tempo real"
// ──────────────────────────────────────────────────────────────
const META_OLD = `<div class="meta">tempo real</div>`;
if (oldStr.indexOf(META_OLD) < 0) {
  console.error('FATAL: <div class="meta">tempo real</div> nao encontrado');
  process.exit(1);
}

// Aplica as 2 trocas
let newStr = oldStr.replace(CALC_CSS_OLD, CALC_CSS_NEW);
newStr = newStr.replace(META_OLD, '');
console.log('template len depois:', newStr.length);

// Sanity
if (newStr.indexOf('overflow: hidden;\n    box-shadow') < 0 && newStr.indexOf('overflow: hidden;\n  }') < 0) {
  console.error('FATAL: overflow:hidden nao foi inserido como esperado');
  process.exit(1);
}
if (newStr.indexOf('tempo real') >= 0) {
  console.error('FATAL: "tempo real" ainda aparece no template');
  process.exit(1);
}

// Escape obrigatorio </script> -> <\/script>
const newJson = '\n' + JSON.stringify(newStr).replace(/<\/script>/g, '<\\/script>') + '\n  ';
const newHtml = html.replace(tplPattern, (_m, a, _b, c) => a + newJson + c);

if (newHtml === html) {
  console.error('FATAL: HTML nao mudou');
  process.exit(1);
}

fs.writeFileSync(SITE, newHtml);
console.log('OK. novo size:', fs.statSync(SITE).size, 'bytes');
