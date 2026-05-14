// LOTE 7 — Perfil editavel
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';
const URL_PERFIL = `${BASE}/18-perfil.html`;

const SHOTS = path.join(__dirname, 'shots', 'lote-7' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => { log.push({n,ok,det}); console.log(`[${ok?'OK':'FAIL'}] ${n}${det?' · '+det:''}`); };
function gerarCPF(){const n=Array.from({length:9},()=>Math.floor(Math.random()*10));for(let j=9;j<11;j++){let s=0;for(let i=0;i<j;i++)s+=n[i]*(j+1-i);let d=(s*10)%11;if(d===10)d=0;n.push(d);}return n.join('');}

async function setup(page) {
  const sufixo = Date.now();
  const d = { nome:'Lote7 '+sufixo, celular:'(11) 9'+String(sufixo).slice(-4)+'-'+String(sufixo).slice(-4), email:`lote7-${sufixo}@vitae-test.com`, senha:'TesteSenha123!' };
  await page.goto(URL_PERFIL).catch(()=>{});
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
  await page.evaluate(async (args) => {
    await fetch('https://vitae-app-production.up.railway.app/perfil', {method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+args.t},body:JSON.stringify({genero:'FEMININO',dataNascimento:'1985-06-20',tipoSanguineo:'O_POS',cpf:args.cpf,contatoEmergenciaNome:'Carlos',contatoEmergenciaTel:'(11) 98888-7777'})});
  }, { t: r.body.token, cpf: gerarCPF() });
  return { dados:d, token:r.body.token };
}

(async()=>{
  const browser = await chromium.launch({channel:'msedge', headless:false});
  const ctx = await browser.newContext({viewport:{width:500,height:950}});
  const page = await ctx.newPage();

  console.log('═══════════════════════════════════════════════════════');
  console.log(`LOTE 7 — Perfil · ${PROD?'PROD':'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const p = await setup(page);
  if (!p) { step('Setup', false); await browser.close(); return; }
  step('Setup paciente', true, p.dados.email);

  try {
    await page.goto(URL_PERFIL);
    await page.waitForTimeout(3000);
    const body = (await page.locator('body').textContent())||'';

    const semLucas = !body.includes('Lucas Borelli') && !body.includes('LUCAS BORELLI');
    step('Sem hardcode Lucas', semLucas);

    const semMarina = !body.includes('Marina Borelli');
    step('Sem hardcode Marina', semMarina);

    const semCpfFake = !body.includes('001.234.567') && !body.includes('001234567');
    step('Sem hardcode CPF 001234567', semCpfFake);

    const semTelFake = !body.includes('98765-4321');
    step('Sem hardcode telefone fictício', semTelFake);

    const nomeReal = body.includes(p.dados.nome) || body.includes(p.dados.nome.split(' ')[0]);
    step('Mostra nome real', nomeReal);

    const emailReal = body.includes(p.dados.email);
    step('Mostra email real', emailReal);

    const sangue = body.includes('O+');
    step('Mostra sangue O+ real', sangue);

    await page.screenshot({path: path.join(SHOTS, '01-perfil.png')});

    // logout button presente
    const btnLogout = await page.locator('button:has-text("Sair"), [onclick*="logout"]').count();
    step('Botão logout presente', btnLogout > 0);

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
