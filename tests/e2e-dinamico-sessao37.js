// Robô E2E DINÂMICO — Sessão 37/38 — painel do dono + pré-consulta + telas de alergia
// Valida T1-T12 + T15. Roda contra produção: QBASE=https://vitae-app.vercel.app/app-v3 node tests/e2e-dinamico-sessao37.js
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app-v3');
const PORT = 3002;
const API = 'https://vitae-app-production.up.railway.app';
const BASE = process.env.QBASE || ('http://localhost:' + PORT);
const USE_LOCAL = !process.env.QBASE;

const MIME = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon' };
function serve(){ return http.createServer((req,res)=>{ let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/01-saude.html'; const fp=path.join(ROOT,p); if(!fp.startsWith(ROOT)||!fs.existsSync(fp)||fs.statSync(fp).isDirectory()){res.writeHead(404);return res.end('404');} res.writeHead(200,{'Content-Type':MIME[path.extname(fp)]||'application/octet-stream'}); fs.createReadStream(fp).pipe(res); }).listen(PORT); }

function cpfValido(){ const n=Array.from({length:9},()=>Math.floor(Math.random()*10)); const dv=(a)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*(a.length+1-i);let r=11-(s%11);return r>=10?0:r;}; const d1=dv(n),d2=dv([...n,d1]); return [...n,d1,d2].join(''); }
function fmtCpf(c){ return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'); }
const log=(...a)=>console.log(...a);
let PASS=0,FAIL=0; const EMAILS=[];
const ok=(c,m)=>{ if(c){PASS++;log('  ✅',m);}else{FAIL++;log('  ❌',m);} };

async function api(pathName, {method='GET', token, body}={}){
  const r = await fetch(API+pathName, { method, headers:{ 'Content-Type':'application/json', ...(token?{Authorization:'Bearer '+token}:{}) }, body: body?JSON.stringify(body):undefined });
  let j=null; try{ j=await r.json(); }catch(_){}
  return { status:r.status, body:j };
}
async function criarConta(prefixo, tipo='PACIENTE'){
  const uniq = Date.now().toString().slice(-7)+Math.floor(Math.random()*90+10);
  const email = `${prefixo}-${Date.now()}-${Math.floor(Math.random()*9999)}@vitae-test.invalid`;
  EMAILS.push(email);
  const r = await api('/auth/cadastro',{method:'POST',body:{nome:'Robo '+prefixo,email,celular:'+5511'+uniq,senha:'TesteRobo@123',tipo}});
  if(!r.body || !r.body.token) throw new Error('cadastro '+prefixo+' falhou: '+JSON.stringify(r.body));
  return { token:r.body.token, refresh:r.body.refreshToken, usuario:r.body.usuario, email };
}
async function setToken(page, c){ await page.evaluate((x)=>{ localStorage.setItem('vitae_token',x.token); if(x.refresh)localStorage.setItem('vitae_refresh_token',x.refresh); localStorage.setItem('vitae_usuario',JSON.stringify(x.usuario)); }, c); }
async function picker(page, fieldId, texto){ await page.click('#'+fieldId); await page.waitForSelector('#pickerOverlay',{state:'visible',timeout:6000}); const s=page.locator('#pickerSearch'); if(await s.isVisible().catch(()=>false)){ await s.fill(texto.slice(0,4)); await page.waitForTimeout(150);} await page.locator('#pickerOverlay').getByText(texto,{exact:true}).first().click(); await page.waitForSelector('#pickerOverlay',{state:'hidden',timeout:6000}).catch(()=>{}); }
async function fotoFake(page){ const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64'); const tmp=path.join(__dirname,'_tmp-foto2.png'); fs.writeFileSync(tmp,png); await page.setInputFiles('#fotoGaleria',tmp); await page.waitForTimeout(600); }
async function next(page){ await page.click('.step.active .btn-next'); await page.waitForTimeout(450); }
async function activeStep(page){ return await page.evaluate(()=>{ const a=document.querySelector('.step.active'); return a?a.id:null; }); }

async function preencherQuiz(page, cpf){
  await page.fill('#nascimentoInput','15/03/1990'); await page.waitForTimeout(100);
  await page.fill('#cpfInput', fmtCpf(cpf));
  await picker(page,'sexoField','Masculino'); await next(page);
  await page.fill('#emergenciaNome','Ana Lima'); await page.fill('#emergenciaParentesco','Mãe'); await page.fill('#emergenciaTel','(11) 99999-8888'); await next(page);
  await picker(page,'tipoSangueField','O+'); await next(page);
  await page.fill('#alergiaNomeInput','Dipirona'); await page.selectOption('#alergiaTipoInput','MEDICAMENTO').catch(()=>{}); await page.fill('#alergiaReacaoInput','anafilaxia'); await page.click('#alergiaFormBox button, button:has-text("Adicionar à lista")').catch(()=>{}); await page.waitForTimeout(250); await next(page);
  await page.fill('#medNomeInput','Losartana'); await page.fill('#medMotivoInput','pressao alta').catch(()=>{}); await page.click('#medFormBox button, button:has-text("Adicionar à lista")').catch(()=>{}); await page.waitForTimeout(250); await next(page);
  await page.fill('#implantesInput','stent coronario').catch(()=>{}); await next(page);
  await next(page); // plano (opcional)
  await fotoFake(page);
  await page.click('#btnConcluir');
}

async function seedRG(membro){
  const cpf = cpfValido();
  await api('/perfil',{method:'PUT',token:membro.token,body:{
    genero:'MASCULINO', dataNascimento:'1990-03-15', cpf, tipoSanguineo:'O_POS', condicoes:'Hipertensao', implantes:'stent coronario',
    contatoEmergenciaNome:'Ana Lima', parentescoEmergencia:'Mãe', contatoEmergenciaTel:'11999998888',
    contatoEmergenciaNome2:'Joao Lima', parentescoEmergencia2:'Pai', contatoEmergenciaTel2:'11977776666',
  }});
  await api('/alergias',{method:'POST',token:membro.token,body:{nome:'Dipirona',tipo:'MEDICAMENTO',reacao:'anafilaxia'}});
  await api('/medicamentos',{method:'POST',token:membro.token,body:{nome:'Losartana',dosagem:'50mg',motivo:'pressao alta'}});
  return cpf;
}

// ============================================================
async function run(browser){
  // ---------- SETUP PAINEL ----------
  log('\n══ SETUP painel (dono + empresa + convite + membro + RG) ══');
  const dono = await criarConta('dono');
  const emp = await api('/empresa',{method:'POST',token:dono.token,body:{nome:'Empresa Robo CICLO',tipo:'Empresa',quantidade:10}});
  ok(emp.status===201||emp.status===200, `criou empresa (${emp.status})`);
  const conv = await api('/empresa/convite',{method:'POST',token:dono.token,body:{}});
  const conviteToken = conv.body && (conv.body.token || conv.body.codigo);
  ok(!!conviteToken, `gerou link de convite (${conv.status})`);
  const membro = await criarConta('membro');
  const vinc = await api('/empresa/vincular',{method:'POST',token:membro.token,body:{token:conviteToken}});
  ok(vinc.status===200, `membro vinculou (${vinc.status} ${JSON.stringify(vinc.body)})`);
  await seedRG(membro);
  const membroId = membro.usuario.id;

  // ---------- T6-T9 (dados via API + render via UI) ----------
  log('\n══ T6-T9: Painel do dono — ficha do membro ══');
  const fic = await api('/empresa/membro/'+membroId,{token:dono.token});
  const M = fic.body && fic.body.membro || {};
  ok(fic.status===200, `dono abre ficha do membro (${fic.status})`);
  ok((M.alergias||[]).some(a=>a.reacao==='anafilaxia'), 'T6 backend: alergia com reacao=anafilaxia');
  ok((M.medicamentos||[]).some(md=>md.motivo==='pressao alta'), 'T7 backend: medicamento com motivo (finalidade)');
  ok(M.perfilSaude && M.perfilSaude.implantes==='stent coronario', 'T7 backend: implantes');
  ok(M.perfilSaude && M.perfilSaude.parentescoEmergencia==='Mãe' && M.perfilSaude.contatoEmergenciaNome2==='Joao Lima', 'T8 backend: parentesco + 2º contato');
  ok(!('exames' in M), 'T9 backend: ficha NÃO traz exames');

  // UI render
  const dp = await browser.newPage();
  await dp.goto(`${BASE}/01-saude.html`,{waitUntil:'domcontentloaded'}).catch(()=>{});
  await setToken(dp, dono);
  await dp.goto(`${BASE}/empresa-painel.html`,{waitUntil:'domcontentloaded'});
  await dp.waitForTimeout(1500);
  await dp.evaluate(id=>window.abrir(id), membroId);
  await dp.waitForFunction(()=>{const d=document.getElementById('detailView');return d&&!d.classList.contains('hidden')&&document.getElementById('dAlergias').innerText.length>0;},{timeout:12000}).catch(()=>{});
  const alg = await dp.locator('#dAlergias').innerText().catch(()=>'');
  const med = await dp.locator('#dMeds').innerText().catch(()=>'');
  const cnd = await dp.locator('#dCond').innerText().catch(()=>'');
  const ctt = await dp.locator('#dContato').innerText().catch(()=>'');
  ok(/Reação:\s*anafilaxia/i.test(alg), `T6 UI: ficha mostra "Reação: anafilaxia"`);
  ok(/Finalidade:\s*pressao alta/i.test(med), `T7 UI: ficha mostra "Finalidade: pressao alta"`);
  ok(/Implantes/i.test(cnd) && /stent coronario/i.test(cnd), `T7 UI: ficha mostra Implantes`);
  ok(/Mãe/.test(ctt) && /2º contato/i.test(ctt), `T8 UI: contato com parentesco + 2º contato`);
  ok(!/exame/i.test(await dp.locator('#detailView').innerText().catch(()=>'')), `T9 UI: ficha sem exames`);
  await dp.close();

  // ---------- T15 segurança ----------
  log('\n══ T15: segurança (dono de outra empresa → 403) ══');
  const donoB = await criarConta('donob');
  await api('/empresa',{method:'POST',token:donoB.token,body:{nome:'Empresa B Robo',tipo:'Empresa'}});
  const intruso = await api('/empresa/membro/'+membroId,{token:donoB.token});
  ok(intruso.status===403, `T15: dono alheio recebe 403 (${intruso.status})`);

  // ---------- T1-T5 telas de alergia (paciente) ----------
  log('\n══ T1-T5: telas de alergia + cartão RG ══');
  const pac = await criarConta('alergia');
  const seed = await api('/alergias',{method:'POST',token:pac.token,body:{nome:'Dipirona',tipo:'MEDICAMENTO',reacao:'anafilaxia'}});
  const alergiaId = seed.body && seed.body.alergia && seed.body.alergia.id;
  const ap = await browser.newPage();
  await ap.goto(`${BASE}/01-saude.html`,{waitUntil:'domcontentloaded'}).catch(()=>{});
  await setToken(ap, pac);
  // T1 add
  await ap.goto(`${BASE}/08-add-alergia.html`,{waitUntil:'domcontentloaded'}); await ap.waitForTimeout(600);
  ok(await ap.locator('#inputReacao').count()>0, 'T1: form de adicionar tem campo Reação');
  ok(await ap.locator('text=/Grave|Moderada|Leve|Gravidade/i').count()===0, 'T1: sem Grave/Moderada/Leve');
  // T2 lista
  await ap.goto(`${BASE}/06-alergias.html`,{waitUntil:'domcontentloaded'}); await ap.waitForTimeout(800);
  const card = await ap.locator('.severity-card').first().innerText().catch(()=>'');
  ok(/Dipirona/.test(card) && /Reação:/i.test(card) && /anafilaxia/i.test(card), 'T2: lista mostra Reação');
  ok(!/Grave|Moderada|Leve|Gravidade/i.test(card) && !card.includes('⚠'), 'T2: lista sem gravidade');
  // T3 detalhe
  if(alergiaId){ await ap.goto(`${BASE}/07-alergia-detalhe.html?id=${alergiaId}`,{waitUntil:'domcontentloaded'}); await ap.waitForTimeout(800);
    const det = await ap.locator('#alGravidade').innerText().catch(()=>'');
    ok(/Reação:/i.test(det) && /anafilaxia/i.test(det), 'T3: detalhe mostra reação');
    ok(!/Grave|Moderada|Leve/i.test(det), 'T3: detalhe sem escala de gravidade');
  } else { ok(false,'T3: não obteve alergiaId pra abrir detalhe'); }
  // T4 home
  await ap.goto(`${BASE}/01-saude.html`,{waitUntil:'domcontentloaded'}); await ap.waitForTimeout(1500);
  const homeAlg = await ap.locator('body').innerText().catch(()=>'');
  ok(/anafilaxia/i.test(homeAlg) || /Reação:/i.test(homeAlg), 'T4: home mostra reação');
  ok(!/Alta gravidade|Moderada gravidade/i.test(homeAlg), 'T4: home sem rótulo de gravidade');
  // T5 cartão RG
  await ap.goto(`${BASE}/14-rg-publico.html?demo=1`,{waitUntil:'domcontentloaded'}); await ap.waitForTimeout(1200);
  const algTags = await ap.locator('.tag.allergy, .card-tag-allergy').allInnerTexts().catch(()=>[]);
  ok(algTags.some(t=>/Dipirona/.test(t)), 'T5: cartão mostra nomes de alergia');
  ok(algTags.length>0 && algTags.every(t=>!t.includes('⚠') && !/·|GRAVE|MODERADA|ANAFILAXIA/i.test(t)), 'T5: tags de alergia SÓ com nome (sem ⚠/gravidade)');
  ok(await ap.locator('.tag.allergy-grave').count()===0, 'T5: sentinela allergy-grave nunca aplicada');
  await ap.close();

  // ---------- SETUP + T10-T12 pré-consulta ----------
  log('\n══ T10-T12: pré-consulta unificada ══');
  const medico = await criarConta('medico','MEDICO');
  const reg = await api('/medico',{method:'POST',token:medico.token,body:{crm:String(Math.floor(Math.random()*900000+100000)),ufCrm:'SP',especialidade:'Clinica Geral',clinica:'Clinica Robo',enderecoClinica:'Rua Teste, 100',telefoneClinica:'1133334444',valorConsulta:250}});
  ok(reg.status===200||reg.status===201, `médico cadastrado (${reg.status})`);
  const pc = await api('/pre-consulta',{method:'POST',token:medico.token,body:{pacienteNome:'Paciente Robo',dataConsulta:new Date(Date.now()+86400000).toISOString()}});
  const linkToken = pc.body && pc.body.preConsulta && pc.body.preConsulta.linkToken;
  ok(!!linkToken, `pré-consulta criada com token (${pc.status})`);
  const pacNovo = await criarConta('pacpc');
  const pp = await browser.newPage();
  await pp.goto(`${BASE}/pre-consulta.html?token=${linkToken}`,{waitUntil:'domcontentloaded'}).catch(()=>{});
  await setToken(pp, pacNovo);
  await pp.evaluate((tk)=>{ localStorage.setItem('vitae_pc_state_'+tk, JSON.stringify({slidesVistos:true,onb2Visto:true})); }, linkToken); // pula onboarding intro
  await pp.goto(`${BASE}/pre-consulta.html?token=${linkToken}`,{waitUntil:'domcontentloaded'});
  // T10: cai na 30-quiz azul
  await pp.waitForURL(/30-quiz\.html\?retorno=/, {timeout:15000}).catch(()=>{});
  const url10 = pp.url();
  ok(/30-quiz\.html\?retorno=/.test(url10), `T10: paciente novo caiu na 30-quiz (${url10.split('/').pop().slice(0,40)})`);
  ok((await pp.locator('text=/de 8/').count())>0, 'T10: quiz é o novo (Passo de 8)');
  // T11: conclui e volta
  await pp.waitForTimeout(800);
  await preencherQuiz(pp, cpfValido());
  await pp.waitForURL(/pre-consulta\.html\?token=.*voltei=quizvid/, {timeout:20000}).catch(()=>{});
  const url11 = pp.url();
  ok(/voltei=quizvid/.test(url11), `T11: concluiu e voltou pra pré-consulta (?voltei=quizvid)`);
  // T12: não voltou pro quiz nem pro login
  await pp.waitForTimeout(2500);
  const url12 = pp.url();
  ok(!/30-quiz\.html/.test(url12), 'T12: não caiu de volta no quiz (perfil reconhecido)');
  await pp.close();
}

(async()=>{
  const server = USE_LOCAL ? serve() : null;
  log('BASE =', BASE);
  const browser = await chromium.launch({ headless:true });
  try { await run(browser); }
  catch(e){ FAIL++; log('  ❌ ERRO FATAL:', e.message); }
  finally {
    await browser.close(); if(server) server.close();
    try{ fs.unlinkSync(path.join(__dirname,'_tmp-foto2.png')); }catch(_){}
    log(`\n═══ RESULTADO: ${PASS} ✅  /  ${FAIL} ❌ ═══`);
    log('Emails de teste (limpar):', EMAILS.join(', '));
    process.exit(FAIL>0?1:0);
  }
})();
