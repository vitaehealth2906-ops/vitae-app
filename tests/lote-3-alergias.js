// LOTE 3 — Alergias: lista + detalhe + add + remover
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';
const URL_LISTA = `${BASE}/06-alergias.html`;
const URL_ADD = `${BASE}/08-add-alergia.html`;
const URL_DET = (id) => `${BASE}/07-alergia-detalhe.html?id=${encodeURIComponent(id)}`;
const API = 'https://vitae-app-production.up.railway.app';

const SHOTS = path.join(__dirname, 'shots', 'lote-3' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => { log.push({n,ok,det}); console.log(`[${ok?'OK':'FAIL'}] ${n}${det?' · '+det:''}`); };

function gerarCPF(){const n=Array.from({length:9},()=>Math.floor(Math.random()*10));for(let j=9;j<11;j++){let s=0;for(let i=0;i<j;i++)s+=n[i]*(j+1-i);let d=(s*10)%11;if(d===10)d=0;n.push(d);}return n.join('');}

async function setupPaciente(page) {
  const sufixo = Date.now();
  const d = { nome:'Lote3 '+sufixo, celular:'(11) 9'+String(sufixo).slice(-4)+'-'+String(sufixo).slice(-4), email:`lote3-${sufixo}@vitae-test.com`, senha:'TesteSenha123!' };
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
  console.log(`LOTE 3 — Alergias · ${PROD?'PROD':'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const p = await setupPaciente(page);
  if (!p) { step('Setup', false); await browser.close(); return; }
  step('Setup paciente', true, p.dados.email);

  // ── CENÁRIO 1: vazio
  try {
    await page.goto(URL_LISTA);
    await page.waitForTimeout(1800);
    const sub = (await page.locator('#alergiasSubtitle').textContent())||'';
    step('Subtítulo: nenhuma cadastrada', sub.toLowerCase().includes('nenhuma'));
    const empty = await page.locator('text=Nenhuma alergia cadastrada').count();
    step('Estado vazio com CTA', empty > 0);
    const dipiHard = await page.locator('text=Dipirona').count();
    step('Sem hardcode Dipirona', dipiHard === 0);
    const penHard = await page.locator('text=Penicilina').count();
    step('Sem hardcode Penicilina', penHard === 0);
    const albertHard = await page.locator('text=Albert Einstein').count();
    step('Sem hardcode Hospital Albert Einstein', albertHard === 0);
    await page.screenshot({path: path.join(SHOTS, '01-vazio.png')});
  } catch(e){ step('Cenário 1 ERRO', false, e.message); }

  // ── CENÁRIO 2: validação form
  try {
    await page.goto(URL_ADD);
    await page.waitForTimeout(800);
    await page.click('#btnSalvar');
    await page.waitForTimeout(500);
    const erro = (await page.locator('#erroBox').textContent())||'';
    step('Validação nome obrigatório', erro.toLowerCase().includes('substância'));
  } catch(e){ step('Cenário 2 ERRO', false, e.message); }

  // ── CENÁRIO 3: adicionar grave
  try {
    await page.goto(URL_ADD);
    await page.waitForTimeout(800);
    await page.fill('#inputNome', 'Dipirona');
    await page.selectOption('#inputTipo', 'MEDICAMENTO');
    // Grave já é o default
    await page.click('#btnSalvar');
    await page.waitForTimeout(3000);
    const url = page.url();
    step('Redirect pra lista após salvar', url.includes('06-alergias'));
    await page.screenshot({path: path.join(SHOTS, '03-add-grave.png')});
  } catch(e){ step('Cenário 3 ERRO', false, e.message); }

  // ── CENÁRIO 4: adicionar leve
  try {
    await page.goto(URL_ADD);
    await page.waitForTimeout(800);
    await page.fill('#inputNome', 'Camarão');
    await page.selectOption('#inputTipo', 'ALIMENTO');
    await page.locator('.sev-option.light').click();
    await page.click('#btnSalvar');
    await page.waitForTimeout(3000);
    step('Add segunda alergia', page.url().includes('06-alergias'));
  } catch(e){ step('Cenário 4 ERRO', false, e.message); }

  // ── CENÁRIO 5: lista organizada
  try {
    await page.waitForTimeout(2000);
    const sub = (await page.locator('#alergiasSubtitle').textContent())||'';
    step('Subtítulo total + críticas', sub.includes('2 cadastradas') && sub.includes('1 crítica'));
    const cards = await page.locator('.severity-card').count();
    step('2 cards visíveis', cards === 2);
    const headerCritica = await page.locator('text=Críticas').count();
    step('Header de críticas presente', headerCritica > 0);
    const headerLeves = await page.locator('text=Leves').count();
    step('Header de leves presente', headerLeves > 0);
    await page.screenshot({path: path.join(SHOTS, '05-lista-2.png')});
  } catch(e){ step('Cenário 5 ERRO', false, e.message); }

  // ── CENÁRIO 6: click → detalhe (Dipirona)
  try {
    await page.locator('.severity-card.critica').first().click();
    await page.waitForTimeout(3000);
    const nome = (await page.locator('#alNome').textContent())||'';
    step('Detalhe abre Dipirona', nome.includes('Dipirona'));
    const sev = (await page.locator('#alGravidade').textContent())||'';
    step('Mostra alta gravidade', sev.toLowerCase().includes('alta'));
    const semRenata = await page.locator('text=Renata Cardoso').count();
    step('Sem hardcode Renata Cardoso', semRenata === 0);
    await page.screenshot({path: path.join(SHOTS, '06-detalhe.png')});
  } catch(e){ step('Cenário 6 ERRO', false, e.message); }

  // ── CENÁRIO 7: remover alergia
  try {
    page.on('dialog', d => d.accept());
    await page.click('#btnRemover');
    await page.waitForTimeout(2500);
    step('Remove volta pra lista', page.url().includes('06-alergias'));
    await page.waitForTimeout(1500);
    const cards = await page.locator('.severity-card').count();
    step('Restou 1 alergia', cards === 1);
    await page.screenshot({path: path.join(SHOTS, '07-removida.png')});
  } catch(e){ step('Cenário 7 ERRO', false, e.message); }

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
