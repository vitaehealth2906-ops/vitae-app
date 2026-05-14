// LOTE 6 — QR Code + RG público
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';
const URL_QR = `${BASE}/12-qr-code.html`;
const URL_RG = (uid) => `${BASE}/14-rg-publico.html?id=${encodeURIComponent(uid)}`;

const SHOTS = path.join(__dirname, 'shots', 'lote-6' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => { log.push({n,ok,det}); console.log(`[${ok?'OK':'FAIL'}] ${n}${det?' · '+det:''}`); };
function gerarCPF(){const n=Array.from({length:9},()=>Math.floor(Math.random()*10));for(let j=9;j<11;j++){let s=0;for(let i=0;i<j;i++)s+=n[i]*(j+1-i);let d=(s*10)%11;if(d===10)d=0;n.push(d);}return n.join('');}

async function setupPaciente(page) {
  const sufixo = Date.now();
  const d = { nome:'Lote6 '+sufixo, celular:'(11) 9'+String(sufixo).slice(-4)+'-'+String(sufixo).slice(-4), email:`lote6-${sufixo}@vitae-test.com`, senha:'TesteSenha123!' };
  await page.goto(URL_QR).catch(()=>{});
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
  // Adiciona perfil + alergia + med pra ter dados no RG publico
  await page.evaluate(async (args) => {
    const t = args.t;
    await fetch('https://vitae-app-production.up.railway.app/perfil', {method:'PUT',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({genero:'FEMININO',dataNascimento:'1985-06-20',tipoSanguineo:'O_POS',cpf:args.cpf,contatoEmergenciaNome:'Carlos',contatoEmergenciaTel:'(11) 98888-7777'})});
    await fetch('https://vitae-app-production.up.railway.app/alergias', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({nome:'Dipirona',tipo:'MEDICAMENTO',gravidade:'GRAVE'})});
    await fetch('https://vitae-app-production.up.railway.app/medicamentos', {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+t},body:JSON.stringify({nome:'Losartana',dosagem:'50mg',frequencia:'diário',horario:'08:00'})});
  }, { t: r.body.token, cpf: gerarCPF() });
  return { dados:d, token:r.body.token, usuario:r.body.usuario };
}

(async()=>{
  const browser = await chromium.launch({channel:'msedge', headless:false});
  const ctx = await browser.newContext({viewport:{width:500,height:950}});
  const page = await ctx.newPage();

  console.log('═══════════════════════════════════════════════════════');
  console.log(`LOTE 6 — QR + RG Público · ${PROD?'PROD':'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  const p = await setupPaciente(page);
  if (!p) { step('Setup', false); await browser.close(); return; }
  step('Setup paciente com dados', true, p.dados.email);

  // ── CENÁRIO 1: tela QR renderiza
  try {
    await page.goto(URL_QR);
    await page.waitForTimeout(2500);
    const qrImg = await page.locator('#qrcode canvas, #qrcode img').count();
    step('QR Code renderiza', qrImg > 0);
    const semLogin = await page.locator('text=Faça login para ver').count();
    step('Não mostra "faça login" pra usuário logado', semLogin === 0);
    await page.screenshot({path: path.join(SHOTS, '01-qr.png')});
  } catch(e){ step('Cenário 1 ERRO', false, e.message); }

  // ── CENÁRIO 2: link compartilhar funcional
  try {
    const wppBtn = await page.locator('button.share-btn.whatsapp').count();
    step('Botão WhatsApp presente', wppBtn > 0);
    const dlBtn = await page.locator('button.share-btn.save').count();
    step('Botão Salvar imagem presente', dlBtn > 0);
  } catch(e){ step('Cenário 2 ERRO', false, e.message); }

  // ── CENÁRIO 3: RG público com usuário válido
  try {
    await page.evaluate(() => localStorage.clear());  // simula visitante sem login
    await page.goto(URL_RG(p.usuario.id));
    await page.waitForTimeout(3500);

    const body = (await page.locator('body').textContent())||'';
    step('Página RG público renderiza', body.length > 200);

    const erro = await page.locator('text=Link inválido').count();
    step('Sem erro "Link inválido"', erro === 0);

    const nomePac = body.includes(p.dados.nome) || body.includes(p.dados.nome.split(' ')[0]);
    step('Mostra nome do paciente', nomePac);

    const sangue = body.includes('O+') || body.includes('O Pos');
    step('Mostra tipo sanguíneo', sangue);

    const dipirona = body.includes('Dipirona');
    step('Mostra alergia Dipirona', dipirona);

    await page.screenshot({path: path.join(SHOTS, '03-rg-publico.png')});
  } catch(e){ step('Cenário 3 ERRO', false, e.message); }

  // ── CENÁRIO 4: RG público sem ID válido
  try {
    await page.goto(`${BASE}/14-rg-publico.html?id=xxx-inexistente-xxx`);
    await page.waitForTimeout(3000);
    const body = (await page.locator('body').textContent())||'';
    step('ID inválido mostra erro amigável', body.toLowerCase().includes('não') || body.toLowerCase().includes('inválid') || body.toLowerCase().includes('encontr'));
    await page.screenshot({path: path.join(SHOTS, '04-rg-erro.png')});
  } catch(e){ step('Cenário 4 ERRO', false, e.message); }

  fs.writeFileSync(path.join(SHOTS, 'log.json'), JSON.stringify(log, null, 2));
  const okN = log.filter(l=>l.ok).length;
  const failN = log.filter(l=>!l.ok).length;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`RESUMO: ${okN}/${log.length} OK · ${failN} falharam`);
  console.log('═══════════════════════════════════════════════════════');
  await browser.close();
  process.exit(failN>0?1:0);
})();
