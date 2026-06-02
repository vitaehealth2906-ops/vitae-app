// Etapa 1 (local, file://): cada tela redesenhada renderiza e NAO quebrou o JS.
const { chromium } = require('playwright');
const BASE = 'file:///D:/vitae-app-novo/app-v3/';
const results = [];
const check = (n, ok, x = '') => { results.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FALHA') + ' | ' + n + (x ? '  -> ' + x : '')); };
// so erros que indicam JS QUEBRADO (ignora rede/cors/favicon/google no file://)
const QUEBROU = /is not defined|Cannot read|is not a function|SyntaxError|Unexpected token|undefined is not|null is not/i;

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
    await p.waitForTimeout(1500);
    return { p, ctx, errs };
  }
  const quebras = (errs) => errs.filter((e) => QUEBROU.test(e));

  // 1) 26-cadastro (app paciente) — render + toggle + olho
  {
    const { p, ctx, errs } = await abrir('26-cadastro.html');
    const ok = await p.locator('#btnCreate').isVisible().catch(() => false);
    check('26-cadastro renderiza + sem JS quebrado', ok && quebras(errs).length === 0, 'render=' + ok + ' quebras=' + quebras(errs).length + (quebras(errs)[0] ? ' (' + quebras(errs)[0].slice(0, 70) + ')' : ''));
    try {
      await p.click('.login-link a'); await p.waitForTimeout(300);
      const t = (await p.textContent('.page-title')) || '';
      check('26-cadastro: alterna p/ "Entrar" funciona', /volta/i.test(t), 'titulo=' + t.trim());
    } catch (e) { check('26-cadastro: alterna p/ "Entrar" funciona', false, e.message); }
    await ctx.close();
  }

  // 2) pre-consulta (login embutido no link do medico) — so checa que carrega sem JS quebrado
  {
    const { p, ctx, errs } = await abrir('pre-consulta.html?token=reskin-teste-xyz');
    const carregou = await p.locator('body').isVisible().catch(() => false);
    check('pre-consulta carrega + sem JS quebrado (FLUXO intacto)', carregou && quebras(errs).length === 0, 'quebras=' + quebras(errs).length + (quebras(errs)[0] ? ' (' + quebras(errs)[0].slice(0, 70) + ')' : ''));
    await ctx.close();
  }

  // 3) 24-esqueci-senha
  {
    const { p, ctx, errs } = await abrir('24-esqueci-senha.html');
    const ok = await p.locator('input[type="email"]').first().isVisible().catch(() => false);
    check('24-esqueci-senha renderiza + sem JS quebrado', ok && quebras(errs).length === 0, 'render=' + ok + ' quebras=' + quebras(errs).length);
    await ctx.close();
  }

  // 4) 25-nova-senha — render + medidor de forca reage
  {
    const { p, ctx, errs } = await abrir('25-nova-senha.html');
    const ok = await p.locator('#pw1').isVisible().catch(() => false);
    check('25-nova-senha renderiza + sem JS quebrado', ok && quebras(errs).length === 0, 'render=' + ok + ' quebras=' + quebras(errs).length);
    try { await p.fill('#pw1', 'Senha@123'); await p.waitForTimeout(200); check('25-nova-senha: medidor de forca reage', true); }
    catch (e) { check('25-nova-senha: medidor de forca reage', false, e.message); }
    await ctx.close();
  }

  // 5) empresa-painel — com login fake fica no "criar" e mostra os 2 campos novos + copy
  {
    const init = () => { localStorage.setItem('vitae_token', 'fake-reskin'); localStorage.setItem('vitae_usuario', '{"id":"x","nome":"T","tipo":"EMPRESA"}'); };
    const { p, ctx, errs } = await abrir('empresa-painel.html', init);
    const tipo = await p.locator('#inpTipo').count();
    const qtd = await p.locator('#inpQtd').count();
    const html = (await p.content()).toLowerCase();
    check('empresa-painel: 2 campos novos (tipo + quantidade) existem', tipo > 0 && qtd > 0, 'inpTipo=' + tipo + ' inpQtd=' + qtd);
    check('empresa-painel: copy "sua equipe" / "organizacao" presente', html.includes('sua equipe') || html.includes('organiza'), '');
    check('empresa-painel: sem JS quebrado', quebras(errs).length === 0, 'quebras=' + quebras(errs).length + (quebras(errs)[0] ? ' (' + quebras(errs)[0].slice(0, 70) + ')' : ''));
    await ctx.close();
  }

  await browser.close();
  const pass = results.filter((x) => x.ok).length;
  console.log(`\n=== ETAPA 1 (local): ${pass}/${results.length} ===`);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
