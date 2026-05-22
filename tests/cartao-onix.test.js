// ============================================================
// CARTÃO ÔNIX — Validação E2E após implantação 22-mai-2026
// ------------------------------------------------------------
// Testa 10 invariantes do novo cartão da aba "Meu RG":
//   1.  Elemento .rgonix#rgOnix presente e visível
//   2.  Logo "vita id" no topo
//   3.  Nome completo (#rgNome) preenchido, em uppercase
//   4.  CPF (#rgCpf) renderizado (formato CPF ou placeholder)
//   5.  QR existe dentro de #rgOnixQr (canvas/img/svg)
//   6.  QR aponta pra 14-rg-publico.html?id={userId} (data-qr-url)
//   7.  URL do QR === a que 12-qr-code.html gera (cross-check)
//   8.  Toque no cartão navega pra 12-qr-code.html
//   9.  Cartão NÃO vira (sem .flipped, sem .rgcard-back)
//  10.  Elementos antigos do verso (rgVersoAlergias, etc.) sumiram
//
// Usa credenciais reais de teste do .env (PACIENTE_EMAIL / PACIENTE_SENHA)
// e a URL de produção do app-v3 — assim valida o fluxo end-to-end.
// ============================================================

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const APP_V3 = process.env.APP_V3_URL || 'https://vitae-app.vercel.app/app-v3';
const PAC_CADASTRO = `${APP_V3}/26-cadastro.html`;
const PAC_SAUDE    = `${APP_V3}/01-saude.html`;
const PAC_QRCODE   = `${APP_V3}/12-qr-code.html`;

const SHOTS = path.join(__dirname, 'shots', 'cartao-onix');
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
let passed = 0, failed = 0;

function check(name, condition, detail) {
  const status = condition ? 'PASS' : 'FAIL';
  if (condition) passed++; else failed++;
  results.push({ name, status, detail: detail || null });
  console.log(`  [${status}] ${name}` + (detail ? ` — ${typeof detail === 'string' ? detail.slice(0, 200) : JSON.stringify(detail).slice(0, 200)}` : ''));
}

async function shot(page, label) {
  try { await page.screenshot({ path: path.join(SHOTS, label + '.png'), fullPage: false }); } catch (_e) {}
}

const BACKEND_URL = 'https://vitae-app-production.up.railway.app';

