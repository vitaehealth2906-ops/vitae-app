/**
 * Testes unitários do service prosodica.js (Fase 9)
 * Determinístico — não precisa de Claude/Gemini.
 */
const prosodica = require('../backend/src/services/prosodica');

let pass = 0, fail = 0;
function teste(nome, fn) {
  try {
    fn();
    console.log(`✓ ${nome}`);
    pass++;
  } catch(e) {
    console.log(`✗ ${nome}: ${e.message}`);
    fail++;
  }
}
function eq(a, b, msg) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((msg||'') + ' esperado ' + JSON.stringify(b) + ' recebido ' + JSON.stringify(a)); }
function trueAssert(v, msg) { if (!v) throw new Error(msg || 'assertion failed'); }

teste('analisa retorna null pra audio < 30s', () => {
  const r = prosodica.analisar({ duracaoSegundos: 20, transcricao: 'teste curto' });
  eq(r.alerta, null);
  eq(r.features, null);
  eq(r.motivo, 'audio_curto_demais');
});

teste('analisa retorna features pra audio >= 30s', () => {
  const r = prosodica.analisar({
    duracaoSegundos: 60,
    transcricao: 'Olá doutor, estou com dor de cabeça há duas semanas que piora à tarde. Tomo dipirona quando dói muito mas não resolve totalmente. Minha mãe também tinha enxaqueca quando era jovem.',
  });
  trueAssert(r.features !== null, 'features deve existir');
  trueAssert(typeof r.features.velocidade_wpm === 'number', 'velocidade_wpm');
  trueAssert(r.features.modo_extracao === 'mock');
  trueAssert(r.retencaoAte instanceof Date, 'retencaoAte');
  trueAssert(r.thresholds, 'thresholds');
});

teste('determinismo: mesma transcrição → mesmas features', () => {
  const input = { duracaoSegundos: 60, transcricao: 'Texto exatamente igual pra teste' };
  const a = prosodica.analisar(input);
  const b = prosodica.analisar(input);
  eq(a.features.jitter_estimado, b.features.jitter_estimado, 'jitter');
  eq(a.features.shimmer_estimado, b.features.shimmer_estimado, 'shimmer');
  eq(a.features.f0_mediana_hz, b.features.f0_mediana_hz, 'f0');
});

teste('retencao 20 anos', () => {
  const agora = new Date();
  const r = prosodica.calcRetencaoAte20anos(agora);
  const diff = r.getFullYear() - agora.getFullYear();
  eq(diff, 20);
});

teste('hash audio sha-256 (32 bytes hex = 64 chars)', () => {
  const buf = Buffer.from('audio fake');
  const h = prosodica.hashAudio(buf);
  trueAssert(h && h.length === 64, 'hash deve ser 64 chars hex');
  // Determinismo
  eq(prosodica.hashAudio(buf), h);
});

teste('avalia features fora de threshold dispara alerta', () => {
  const features = {
    duracao_segundos: 60,
    palavras_total: 100,
    velocidade_wpm: 80, // < 95 = fala lenta
    pausa_max_ms: 2500, // > 1500 = pausa longa
    pausa_media_ms: 500,
    jitter_estimado: 0.05, // > 0.04 = voz tremida
    shimmer_estimado: 0.12, // > 0.10
    f0_mediana_hz: 180,
    f0_variacao_pct: 0.30, // > 0.25 = tom alterado
    modo_extracao: 'mock',
  };
  const a = prosodica.avaliarFeatures(features);
  trueAssert(a !== null, 'deve gerar alerta');
  trueAssert(a.severidade === 'alta' || a.severidade === 'media', 'severidade alta/media com 4 sinais');
  trueAssert(a.disclaimer.includes('CFM 2.314'), 'disclaimer CFM presente');
});

teste('features dentro de threshold = null (saudavel)', () => {
  const features = {
    duracao_segundos: 60,
    palavras_total: 200,
    velocidade_wpm: 130, // OK
    pausa_max_ms: 800, // OK
    pausa_media_ms: 200,
    jitter_estimado: 0.02,
    shimmer_estimado: 0.05,
    f0_mediana_hz: 180,
    f0_variacao_pct: 0.10,
    modo_extracao: 'mock',
  };
  eq(prosodica.avaliarFeatures(features), null);
});

teste('thresholds expostos', () => {
  trueAssert(prosodica.THRESHOLDS, 'thresholds disponíveis');
  eq(prosodica.THRESHOLDS.duracaoMinSegundos, 30);
  eq(prosodica.THRESHOLDS.pausaMinMs, 1500);
});

teste('textos clinicos em PT-BR (sem jargão técnico)', () => {
  const t = prosodica.TEXTOS_CLINICOS;
  trueAssert(!Object.values(t).some(s => /jitter|shimmer|F0|hertz/i.test(s)), 'sem termos técnicos no texto pro médico');
  trueAssert(Object.values(t).every(s => /^[A-ZÀ-Ú]/.test(s)), 'começa com maiúscula');
});

console.log(`\n=== ${pass} OK · ${fail} FALHA ===`);
process.exit(fail > 0 ? 1 : 0);
