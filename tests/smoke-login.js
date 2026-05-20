/**
 * SMOKE TEST — Valida que credenciais MEDICO e PACIENTE conseguem logar.
 * Saída: códigos de exit 0 (ok) ou 1 (falha).
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BASE = 'https://vitae-app-production.up.railway.app';

async function login(email, senha, tipo) {
  const r = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.log(`  ❌ ${tipo} (${email}): ${r.status} — ${body.erro || 'erro'}`);
    return null;
  }
  console.log(`  ✅ ${tipo} (${email}): logado · token ${body.token ? body.token.slice(0,12) + '...' : '?'}`);
  return body;
}

(async () => {
  console.log('🔐 SMOKE LOGIN — vita id');
  console.log('Backend:', BASE);
  console.log('');

  const med = await login(process.env.MEDICO_EMAIL, process.env.MEDICO_SENHA, 'MEDICO');
  const pac = await login(process.env.PACIENTE_EMAIL, process.env.PACIENTE_SENHA, 'PACIENTE');

  console.log('');
  if (!med || !pac) {
    console.log('❌ FALHA — alguma credencial não bate.');
    process.exit(1);
  }
  console.log('✅ TUDO OK — pode rodar bateria.');
  if (med.usuario) console.log('   Médico tipo:', med.usuario.tipo);
  if (pac.usuario) console.log('   Paciente tipo:', pac.usuario.tipo);
  process.exit(0);
})();
