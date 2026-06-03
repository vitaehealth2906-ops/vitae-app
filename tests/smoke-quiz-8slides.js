// Robô de teste — Quiz do RG 8 slides (azul) — Sessão 37
// Navega o quiz como usuário REAL: adulto + menor(escola), confere se salvou no backend.
// Frontend servido local (app-v3) → backend de PRODUÇÃO (Railway, já com as colunas novas).
// Rodar: node tests/smoke-quiz-8slides.js
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app-v3');
const PORT = 3001; // backend CORS libera localhost:3000/3001/3002
const API = 'https://vitae-app-production.up.railway.app';

// ---- servidor estático simples p/ app-v3 ----
const MIME = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml', '.json':'application/json', '.ico':'image/x-icon' };
function serve() {
  return http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/30-quiz.html';
    const fp = path.join(ROOT, p);
    if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
    fs.createReadStream(fp).pipe(res);
  }).listen(PORT);
}

// ---- CPF válido (dígito verificador) ----
function cpfValido() {
  const n = Array.from({length:9}, () => Math.floor(Math.random()*10));
  const dv = (arr) => { let s=0; for(let i=0;i<arr.length;i++) s+=arr[i]*(arr.length+1-i); let r=11-(s%11); return r>=10?0:r; };
  const d1 = dv(n); const d2 = dv([...n,d1]);
  return [...n,d1,d2].join('');
}
function fmtCpf(c){ return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'); }

const log = (...a) => console.log(...a);
let PASS=0, FAIL=0;
const ok = (c,m) => { if(c){PASS++;log('  ✅',m);} else {FAIL++;log('  ❌',m);} };

async function criarConta(prefixo) {
  const uniq = Date.now().toString().slice(-7) + Math.floor(Math.random()*90+10);
  const email = `${prefixo}-${Date.now()}-${Math.floor(Math.random()*9999)}@vitae-test.invalid`;
  const celular = '+5511' + uniq; // 9 dígitos únicos
  const r = await fetch(`${API}/auth/cadastro`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ nome:'Robo Teste', email, celular, senha:'TesteRobo@123', tipo:'PACIENTE' })
  });
  const j = await r.json();
  if(!j.token) throw new Error('cadastro falhou: '+JSON.stringify(j));
  return { token:j.token, refresh:j.refreshToken, usuario:j.usuario, email };
}

async function setToken(page, conta) {
  await page.evaluate((c) => {
    localStorage.setItem('vitae_token', c.token);
    if(c.refresh) localStorage.setItem('vitae_refresh_token', c.refresh);
    localStorage.setItem('vitae_usuario', JSON.stringify(c.usuario));
  }, conta);
}

async function picker(page, fieldId, texto) {
  await page.click('#'+fieldId);
  await page.waitForSelector('#pickerOverlay', { state:'visible', timeout:5000 });
  // tenta busca se houver
  const search = page.locator('#pickerSearch');
  if (await search.isVisible().catch(()=>false)) { await search.fill(texto.slice(0,4)); await page.waitForTimeout(150); }
  await page.locator('#pickerOverlay').getByText(texto, { exact:true }).first().click();
  await page.waitForSelector('#pickerOverlay', { state:'hidden', timeout:5000 }).catch(()=>{});
}

async function fotoFake(page) {
  // 1x1 png
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64');
  const tmp = path.join(__dirname, '_tmp-foto.png');
  fs.writeFileSync(tmp, png);
  await page.setInputFiles('#fotoGaleria', tmp);
  await page.waitForTimeout(600);
}

async function next(page){ await page.click('.step.active .btn-next'); await page.waitForTimeout(450); }
async function activeStep(page){ return await page.evaluate(()=>{ const a=document.querySelector('.step.active'); return a?a.id:null; }); }

