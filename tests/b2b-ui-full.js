// Teste de navegacao: PORTA DO DONO real (empresa-login) + regressao do cadastro normal.
const { chromium } = require('playwright');
const APP = 'https://vitae-app.vercel.app/app-v3';
const ts = Date.now();
const results = [];
const check = (n, ok, x = '') => { results.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FALHA') + ' | ' + n + (x ? '  -> ' + x : '')); };
const donoEmail = `teste-b2b-uifull-dono-${ts}@vitae-test.com`;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const opts = { serviceWorkers: 'block' };

  // ===== T3.1 DONO pela porta REAL (empresa-login -> criar conta) =====
  const ctx = await browser.newContext(opts);
  const p = await ctx.newPage();
  await p.goto(APP + '/empresa-login.html', { waitUntil: 'domcontentloaded' });
  await p.click('a:has-text("Criar conta da empresa")');
  await p.waitForSelector('#cadView:not(.hidden)', { timeout: 15000 });
  await p.fill('#cadNome', 'TESTE-B2B UIFull Dono');
  await p.fill('#cadCelular', '119' + Math.floor(10000000 + Math.random() * 89999999));
  await p.fill('#cadEmail', donoEmail);
  await p.fill('#cadSenha', 'senha12345');
  await p.click('#btnCad');
  let okReach = false; try { await p.waitForURL(/empresa-painel\.html/, { timeout: 20000 }); okReach = true; } catch (_) {}
  check('T3.1 Dono cria conta na PORTA real e chega no painel', okReach, 'url=' + p.url());

  // criar empresa + gerar link, tudo na porta real
  const empNome = `TESTE-B2B UIFull Empresa ${ts}`;
  let link = '';
  if (okReach) {
    try { await p.waitForSelector('#criarView:not(.hidden)', { timeout: 15000 }); } catch (_) {}
    await p.fill('#inpNome', empNome);
    await p.click('#btnCriar');
    try { await p.waitForSelector('#painelView:not(.hidden)', { timeout: 20000 }); } catch (_) {}
    await p.click('#btnGerar');
    try { await p.waitForSelector('#linkArea:not(.hidden)', { timeout: 20000 }); link = await p.inputValue('#linkInp'); } catch (_) {}
  }
  check('T3.2 Dono cria empresa e gera link (porta real, ponta a ponta)', /convite\.html\?c=/.test(link), 'link=' + link);

  // ===== T3.3 Funcionario abre o link gerado de verdade =====
  if (link) {
    const cf = await browser.newContext(opts);
    const pf = await cf.newPage();
    await pf.goto(link, { waitUntil: 'domcontentloaded' });
    let okC = false, chip = '';
    try { await pf.waitForSelector('#okView:not(.hidden)', { timeout: 20000 }); chip = (await pf.textContent('#chipNome'))?.trim(); okC = chip === empNome; } catch (_) {}
    check('T3.3 Funcionario abre o link gerado e ve o nome certo', okC, 'chip=' + chip);
  } else { check('T3.3 Funcionario abre o link gerado e ve o nome certo', false, 'sem link'); }

  // ===== T3.4 REGRESSAO: cadastro normal carrega sem erro de JS =====
  const cr = await browser.newContext(opts);
  const pr = await cr.newPage();
  const errCad = [];
  pr.on('console', (m) => { if (m.type() === 'error') errCad.push(m.text()); });
  await pr.goto(APP + '/26-cadastro.html', { waitUntil: 'domcontentloaded' });
  let formOk = false; try { await pr.waitForSelector('input[type="email"]', { timeout: 15000 }); formOk = true; } catch (_) {}
  const realErrs = errCad.filter((e) => !/favicon|gsi|accounts\.google|net::ERR|sw\.js|ServiceWorker/i.test(e));
  check('T3.4 REGRESSAO: cadastro normal carrega + form ok + sem erro JS', formOk && realErrs.length === 0, 'form=' + formOk + ' erros=' + realErrs.length + (realErrs[0] ? ' (' + realErrs[0].slice(0, 70) + ')' : ''));

  await browser.close();
  const pass = results.filter((x) => x.ok).length;
  console.log(`\n=== ${pass}/${results.length} checagens passaram ===`);
  console.log('DADO TESTE:', donoEmail, '| empresa:', empNome);
})().catch((e) => { console.error('FATAL:', e); process.exit(1); });
