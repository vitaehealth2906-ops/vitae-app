/**
 * Inventário físico exaustivo. Output: tests/_inventario-2026-05-20.json
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'backups',
]);
const SKIP_SUB = [
  'backend/node_modules',
  'tests/videos',
  'tests/shots-paciente',
  'tests/cobertura-visual-2026-05-19T17-28-19',
  'tests/fase2-2026-05-19T14-47-54',
  'tests/master-2026-05-19T14-30-44',
  'tests/master-2026-05-19T14-31-56',
  'tests/master-2026-05-19T14-34-54',
  'tests/validacao-visual-2026-05-19T15-07-56',
  'tests/logs',
  'tests/_audit-FULL-2026-05-20',
];

const files = [];

function walk(dir, rel = '') {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) { return; }

  for (const e of entries) {
    const full = path.join(dir, e.name);
    const r = rel ? rel + '/' + e.name : e.name;
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      if (SKIP_SUB.includes(r)) continue;
      walk(full, r);
    } else if (e.isFile()) {
      let stat;
      try { stat = fs.statSync(full); } catch (e) { continue; }
      files.push({
        path: r.replace(/\\/g, '/'),
        size: stat.size,
        modificado: stat.mtime.toISOString().slice(0, 10),
        ext: path.extname(e.name).toLowerCase(),
      });
    }
  }
}

walk(ROOT);

const porExt = {};
const porPasta = {};
let totalSize = 0;

for (const f of files) {
  porExt[f.ext || '(sem ext)'] = (porExt[f.ext || '(sem ext)'] || 0) + 1;
  const pasta = f.path.split('/')[0] || '(raiz)';
  if (!porPasta[pasta]) porPasta[pasta] = { count: 0, size: 0 };
  porPasta[pasta].count++;
  porPasta[pasta].size += f.size;
  totalSize += f.size;
}

const sumario = {
  total_arquivos: files.length,
  tamanho_total_mb: (totalSize / 1024 / 1024).toFixed(1),
  por_extensao: porExt,
  por_pasta_top: Object.entries(porPasta)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([p, s]) => ({ pasta: p, arquivos: s.count, tamanho_mb: (s.size / 1024 / 1024).toFixed(2) })),
};

const out = path.join(__dirname, '_inventario-2026-05-20.json');
fs.writeFileSync(out, JSON.stringify({ sumario, files }, null, 2));
console.log('Inventário salvo:', out);
console.log('Total arquivos:', files.length);
console.log('Tamanho total:', sumario.tamanho_total_mb, 'MB');
console.log('Por pasta:');
for (const p of sumario.por_pasta_top.slice(0, 15)) {
  console.log(`  ${p.pasta}: ${p.arquivos} arquivos (${p.tamanho_mb} MB)`);
}