async function verificarPerfil(token, checks) {
  const r = await fetch(`${API}/perfil`, { headers:{ Authorization:'Bearer '+token } });
  const j = await r.json();
  const p = j.perfil || j || {};
  for (const [campo, esperado] of Object.entries(checks)) {
    ok(p[campo] === esperado || (esperado === '__any__' && p[campo]), `perfil.${campo} salvo (${JSON.stringify(p[campo])})`);
  }
  return p;
}
async function verificarAlergias(token) {
  const r = await fetch(`${API}/alergias`, { headers:{ Authorization:'Bearer '+token } });
  const j = await r.json();
  const a = (j.alergias||[])[0];
  ok(!!a, 'alergia salva');
  if(a) ok(!!a.reacao, `alergia.reacao salvo (${JSON.stringify(a.reacao)})`);
  return j.alergias;
}

// =================== CENÁRIOS ===================
async function cenarioAdulto(browser) {
  log('\n══ CENÁRIO 1: ADULTO (8 slides completos) ══');
  const conta = await criarConta('adulto');
  const page = await browser.newPage();
  // DIAGNÓSTICO: erros de JS e respostas das APIs de salvar
  page.on('console', m => { if(m.type()==='error') log('   [console.error]', m.text()); });
  page.on('pageerror', e => log('   [pageerror]', e.message));
  page.on('response', async r => {
    const u = r.url();
    if (/\/(perfil|alergias|medicamentos)(\?|$)/.test(u) && r.request().method()!=='GET') {
      let body=''; try { body = JSON.stringify(await r.json()).slice(0,200); } catch(_){}
      log(`   [API] ${r.request().method()} ${u.split('.app')[1]||u} → ${r.status()} ${body}`);
    }
  });
  await page.goto(`http://localhost:${PORT}/01-saude.html`, { waitUntil:'domcontentloaded' }).catch(()=>{});
  await setToken(page, conta);
  await page.goto(`http://localhost:${PORT}/30-quiz.html`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(800);

  const cpf = cpfValido();
  // step0 Identidade
  ok(await activeStep(page)==='step0', 'abriu no step0 (Identidade)');
  await page.fill('#nascimentoInput','15/03/1990'); await page.waitForTimeout(100);
  await page.fill('#cpfInput', fmtCpf(cpf));
  await picker(page,'sexoField','Masculino');
  await next(page);
  // step1 Contato + parentesco + 2º contato
  ok(await activeStep(page)==='step1', 'foi pro step1 (Contato)');
  await page.fill('#emergenciaNome','Ana Lima');
  await page.fill('#emergenciaParentesco','Mãe');
  await page.fill('#emergenciaTel','(11) 99999-8888');
  // abre 2º contato
  await page.click('#btnAddContato2').catch(()=>{});
  await page.waitForTimeout(200);
  await page.fill('#emergenciaNome2','Joao Lima').catch(()=>{});
  await page.fill('#emergenciaParentesco2','Pai').catch(()=>{});
  await page.fill('#emergenciaTel2','(11) 97777-6666').catch(()=>{});
  await next(page);
  // step2 sangue
  ok(await activeStep(page)==='step2', 'foi pro step2 (Sangue)');
  await picker(page,'tipoSangueField','O+');
  await next(page);
  // step3 alergias
  ok(await activeStep(page)==='step3', 'foi pro step3 (Alergias)');
  await page.fill('#alergiaNomeInput','Dipirona');
  await page.selectOption('#alergiaTipoInput','MEDICAMENTO').catch(()=>{});
  await page.fill('#alergiaReacaoInput','anafilaxia');
  await page.click('#alergiaFormBox button, button:has-text("Adicionar à lista")').catch(()=>{});
  await page.waitForTimeout(300);
  await next(page);
  // step4 medicamentos
  ok(await activeStep(page)==='step4', 'foi pro step4 (Medicamentos)');
  await page.fill('#medNomeInput','Losartana');
  await page.fill('#medDoseInput','50mg').catch(()=>{});
  await page.fill('#medMotivoInput','pressao alta').catch(()=>{});
  await page.click('#medFormBox button, button:has-text("Adicionar à lista")').catch(()=>{});
  await page.waitForTimeout(300);
  await next(page);
  // step5 historico
  ok(await activeStep(page)==='step5', 'foi pro step5 (Histórico)');
  await page.fill('#condicoesInput','hipertensao');
  await page.fill('#cirurgiasInput','apendicectomia');
  await page.fill('#implantesInput','stent coronario');
  await next(page);
  // step6 plano (opcional)
  ok(await activeStep(page)==='step6', 'foi pro step6 (Plano)');
  await picker(page,'planoField','Unimed BH').catch(()=>{});
  await page.fill('#carteirinhaInput','123456789').catch(()=>{});
  await next(page);
  // step7 foto
  ok(await activeStep(page)==='step7', 'foi pro step7 (Foto)');
  await fotoFake(page);
  const concluirOn = await page.evaluate(()=>{ const b=document.getElementById('btnConcluir'); return b && !b.disabled; });
  ok(concluirOn, 'botão Criar RG habilitou após a foto');
  await page.click('#btnConcluir');
  await page.waitForTimeout(3500); // espera as chamadas de API

  // verifica no backend
  log('  — conferindo no banco —');
  await verificarPerfil(conta.token, {
    cpf: cpf,
    contatoEmergenciaNome: 'Ana Lima',
    parentescoEmergencia: 'Mãe',
    contatoEmergenciaNome2: 'Joao Lima',
    implantes: 'stent coronario',
    tipoSanguineo: 'O_POS',
  });
  await verificarAlergias(conta.token);
  await page.close();
  return conta;
}

async function cenarioMenor(browser) {
  log('\n══ CENÁRIO 2: MENOR / ESCOLA (responsáveis) ══');
  const conta = await criarConta('menor');
  const page = await browser.newPage();
  await page.goto(`http://localhost:${PORT}/01-saude.html`, { waitUntil:'domcontentloaded' }).catch(()=>{});
  await setToken(page, conta);
  await page.goto(`http://localhost:${PORT}/30-quiz.html`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(800);
  const cpf = cpfValido();
  await page.fill('#nascimentoInput','10/05/2015'); await page.waitForTimeout(100); // ~10 anos
  await page.fill('#cpfInput', fmtCpf(cpf));
  await picker(page,'sexoField','Feminino');
  await next(page);
  // step1 deve mostrar responsáveis
  const menorVisivel = await page.evaluate(()=>{ const m=document.getElementById('step2Menor'); return m && getComputedStyle(m).display!=='none'; });
  ok(menorVisivel, 'menor → apareceu o bloco Responsáveis (pai/mãe)');
  // tenta avançar SEM responsável (deve bloquear)
  await next(page);
  ok(await activeStep(page)==='step1', 'bloqueou avanço sem responsável (continua no step1)');
  await page.fill('#maeNome','Maria Souza');
  await page.fill('#maeTel','(11) 96666-5555');
  await next(page);
  ok(await activeStep(page)==='step2', 'com responsável preenchido, avançou');
  await page.close();
  return conta;
}

(async () => {
  const server = serve();
  log('Servidor local em http://localhost:'+PORT);
  const browser = await chromium.launch({ headless:true });
  const contas = [];
  try {
    contas.push(await cenarioAdulto(browser));
    contas.push(await cenarioMenor(browser));
  } catch(e) {
    FAIL++; log('  ❌ ERRO FATAL:', e.message);
  } finally {
    await browser.close();
    server.close();
    try { fs.unlinkSync(path.join(__dirname,'_tmp-foto.png')); } catch(_){}
    log(`\n═══ RESULTADO: ${PASS} ✅  /  ${FAIL} ❌ ═══`);
    log('Contas de teste criadas (limpar depois):', contas.map(c=>c&&c.email).filter(Boolean).join(', '));
    process.exit(FAIL>0?1:0);
  }
})();
