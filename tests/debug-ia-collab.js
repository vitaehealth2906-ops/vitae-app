// Debug IA Collab — captura tudo que acontece quando clica "Comparar anamneses"
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const MED_URL = 'https://vitae-app.vercel.app/desktop/app-v2.html';
const PACIENTE = 'f9df2c03-690b-4bb7-9dc6-59a6f531489b';
fs.mkdirSync(path.join(__dirname, 'shots', 'ia-collab'), { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const calls = [], errs = [];
  page.on('pageerror', e => errs.push('PAGEERR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE.err: ' + m.text().slice(0, 200)); });
  page.on('response', async r => {
    const u = r.url();
    if (u.includes('/ia-collab') || u.includes('/pre-consulta')) {
      let body = '';
      try { body = await r.text(); } catch (_) {}
      calls.push({ status: r.status(), url: u, body: body.slice(0, 600) });
    }
  });

  // Login + abre paciente
  await page.goto(MED_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
  if (page.url().includes('login')) {
    await page.locator('input[type="email"]').first().fill(process.env.MEDICO_EMAIL);
    await page.locator('input[type="password"]').first().fill(process.env.MEDICO_SENHA);
    await page.locator('button[type="submit"], button:has-text("Entrar")').first().click();
    await page.waitForTimeout(3500);
  }
  if (!page.url().includes('app-v2')) {
    await page.goto(MED_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  }
  await page.locator('a:has-text("Pacientes"), .nl:has-text("Pacientes")').first().click();
  await page.waitForTimeout(2000);
  await page.evaluate(pid => { window.STATE.selectedPaciente = pid; window.goto('pacientes-detail'); }, PACIENTE);
  await page.waitForTimeout(6000);

  // Estado ANTES do click
  const estadoAntes = await page.evaluate(() => {
    return {
      pcsTotal: Object.keys(window.PCS || {}).length,
      pcsPaciente: Object.values(window.PCS || {}).filter(p => p.pacienteId === window.STATE.selectedPaciente).map(p => ({ id: p.id?.slice(0,8), pacienteId: p.pacienteId?.slice(0,8), status: p.status })),
      view: window.STATE.view,
      pidSelecionado: window.STATE.selectedPaciente?.slice(0,8),
      botaoIaVisivel: !!document.querySelector('button[onclick*="iniciarComparativo"]'),
    };
  });
  console.log('=== ANTES do click ===');
  console.log(JSON.stringify(estadoAntes, null, 2));

  // Click IA Collab
  const btn = page.locator('button:has-text("Comparar")').first();
  const vis = await btn.isVisible({ timeout: 5000 }).catch(() => false);
  if (!vis) {
    console.log('Botao Comparar NAO VISIVEL');
    const bodyTxt = await page.locator('body').innerText();
    console.log('Body inclui:', bodyTxt.slice(bodyTxt.indexOf('IA Collab'), bodyTxt.indexOf('IA Collab') + 200));
  } else {
    await page.screenshot({ path: path.join(__dirname, 'shots', 'ia-collab', '01-antes-click.png') });
    await btn.click();
    console.log('Clicou. Esperando 5s...');
    await page.waitForTimeout(5000);
    await page.screenshot({ path: path.join(__dirname, 'shots', 'ia-collab', '02-pos-click.png') });
  }

  // Estado DEPOIS
  const estadoDepois = await page.evaluate(pid => {
    return {
      comparativoLoading: window.STATE && window.STATE.comparativoLoading,
      comparativoLigado: window.STATE && window.STATE.comparativoLigado,
      compareMockPid: window.COMPARE_MOCK && window.COMPARE_MOCK[pid],
      compareCardVisivel: !!document.querySelector('.compare-card'),
      iaLoadVisivel: !!document.querySelector('.ia-load'),
    };
  }, PACIENTE);
  console.log('\n=== DEPOIS do click ===');
  console.log(JSON.stringify(estadoDepois, null, 2));

  console.log('\n=== API calls ===');
  calls.forEach(c => console.log(' ', c.status, c.url.replace('https://vitae-app-production.up.railway.app',''), '::', c.body.slice(0, 250)));
  console.log('\n=== Erros ===');
  errs.slice(0, 10).forEach(e => console.log(' ', e));

  await ctx.close();
  await browser.close();
})().catch(e => { console.error('FATAL:', e); process.exit(2); });
