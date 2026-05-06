/**
 * Testes unitários do whatsapp.js (Fase 10)
 * Foca em normalização e placeholders (não dispara real).
 */
const wa = require('../backend/src/services/whatsapp');

let pass = 0, fail = 0;
function teste(nome, fn) { try { fn(); console.log(`✓ ${nome}`); pass++; } catch(e) { console.log(`✗ ${nome}: ${e.message}`); fail++; } }
function eq(a, b) { if (a !== b) throw new Error('esperado ' + JSON.stringify(b) + ' recebido ' + JSON.stringify(a)); }

teste('normaliza celular BR 11 dígitos', () => {
  eq(wa.normalizarTelefone('11987654321'), '+5511987654321');
});

teste('normaliza celular com 55 prefix', () => {
  eq(wa.normalizarTelefone('5511987654321'), '+5511987654321');
});

teste('normaliza com formatação humana', () => {
  eq(wa.normalizarTelefone('(11) 98765-4321'), '+5511987654321');
});

teste('rejeita número curto demais', () => {
  eq(wa.normalizarTelefone('123'), null);
});

teste('rejeita null/undefined', () => {
  eq(wa.normalizarTelefone(null), null);
  eq(wa.normalizarTelefone(undefined), null);
});

teste('placeholders simples', () => {
  const m = wa.aplicarPlaceholders('Olá {{nome}}, sua consulta com {{medico}} é dia {{data}}', {
    nome: 'Maria', medico: 'Dr. Lucas', data: '15/04/2026'
  });
  eq(m, 'Olá Maria, sua consulta com Dr. Lucas é dia 15/04/2026');
});

teste('placeholder vazio vira string vazia', () => {
  const m = wa.aplicarPlaceholders('Hi {{nome}}, link: {{link}}', { nome: 'X' });
  eq(m, 'Hi X, link: ');
});

teste('placeholder com {{ } sem nome real fica intacto', () => {
  const m = wa.aplicarPlaceholders('teste {{coisa}} fim', {});
  eq(m, 'teste  fim');
});

teste('MODO default = simulacao', () => {
  // Variável de ambiente não setada
  if (!process.env.WHATSAPP_MODO) eq(wa.MODO, 'simulacao');
});

console.log(`\n=== ${pass} OK · ${fail} FALHA ===`);
process.exit(fail > 0 ? 1 : 0);
