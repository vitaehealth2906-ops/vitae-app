// LOTE 4 — Exames: lista + detalhe + estado vazio
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';
const URL_LISTA = `${BASE}/09-exames-lista.html`;
const URL_VAZIA = `${BASE}/43-exames-vazia.html`;

const SHOTS = path.join(__dirname, 'shots', 'lote-4' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => { log.push({n,ok,det}); console.log(`[${ok?'OK':'FAIL'}] ${n}${det?' · '+det:''}`); };

async function setupPaciente(page) {
  const sufixo = Date.now();
  const d = { nome:'Lote4 '+sufixo, celular:'(11) 9'+String(sufixo).slice(-4)+'-'+String(sufixo).slice(-4), email:`lote4-${sufixo}@vitae-test.com`, senha:'TesteSenha123!' };
  await page.goto(URL_LISTA).catch(()=>{});
  await page.waitForTimeout(300);
  const r = await page.evaluate(async (d)=>{
    const r = await fetch('https://vitae-app-production.up.railway.app/auth/cadastro', {method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({nome:d.nome,email:d.email,celular:'+5511'+d.celular.replace(/\D/g,'').slice(-9),senha:d.senha,tipo:'PACIENTE'})});
    return { status:r.status, body: await r.json() };
  }, d);
  if (!r.body?.token) return null;
  await page.evaluate((b)=>{
    localStorage.setItem('vitae_token', b.token);
    if (b.refreshToken) localStorage.setItem('vitae_refresh_token', b.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(b.usuario));
  }, r.body);
  return { dados:d, token:r.body.token };
}

(async()=>{
  const browser = await chromium.launch({channel:'msedge', headless:false});
  const ctx = await browser.newContext({viewport:{width:500,height:950}});
  const page = await ctx.newPage();

  console.log('═══════════════════════════════════════════════════════');
  console.log(`LOTE 4 — Exames · ${PROD?'PROD':'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const p = await setupPaciente(page);
  if (!p) { step('Setup', false); await browser.close(); return; }
  step('Setup paciente', true, p.dados.email);

  // ── CENÁRIO 1: lista sem exames
  try {
    await page.goto(URL_LISTA);
    await page.waitForTimeout(2500);
    // sem hardcode de Bruno/Marina/Lucas
    const semHardcodeName = await page.locator('text=Bruno Lima').count() === 0 &&
                            await page.locator('text=Marina Ferreira').count() === 0 &&
                            await page.locator('text=LUCAS BORELLI').count() === 0;
    step('Sem hardcode pessoa', semHardcodeName);
    // não há erro fatal
    const bodyText = (await page.locator('body').textContent())||'';
    step('Página renderizou sem crash', bodyText.length > 200);
    await page.screenshot({path: path.join(SHOTS, '01-lista.png')});
  } catch(e){ step('Cenário 1 ERRO', false, e.message); }

  // ── CENÁRIO 2: empty state dedicado
  try {
    await page.goto(URL_VAZIA);
    await page.waitForTimeout(1500);
    const bodyText = (await page.locator('body').textContent())||'';
    step('43-exames-vazia renderiza', bodyText.length > 100);
    const semHardcode = await page.locator('text=LUCAS BORELLI').count() === 0;
    step('Empty state sem hardcode', semHardcode);
    await page.screenshot({path: path.join(SHOTS, '02-vazia.png')});
  } catch(e){ step('Cenário 2 ERRO', false, e.message); }

  // ── CENÁRIO 3: upload via API direto
  let exameId = null;
  try {
    // Vamos simular upload via POST direto (multipart com Blob fake)
    // Como não tem foto real, vou pular o upload — exames precisam de foto real pra Claude analisar.
    // Em vez disso, vou apenas verificar que listarExames retorna array vazio sem crash.
    const res = await page.evaluate(async (t) => {
      const r = await fetch('https://vitae-app-production.up.railway.app/exames', {
        headers: { 'Authorization': 'Bearer ' + t }
      });
      return { status: r.status, body: await r.json() };
    }, p.token);
    step('GET /exames retorna 200', res.status === 200);
    const lista = res.body.exames || res.body || [];
    step('Lista inicial vazia', Array.isArray(lista) && lista.length === 0);
  } catch(e){ step('Cenário 3 ERRO', false, e.message); }

  // ── CENÁRIO 4: ver layout de hero exam (deve ter algum elemento de tela mesmo sem dado)
  try {
    await page.goto(URL_LISTA);
    await page.waitForTimeout(2500);
    // a tela tem tabbar?
    const tabBar = await page.locator('text=Meu RG').count() + await page.locator('text=QR Code').count();
    step('Tela tem navegação', tabBar > 0);
    // a tela tem botao de adicionar?
    const btnAdd = await page.locator('button, .header-icon-btn, [onclick*="upload"]').count();
    step('Tela tem botão de ação', btnAdd > 0);
    await page.screenshot({path: path.join(SHOTS, '04-layout.png')});
  } catch(e){ step('Cenário 4 ERRO', false, e.message); }

  fs.writeFileSync(path.join(SHOTS, 'log.json'), JSON.stringify(log, null, 2));
  const okN = log.filter(l=>l.ok).length;
  const failN = log.filter(l=>!l.ok).length;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`RESUMO: ${okN}/${log.length} OK · ${failN} falharam`);
  console.log(`Screenshots: ${SHOTS}`);
  console.log('═══════════════════════════════════════════════════════');
  await browser.close();
  process.exit(failN>0?1:0);
})();
