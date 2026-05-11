/* Reproduz o bug do "Recurso não encontrado" no passo 5 do quiz médico.
   Intercepta TODAS as requests pra descobrir qual está dando 404. */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  // Intercepta TUDO
  page.on('response', async resp => {
    const status = resp.status();
    if (status >= 400) {
      const body = await resp.text().catch(() => '');
      console.log('🔴 RESP ' + status + ' ' + resp.request().method() + ' ' + resp.url() + (body ? ' → ' + body.slice(0, 200) : ''));
    }
  });
  page.on('requestfailed', req => {
    console.log('🟠 FAIL ' + req.method() + ' ' + req.url() + ' → ' + req.failure().errorText);
  });
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && t.includes('404')) {
      console.log('💬 CONSOLE: ' + t.slice(0, 250));
      // Tenta extrair URL do error
      m.args().forEach(async (a, i) => {
        try { const v = await a.jsonValue().catch(() => null); if (v) console.log('   arg[' + i + ']: ' + JSON.stringify(v).slice(0, 250)); } catch(e){}
      });
    }
  });
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warn') {
      console.log('[' + m.type() + ']', m.text().slice(0, 200));
    }
  });

  const RAND = Math.floor(Math.random() * 1e9);
  const MED = {
    nome: 'Dr Debug ' + RAND,
    email: 'med-debug-' + RAND + '@vitae-debug.local',
    celular: '11998' + Math.floor(100000 + Math.random() * 899999),
    senha: 'TesteSenha123!',
  };
  console.log('Cadastrando: ' + MED.email);

  await page.goto('https://vitae-app.vercel.app/desktop/02-cadastro.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.fill('#nome', MED.nome);
  await page.fill('#email', MED.email);
  await page.fill('#celular', MED.celular);
  await page.fill('#senha', MED.senha);
  await page.fill('#senha2', MED.senha);
  await page.check('#aceite');
  await page.click('#btn');
  await page.waitForURL(/03-quiz-medico/, { timeout: 30000 });
  await page.waitForTimeout(2000);

  console.log('\n=== Passo 1: Identidade ===');
  await page.selectOption('#uf', 'SP');
  await page.fill('#crm', '99' + RAND.toString().slice(-4));
  await page.fill('#esp', 'Clinica Geral');
  await page.click('text=Avançar');
  await page.waitForTimeout(800);

  console.log('=== Passo 2: pula ===');
  await page.click('text=Pular este passo');
  await page.waitForTimeout(800);

  console.log('=== Passo 3: Onde atende ===');
  await page.fill('#clinica', 'Consultório Teste').catch(() => {});
  await page.fill('#endereco', 'Rua Teste 100').catch(() => {});
  await page.fill('#tel', '1133331234').catch(() => {});
  await page.click('text=Avançar');
  await page.waitForTimeout(800);

  console.log('=== Passo 4: Consulta ===');
  await page.fill('#valor', '300').catch(() => {});
  await page.click('text=Avançar');
  await page.waitForTimeout(800);

  console.log('=== Passo 5: Toque final ===');
  await page.fill('#msgWpp', 'ola meu nome e tiozedu').catch(() => {});
  await page.screenshot({ path: 'd:/vitae-app-novo/tests/shots/debug-quiz-passo5-antes.png', fullPage: true });

  // Limpa requests pra capturar SÓ o que acontece no Salvar
  console.log('\n--- Clicando "Salvar e continuar" ---');
  const reqsBefore = requests.length;
  await page.click('text=Salvar e continuar');
  await page.waitForTimeout(8000);
  await page.screenshot({ path: 'd:/vitae-app-novo/tests/shots/debug-quiz-passo5-depois.png', fullPage: true });

  console.log('\n=== REQUESTS DURANTE O SALVAR ===');
  requests.slice(reqsBefore).forEach((r, i) => {
    if (r.phase === 'response') {
      console.log(`${r.status} ${r.method} ${r.url}`);
      if (r.body) console.log('   body: ' + r.body);
    }
  });

  // Verifica se erro está visível
  const erroVisivel = await page.locator('text=/Recurso não encontrado/').count();
  console.log('\n=== ESTADO DA TELA ===');
  console.log('Erro "Recurso não encontrado" visível: ' + (erroVisivel > 0 ? 'SIM (BUG REPRODUZIDO)' : 'não'));

  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
