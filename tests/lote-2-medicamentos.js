// LOTE 2 — Lista medicamentos + detalhe + add/edit/remover
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';
const URL_LISTA = `${BASE}/03-medicamentos.html`;
const URL_ADD = `${BASE}/05-add-medicamento.html`;
const URL_DET = (id) => `${BASE}/04-med-detalhe.html?id=${encodeURIComponent(id)}`;
const API = 'https://vitae-app-production.up.railway.app';

const SHOTS = path.join(__dirname, 'shots', 'lote-2' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => { log.push({n,ok,det}); console.log(`[${ok?'OK':'FAIL'}] ${n}${det?' · '+det:''}`); };

function gerarCPF(){
  const n = Array.from({length:9},()=>Math.floor(Math.random()*10));
  for (let j = 9; j < 11; j++) {
    let s=0; for (let i=0;i<j;i++) s += n[i]*(j+1-i);
    let d=(s*10)%11; if (d===10) d=0; n.push(d);
  }
  return n.join('');
}

async function criarPaciente(page) {
  const sufixo = Date.now();
  const d = { nome:'Lote2 '+sufixo, celular:'(11) 9'+String(sufixo).slice(-4)+'-'+String(sufixo).slice(-4), email:`lote2-${sufixo}@vitae-test.com`, senha:'TesteSenha123!' };
  await page.goto(URL_LISTA).catch(()=>{});
  await page.waitForTimeout(300);
  const r = await page.evaluate(async (d)=>{
    const r = await fetch('https://vitae-app-production.up.railway.app/auth/cadastro', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({nome:d.nome,email:d.email,celular:'+5511'+d.celular.replace(/\D/g,'').slice(-9),senha:d.senha,tipo:'PACIENTE'})
    });
    return { status:r.status, body: await r.json() };
  }, d);
  if (!r.body?.token) return null;
  await page.evaluate((b)=>{
    localStorage.setItem('vitae_token', b.token);
    if (b.refreshToken) localStorage.setItem('vitae_refresh_token', b.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(b.usuario));
  }, r.body);
  // preenche perfil (necessario pra alguns paths)
  await page.evaluate(async (args)=>{
    await fetch('https://vitae-app-production.up.railway.app/perfil', {
      method:'PUT', headers:{'Content-Type':'application/json','Authorization':'Bearer '+args.t},
      body: JSON.stringify({genero:'FEMININO',dataNascimento:'1985-06-20',alturaCm:165,pesoKg:62,tipoSanguineo:'B_POS',cpf:args.cpf,contatoEmergenciaNome:'Carlos',contatoEmergenciaTel:'(11) 98888-7777'})
    });
  }, { t:r.body.token, cpf: gerarCPF() });
  return { dados:d, token:r.body.token, usuario:r.body.usuario };
}

