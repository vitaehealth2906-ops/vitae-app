// ============================================================
// CARTÃO ÔNIX — Cenário PRIMEIRO ACESSO (sem cache local)
// ------------------------------------------------------------
// Reproduz o bug reportado pelo amigo do Daniel:
//   - Conta nova (ou cache limpo)
//   - Sem vitae_swr_perfil no localStorage
//   - Backend Railway pode estar em cold start
// Esperado após fix: nome aparece em < 1s, QR é gerado em < 2s,
// CPF começa como placeholder e é substituído quando /perfil chega.
// ============================================================

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const APP_V3 = process.env.APP_V3_URL || 'https://vitae-app.vercel.app/app-v3';
const BACKEND_URL = 'https://vitae-app-production.up.railway.app';
const SHOTS = path.join(__dirname, 'shots', 'cartao-onix-primeiro');
fs.mkdirSync(SHOTS, { recursive: true });

let passed = 0, failed = 0;
function check(name, ok, info) {
  const tag = ok ? 'PASS' : 'FAIL';
  if (ok) passed++; else failed++;
  console.log(`  [${tag}] ${name}` + (info ? ` — ${typeof info === 'string' ? info : JSON.stringify(info)}` : ''));
}

(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Cartão Ônix — cenário primeiro acesso');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Login via Node fetch (sem CORS)
  const res = await fetch(`${BACKEND_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.PACIENTE_EMAIL, senha: process.env.PACIENTE_SENHA }),
  });
  const auth = await res.json();

  const browser = await chromium.launch({ channel: 'msedge', headless: process.env.PW_HEADLESS !== '0' });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await ctx.newPage();

  // Vai pra qualquer página do app pra estabelecer origin
  await page.goto(`${APP_V3}/20-splash.html`, { waitUntil: 'domcontentloaded' });

  // Simula PRIMEIRO ACESSO: injeta APENAS token+usuario (sem cache SWR)
  await page.evaluate((data) => {
    localStorage.clear();
    localStorage.setItem('vitae_token', data.token);
    if (data.refreshToken) localStorage.setItem('vitae_refresh_token', data.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(data.usuario));
    localStorage.setItem('vitae_onb_quiz_visto', '1');
    // Note: NÃO seta vitae_swr_perfil/alergias/medicamentos → simula primeiro acesso
  }, auth);

  // Abre 01-saude.html e mede TEMPO até o nome aparecer
  const t0 = Date.now();
  await page.goto(`${APP_V3}/01-saude.html`, { waitUntil: 'domcontentloaded' });

  // Tempo até #rgNome ter texto não vazio
  let tempoNome = null;
  await page.waitForFunction(() => {
    const el = document.getElementById('rgNome');
    return el && el.textContent && el.textContent.trim().length > 1 && el.textContent.trim() !== '—';
  }, { timeout: 6000 }).then(() => { tempoNome = Date.now() - t0; }).catch(() => {});

  check(`Nome aparece em < 2s (foi ${tempoNome}ms)`, tempoNome !== null && tempoNome < 2000, `${tempoNome}ms`);

  // Tempo até QR ter canvas/img dentro
  let tempoQR = null;
  await page.waitForFunction(() => {
    return document.querySelectorAll('#rgOnixQr canvas, #rgOnixQr img').length > 0;
  }, { timeout: 6000 }).then(() => { tempoQR = Date.now() - t0; }).catch(() => {});

  check(`QR gerado em < 3s (foi ${tempoQR}ms)`, tempoQR !== null && tempoQR < 3000, `${tempoQR}ms`);

  // Screenshot do estado inicial (otimista)
  await page.screenshot({ path: path.join(SHOTS, '01-otimista.png') });

  // Aguarda CPF real chegar
  let tempoCpf = null;
  await page.waitForFunction(() => {
    const el = document.getElementById('rgCpf');
    return el && /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(el.textContent.trim());
  }, { timeout: 45000 }).then(() => { tempoCpf = Date.now() - t0; }).catch(() => {});

  check(`CPF formatado chega após /perfil (foi ${tempoCpf}ms)`, tempoCpf !== null, tempoCpf ? `${tempoCpf}ms` : 'não chegou');

  // Conteúdo final
  const nome = (await page.locator('#rgNome').textContent()).trim();
  const cpf = (await page.locator('#rgCpf').textContent()).trim();
  const qrUrl = await page.locator('#rgOnixQr').getAttribute('data-qr-url');

  check('Nome final preenchido', nome.length > 0 && nome !== '—', nome);
  check('CPF final no formato XXX.XXX.XXX-XX', /^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(cpf), cpf);
  check('QR aponta pra 14-rg-publico.html', qrUrl && qrUrl.includes('14-rg-publico.html'), qrUrl);

  await page.screenshot({ path: path.join(SHOTS, '02-final.png') });

  await browser.close();

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  RESULTADO: ${passed} PASS · ${failed} FAIL`);
  console.log(`  Screenshots: ${SHOTS}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(failed > 0 ? 1 : 0);
})();
