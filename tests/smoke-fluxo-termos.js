// Smoke test do novo fluxo de termos (26-cadastro -> 27-consentimento -> onboarding).
// Roda contra o serve.js local (http://localhost:3000) com Edge.
// Mocka a API (:3002) e o login via localStorage. NAO toca producao.
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const results = [];
function check(name, cond, extra) { results.push({ name, ok: !!cond, extra: extra || '' }); console.log((cond ? 'PASS ' : 'FALHA') + ' · ' + name + (extra ? ' — ' + extra : '')); }

async function mockApi(ctx, counters) {
  await ctx.route('**', async (route) => {
    const req = route.request();
    const url = req.url();
    const m = req.method();
    const isApi = url.includes(':3002') || /\/(perfil|consentimento)(\/flags-app)?(\?|$)/.test(url);
    if (!isApi) return route.continue();
    const path = url.split('?')[0];
    let body = {};
    if (path.includes('/perfil/flags-app')) {
      if (m === 'POST') { counters.setFlags++; body = { ok: true }; }
      else { body = {}; }                       // sem flags = mostra a tela
    } else if (/\/perfil(\?|$)/.test(path)) {
      body = { perfil: {} };                     // perfil vazio => vai pra tela de termos
    } else if (path.includes('/consentimento')) {
      counters.consent++; body = { ok: true, consentimento: { id: 'mock' } };
    } else { body = { ok: true }; }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    // ---------- TESTE 1: cadastro logado + perfil vazio -> tela de termos ----------
    const counters = { consent: 0, setFlags: 0 };
    const ctx = await browser.newContext({ serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      localStorage.setItem('vitae_token', 'tok-smoke');
      localStorage.setItem('vitae_usuario', JSON.stringify({ id: 'u1', nome: 'Teste', tipo: 'PACIENTE' }));
      ['vitae_termos_aceitos','vitae_onb_quiz_visto','vitae_quiz_retorno','vitae_convite_empresa','vitae_quiz_completo'].forEach(k => localStorage.removeItem(k));
    });
    await mockApi(ctx, counters);
    const page = await ctx.newPage();
    const erros = [];
    page.on('pageerror', e => erros.push(String(e)));

    // retry de conexao (serve.js pode estar subindo)
    let ok = false;
    for (let i = 0; i < 15 && !ok; i++) {
      try { await page.goto(BASE + '/app-v3/26-cadastro.html', { waitUntil: 'domcontentloaded', timeout: 4000 }); ok = true; }
      catch (_) { await page.waitForTimeout(1000); }
    }
    if (!ok) throw new Error('serve.js nao respondeu em http://localhost:3000');

    await page.waitForURL('**/27-consentimento.html', { timeout: 8000 }).catch(()=>{});
    check('Cadastro logado (perfil vazio) redireciona para a tela de Termos (27)', page.url().includes('27-consentimento.html'), page.url());

    // ---------- TESTE 2: scroll-gate + aceite ----------
    await page.waitForSelector('#box', { timeout: 6000 }).catch(()=>{});
    const btnTxt0 = await page.textContent('#btn').catch(()=>'');
    check('Botao comeca travado ("Leia ate o fim")', /Leia até o fim/i.test(btnTxt0 || ''), btnTxt0);

    // rola a caixa ate o fim
    await page.$eval('#box', el => { el.scrollTop = el.scrollHeight; el.dispatchEvent(new Event('scroll')); });
    await page.waitForTimeout(300);
    const btnTxt1 = await page.textContent('#btn').catch(()=>'');
    check('Apos rolar ate o fim, pede a autorizacao de saude', /autorização de saúde/i.test(btnTxt1 || ''), btnTxt1);

    // marca a saude (obrigatoria)
    await page.click('#rowHealth');
    await page.waitForTimeout(150);
    const btnTxt2 = await page.textContent('#btn').catch(()=>'');
    const btnOn = await page.$eval('#btn', el => el.classList.contains('on')).catch(()=>false);
    check('Apos marcar saude, botao libera ("Aceitar e continuar")', btnOn && /Aceitar e continuar/i.test(btnTxt2 || ''), btnTxt2);

    // aceita
    await page.click('#btn');
    await page.waitForURL('**/28-onboarding.html', { timeout: 8000 }).catch(()=>{});
    check('Ao aceitar, grava consentimento (4 chamadas)', counters.consent >= 4, 'consent=' + counters.consent);
    check('Ao aceitar, grava a flag (setFlagsApp)', counters.setFlags >= 1, 'setFlags=' + counters.setFlags);
    check('Ao aceitar, segue para o onboarding (28)', page.url().includes('28-onboarding.html'), page.url());
    check('Tela de termos sem erro de JS', erros.length === 0, erros.join(' | '));
    await ctx.close();

    // ---------- TESTE 3: 26-cadastro deslogado nao tem mais a caixinha ----------
    const ctx2 = await browser.newContext({ serviceWorkers: 'block' });
    const p2 = await ctx2.newPage();
    const erros2 = [];
    p2.on('pageerror', e => erros2.push(String(e)));
    await p2.goto(BASE + '/app-v3/26-cadastro.html', { waitUntil: 'domcontentloaded', timeout: 8000 });
    await p2.waitForTimeout(400);
    const temCaixinha = await p2.$('.terms-check');
    check('Caixinha de termos REMOVIDA do cadastro', !temCaixinha);
    const html = await p2.content();
    check('Cadastro tem o flag FLUXO_TERMOS_V2 + aponta pra tela 27', html.includes('FLUXO_TERMOS_V2') && html.includes('27-consentimento.html'));
    check('Cadastro sem erro de JS', erros2.length === 0, erros2.join(' | '));
    await ctx2.close();

  } catch (e) {
    check('Execucao do smoke', false, e.message);
  } finally {
    await browser.close();
  }

  const fail = results.filter(r => !r.ok);
  console.log('\n==== RESULTADO: ' + (results.length - fail.length) + '/' + results.length + ' ====');
  process.exit(fail.length === 0 ? 0 : 1);
})();
