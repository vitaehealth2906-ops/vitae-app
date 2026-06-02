// Teste de NAVEGACAO (Playwright) da Fundacao B2B contra producao. Dados TESTE-B2B.
const { chromium } = require('playwright');
const API = 'https://vitae-app-production.up.railway.app';
const APP = 'https://vitae-app.vercel.app/app-v3';
const ts = Date.now();
const cel = () => '+5511' + Math.floor(100000000 + Math.random() * 900000000);
const results = [];
const check = (n, ok, x = '') => { results.push({ n, ok: !!ok }); console.log((ok ? 'PASS ' : 'FALHA') + ' | ' + n + (x ? '  -> ' + x : '')); };
async function api(method, path, { token, body } = {}) {
  const h = { 'Content-Type': 'application/json' }; if (token) h['Authorization'] = 'Bearer ' + token;
  const r = await fetch(API + path, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) {}
  return { status: r.status, json: j };
}

(async () => {
  const donoEmail = `teste-b2b-ui-dono-${ts}@vitae-test.com`;
  let r = await api('POST', '/auth/cadastro', { body: { nome: 'TESTE-B2B UI Dono', email: donoEmail, celular: cel(), senha: 'senha12345', tipo: 'EMPRESA' } });
  const donoToken = r.json?.token, donoUser = r.json?.usuario;
  if (!donoToken) { console.error('Nao criou dono via API:', r.status, r.json); process.exit(1); }

  const browser = await chromium.launch({ headless: true });
  const opts = { serviceWorkers: 'block' };

  // ===== DONO (logado via localStorage) =====
  const ctxDono = await browser.newContext(opts);
  await ctxDono.addInitScript(([t, u]) => {
    localStorage.setItem('vitae_token', t);
    localStorage.setItem('vitae_usuario', u);
  }, [donoToken, JSON.stringify(donoUser)]);
  const pDono = await ctxDono.newPage();

  await pDono.goto(APP + '/empresa-painel.html', { waitUntil: 'domcontentloaded' });
  let okCriar = false; try { await pDono.waitForSelector('#criarView:not(.hidden)', { timeout: 20000 }); okCriar = true; } catch (_) {}
  check('T2.1a Painel abre no estado "criar empresa" (dono novo, sem redirect pro login)', okCriar, 'url=' + pDono.url());

  const empNome = `TESTE-B2B UI Empresa ${ts}`;
  let okPainel = false, nomeMostrado = '';
  if (okCriar) {
    await pDono.fill('#inpNome', empNome);
    await pDono.click('#btnCriar');
    try { await pDono.waitForSelector('#painelView:not(.hidden)', { timeout: 20000 }); nomeMostrado = (await pDono.textContent('#empNome'))?.trim(); okPainel = nomeMostrado === empNome; } catch (_) {}
  }
  check('T2.1b Dono CRIA a empresa pela tela e ve o painel', okPainel, 'nome=' + nomeMostrado);

  let link = '';
  if (okPainel) {
    await pDono.click('#btnGerar');
    try { await pDono.waitForSelector('#linkArea:not(.hidden)', { timeout: 20000 }); link = await pDono.inputValue('#linkInp'); } catch (_) {}
  }
  check('T2.2 Dono GERA o link de convite pela tela', /convite\.html\?c=[a-f0-9]+/.test(link), 'link=' + link);

  // ===== FUNCIONARIO (navegador limpo) =====
  let okConvite = false, chipNome = '';
  if (link) {
    const ctxF = await browser.newContext(opts);
    const pF = await ctxF.newPage();
    await pF.goto(link, { waitUntil: 'domcontentloaded' });
    try { await pF.waitForSelector('#okView:not(.hidden)', { timeout: 20000 }); chipNome = (await pF.textContent('#chipNome'))?.trim(); okConvite = chipNome === empNome; } catch (_) {}
    check('T2.3 Funcionario abre o link e ve o NOME CERTO da empresa', okConvite, 'chip=' + chipNome);

    let okWire = false, urlAfter = '', tokenStored = '';
    if (okConvite) {
      await pF.click('#btnAtivar');
      try { await pF.waitForURL(/26-cadastro\.html/, { timeout: 20000 }); urlAfter = pF.url(); tokenStored = await pF.evaluate(() => localStorage.getItem('vitae_convite_empresa')); okWire = /26-cadastro/.test(urlAfter) && !!tokenStored; } catch (_) {}
    }
    check('T2.4 "Ativar" guarda o convite e leva pro cadastro real', okWire, 'cadastro=' + /26-cadastro/.test(urlAfter) + ' token_guardado=' + !!tokenStored);
  } else {
    check('T2.3 Funcionario abre o link e ve o NOME CERTO da empresa', false, 'sem link');
    check('T2.4 "Ativar" guarda o convite e leva pro cadastro real', false, 'sem link');
  }

  // ===== Convite invalido =====
  const ctxBad = await browser.newContext(opts);
  const pBad = await ctxBad.newPage();
  await pBad.goto(APP + '/convite.html?c=token-invalido-' + ts, { waitUntil: 'domcontentloaded' });
  let okBad = false, badTitle = '';
  try { await pBad.waitForSelector('#badView:not(.hidden)', { timeout: 20000 }); badTitle = (await pBad.textContent('#badTitle'))?.trim(); okBad = true; } catch (_) {}
  check('T2.5 Convite invalido mostra mensagem amigavel (nao quebra a tela)', okBad, 'titulo=' + badTitle);

  await browser.close();
  const pass = results.filter(x => x.ok).length;
  console.log(`\n=== ${pass}/${results.length} checagens de navegacao passaram ===`);
  console.log('DADO DE TESTE UI:', donoEmail, '| empresa:', empNome);
})().catch(e => { console.error('ERRO FATAL UI:', e); process.exit(1); });
