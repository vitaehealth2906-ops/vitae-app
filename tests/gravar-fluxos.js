// GRAVADOR DE FLUXOS — Sessão 37/38. Grava vídeo de cada fluxo que mudou, contra produção.
// Rodar: QBASE=https://vitae-app.vercel.app/app-v3 node tests/gravar-fluxos.js
// Vídeos salvos em d:\vita-telas-b2b\VIDEOS-FLUXOS\*.webm (abre no Edge/Chrome com 2 cliques)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const API = 'https://vitae-app-production.up.railway.app';
const BASE = process.env.QBASE || 'https://vitae-app.vercel.app/app-v3';
const VIDDIR = 'd:\\vita-telas-b2b\\VIDEOS-FLUXOS';
if (!fs.existsSync(VIDDIR)) fs.mkdirSync(VIDDIR, { recursive:true });

const EMAILS=[];
const log=(...a)=>console.log(...a);
function cpfValido(){ const n=Array.from({length:9},()=>Math.floor(Math.random()*10)); const dv=(a)=>{let s=0;for(let i=0;i<a.length;i++)s+=a[i]*(a.length+1-i);let r=11-(s%11);return r>=10?0:r;}; const d1=dv(n),d2=dv([...n,d1]); return [...n,d1,d2].join(''); }
function fmtCpf(c){ return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/,'$1.$2.$3-$4'); }
async function api(p,{method='GET',token,body}={}){ const r=await fetch(API+p,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}); let j=null;try{j=await r.json();}catch(_){} return {status:r.status,body:j}; }
async function criarConta(prefixo,tipo='PACIENTE'){ const uniq=Date.now().toString().slice(-7)+Math.floor(Math.random()*90+10); const email=`${prefixo}-${Date.now()}-${Math.floor(Math.random()*9999)}@vitae-test.invalid`; EMAILS.push(email); const r=await api('/auth/cadastro',{method:'POST',body:{nome:'Demo '+prefixo,email,celular:'+5511'+uniq,senha:'TesteRobo@123',tipo}}); if(!r.body||!r.body.token) throw new Error('cadastro '+prefixo+' falhou: '+JSON.stringify(r.body)); return {token:r.body.token,refresh:r.body.refreshToken,usuario:r.body.usuario,email}; }
async function setToken(page,c){ await page.evaluate((x)=>{localStorage.setItem('vitae_token',x.token);if(x.refresh)localStorage.setItem('vitae_refresh_token',x.refresh);localStorage.setItem('vitae_usuario',JSON.stringify(x.usuario));},c); }
async function pausa(page,ms=1100){ await page.waitForTimeout(ms); }
async function picker(page,fieldId,texto){ await page.click('#'+fieldId); await page.waitForSelector('#pickerOverlay',{state:'visible',timeout:6000}); const s=page.locator('#pickerSearch'); if(await s.isVisible().catch(()=>false)){await s.fill(texto.slice(0,4));await page.waitForTimeout(200);} await page.locator('#pickerOverlay').getByText(texto,{exact:true}).first().click(); await page.waitForSelector('#pickerOverlay',{state:'hidden',timeout:6000}).catch(()=>{}); }
async function fotoFake(page){ const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC','base64'); const tmp=path.join(__dirname,'_tmp-vid.png'); fs.writeFileSync(tmp,png); await page.setInputFiles('#fotoGaleria',tmp); await page.waitForTimeout(700); }
async function next(page){ await page.click('.step.active .btn-next'); await page.waitForTimeout(700); }

async function preencherQuiz(page,{menor=false}={}){
  await pausa(page,1200);
  await page.fill('#nascimentoInput', menor?'10/05/2015':'15/03/1990'); await page.waitForTimeout(300);
  await page.fill('#cpfInput', fmtCpf(cpfValido()));
  await picker(page,'sexoField', menor?'Feminino':'Masculino'); await pausa(page,800); await next(page);
  if(menor){ await pausa(page,900); await page.fill('#maeNome','Maria Souza'); await page.fill('#maeTel','(11) 96666-5555'); }
  else { await page.fill('#emergenciaNome','Ana Lima'); await page.fill('#emergenciaParentesco','Mãe'); await page.fill('#emergenciaTel','(11) 99999-8888'); await page.click('#btnAddContato2').catch(()=>{}); await page.waitForTimeout(300); await page.fill('#emergenciaNome2','Joao Lima').catch(()=>{}); await page.fill('#emergenciaParentesco2','Pai').catch(()=>{}); await page.fill('#emergenciaTel2','(11) 97777-6666').catch(()=>{}); }
  await pausa(page,900); await next(page);
  await picker(page,'tipoSangueField','O+'); await pausa(page,700); await next(page);
  await page.fill('#alergiaNomeInput','Dipirona'); await page.selectOption('#alergiaTipoInput','MEDICAMENTO').catch(()=>{}); await page.fill('#alergiaReacaoInput','anafilaxia'); await page.click('#alergiaFormBox button, button:has-text("Adicionar à lista")').catch(()=>{}); await pausa(page,900); await next(page);
  await page.fill('#medNomeInput','Losartana'); await page.fill('#medDoseInput','50mg').catch(()=>{}); await page.fill('#medMotivoInput','pressao alta').catch(()=>{}); await page.click('#medFormBox button, button:has-text("Adicionar à lista")').catch(()=>{}); await pausa(page,900); await next(page);
  await page.fill('#condicoesInput','Hipertensao').catch(()=>{}); await page.fill('#implantesInput','stent coronario').catch(()=>{}); await pausa(page,900); await next(page);
  await pausa(page,700); await next(page); // plano
  await fotoFake(page); await pausa(page,900);
  await page.click('#btnConcluir'); await pausa(page,2500);
}

async function gravar(browser, nome, viewport, fn){
  log('🎥 gravando:', nome);
  const ctx = await browser.newContext({ viewport, recordVideo:{ dir:VIDDIR, size:viewport } });
  const page = await ctx.newPage();
  const v = page.video();
  try { await fn(page); } catch(e){ log('   (parou:', e.message.split('\n')[0], ')'); }
  await ctx.close();
  try { const p = await v.path(); const dest = path.join(VIDDIR, nome+'.webm'); fs.renameSync(p, dest); log('   ✅', dest); }
  catch(e){ log('   ⚠ vídeo:', e.message); }
}

const MOBILE={width:393,height:852}, DESK={width:1280,height:820};

(async()=>{
  const browser = await chromium.launch({ headless:true, slowMo:120 });
  try {
    // 1) QUIZ ADULTO
    await gravar(browser,'1-quiz-adulto-8-slides',MOBILE, async(page)=>{
      const c=await criarConta('vq-adulto');
      await page.goto(`${BASE}/01-saude.html`,{waitUntil:'domcontentloaded'}).catch(()=>{}); await setToken(page,c);
      await page.goto(`${BASE}/30-quiz.html`,{waitUntil:'domcontentloaded'});
      await preencherQuiz(page,{});
    });
    // 2) QUIZ MENOR (ESCOLA)
    await gravar(browser,'2-quiz-menor-responsaveis',MOBILE, async(page)=>{
      const c=await criarConta('vq-menor');
      await page.goto(`${BASE}/01-saude.html`,{waitUntil:'domcontentloaded'}).catch(()=>{}); await setToken(page,c);
      await page.goto(`${BASE}/30-quiz.html`,{waitUntil:'domcontentloaded'});
      await preencherQuiz(page,{menor:true});
    });
    // 3) TELAS DE ALERGIA + CARTÃO RG
    await gravar(browser,'3-alergia-e-cartao-rg',MOBILE, async(page)=>{
      const c=await criarConta('vq-alergia');
      const seed=await api('/alergias',{method:'POST',token:c.token,body:{nome:'Dipirona',tipo:'MEDICAMENTO',reacao:'anafilaxia'}});
      const aid=seed.body&&seed.body.alergia&&seed.body.alergia.id;
      await page.goto(`${BASE}/01-saude.html`,{waitUntil:'domcontentloaded'}).catch(()=>{}); await setToken(page,c);
      await page.goto(`${BASE}/08-add-alergia.html`,{waitUntil:'domcontentloaded'}); await pausa(page,2200);
      await page.goto(`${BASE}/06-alergias.html`,{waitUntil:'domcontentloaded'}); await pausa(page,2200);
      if(aid){ await page.goto(`${BASE}/07-alergia-detalhe.html?id=${aid}`,{waitUntil:'domcontentloaded'}); await pausa(page,2200); }
      await page.goto(`${BASE}/01-saude.html`,{waitUntil:'domcontentloaded'}); await pausa(page,2600);
      await page.goto(`${BASE}/14-rg-publico.html?demo=1`,{waitUntil:'domcontentloaded'}); await pausa(page,2800);
    });
    // 4) PAINEL DO DONO
    await gravar(browser,'4-painel-do-dono-ficha',DESK, async(page)=>{
      const dono=await criarConta('vq-dono');
      await api('/empresa',{method:'POST',token:dono.token,body:{nome:'Escola Demo CICLO',tipo:'Escola',quantidade:10}});
      const conv=await api('/empresa/convite',{method:'POST',token:dono.token,body:{}});
      const membro=await criarConta('vq-membro');
      await api('/empresa/vincular',{method:'POST',token:membro.token,body:{token:conv.body&&conv.body.token}});
      const cpf=cpfValido();
      await api('/perfil',{method:'PUT',token:membro.token,body:{genero:'MASCULINO',dataNascimento:'1990-03-15',cpf,tipoSanguineo:'O_POS',condicoes:'Hipertensao',implantes:'stent coronario',contatoEmergenciaNome:'Ana Lima',parentescoEmergencia:'Mãe',contatoEmergenciaTel:'11999998888',contatoEmergenciaNome2:'Joao Lima',parentescoEmergencia2:'Pai',contatoEmergenciaTel2:'11977776666'}});
      await api('/alergias',{method:'POST',token:membro.token,body:{nome:'Dipirona',tipo:'MEDICAMENTO',reacao:'anafilaxia'}});
      await api('/medicamentos',{method:'POST',token:membro.token,body:{nome:'Losartana',dosagem:'50mg',motivo:'pressao alta'}});
      await page.goto(`${BASE}/01-saude.html`,{waitUntil:'domcontentloaded'}).catch(()=>{}); await setToken(page,dono);
      await page.goto(`${BASE}/empresa-painel.html`,{waitUntil:'domcontentloaded'}); await pausa(page,2600);
      const row=page.locator('.trow').first();
      if(await row.count()>0){ await row.click(); } else { await page.evaluate(id=>window.abrir(id), membro.usuario.id); }
      await page.waitForTimeout(2000); await page.mouse.wheel(0,400); await pausa(page,2800);
    });
    // 5) PRÉ-CONSULTA (paciente novo → quiz azul → volta)
    await gravar(browser,'5-pre-consulta-unificada',MOBILE, async(page)=>{
      const medico=await criarConta('vq-medico','MEDICO');
      await api('/medico',{method:'POST',token:medico.token,body:{crm:String(Math.floor(Math.random()*900000+100000)),ufCrm:'SP',especialidade:'Clinica Geral',clinica:'Clinica Demo',enderecoClinica:'Rua Teste, 100',telefoneClinica:'1133334444',valorConsulta:250}});
      const pc=await api('/pre-consulta',{method:'POST',token:medico.token,body:{pacienteNome:'Paciente Demo',dataConsulta:new Date(Date.now()+86400000).toISOString()}});
      const tk=pc.body&&pc.body.preConsulta&&pc.body.preConsulta.linkToken;
      const pac=await criarConta('vq-pacpc');
      await page.goto(`${BASE}/pre-consulta.html?token=${tk}`,{waitUntil:'domcontentloaded'}).catch(()=>{}); await setToken(page,pac);
      await page.evaluate((t)=>localStorage.setItem('vitae_pc_state_'+t,JSON.stringify({slidesVistos:true,onb2Visto:true})),tk);
      await page.goto(`${BASE}/pre-consulta.html?token=${tk}`,{waitUntil:'domcontentloaded'});
      await page.waitForURL(/30-quiz\.html/,{timeout:15000}).catch(()=>{}); await pausa(page,1500);
      await preencherQuiz(page,{});
      await page.waitForURL(/pre-consulta\.html.*voltei=quizvid/,{timeout:20000}).catch(()=>{}); await pausa(page,2500);
    });
  } finally {
    await browser.close();
    try{ fs.unlinkSync(path.join(__dirname,'_tmp-vid.png')); }catch(_){}
    log('\n=== VÍDEOS em', VIDDIR, '===');
    log('Emails de teste (limpar):', EMAILS.join(', '));
  }
})();
