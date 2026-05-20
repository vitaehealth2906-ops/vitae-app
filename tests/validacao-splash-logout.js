/* Valida os 2 fixes da sessao 20/05/2026:
   1. Splash: logo gradient #00E5A0->#00B4D8 + tagline "Sua saude, sempre com voce"
   2. Splash sem login: redireciona pra 23-login.html (nao 03-cadastro.html)
   3. vitaeAPI.logout(): limpa tokens e manda pra 23-login.html
*/
const { chromium } = require('playwright');
const fs = require('fs');

const SHOTS = 'd:/vitae-app-novo/tests/shots/fix-splash-logout';
fs.mkdirSync(SHOTS, { recursive: true });

const SPLASH = 'file:///d:/vitae-app-novo/app-v3/20-splash.html';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  // Cada navegacao comeca limpa
  await page.addInitScript(() => { try { localStorage.clear(); } catch(e){} });

  // Intercepta redirects pra capturar destino sem realmente navegar
  let fase = 'splash-anonima';
  let splashDestino = null;
  let logoutDestino = null;
  let outras = [];

  const captura = async (route) => {
    const url = route.request().url();
    const file = url.split('/').pop().split('?')[0];
    if (fase === 'splash-anonima') splashDestino = file;
    else if (fase === 'logout') logoutDestino = file;
    else outras.push(file);
    return route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>stub</title>' });
  };

  await page.route('**/23-login.html*', captura);
  await page.route('**/03-cadastro.html*', captura);
  await page.route('**/01-saude.html*', captura);
  await page.route('**/28-onboarding.html*', captura);
  await page.route('**/30-quiz.html*', captura);

  const erros = [];
  page.on('pageerror', e => erros.push(e.message));

  // ========== TESTE 1: SPLASH (logo + frase) ==========
  console.log('\n=========================================');
  console.log('TESTE 1: SPLASH (visual + DOM)');
  console.log('=========================================');
  await page.goto(SPLASH, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1300); // antes do redirect (1.5s+)

  await page.screenshot({ path: SHOTS + '/01-splash-renderizada.png' });

  const info = await page.evaluate(() => {
    const stops = document.querySelectorAll('#vGrad stop');
    return {
      grad1: stops[0]?.getAttribute('stop-color') || null,
      grad2: stops[1]?.getAttribute('stop-color') || null,
      tagline: document.querySelector('.tagline')?.textContent.trim() || null,
    };
  });

  const okGrad1 = info.grad1 === '#00E5A0';
  const okGrad2 = info.grad2 === '#00B4D8';
  const okTag = info.tagline === 'Sua saúde, sempre com você';

  console.log('  Logo (gradiente do quadrado "id"):');
  console.log('    Cor 1: ' + info.grad1 + '  ' + (okGrad1 ? 'OK (verde novo)' : 'FALHA (deveria ser #00E5A0)'));
  console.log('    Cor 2: ' + info.grad2 + '  ' + (okGrad2 ? 'OK (ciano)' : 'FALHA (deveria ser #00B4D8)'));
  console.log('  Tagline:');
  console.log('    "' + info.tagline + '"  ' + (okTag ? 'OK' : 'FALHA (deveria ser "Sua saude, sempre com voce")'));

  // ========== TESTE 2: SPLASH sem login -> 23-login.html ==========
  console.log('\n=========================================');
  console.log('TESTE 2: Splash sem login redireciona pra 23-login.html');
  console.log('=========================================');
  // Espera o setTimeout de 2200ms do splash disparar window.location.href
  await page.waitForTimeout(1500);

  const okSplashDest = splashDestino === '23-login.html';
  console.log('  Splash redirecionou pra: ' + (splashDestino || '(nenhum)'));
  console.log('  ' + (okSplashDest ? 'OK (caminho novo)' : 'FALHA — esperado 23-login.html'));

  // ========== TESTE 3: vitaeAPI.logout() ==========
  console.log('\n=========================================');
  console.log('TESTE 3: vitaeAPI.logout() limpa tokens e vai pra 23-login.html');
  console.log('=========================================');
  fase = 'pre-logout'; // descartar outras navegacoes que ocorrerem
  await page.goto(SPLASH, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(400);

  // Coloca tokens fake (simula paciente logado), depois chama logout
  await page.evaluate(() => {
    localStorage.setItem('vitae_token', 'fake-jwt-test');
    localStorage.setItem('vitae_refresh_token', 'fake-refresh-test');
    localStorage.setItem('vitae_usuario', '{"id":"x","nome":"Teste"}');
  });

  // Confere que vitaeAPI existe e tokens foram setados
  const antes = await page.evaluate(() => ({
    hasApi: typeof window.vitaeAPI?.logout === 'function',
    token: localStorage.getItem('vitae_token'),
    refresh: localStorage.getItem('vitae_refresh_token'),
    usuario: localStorage.getItem('vitae_usuario'),
  }));
  console.log('  Antes do logout:');
  console.log('    vitaeAPI.logout existe?  ' + (antes.hasApi ? 'sim' : 'NAO'));
  console.log('    vitae_token:             ' + antes.token);
  console.log('    vitae_refresh_token:     ' + antes.refresh);
  console.log('    vitae_usuario:           ' + antes.usuario);

  fase = 'logout';
  await page.evaluate(() => { window.vitaeAPI.logout(); });
  await page.waitForTimeout(500);

  // Tokens devem ter sido removidos (mas pode ter navegado pra stub)
  const depois = await page.evaluate(() => ({
    token: localStorage.getItem('vitae_token'),
    refresh: localStorage.getItem('vitae_refresh_token'),
    usuario: localStorage.getItem('vitae_usuario'),
  })).catch(() => ({ token: '?', refresh: '?', usuario: '?' }));

  const okTok = depois.token === null;
  const okRef = depois.refresh === null;
  const okUsr = depois.usuario === null;
  const okLogoutDest = logoutDestino === '23-login.html';

  console.log('  Apos chamar vitaeAPI.logout():');
  console.log('    vitae_token:         ' + (okTok ? 'removido OK' : 'FALHA: ' + depois.token));
  console.log('    vitae_refresh_token: ' + (okRef ? 'removido OK' : 'FALHA: ' + depois.refresh));
  console.log('    vitae_usuario:       ' + (okUsr ? 'removido OK' : 'FALHA: ' + depois.usuario));
  console.log('    Destino do redirect: ' + (logoutDestino || '(nenhum)'));
  console.log('    ' + (okLogoutDest ? 'OK (caminho correto)' : 'FALHA — esperado 23-login.html'));

  await browser.close();

  // ========== RESUMO ==========
  console.log('\n=========================================');
  console.log('RESUMO');
  console.log('=========================================');
  const checks = [
    ['Splash logo gradient #00E5A0',         okGrad1],
    ['Splash logo gradient #00B4D8',         okGrad2],
    ['Splash tagline nova',                  okTag],
    ['Splash anonima -> 23-login.html',      okSplashDest],
    ['Logout limpa vitae_token',             okTok],
    ['Logout limpa vitae_refresh_token',     okRef],
    ['Logout limpa vitae_usuario',           okUsr],
    ['Logout -> 23-login.html',              okLogoutDest],
  ];
  const ok = checks.filter(c => c[1]).length;
  const total = checks.length;
  checks.forEach(([nome, passou]) => {
    console.log('  ' + (passou ? '[OK]   ' : '[FALHA]') + ' ' + nome);
  });
  console.log('\n  ' + ok + '/' + total + ' verificacoes passaram');

  if (erros.length) {
    console.log('\nPage errors:');
    erros.forEach(e => console.log('  ! ' + e));
  }

  console.log('\nScreenshot: ' + SHOTS + '/01-splash-renderizada.png');

  if (ok !== total) {
    process.exit(1);
  }
})().catch(e => { console.error('FATAL:', e.message); console.error(e.stack); process.exit(1); });
