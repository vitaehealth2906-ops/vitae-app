// ═══════════════════════════════════════════════════════════════════
// AGENTE FARMACOLOGISTA
// 100% deterministico — sem LLM.
// Cruza: medicamentos mencionados no audio + medicamentos do perfil
//        com alergias do perfil usando tabela de classes farmacologicas.
// Saida: cards de alerta (critico/alto/medio) + auto-medicacao.
// ═══════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

let _classes = null;
let _sinonimos = null;

function carregarBase() {
  if (_classes && _sinonimos) return;
  const base = path.join(__dirname, '..', '..', '..', 'knowledge', '_farmacologia');
  _classes = JSON.parse(fs.readFileSync(path.join(base, 'classes.json'), 'utf8'));
  _sinonimos = JSON.parse(fs.readFileSync(path.join(base, 'sinonimos.json'), 'utf8'));
}

// Normaliza nome comercial -> principio ativo + classe
function normalizarMedicamento(nome) {
  if (!nome) return null;
  carregarBase();
  const chave = String(nome).toLowerCase().trim().replace(/\s+/g, '_');
  const s = _sinonimos.sinonimos[chave] || _sinonimos.sinonimos[chave.replace(/_/g, '')] || null;
  if (s) return { nome_original: nome, principio_ativo: s.principio_ativo, classe: s.classe };
  // Tenta match aproximado por substring
  for (const k in _sinonimos.sinonimos) {
    if (chave.includes(k) || k.includes(chave)) {
      const v = _sinonimos.sinonimos[k];
      return { nome_original: nome, principio_ativo: v.principio_ativo, classe: v.classe };
    }
  }
  return { nome_original: nome, principio_ativo: null, classe: null };
}

// Classes que cruzam com uma dada classe
function classesCruzam(classe) {
  if (!classe || !_classes.classes[classe]) return [classe];
  const info = _classes.classes[classe];
  return [classe, ...(info.alergia_cruzada_com || [])];
}

// Gera ID de auditoria unico
function gerarAuditId(prefix) {
  const ts = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `AUD-${ts}-${prefix}${rand}`;
}

function analisar({ anamnese, perfil }) {
  carregarBase();
  const alertas = [];
  const autoMedicacao = [];

  const alergias = (perfil.alergias || []).map(a => ({
    nome: String(a.nome || a).toLowerCase().trim(),
    gravidade: String(a.gravidade || 'moderada').toLowerCase(),
  }));

  const medsPerfil = (perfil.medicamentos || [])
    .map(m => String(m.nome || m).toLowerCase().trim())
    .filter(Boolean);

  const medsMencionados = (anamnese.medicamentos_mencionados || [])
    .map(m => String(m).toLowerCase().trim())
    .filter(Boolean);

  // ──────────── Cruzamento alergia × medicamento ────────────
  for (const med of [...medsMencionados, ...medsPerfil]) {
    const norm = normalizarMedicamento(med);
    if (!norm || !norm.classe) continue;

    const classesRelacionadas = classesCruzam(norm.classe);

    for (const alergia of alergias) {
      const alergNorm = normalizarMedicamento(alergia.nome);
      // Alergia pode ser: nome especifico OU nome de classe
      const bateClasse = alergNorm && classesRelacionadas.includes(alergNorm.classe);
      const bateAtivo = alergNorm && alergNorm.principio_ativo === norm.principio_ativo;
      const bateTextoClasse = classesRelacionadas.some(c => alergia.nome.includes(c.replace(/_/g, ' ')));

      if (bateAtivo || bateClasse || bateTextoClasse) {
        const severidade = alergia.gravidade === 'grave' || alergia.gravidade === 'anafilaxia' ? 'critica' : 'alta';
        const foiMencionado = medsMencionados.includes(med);
        alertas.push({
          id: gerarAuditId('F'),
          tipo: 'alergia_medicamento',
          severidade,
          medicamento: med,
          principio_ativo: norm.principio_ativo,
          classe: norm.classe,
          alergia_registrada: alergia.nome,
          origem: foiMencionado ? 'audio_paciente' : 'perfil_paciente',
          mensagem: `Paciente ${foiMencionado ? 'mencionou' : 'tem registrado'} ${med} — alergia a ${alergia.nome} registrada. Risco de reacao cruzada (classe ${norm.classe}).`,
          acao_sugerida: `Nao prescrever ${norm.classe}. Considerar alternativa de classe diferente.`,
          fonte: {
            titulo: 'Formulario Terapeutico Nacional + ANVISA',
            tipo: 'regulatorio_br',
          },
          base_version: 'farmacologia_v1.0',
          disclaimer: 'Cruzamento deterministico baseado em classes farmacologicas. Nao constitui diagnostico. Ato medico privativo.',
        });
      }
    }
  }

  // ──────────── Auto-medicacao ────────────
  for (const med of medsMencionados) {
    const norm = normalizarMedicamento(med);
    if (!norm || !norm.principio_ativo) continue;
    const estaNoPerfil = medsPerfil.some(p => {
      const pn = normalizarMedicamento(p);
      return pn && pn.principio_ativo === norm.principio_ativo;
    });
    if (!estaNoPerfil) {
      autoMedicacao.push({
        id: gerarAuditId('A'),
        tipo: 'auto_medicacao',
        severidade: 'media',
        medicamento: med,
        principio_ativo: norm.principio_ativo,
        classe: norm.classe,
        mensagem: `Paciente mencionou ${med} no audio — nao consta no perfil como uso regular.`,
        acao_sugerida: 'Atualizar cadastro de medicamentos com informacao atual de uso antes da consulta.',
        fonte: { titulo: 'Boas praticas de prescricao', tipo: 'recomendacao' },
        base_version: 'farmacologia_v1.0',
        disclaimer: 'Deteccao baseada em cruzamento deterministico. Confirmar com paciente.',
      });
    }
  }

  return { alertasFarmacologicos: alertas, autoMedicacao };
}

module.exports = { analisar, normalizarMedicamento };
