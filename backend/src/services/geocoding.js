/**
 * Geocoding via Nominatim (OpenStreetMap) — gratuito, sem API key.
 * Limite de uso: 1 req/s. Tolerante a falhas: retorna null em qualquer erro.
 * Docs: https://operations.osmfoundation.org/policies/nominatim/
 */

const USER_AGENT = 'vita-id-app/1.0 (https://vitae-app-production.up.railway.app)';

async function geocodificar(endereco) {
  if (!endereco || typeof endereco !== 'string' || endereco.trim().length < 4) {
    return null;
  }

  const query = encodeURIComponent(endereco.trim() + ', Brasil');
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1&countrycodes=br`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'pt-BR' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch (err) {
    console.warn('[geocoding] falhou:', err.message);
    return null;
  }
}

module.exports = { geocodificar };
