// LOTE 9 — Quiz com form estruturado de medicamento
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';
const URL_QUIZ = `${BASE}/30-quiz.html`;

const SHOTS = path.join(__dirname, 'shots', 'lote-9' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => { log.push({n,ok,det}); console.log(`[${ok?'OK':'FAIL'}] ${n}${det?' · '+det:''}`); };

async function setup(page) {
  const sufixo = Date.now();
  const d = { nome:'Lote9 '+sufixo, celular:'(11) 9'+String(sufixo).slice(-4)+'-'+String(sufixo).slice(-4), email:`lote9-${sufixo}@vitae-test.com`, senha:'TesteSenha123!' };
  await page.goto(URL_QUIZ).catch(()=>{});
  await page.waitForTimeout(300);
  const r = await page.evaluate(async (d)=>{
    const r = await fetch('https://vitae-app-production.up.railway.app/auth/cadastro', {method:'POST',headers:{'Content-Type':'application/json'},body: JSON.stringify({nome:d.nome,email:d.email,celular:'+5511'+d.celular.replace(/\D/g,'').slice(-9),senha:d.senha,tipo:'PACIENTE'})});
    return { body: await r.json() };
  }, d);
  if (!r.body?.token) return null;
  await page.evaluate((b)=>{
    localStorage.setItem('vitae_token', b.token);
    if (b.refreshToken) localStorage.setItem('vitae_refresh_token', b.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(b.usuario));
    localStorage.removeItem('vitae_quiz_parcial_v2');
  }, r.body);
  return { token:r.body.token, usuario:r.body.usuario };
}

(async()=>{
  const browser = await chromium.launch({channel:'msedge', headless:false});
  const ctx = await browser.newContext({viewport:{width:500,height:950}});
  const page = await ctx.newPage();

  console.log('═══════════════════════════════════════════════════════');
  console.log(`LOTE 9 — Quiz form estruturado · ${PROD?'PROD':'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  page.on('dialog', d => d.dismiss());

  const p = await setup(page);
  if (!p) { step('Setup', false); await browser.close(); return; }
  step('Setup paciente', true);

  try {
    await page.goto(URL_QUIZ);
    await page.waitForTimeout(2000);

    // Forçar pular pro passo 4 (medicamentos)
    await page.evaluate(() => {
      if (window.goToStep) {
        window.currentStep = 4;
        window.goToStep(4);
      }
    });
    await page.waitForTimeout(800);

    // Verifica que o form estruturado existe (não é textarea simples)
    const nomeInput = await page.locator('#medNomeInput').count();
    step('Form tem input nome', nomeInput > 0);
    const doseInput = await page.locator('#medDoseInput').count();
    step('Form tem input dose', doseInput > 0);
    const horaInput = await page.locator('#medHoraInput').count();
    step('Form tem input horário', horaInput > 0);
    const motivoInput = await page.locator('#medMotivoInput').count();
    step('Form tem input motivo', motivoInput > 0);

    await page.screenshot({path: path.join(SHOTS, '01-form-empty.png')});

    // Tenta adicionar sem nome → toast de erro
    await page.click('button:has-text("Adicionar à lista")');
    await page.waitForTimeout(800);
    const toastSemNome = await page.locator('#quizToast').isVisible().catch(()=>false);
    step('Validação nome obrigatório', toastSemNome);

    // Preenche e adiciona
    await page.fill('#medNomeInput', 'Losartana');
    await page.fill('#medDoseInput', '50mg');
    await page.fill('#medHoraInput', '08:00');
    await page.fill('#medMotivoInput', 'pressão');
    await page.click('button:has-text("Adicionar à lista")');
    await page.waitForTimeout(800);

    const listaItens = await page.locator('#medsListaQuiz > div').count();
    step('Med apareceu na lista', listaItens === 1);

    const losa = await page.locator('#medsListaQuiz').textContent();
    step('Lista mostra Losartana 50mg 08:00', losa.includes('Losartana') && losa.includes('50mg') && losa.includes('08:00'));
    step('Lista mostra motivo', losa.includes('pressão'));

    await page.screenshot({path: path.join(SHOTS, '02-med-adicionado.png')});

    // Inputs limparam
    const nomeVazio = await page.locator('#medNomeInput').inputValue() === '';
    step('Inputs limpam após add', nomeVazio);

    // Adiciona segundo
    await page.fill('#medNomeInput', 'Omeprazol');
    await page.fill('#medDoseInput', '20mg');
    await page.click('button:has-text("Adicionar à lista")');
    await page.waitForTimeout(500);
    const total = await page.locator('#medsListaQuiz > div').count();
    step('Adiciona segundo med', total === 2);

    // Remove um
    await page.locator('#medsListaQuiz button:has-text("×")').first().click();
    await page.waitForTimeout(500);
    const restou = await page.locator('#medsListaQuiz > div').count();
    step('Remove med funciona', restou === 1);

    await page.screenshot({path: path.join(SHOTS, '03-removido.png')});

    // Verifica que textarea hidden tem valor (compat com legado)
    const textareaVal = await page.locator('#medicamentosInput').inputValue();
    step('Textarea hidden tem valor concatenado', textareaVal.includes('Omeprazol'));

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