async function loginPaciente(page) {
  // Login via Node fetch (sem CORS) → injeta tokens no localStorage do browser.
  // Necessário porque o app-v3 servido localmente (origin localhost:8765) não está
  // na lista CORS do backend Railway.
  let auth;
  try {
    const res = await fetch(`${BACKEND_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: process.env.PACIENTE_EMAIL,
        senha: process.env.PACIENTE_SENHA,
      }),
    });
    if (!res.ok) return { ok: false, err: `HTTP ${res.status}` };
    auth = await res.json();
  } catch (e) {
    return { ok: false, err: e && e.message || String(e) };
  }
  if (!auth || !auth.token) return { ok: false, err: 'no token' };

  // Navega para uma página do app-v3 só pra estabelecer a origin antes de setar localStorage
  await page.goto(`${APP_V3}/20-splash.html`, { waitUntil: 'domcontentloaded' });
  await page.evaluate((data) => {
    localStorage.setItem('vitae_token', data.token);
    if (data.refreshToken) localStorage.setItem('vitae_refresh_token', data.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(data.usuario));
    localStorage.setItem('vitae_onb_quiz_visto', '1');
  }, auth);

  return { ok: true, id: auth.usuario && auth.usuario.id };
}

async function run() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Cartão Ônix — bateria de validação');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const browser = await chromium.launch({
    channel: process.env.PW_CHANNEL || 'msedge',
    headless: process.env.PW_HEADLESS !== '0',
  });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await ctx.newPage();

  try {
    // ─── LOGIN ─────────────────────────────────────────────────
    console.log('\n• Login do paciente');
    const loginResult = await loginPaciente(page);
    console.log('  login →', loginResult);
    // Bypass de gates de onboarding/quiz pra primeira entrada
    await page.evaluate(() => { try { localStorage.setItem('vitae_onb_quiz_visto', '1'); } catch(_e){} });
    await page.goto(PAC_SAUDE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
    await shot(page, '01-home-saude');

    // Captura userId pra cross-check
    const userId = await page.evaluate(() => {
      try { return JSON.parse(localStorage.getItem('vitae_usuario') || '{}').id || null; }
      catch (_e) { return null; }
    });
    check('Login OK e userId disponível', !!userId, userId);

    // ─── 1. Cartão presente ───────────────────────────────────
    const rgOnix = page.locator('#rgOnix');
    const rgOnixVisible = await rgOnix.isVisible({ timeout: 8000 }).catch(() => false);
    check('1. Cartão .rgonix#rgOnix presente e visível', rgOnixVisible);

    if (!rgOnixVisible) {
      console.log('\n  Cartão não apareceu — abortando bateria.');
      return;
    }

    // ─── 2. Logo "vita id" ─────────────────────────────────────
    const brandText = await rgOnix.locator('.rgonix-brand').textContent().catch(() => '');
    check('2. Logo "vita id" visível no topo',
      /vita/i.test(brandText) && /id/i.test(brandText),
      brandText.trim());

    // ─── 3. Nome completo preenchido ──────────────────────────
    const nome = (await page.locator('#rgNome').textContent().catch(() => '') || '').trim();
    check('3. Nome (#rgNome) preenchido e em uppercase',
      nome.length > 0 && nome !== '—' && nome === nome.toUpperCase(),
      nome);

    // ─── 4. CPF renderizado ──────────────────────────────────
    const cpf = (await page.locator('#rgCpf').textContent().catch(() => '') || '').trim();
    const cpfPattern = /^\d{3}\.\d{3}\.\d{3}-\d{2}$/;
    const cpfPlaceholder = /^[·.\s-]+$/;
    check('4. CPF (#rgCpf) com formato CPF ou placeholder',
      cpfPattern.test(cpf) || cpfPlaceholder.test(cpf),
      cpf);

    // ─── 5. QR existe (canvas / img / svg) ───────────────────
    const qrChildren = await page.locator('#rgOnixQr canvas, #rgOnixQr img, #rgOnixQr svg').count();
    check('5. QR Code renderizado dentro de #rgOnixQr', qrChildren > 0, `${qrChildren} elemento(s)`);

    // ─── 6. data-qr-url presente e aponta pro destino certo ──
    const qrUrl = await page.locator('#rgOnixQr').getAttribute('data-qr-url');
    const expectedFragment = `14-rg-publico.html?id=${userId}`;
    check('6. QR aponta para 14-rg-publico.html?id=<userId>',
      typeof qrUrl === 'string' && qrUrl.includes(expectedFragment),
      qrUrl);

    // ─── 7. Cross-check: mesma URL na aba QR Code ────────────
    const pageQr = await ctx.newPage();
    await pageQr.goto(PAC_QRCODE, { waitUntil: 'domcontentloaded' });
    await pageQr.waitForTimeout(2500);
    const qrAbaUrl = await pageQr.evaluate(() => {
      const u = JSON.parse(localStorage.getItem('vitae_usuario') || '{}');
      const baseUrl = window.location.origin + window.location.pathname.replace('12-qr-code.html', '');
      return baseUrl + '14-rg-publico.html?id=' + (u.id || '');
    });
    check('7. URL do QR Ônix === URL gerada por 12-qr-code.html',
      qrUrl === qrAbaUrl,
      { onix: qrUrl, aba: qrAbaUrl });
    await pageQr.close();

    // ─── 8. Toque no cartão navega pra 12-qr-code.html ──────
    await rgOnix.click();
    await page.waitForTimeout(1500);
    const urlAposClick = page.url();
    check('8. Toque no cartão navega para 12-qr-code.html',
      urlAposClick.endsWith('12-qr-code.html') || urlAposClick.includes('12-qr-code.html'),
      urlAposClick);

    // Volta pra home pra próximas verificações
    await page.goto(PAC_SAUDE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // ─── 9. Cartão NÃO vira ──────────────────────────────────
    const isFlipped = await page.locator('#rgOnix.flipped').count();
    const hasBack = await page.locator('.rgcard-back, .rgcard-inner, .rgcard-face').count();
    check('9. Cartão Ônix não vira (sem .flipped, sem .rgcard-back)',
      isFlipped === 0 && hasBack === 0,
      { flipped: isFlipped, backNodes: hasBack });

    // ─── 10. IDs antigos do verso sumiram ────────────────────
    const oldIds = ['rgVersoAlergias','rgVersoMeds','rgVersoEmerg','rgNumero','rgSangue','rgNascimento','rgEmerg','rgAtualizadoEm'];
    let ghosts = 0;
    for (const id of oldIds) {
      const exists = await page.locator('#' + id).count();
      if (exists > 0) ghosts++;
    }
    check('10. Elementos antigos do verso (8 IDs) foram removidos',
      ghosts === 0,
      `${ghosts} fantasma(s) restante(s) em ${oldIds.length} IDs`);

    await shot(page, '02-onix-final');

  } catch (err) {
    console.error('\nERRO INESPERADO:', err && err.stack || err);
    check('Erro inesperado durante execução', false, err.message || String(err));
  } finally {
    await browser.close();
  }

  // Relatório
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`  RESULTADO: ${passed} PASS · ${failed} FAIL`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const reportPath = path.join(__dirname, 'logs', 'cartao-onix-resultado.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    when: new Date().toISOString(),
    passed, failed, total: results.length,
    results,
  }, null, 2));
  console.log(`  Relatório: ${reportPath}`);
  console.log(`  Screenshots: ${SHOTS}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
