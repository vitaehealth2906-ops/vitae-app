// Reconstrói o MD da fase 2 a partir do JSON
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, 'fase2-2026-05-19T14-47-54');
const r = JSON.parse(fs.readFileSync(path.join(OUT, 'relatorio.json'), 'utf8'));
const t = r.resumo.total, p = r.resumo.passou || 0, f = r.resumo.falhou || 0;
const pct = t ? Math.round(p / t * 100) : 0;

let md = `# Relatório E2E FASE 2 — 19/mai/2026\n\n**Início:** ${r.startedAt}\n**Fim:** ${r.endedAt || 'incompleto'}\n\n## Resumo\n\n`;
md += `| Métrica | Valor |\n|---|---|\n`;
md += `| Total cenários | ${t} |\n| ✅ Passou | ${p} (${pct}%) |\n| ❌ Falhou | ${f} |\n`;
md += `| Recursos criados | ${(r.recursosCriados?.preConsultas || []).length} PCs · ${(r.recursosCriados?.agendamentos || []).length} agendamentos · ${(r.recursosCriados?.documentos || []).length} docs |\n`;
if (r.cleanup) md += `| Cleanup | ${r.cleanup.ok} apagados / ${r.cleanup.fail} preservados (proteção CFM/LGPD) |\n`;
md += `\n`;

const falhas = r.cenarios.filter(c => c.status === 'falhou');
if (falhas.length) {
  md += `## ❌ Falhas (${falhas.length})\n\n`;
  for (const c of falhas) {
    md += `### [${c.id || '?'}] ${c.nome || '?'}\n- **Erro:** \`${c.erro}\`\n- **Tempo:** ${c.tempoMs}ms\n\n`;
  }
}

md += `## ✅ Passou por grupo\n\n`;
const grupos = ['G1', 'G2', 'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9', 'G10'];
const labels = {
  G1: 'Quiz vita id validações',
  G2: 'UI médico profundo',
  G3: 'UI paciente profundo',
  G4: 'Tela detalhe consulta',
  G5: 'Estados de erro UI',
  G6: 'Anamnese + IA Collab',
  G7: 'Notificações cruzadas',
  G8: 'Validações backend',
  G9: 'Stress & idempotência',
  G10: 'Cleanup & auditoria',
};
for (const g of grupos) {
  const lista = r.cenarios.filter(c => c.id && c.id.startsWith(g + '.') && c.status === 'passou');
  if (lista.length === 0) continue;
  md += `### ${g} · ${labels[g]} — ${lista.length} cenários\n`;
  for (const c of lista) md += `- [${c.id}] ${c.nome} (${c.tempoMs}ms)\n`;
  md += `\n`;
}

fs.writeFileSync(path.join(OUT, 'relatorio.md'), md);
console.log('✅ MD gerado:', path.join(OUT, 'relatorio.md'));
console.log('Resumo: ' + p + '/' + t + ' verdes (' + pct + '%)');