(async()=>{
  const browser = await chromium.launch({channel:'msedge', headless:false});
  const ctx = await browser.newContext({viewport:{width:500,height:950}});
  const page = await ctx.newPage();

  console.log('═══════════════════════════════════════════════════════');
  console.log(`LOTE 2 — Medicamentos · ${PROD?'PROD':'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const p = await criarPaciente(page);
  if (!p) { step('Setup', false, 'sem token'); await browser.close(); return; }
  step('Setup paciente', true, p.dados.email);

  // ── CENÁRIO 1: lista vazia
  try {
    await page.goto(URL_LISTA);
    await page.waitForTimeout(2000);
    const sub = (await page.locator('#medsSubtitle').textContent())||'';
    step('Subtítulo: nenhum cadastrado', sub.toLowerCase().includes('nenhum'));
    const empty = await page.locator('text=Nenhum medicamento cadastrado').count();
    step('Estado vazio com CTA', empty > 0);
    const lucas = await page.locator('text=Losartana').count();
    step('Sem hardcode Losartana', lucas === 0);
    await page.screenshot({ path: path.join(SHOTS, '01-vazio.png') });
  } catch(e){ step('Cenário 1 ERRO', false, e.message); }

  // ── CENÁRIO 2: adicionar via form
  try {
    await page.goto(URL_ADD);
    await page.waitForTimeout(1000);

    // Tenta salvar sem nome → erro
    await page.click('#btnSalvar');
    await page.waitForTimeout(500);
    const erroBoxText = (await page.locator('#erroBox').textContent())||'';
    step('Validação nome obrigatório', erroBoxText.includes('nome'));

    await page.fill('#inputNome', 'Losartana');
    await page.fill('#inputDose', '50mg');
    await page.fill('#inputMotivo', 'pressão alta');
    await page.fill('#inputHorario', '08:00');
    await page.click('#btnSalvar');
    await page.waitForTimeout(3000);

    const ondeEstou = page.url();
    step('Redireciona pra lista apos salvar', ondeEstou.includes('03-medicamentos'));
    await page.screenshot({ path: path.join(SHOTS, '02-adicionado.png') });
  } catch(e){ step('Cenário 2 ERRO', false, e.message); }

  // ── CENÁRIO 3: lista com 1 med
  try {
    await page.waitForTimeout(1500);
    const card = await page.locator('.med-card-detail').count();
    step('Lista mostra 1 med', card === 1);
    const nome = (await page.locator('.med-detail-name').first().textContent())||'';
    step('Nome correto', nome.includes('Losartana') && nome.includes('50mg'));
    const motivo = await page.locator('text=Pressão').count();
    step('Badge categoria pressão', motivo > 0);
    await page.screenshot({ path: path.join(SHOTS, '03-lista-com-1.png') });
  } catch(e){ step('Cenário 3 ERRO', false, e.message); }

  // ── CENÁRIO 4: clica → detalhe
  try {
    await page.locator('.med-card-detail').first().click();
    await page.waitForTimeout(2000);
    const heroNome = (await page.locator('#heroNome').textContent())||'';
    step('Detalhe abre med correto', heroNome.includes('Losartana') && heroNome.includes('50mg'));
    const heroSub = (await page.locator('#heroSub').textContent())||'';
    step('Detalhe mostra motivo', heroSub.includes('pressão'));
    const semRenata = await page.locator('text=Renata Cardoso').count();
    step('Sem hardcode Dra. Renata Cardoso', semRenata === 0);
    const semAlertHard = await page.locator('text=ibuprofeno').count();
    step('Sem hardcode alerta ibuprofeno', semAlertHard === 0);
    await page.screenshot({ path: path.join(SHOTS, '04-detalhe.png') });
  } catch(e){ step('Cenário 4 ERRO', false, e.message); }

  // ── CENÁRIO 5: busca filtra
  try {
    await page.goto(URL_LISTA);
    await page.waitForTimeout(1500);
    await page.fill('#medsSearch', 'losa');
    await page.waitForTimeout(500);
    const c1 = await page.locator('.med-card-detail').count();
    step('Busca "losa" mostra 1', c1 === 1);
    await page.fill('#medsSearch', 'xyz');
    await page.waitForTimeout(500);
    const c2 = await page.locator('.med-card-detail').count();
    step('Busca "xyz" mostra 0', c2 === 0);
    await page.screenshot({ path: path.join(SHOTS, '05-busca.png') });
  } catch(e){ step('Cenário 5 ERRO', false, e.message); }

  // ── CENÁRIO 6: calendário com hoje destacado
  try {
    await page.goto(URL_LISTA);
    await page.waitForTimeout(1500);
    const hoje = new Date().getDate();
    const todayEl = await page.locator(`.day.today .day-num`).textContent();
    step('Calendário marca hoje', String(todayEl).trim() === String(hoje));
    await page.screenshot({ path: path.join(SHOTS, '06-calendario.png') });
  } catch(e){ step('Cenário 6 ERRO', false, e.message); }

  // ── CENÁRIO 7: editar med
  try {
    await page.locator('.med-card-detail').first().click();
    await page.waitForTimeout(1500);
    await page.click('#btnEditar');
    await page.waitForTimeout(1500);
    const url = page.url();
    step('Botão editar abre add com id', url.includes('05-add-medicamento') && url.includes('id='));
    const titulo = (await page.locator('#pageTitle').textContent())||'';
    step('Página em modo editar', titulo.toLowerCase().includes('editar'));
    const nomeVal = await page.locator('#inputNome').inputValue();
    step('Nome pre-preenchido', nomeVal === 'Losartana');
    await page.fill('#inputMotivo', 'controle de pressão arterial');
    await page.click('#btnSalvar');
    await page.waitForTimeout(2500);
    const urlPos = page.url();
    step('Volta pra lista apos editar', urlPos.includes('03-medicamentos'));
    await page.screenshot({ path: path.join(SHOTS, '07-editado.png') });
  } catch(e){ step('Cenário 7 ERRO', false, e.message); }

  // ── CENÁRIO 8: descontinuar (delete)
  try {
    await page.waitForTimeout(1500);
    await page.locator('.med-card-detail').first().click();
    await page.waitForTimeout(1500);
    page.on('dialog', d => d.accept());
    await page.click('#btnDescontinuar');
    await page.waitForTimeout(2500);
    const url = page.url();
    step('Descontinuar volta pra lista', url.includes('03-medicamentos'));
    await page.waitForTimeout(1000);
    const cards = await page.locator('.med-card-detail').count();
    step('Med foi removido', cards === 0);
    await page.screenshot({ path: path.join(SHOTS, '08-descontinuado.png') });
  } catch(e){ step('Cenário 8 ERRO', false, e.message); }

  // ── RESUMO
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
