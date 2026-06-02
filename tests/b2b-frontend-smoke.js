// Smoke das telas editadas na Sessao 36: empresa-painel (real) + 30-quiz (responsaveis).
// Roda local (file://) so pra pegar JS QUEBRADO das edicoes (rede/cors ignorados).
const { chromium } = require('playwright');
const BASE = 'file:///D:/vitae-app-novo/app-v3/';
const QUEBROU = /is not defined|Cannot read|is not a function|SyntaxError|Unexpected token|undefined is not|null is not/i;
const results = [];
const check = (n, ok, x = '') => { results.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FALHA') + ' | ' + n + (x ? '  -> ' + x : '')); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  async function abrir(arq, init) {
    const ctx = await browser.newContext();
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', (e) => errs.push('UNCAUGHT: ' + e.message));
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(BASE + arq, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(1200);
    return { p, ctx, errs };
  }
  const quebras = (errs) => errs.filter((e) => QUEBROU.test(e));

  // 1) empresa-painel (logado fake -> getMinhaEmpresa falha no file:// e cai no criar, sem JS quebrado)
  {
    const init = () => { localStorage.setItem('vitae_token', 'fake'); localStorage.setItem('vitae_usuario', '{"id":"x","nome":"Gestor","tipo":"EMPRESA"}'); };
    const { p, ctx, errs } = await abrir('empresa-painel.html', init);
    const temApp = await p.locator('.app').count();
    const temOnix = await p.locator('.rgonix').count();
    check('empresa-painel renderiza + cartao Onix + sem JS quebrado', temApp > 0 && temOnix > 0 && quebras(errs).length === 0, 'app=' + temApp + ' onix=' + temOnix + ' quebras=' + quebras(errs).length + (quebras(errs)[0] ? ' (' + quebras(errs)[0].slice(0, 70) + ')' : ''));
    await ctx.close();
  }

  // 2) 30-quiz: carrega + elementos do menor + quizConfigStep2 funciona
  {
    const { p, ctx, errs } = await abrir('30-quiz.html');
    const carregou = await p.locator('body').isVisible().catch(() => false);
    check('30-quiz carrega + sem JS quebrado', carregou && quebras(errs).length === 0, 'quebras=' + quebras(errs).length + (quebras(errs)[0] ? ' (' + quebras(errs)[0].slice(0, 70) + ')' : ''));
    const temMenor = await p.locator('#step2Menor').count();
    const temPai = await p.locator('#paiNome').count();
    const temMae = await p.locator('#maeNome').count();
    check('30-quiz: passo Responsaveis (pai/mae) existe', temMenor > 0 && temPai > 0 && temMae > 0, 'menor=' + temMenor + ' pai=' + temPai + ' mae=' + temMae);
    const r = await p.evaluate(() => { if (typeof quizConfigStep2 !== 'function') return 'SEM FUNCAO'; quizConfigStep2(true); const me = document.getElementById('step2Menor').style.display; const ad = document.getElementById('step2Adulto').style.display; const t = document.getElementById('step2Title').textContent; return 'me=' + me + ' ad=' + ad + ' titulo=' + t; });
    check('30-quiz: quizConfigStep2(true) mostra Responsaveis e esconde adulto', /me=block/.test(r) && /ad=none/.test(r) && /respons/i.test(r), r);
    await ctx.close();
  }

  // 3) Mascaras ao vivo (CNPJ + quantidade no painel; celular do gestor no login)
  {
    const init = () => { localStorage.setItem('vitae_token', 'fake'); localStorage.setItem('vitae_usuario', '{"id":"x","nome":"G","tipo":"EMPRESA"}'); };
    const { p, ctx } = await abrir('empresa-painel.html', init);
    await p.fill('#inpCnpj', ''); await p.type('#inpCnpj', '11222333000181');
    const cnpj = await p.inputValue('#inpCnpj').catch(() => '');
    check('mascara CNPJ (criar org)', cnpj === '11.222.333/0001-81', 'cnpj=' + cnpj);
    await p.fill('#inpQtd', ''); await p.type('#inpQtd', '99999999');
    const qtd = await p.inputValue('#inpQtd').catch(() => '');
    check('quantidade limitada a 6 digitos', qtd === '999999', 'qtd=' + qtd);
    await ctx.close();
  }
  {
    const { p, ctx } = await abrir('empresa-login.html');
    await p.evaluate(() => { if (typeof trocar === 'function') trocar('cadastro'); });
    await p.fill('#cadCelular', ''); await p.type('#cadCelular', '11987654321');
    const cel = await p.inputValue('#cadCelular').catch(() => '');
    check('mascara celular do gestor (cadastro)', cel === '(11) 98765-4321', 'cel=' + cel);
    await ctx.close();
  }

  await browser.close();
  const pass = results.filter((x) => x.ok).length;
  console.log(`\n=== FRONTEND SMOKE: ${pass}/${results.length} ===`);
  process.exit(pass === results.length ? 0 : 1);
})().catch((e) => { console.error('FATAL:', e.message); process.exit(2); });
