// LOTE 5 — Consultas: vazio + lista + detalhe
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';
const URL_LISTA = `${BASE}/15-consultas.html`;
const URL_VAZIA = `${BASE}/44-consultas-vazia.html`;

const SHOTS = path.join(__dirname, 'shots', 'lote-5' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => { log.push({n,ok,det}); console.log(`[${ok?'OK':'FAIL'}] ${n}${det?' · '+det:''}`); };

async function setupPaciente(page) {
  const sufixo = Date.now();
  const d = { nome:'Lote5 '+sufixo, celular:'(11) 9'+String(sufixo).slice(-4)+'-'+String(sufixo).slice(-4), email:`lote5-${sufixo}@vitae-test.com`, senha:'TesteSenha123!' };
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
  console.log(`LOTE 5 — Consultas · ${PROD?'PROD':'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const p = await setupPaciente(page);
  if (!p) { step('Setup', false); await browser.close(); return; }
  step('Setup paciente', true, p.dados.email);

  // ── CENÁRIO 1: lista vazia (paciente novo sem consulta)
  try {
    await page.goto(URL_LISTA);
    await page.waitForTimeout(2500);

    const semRenata = await page.locator('text=Renata Cardoso').count();
    step('Sem hardcode Renata Cardoso', semRenata === 0);
    const semBruno = await page.locator('text=Bruno Lima').count();
    step('Sem hardcode Bruno Lima', semBruno === 0);
    const semMarina = await page.locator('text=Marina Ferreira').count();
    step('Sem hardcode Marina Ferreira', semMarina === 0);

    const greeting = (await page.locator('#consultasGreeting').textContent())||'';
    step('Greeting mostra nome real', greeting.includes('Lote5'));

    const vazio = await page.locator('text=Nenhuma consulta ainda').count();
    step('Empty state aparece', vazio > 0);

    await page.screenshot({path: path.join(SHOTS, '01-vazio.png')});
  } catch(e){ step('Cenário 1 ERRO', false, e.message); }

  // ── CENÁRIO 2: 44-consultas-vazia renderiza
  try {
    await page.goto(URL_VAZIA);
    await page.waitForTimeout(1500);
    const body = (await page.locator('body').textContent())||'';
    step('44-vazia renderiza', body.length > 100);
    await page.screenshot({path: path.join(SHOTS, '02-vazia.png')});
  } catch(e){ step('Cenário 2 ERRO', false, e.message); }

  // ── CENÁRIO 3: criar agendamento futuro via backend e ver na lista
  try {
    const dataFutura = new Date();
    dataFutura.setDate(dataFutura.getDate() + 10);
    const dataIso = dataFutura.toISOString();
    const res = await page.evaluate(async (args) => {
      const r = await fetch('https://vitae-app-production.up.railway.app/agendamento', {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+args.t},
        body: JSON.stringify({titulo:'Dr. Teste Consulta', tipo:'CONSULTA', dataHora:args.d, local:'Clínica de Testes'})
      });
      return { status:r.status, body: await r.json() };
    }, { t: p.token, d: dataIso });
    step('Criar agendamento futuro', res.status === 200 || res.status === 201, 'HTTP '+res.status);

    await page.goto(URL_LISTA);
    await page.waitForTimeout(2500);

    const nomeReal = await page.locator('text=Dr. Teste Consulta').count();
    step('Lista mostra agendamento real', nomeReal > 0);
    const proximaLabel = await page.locator('text=Próxima consulta').count();
    step('Header "Próxima consulta" aparece', proximaLabel > 0);
    await page.screenshot({path: path.join(SHOTS, '03-com-agendamento.png')});
  } catch(e){ step('Cenário 3 ERRO', false, e.message); }

  fs.writeFileSync(path.join(SHOTS, 'log.json'), JSON.stringify(log, null, 2));
  const okN = log.filter(l=>l.ok).length;
  const failN = log.filter(l=>!l.ok).length;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`RESUMO: ${okN}/${log.length} OK · ${failN} falharam`);
  console.log('═══════════════════════════════════════════════════════');
  await browser.close();
  process.exit(failN>0?1:0);
})();
