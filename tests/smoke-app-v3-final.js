// SMOKE FINAL — fluxo completo app-v3 paciente
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';

const SHOTS = path.join(__dirname, 'shots', 'smoke-final' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => { log.push({n,ok,det}); console.log(`[${ok?'OK':'FAIL'}] ${n}${det?' · '+det:''}`); };
function gerarCPF(){const n=Array.from({length:9},()=>Math.floor(Math.random()*10));for(let j=9;j<11;j++){let s=0;for(let i=0;i<j;i++)s+=n[i]*(j+1-i);let d=(s*10)%11;if(d===10)d=0;n.push(d);}return n.join('');}

(async()=>{
  const browser = await chromium.launch({channel:'msedge', headless:false});
  const ctx = await browser.newContext({viewport:{width:500,height:950}});
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept());

  console.log('═══════════════════════════════════════════════════════');
  console.log(`SMOKE FINAL — Fluxo completo · ${PROD?'PROD':'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // ETAPA 1: cadastro
  const sufixo = Date.now();
  const d = { nome:'Maria SmokeFinal '+sufixo, celular:'(11) 9'+String(sufixo).slice(-4)+'-'+String(sufixo).slice(-4), email:`smoke-${sufixo}@vitae-test.com`, senha:'TesteSenha123!' };
  await page.goto(`${BASE}/01-saude.html`);
  await page.waitForTimeout(500);

  const cad = await page.evaluate(async (d) => {
    const r = await fetch('https://vitae-app-production.up.railway.app/auth/cadastro', {method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({nome:d.nome,email:d.email,celular:'+5511'+d.celular.replace(/\D/g,'').slice(-9),senha:d.senha,tipo:'PACIENTE'})});
    return { body: await r.json() };
  }, d);
  step('1) Cadastro paciente', !!cad.body?.token, d.email);
  if (!cad.body?.token) { await browser.close(); return; }

  await page.evaluate((b) => {
    localStorage.setItem('vitae_token', b.token);
    if (b.refreshToken) localStorage.setItem('vitae_refresh_token', b.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(b.usuario));
  }, cad.body);

  // ETAPA 2: completa perfil
  const perfilRes = await page.evaluate(async (args) => {
    const r = await fetch('https://vitae-app-production.up.railway.app/perfil', {method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+args.t},body:JSON.stringify({genero:'FEMININO',dataNascimento:'1985-06-20',alturaCm:165,pesoKg:62,tipoSanguineo:'B_POS',cpf:args.cpf,contatoEmergenciaNome:'Carlos Teste',contatoEmergenciaTel:'(11) 98888-7777'})});
    return r.status;
  }, { t: cad.body.token, cpf: gerarCPF() });
  step('2) Completa perfil', perfilRes === 200);

  // ETAPA 3: visita Saúde HOME
  await page.goto(`${BASE}/01-saude.html`);
  await page.waitForTimeout(2500);
  const nomeNoRG = await page.locator('#rgNome').textContent();
  step('3) Saúde HOME mostra nome real no RG', nomeNoRG.includes('MARIA'));
  await page.screenshot({path: path.join(SHOTS, '01-saude.png')});

  // ETAPA 4: adiciona alergia via tela
  await page.goto(`${BASE}/08-add-alergia.html`);
  await page.waitForTimeout(1500);
  await page.fill('#inputNome', 'Dipirona');
  await page.click('#btnSalvar');
  await page.waitForTimeout(2500);
  step('4) Adiciona alergia via UI', page.url().includes('06-alergias'));

  // ETAPA 5: lista alergias
  await page.waitForTimeout(1500);
  const aleNome = await page.locator('.severity-card .sev-name').first().textContent();
  step('5) Alergia aparece na lista', aleNome === 'Dipirona');
  await page.screenshot({path: path.join(SHOTS, '02-alergias.png')});

  // ETAPA 6: adiciona medicamento via tela
  await page.goto(`${BASE}/05-add-medicamento.html`);
  await page.waitForTimeout(1500);
  await page.fill('#inputNome', 'Losartana');
  await page.fill('#inputDose', '50mg');
  await page.fill('#inputMotivo', 'pressão alta');
  await page.click('#btnSalvar');
  await page.waitForTimeout(2500);
  step('6) Adiciona medicamento via UI', page.url().includes('03-medicamentos'));

  // ETAPA 7: lista meds
  await page.waitForTimeout(1500);
  const medNome = await page.locator('.med-detail-name').first().textContent();
  step('7) Med aparece na lista', medNome.includes('Losartana'));
  await page.screenshot({path: path.join(SHOTS, '03-meds.png')});

  // ETAPA 8: cria agendamento
  const dataFut = new Date(); dataFut.setDate(dataFut.getDate()+10);
  const agRes = await page.evaluate(async (args) => {
    const r = await fetch('https://vitae-app-production.up.railway.app/agendamento', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+args.t},body:JSON.stringify({titulo:'Dra. Teste', tipo:'CONSULTA', dataHora:args.d, local:'Clínica X'})});
    return r.status;
  }, { t: cad.body.token, d: dataFut.toISOString() });
  step('8) Cria agendamento', agRes === 200 || agRes === 201);

  // ETAPA 9: vê consulta
  await page.goto(`${BASE}/15-consultas.html`);
  await page.waitForTimeout(2500);
  const proximaTxt = await page.locator('text=Dra. Teste').count();
  step('9) Próxima consulta visível', proximaTxt > 0);
  await page.screenshot({path: path.join(SHOTS, '04-consultas.png')});

  // ETAPA 10: QR Code carrega
  await page.goto(`${BASE}/12-qr-code.html`);
  await page.waitForTimeout(2500);
  const qr = await page.locator('#qrcode canvas, #qrcode img').count();
  step('10) QR Code carregado', qr > 0);
  await page.screenshot({path: path.join(SHOTS, '05-qr.png')});

  // ETAPA 11: simula médico vendo RG público
  const usuarioId = cad.body.usuario.id;
  await page.evaluate(() => localStorage.clear()); // limpa pra simular visitante anônimo
  await page.goto(`${BASE}/14-rg-publico.html?id=${usuarioId}`);
  await page.waitForTimeout(3500);
  const bodyPub = (await page.locator('body').textContent())||'';
  step('11) Médico vê nome do paciente', bodyPub.includes('Maria'));
  step('12) Médico vê alergia Dipirona', bodyPub.includes('Dipirona'));
  step('13) Médico vê medicamento Losartana', bodyPub.includes('Losartana'));
  step('14) Médico vê tipo sanguíneo B+', bodyPub.includes('B+'));
  await page.screenshot({path: path.join(SHOTS, '06-rg-publico.png')});

  fs.writeFileSync(path.join(SHOTS, 'log.json'), JSON.stringify(log, null, 2));
  const okN = log.filter(l=>l.ok).length;
  const failN = log.filter(l=>!l.ok).length;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`SMOKE FINAL: ${okN}/${log.length} OK · ${failN} falharam`);
  console.log(`Screenshots: ${SHOTS}`);
  console.log('═══════════════════════════════════════════════════════');

  await browser.close();
  process.exit(failN>0?1:0);
})();
