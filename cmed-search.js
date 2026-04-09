/**
 * VITAE — Modulo de busca de medicamentos (CMED/ANVISA)
 * Carrega banco de medicamentos e permite busca por barcode, nome, ou texto livre
 */

let _cmedData = null;
let _cmedByEan = null;
let _cmedLoaded = false;
let _cmedLoading = false;

// ---- Load CMED database ----

async function loadCmed() {
  if (_cmedLoaded) return _cmedData;
  if (_cmedLoading) {
    // Wait for ongoing load
    return new Promise(resolve => {
      const check = setInterval(() => {
        if (_cmedLoaded) { clearInterval(check); resolve(_cmedData); }
      }, 100);
    });
  }
  _cmedLoading = true;
  try {
    const resp = await fetch('cmed-sample.json');
    _cmedData = await resp.json();
    // Build EAN index for O(1) barcode lookup
    _cmedByEan = {};
    _cmedData.forEach(med => {
      if (med.ean) _cmedByEan[med.ean] = med;
    });
    _cmedLoaded = true;
    console.log('[CMED] Banco carregado: ' + _cmedData.length + ' medicamentos');
  } catch (e) {
    console.error('[CMED] Erro ao carregar banco:', e.message);
    _cmedData = [];
    _cmedByEan = {};
  }
  _cmedLoading = false;
  return _cmedData;
}

// ---- Lookup by EAN barcode (99% confidence) ----

async function cmedLookupBarcode(ean) {
  await loadCmed();
  if (!ean) return null;
  // Pad to 13 digits
  ean = String(ean).padStart(13, '0');
  return _cmedByEan[ean] || null;
}

// ---- Fuzzy search by name (for autocomplete and OCR results) ----

function normalizeText(str) {
  return String(str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .trim();
}

async function cmedSearch(query, limit) {
  await loadCmed();
  if (!query || query.length < 2) return [];
  limit = limit || 10;

  const q = normalizeText(query);
  const tokens = q.split(/\s+/);

  // Score each medication
  const scored = _cmedData.map(med => {
    const nome = normalizeText(med.produto);
    const substancia = normalizeText(med.substancia);
    const apresentacao = normalizeText(med.apresentacao);
    const all = nome + ' ' + substancia + ' ' + apresentacao;

    let score = 0;

    // Exact name match = highest
    if (nome === q) score += 100;
    // Name starts with query
    else if (nome.startsWith(q)) score += 80;
    // Name contains query
    else if (nome.includes(q)) score += 60;
    // Substance exact
    else if (substancia === q) score += 70;
    // Substance starts with
    else if (substancia.startsWith(q)) score += 55;
    // Substance contains
    else if (substancia.includes(q)) score += 40;

    // Token matching: each token found in the combined text adds points
    tokens.forEach(t => {
      if (t.length >= 3 && all.includes(t)) score += 15;
    });

    // Fuzzy: Levenshtein-like for short queries (handles typos)
    if (score === 0 && q.length >= 4) {
      // Simple substring distance
      const minDist = Math.min(
        levenshteinDistance(q, nome.substring(0, q.length)),
        levenshteinDistance(q, substancia.substring(0, q.length))
      );
      if (minDist <= 2) score += 30 - (minDist * 10);
    }

    return { med, score };
  })
  .filter(s => s.score > 0)
  .sort((a, b) => b.score - a.score)
  .slice(0, limit)
  .map(s => s.med);

  return scored;
}

// Simple Levenshtein distance
function levenshteinDistance(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i-1] === a[j-1]) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

// ---- Extract medication name from OCR text ----

async function cmedMatchOcrText(ocrText) {
  await loadCmed();
  if (!ocrText) return [];

  const normalized = normalizeText(ocrText);

  // Try to find medication names in the OCR text
  const results = [];
  _cmedData.forEach(med => {
    const nome = normalizeText(med.produto);
    const substancia = normalizeText(med.substancia);

    if (nome.length >= 4 && normalized.includes(nome)) {
      results.push({ med, confidence: 'high', matchedOn: 'nome' });
    } else if (substancia.length >= 5 && normalized.includes(substancia.split(' ')[0])) {
      results.push({ med, confidence: 'medium', matchedOn: 'substancia' });
    }
  });

  // Deduplicate by produto name (keep highest confidence)
  const seen = {};
  return results.filter(r => {
    const key = r.med.produto + r.med.apresentacao;
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

// Make available globally
window.cmedLookupBarcode = cmedLookupBarcode;
window.cmedSearch = cmedSearch;
window.cmedMatchOcrText = cmedMatchOcrText;
window.loadCmed = loadCmed;
