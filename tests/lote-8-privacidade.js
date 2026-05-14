// LOTE 8 — Privacidade + autorizacoes
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';
const URL_PRIV = `${BASE}/71-privacidade.html`;

const SHOTS = path.join(__dirname, 'shots', 'lote-8' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => { log.push({n,ok,det}); console.log(`[${ok?'OK':'FAIL'}] ${n}${det?' · '+det:''}`); };

async function setup(page) {
  const sufixo = Date.now();
  const d = { nome:'Lote8 '+sufixo, celular:'(11) 9'+String(sufixo).slice(-4)+'-'+String(sufixo).slice(-4), email:`lote8-${sufixo}@vitae-test.com`, senha:'TesteSenha123!' };
  await page.goto(URL_PRIV).catch(()=>{});
  await page.waitForTimeout(300);
  const r = await page.evaluate(async (d)=>{
    const r = await fetch('https://vitae-app-production.up.railway.app/auth/cadastro', {method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({nome:d.nome,email:d.email,celular:'+5511'+d.celular.replace(/\D/g,'').slice(-9),senha:d.senha,tipo:'PACIENTE'})});
    return { body: await r.json() };
  }, d);
  if (!r.body?.token) return null;
  await page.evaluate((b)=>{
    localStorage.setItem('vitae_token', b.token);
    localStorage.setItem('vitae_usuario', JSON.stringify(b.usuario));
  }, r.body);
  return { token:r.body.token };
}

(async()=>{
  const browser = await chromium.launch({channel:'msedge', headless:false});
  const ctx = await browser.newContext({viewport:{width:500,height:950}});
  const page = await ctx.newPage();

  console.log('═══════════════════════════════════════════════════════');
  console.log(`LOTE 8 — Privacidade · ${PROD?'PROD':'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const p = await setup(page);
  if (!p) { step('Setup', false); await browser.close(); return; }
  step('Setup paciente', true);

  try {
    await page.goto(URL_PRIV);
    await page.waitForTimeout(2500);
    const body = (await page.locator('body').textContent())||'';

    step('Página renderiza sem crash', body.length > 200);

    const semHard = !body.includes('Lucas Borelli') && !body.includes('Renata Cardoso');
    step('Sem hardcode de pessoa', semHard);

    // Tem campo pra adicionar CRM
    const crmInput = await page.locator('input[placeholder*="CRM"], input[id*="crm"], input[name*="crm"]').count();
    step('Tela tem input pra CRM', crmInput > 0);

    await page.screenshot({path: path.join(SHOTS, '01-privacidade.png')});
  } catch(e){ step('Cenário ERRO', false, e.message); }

  fs.writeFileSync(path.join(SHOTS, 'log.json'), JSON.stringify(log, null, 2));
  const okN = log.filter(l=>l.ok).length;
  const failN = log.filter(l=>!l.ok).length;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`RESUMO: ${okN}/${log.length} OK · ${failN} falharam`);
  console.log('═══════════════════════════════════════════════════════');
  await browser.close();
  process.exit(failN>0?1:0);
})();
