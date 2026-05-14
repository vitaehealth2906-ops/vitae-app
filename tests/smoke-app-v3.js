// Smoke test do app paciente consolidado (app-v3/app.html)
// Roda: navegação básica, cadastro real, mudança de tela

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP_URL = 'http://localhost:3000/app.html';
const SHOTS_DIR = path.join(__dirname, 'shots', 'app-v3');

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 500, height: 950 } });
  const page = await ctx.newPage();

  const log = [];
  function step(name, ok, detail) {
    const status = ok ? 'OK' : 'FAIL';
    log.push({ name, status, detail: detail || '' });
    console.log(`[${status}] ${name}${detail ? ' · ' + detail : ''}`);
  }

  page.on('console', (msg) => {
    if (msg.type() === 'error') console.log('  [console error]', msg.text());
  });
  page.on('pageerror', (err) => console.log('  [page error]', err.message));

  try {
    // 1. Abrir app (splash)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: path.join(SHOTS_DIR, '01-splash.png'), fullPage: true });
    const title = await page.title();
    step('Abrir app', title.includes('vita id'), `title: ${title}`);

    // 1.5 Confirmar splash tem logo VISÍVEL dentro do phone frame
    const splashLogoBox = await page.locator('.view.active svg').first().boundingBox().catch(() => null);
    const phoneBox = await page.locator('.phone').boundingBox();
    let logoDentro = false;
    if (splashLogoBox && phoneBox) {
      logoDentro = splashLogoBox.x >= phoneBox.x - 5 &&
                   splashLogoBox.x + splashLogoBox.width <= phoneBox.x + phoneBox.width + 5 &&
                   splashLogoBox.y >= phoneBox.y - 5;
    }
    step('Splash logo dentro do phone frame', logoDentro, splashLogoBox ? `logo@(${splashLogoBox.x.toFixed(0)},${splashLogoBox.y.toFixed(0)}) frame@(${phoneBox.x.toFixed(0)},${phoneBox.y.toFixed(0)})` : 'sem logo encontrado');

    // 2. Confirmar API URL
    const apiUrl = await page.evaluate(() => window.API_URL || 'NÃO_DEFINIDO');
    step('API_URL detectada', apiUrl.includes('railway'), apiUrl);

    // 3. Pular pra cadastro via hash
    await page.evaluate(() => { window.location.hash = '#cadastro'; });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(SHOTS_DIR, '02-cadastro.png') });
    const naoCadastro = await page.$('.view.active[data-view="cadastro"]');
    step('Navegar pra cadastro', !!naoCadastro);

    // 4. Tentar clicar no botão Google em dev (deve mostrar mensagem amigável, não tela vermelha)
    const botaoGoogle = await page.$('button:has-text("Continuar com Google")');
    if (botaoGoogle) {
      await botaoGoogle.click();
      await page.waitForTimeout(800);
      const erroVisivel = await page.$eval('#t-cadastro-errorMsg, [id*="errorMsg"]', el => el && el.offsetParent !== null ? el.innerText : null).catch(() => null);
      step('Google em dev mostra mensagem amigável', erroVisivel && erroVisivel.includes('só funciona em produção'), erroVisivel?.slice(0, 80));
    } else {
      step('Botão Google encontrado', false, 'não encontrado');
    }

    // 5. Preencher form de cadastro com email REAL único
    const sufixo = Date.now();
    const dados = {
      nome: 'Teste Playwright ' + sufixo,
      celular: '(11) 9' + String(sufixo).slice(-4) + '-' + String(sufixo).slice(-4),
      email: `playwright-${sufixo}@vitae-test.com`,
      senha: 'TesteSenha123!'
    };

    await page.fill('#t-cadastro-nome', dados.nome);
    await page.fill('#t-cadastro-celular', dados.celular);
    await page.fill('#t-cadastro-email', dados.email);
    await page.fill('#t-cadastro-passInput', dados.senha);

    // Aceitar termos
    await page.click('#t-cadastro-termsCheck');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(SHOTS_DIR, '03-preenchido.png') });
    step('Form preenchido', true, `email: ${dados.email}`);

    // 6. Submeter
    await page.click('#t-cadastro-btnCreate');
    await page.waitForTimeout(4000); // espera fetch real pro Railway
    await page.screenshot({ path: path.join(SHOTS_DIR, '04-pos-submit.png') });

    const errorVisivel = await page.$eval('#t-cadastro-errorMsg', el => el && el.style.display !== 'none' ? el.innerText : null).catch(() => null);
    const viewAtual = await page.evaluate(() => window.STATE && window.STATE.view);

    if (errorVisivel) {
      step('Cadastro completou', false, `erro: ${errorVisivel.slice(0, 100)}`);
    } else {
      step('Cadastro completou', !!(viewAtual && viewAtual !== 'cadastro'), `view atual: ${viewAtual}`);
    }

    // 6.5 Após cadastro: tela ativa precisa ter conteúdo VISÍVEL (não pode estar em branco)
    const conteudoApos = await page.evaluate(() => {
      const v = document.querySelector('.view.active');
      if (!v) return { temConteudo: false, viewName: 'nenhuma' };
      const text = v.innerText.trim();
      const hasContent = text.length > 20;
      return { temConteudo: hasContent, viewName: v.getAttribute('data-view'), preview: text.slice(0, 80) };
    });
    await page.screenshot({ path: path.join(SHOTS_DIR, '05-pos-cadastro.png'), fullPage: true });
    step('Tela pós-cadastro tem conteúdo visível', conteudoApos.temConteudo, `${conteudoApos.viewName}: "${conteudoApos.preview}"`);

    // 7. Verificar token salvo
    const token = await page.evaluate(() => localStorage.getItem('vitae_token'));
    step('Token salvo no localStorage', !!token && token.length > 10, token ? token.slice(0, 20) + '...' : 'null');

    // 8. Confirmar usuário criado lendo do localStorage
    const usuario = await page.evaluate(() => {
      const u = localStorage.getItem('vitae_usuario');
      return u ? JSON.parse(u) : null;
    });
    if (usuario) {
      step('Usuário salvo', usuario.email === dados.email, `${usuario.nome} · ${usuario.email}`);
    } else {
      step('Usuário salvo', false, 'localStorage.vitae_usuario está null');
    }

  } catch (e) {
    step('ERRO FATAL', false, e.message);
    await page.screenshot({ path: path.join(SHOTS_DIR, 'erro-fatal.png') });
  }

  fs.writeFileSync(path.join(SHOTS_DIR, 'log.json'), JSON.stringify(log, null, 2));
  console.log('\n=== RESUMO ===');
  console.log(`OK: ${log.filter(l => l.status === 'OK').length}/${log.length}`);
  console.log(`FAIL: ${log.filter(l => l.status === 'FAIL').length}`);
  console.log(`Screenshots em: ${SHOTS_DIR}`);

  await browser.close();
})();
