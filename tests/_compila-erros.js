/**
 * Compila os erros do audit em padrões legíveis.
 */
const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, '_audit-FULL-2026-05-20', '_resultado.json'), 'utf8'));

const todos404 = {};
const erros_console_padroes = {};
const telas_com_problema = [];

for (const t of data.telas) {
  if (t.erros_404_500 && t.erros_404_500.length > 0) {
    for (const e of t.erros_404_500) {
      const u = e.url.replace('http://localhost:3000', '').split('?')[0];
      if (!todos404[u]) todos404[u] = { count: 0, status: e.status, em: [] };
      todos404[u].count++;
      if (!todos404[u].em.includes(t.id)) todos404[u].em.push(t.id);
    }
  }
  if (t.erros_console && t.erros_console.length > 0) {
    for (const e of t.erros_console) {
      // Normaliza mensagem (tira URLs e tokens)
      let chave = e.text
        .replace(/https?:\/\/[^\s]+/g, '<URL>')
        .replace(/\d+/g, 'N')
        .slice(0, 120);
      if (!erros_console_padroes[chave]) erros_console_padroes[chave] = { count: 0, em: [] };
      erros_console_padroes[chave].count++;
      if (!erros_console_padroes[chave].em.includes(t.id)) erros_console_padroes[chave].em.push(t.id);
    }
  }
  if ((t.erros_404_500 && t.erros_404_500.length > 0) || (t.erros_console && t.erros_console.length > 5) || (t.erros_pagina && t.erros_pagina.length > 0)) {
    telas_com_problema.push({
      id: t.id,
      cat: t.cat,
      url: t.url,
      total_404: (t.erros_404_500 || []).length,
      total_cons: (t.erros_console || []).length,
      total_pg: (t.erros_pagina || []).length,
      urlFinal: t.urlFinal,
      stats: t.stats,
    });
  }
}

const out = {
  resumo: {
    arquivos_404_unicos: Object.keys(todos404).length,
    padroes_erro_console: Object.keys(erros_console_padroes).length,
    telas_com_problema: telas_com_problema.length,
  },
  arquivos_404_ranqueados: Object.entries(todos404)
    .sort(([, a], [, b]) => b.count - a.count)
    .map(([u, info]) => ({ arquivo: u, ocorrencias: info.count, em_telas: info.em })),
  erros_console_top: Object.entries(erros_console_padroes)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 20)
    .map(([k, info]) => ({ mensagem: k, ocorrencias: info.count, em_telas: info.em.slice(0, 8) })),
  telas_problematicas: telas_com_problema.sort((a, b) => (b.total_404 + b.total_cons) - (a.total_404 + a.total_cons)),
};

fs.writeFileSync(path.join(__dirname, '_audit-FULL-2026-05-20', '_erros-compilados.json'), JSON.stringify(out, null, 2));
console.log('Arquivos 404 únicos:', out.resumo.arquivos_404_unicos);
console.log('Padrões de erro console:', out.resumo.padroes_erro_console);
console.log('Telas com problema:', out.resumo.telas_com_problema);
console.log('\nTop 15 arquivos 404:');
for (const a of out.arquivos_404_ranqueados.slice(0, 15)) {
  console.log(`  [${a.ocorrencias}x] ${a.arquivo}  ← ${a.em_telas.slice(0, 4).join(', ')}${a.em_telas.length > 4 ? '...' : ''}`);
}
console.log('\nTop 10 erros console:');
for (const e of out.erros_console_top.slice(0, 10)) {
  console.log(`  [${e.ocorrencias}x] ${e.mensagem.slice(0, 90)}...`);
}
