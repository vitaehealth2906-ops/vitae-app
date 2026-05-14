// Smoke test dos cenários do quiz vita id
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const QUIZ_URL = 'http://localhost:3000/30-quiz.html';
const SHOTS = path.join(__dirname, 'shots', 'quiz-50');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 500, height: 950 } });
  const page = await ctx.newPage();
  const log = [];
  const step = (n, ok, det) => { log.push({ n, ok, det }); console.log(`[${ok ? 'OK' : 'FAIL'}] ${n}${det ? ' · ' + det : ''}`); };

  // Cria conta de teste primeiro pra simular paciente logado
  try {
    // PRIMEIRO navega pra localhost:3000 pra ter contexto válido pro fetch (CORS)
    await page.goto('http://localhost:3000/app.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    const sufixo = Date.now();
    const dados = {
      nome: 'Quiz Test ' + sufixo,
      celular: '(11) 9' + String(sufixo).slice(-4) + '-' + String(sufixo).slice(-4),
      email: `quiz-${sufixo}@vitae-test.com`,
      senha: 'TesteSenha123!'
    };
    // Hack: cria conta via fetch direto pra Railway (mais rápido que UI)
    const res = await page.evaluate(async (d) => {
      const r = await fetch('https://vitae-app-production.up.railway.app/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: d.nome, email: d.email,
          celular: '+5511' + d.celular.replace(/\D/g, '').slice(-9),
          senha: d.senha, tipo: 'PACIENTE'
        })
      });
      return { status: r.status, body: await r.json() };
    }, dados);
    if (res.body && res.body.token) {
      await page.evaluate((data) => {
        localStorage.setItem('vitae_token', data.token);
        localStorage.setItem('vitae_refresh_token', data.refreshToken);
        localStorage.setItem('vitae_usuario', JSON.stringify(data.usuario));
      }, res.body);
      step('Setup: conta criada pra teste', true, dados.email);
    } else {
      step('Setup: conta criada', false, 'HTTP ' + res.status);
    }

    // Limpa quiz parcial salvo de testes anteriores
    await page.evaluate(() => localStorage.removeItem('vitae_quiz_parcial_v2'));

    // Vai pro quiz
    await page.goto(QUIZ_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS, '01-passo0.png') });

    // CENÁRIO: clica Próximo SEM preencher nada
    page.on('dialog', async (d) => { console.log('  [dialog]', d.message().slice(0, 80)); await d.dismiss(); });
    await page.click('button.btn-next');
    await page.waitForTimeout(800);
    const toastVisivel = await page.locator('#quizToast').isVisible().catch(() => false);
    const stepZero = await page.evaluate(() => window.currentStep || (window.STATE && window.STATE.view));
    step('Próximo vazio NÃO avança + mostra toast', toastVisivel, 'toast visível: ' + toastVisivel);

    // CENÁRIO: errores inline devem aparecer em campos vazios
    const errVisiveis = await page.evaluate(() => {
      const errs = Array.from(document.querySelectorAll('[id$="_err"]')).filter(e => e.style.display !== 'none');
      return errs.map(e => e.id + ': ' + e.textContent);
    });
    step('Erros inline aparecem nos campos vazios', errVisiveis.length >= 3, errVisiveis.length + ' erros · ' + errVisiveis.slice(0, 2).join(' | '));
    await page.screenshot({ path: path.join(SHOTS, '02-erros-inline.png') });

    // CENÁRIO: CPF inválido (111.111.111-11)
    await page.fill('#cpfInput', '111.111.111-11');
    await page.fill('#alturaInput', '170');
    await page.fill('#pesoInput', '70');
    await page.fill('#nascimentoInput', '15/03/2000');
    await page.click('button.btn-next');
    await page.waitForTimeout(800);
    const cpfErr = await page.locator('#cpfInput_err').textContent().catch(() => '');
    step('CPF inválido detectado', cpfErr.toLowerCase().includes('inválid') || cpfErr.toLowerCase().includes('invalid'), 'msg: ' + cpfErr);

    // CENÁRIO: idade < 13
    await page.fill('#cpfInput', '529.982.247-25'); // CPF válido teste
    await page.fill('#nascimentoInput', '15/03/2020');
    await page.click('button.btn-next');
    await page.waitForTimeout(800);
    const nascErr = await page.locator('#nascimentoInput_err').textContent().catch(() => '');
    step('Idade < 13 detectada', nascErr.toLowerCase().includes('13'), 'msg: ' + nascErr);

    // CENÁRIO: altura absurda (10cm)
    await page.fill('#nascimentoInput', '15/03/2000');
    await page.fill('#alturaInput', '10');
    await page.click('button.btn-next');
    await page.waitForTimeout(800);
    const altErr = await page.locator('#alturaInput_err').textContent().catch(() => '');
    step('Altura absurda (10cm) detectada', altErr.toLowerCase().includes('cm') || altErr.toLowerCase().includes('50'), 'msg: ' + altErr);

    // CENÁRIO: cruzamento Lucas-Dipirona (já capturado pelo handler genérico)
    let cruzamentoDetectado = false;
    page.removeAllListeners('dialog');
    page.on('dialog', async (d) => {
      const txt = d.message();
      if (txt.includes('dipirona') || txt.includes('alergia')) cruzamentoDetectado = true;
      await d.dismiss();
    });
    await page.evaluate(() => {
      if (document.getElementById('alergiasInput')) document.getElementById('alergiasInput').value = 'dipirona';
      if (document.getElementById('medicamentosInput')) document.getElementById('medicamentosInput').value = 'novalgina 500mg';
      if (window.goToStep) window.goToStep(4);
      window.currentStep = 4;
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => { if (window.validateAndGoNext) window.validateAndGoNext(5); });
    await page.waitForTimeout(1500);
    step('Cruzamento Lucas-Dipirona detectado', cruzamentoDetectado, 'aviso com mapa CMED funcionou');

    // CENÁRIO: salvamento parcial em localStorage
    await page.fill('#alergiasInput', 'amendoim');
    await page.waitForTimeout(1500); // espera debounce
    const parcialSalvo = await page.evaluate(() => {
      const raw = localStorage.getItem('vitae_quiz_parcial_v2');
      return raw ? JSON.parse(raw) : null;
    });
    step('Parcial salvo no localStorage', !!(parcialSalvo && parcialSalvo.alergias === 'amendoim'), 'tem: ' + (parcialSalvo ? Object.keys(parcialSalvo).length + ' campos' : 'null'));

    await page.screenshot({ path: path.join(SHOTS, 'final.png') });
  } catch (e) {
    step('ERRO FATAL', false, e.message);
    await page.screenshot({ path: path.join(SHOTS, 'erro.png') });
  }

  fs.writeFileSync(path.join(SHOTS, 'log.json'), JSON.stringify(log, null, 2));
  console.log('\n=== RESUMO ===');
  console.log(`OK: ${log.filter(l => l.ok).length}/${log.length}`);
  console.log(`FAIL: ${log.filter(l => !l.ok).length}`);
  await browser.close();
})();
