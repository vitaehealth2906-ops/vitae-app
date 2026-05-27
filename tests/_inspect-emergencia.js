// Busca abrangente
const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site-oficial.html');
const html = fs.readFileSync(SITE, 'utf8');

const tplMatch = html.match(/(<script type="__bundler\/template">)([\s\S]+?)(<\/script>)/);
const manMatch = html.match(/(<script type="__bundler\/manifest">)([\s\S]+?)(<\/script>)/);

const NEEDLES_PLAIN = ['Numa emerg', 'PORQUEIMPORTA', 'POR QUE IMPORTA', 'lembrar de tudo', 'pronto-socorro', 'Lucas, 8 anos', 'febre alta', 'tenta lembrar'];

function searchIn(label, text) {
  console.log('\n---', label, 'len', text.length, '---');
  NEEDLES_PLAIN.forEach(n => {
    const i = text.indexOf(n);
    if (i >= 0) {
      console.log('  HIT', JSON.stringify(n), 'em', i);
      console.log('    contexto:', JSON.stringify(text.slice(Math.max(0,i-60), i+120)));
    } else {
      console.log('  miss', JSON.stringify(n));
    }
  });
}

if (tplMatch) {
  const tpl = JSON.parse(tplMatch[2].trim());
  searchIn('TEMPLATE', tpl);
}

if (manMatch) {
  const man = JSON.parse(manMatch[2].trim());
  for (const key of Object.keys(man)) {
    const val = man[key];
    if (typeof val !== 'string') continue;
    try {
      const decoded = Buffer.from(val, 'base64').toString('utf8');
      // so loga se acharmos algo
      let hit = false;
      for (const n of NEEDLES_PLAIN) {
        if (decoded.indexOf(n) >= 0) {
          if (!hit) { searchIn('asset:' + key, decoded); hit = true; }
        }
      }
    } catch (e) {}
  }
}

// busca direta no HTML cru tambem
console.log('\n--- HTML CRU (sem decodificar) ---');
['Numa emerg', 'pronto-socorro', 'lembrar de tudo'].forEach(n => {
  console.log('  ', JSON.stringify(n), '->', html.indexOf(n));
});
