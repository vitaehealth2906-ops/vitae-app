// Preenche os campos FILLABLE (e-mails + URLs derivaveis do dominio) das paginas legais
// e publica numa pasta de rota limpa /legal. Campos que dependem de CNPJ/razao social/
// endereco/nome do DPO ficam [PREENCHER] (impossivel inventar). UTF-8 sem BOM (preserva acentos).
const fs = require('fs'), path = require('path');
const src = path.join('d:', 'vitae-app-novo', 'legal-v2');
const dst = path.join('d:', 'vitae-app-novo', 'legal');
fs.mkdirSync(dst, { recursive: true });
const repl = [
  [/\[PREENCHER: e-mail do DPO, ex\. dpo@vitaidsaude\.com\]/g, 'privacidade@vitaidsaude.com'],
  [/\[PREENCHER: e-mail do DPO\]/g, 'privacidade@vitaidsaude.com'],
  [/\[PREENCHER: e-mail de atendimento \/ SAC\]/g, 'contato@vitaidsaude.com'],
  [/\[PREENCHER: e-mail de atendimento, ex\. contato@vitaidsaude\.com\]/g, 'contato@vitaidsaude.com'],
  [/\[PREENCHER: e-mail de atendimento\]/g, 'contato@vitaidsaude.com'],
  [/\[PREENCHER: e-mail de contato geral, ex\. contato@vitaidsaude\.com\]/g, 'contato@vitaidsaude.com'],
  [/\[PREENCHER: URL da página de exclusão[^\]]*\]/g, 'https://vitaidsaude.com/excluir-conta'],
  [/\[PREENCHER: URL da página web de exclusão de conta\]/g, 'https://vitaidsaude.com/excluir-conta'],
  [/\[PREENCHER: URL da página de Termos de Uso\]/g, 'https://vitaidsaude.com/legal/termos.html'],
];
const files = fs.readdirSync(src).filter(f => f.endsWith('.html'));
let total = 0;
for (const f of files) {
  let s = fs.readFileSync(path.join(src, f), 'utf8');
  let n = 0;
  for (const [re, val] of repl) { s = s.replace(re, () => { n++; return val; }); }
  fs.writeFileSync(path.join(dst, f), s, 'utf8');
  console.log(f + ': ' + n + ' campos preenchidos');
  total += n;
}
const left = files.reduce((a, f) => a + ((fs.readFileSync(path.join(dst, f), 'utf8').match(/\[PREENCHER/g) || []).length), 0);
console.log('TOTAL preenchido: ' + total + ' | [PREENCHER] restantes (dependem de CNPJ/dados oficiais): ' + left);
