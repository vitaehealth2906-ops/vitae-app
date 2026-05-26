/**
 * Paciente fantasma — robo que faz o cadastro inteiro do app-v3 e cronometra
 * o salvar da foto no ultimo passo do quiz.
 *
 * Uso:
 *   node tests/_paciente-fantasma.js                 # rede normal
 *   node tests/_paciente-fantasma.js --net=slow      # 3G lento
 *   node tests/_paciente-fantasma.js --net=fast4g    # 4G medio
 *   node tests/_paciente-fantasma.js --headed        # mostra navegador
 *
 * Pre-requisito: rodar `node tests/_servir-local.js` em outro terminal.
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const NET = (args.find(a => a.startsWith('--net=')) || '--net=normal').split('=')[1];

const BASE = 'http://localhost:3000';
const FOTO_PATH = path.resolve(__dirname, 'fixtures/paciente-foto.jpg');
const TIMESTAMP = Date.now();
const EMAIL_TESTE = `robo-teste-${TIMESTAMP}@vitae-teste.local`;
const CELULAR_TESTE = '+5511' + String(900000000 + Math.floor(Math.random()*99999999)).slice(0,9);
const SENHA_TESTE = 'TesteRobo2026!';
const SCREENSHOT_DIR = path.resolve(__dirname, '_screenshots-fantasma');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

// CPF valido pra teste (algoritmo classico)
function gerarCPF() {
  const rnd = () => Math.floor(Math.random()*9);
  const d = Array.from({length:9}, rnd);
  let s = 0; for (let i=0;i<9;i++) s += d[i]*(10-i);
  let dv1 = 11 - (s%11); if (dv1>=10) dv1=0;
  d.push(dv1);
  s = 0; for (let i=0;i<10;i++) s += d[i]*(11-i);
  let dv2 = 11 - (s%11); if (dv2>=10) dv2=0;
  d.push(dv2);
  return d.join('');
}
const CPF_TESTE = gerarCPF();

// Configuracao de rede por cenario
const NET_PROFILES = {
  normal:  null, // sem throttle
  fast4g:  { downloadThroughput: 4*1024*1024/8, uploadThroughput: 3*1024*1024/8, latency: 20 },
  slow:    { downloadThroughput: 400*1024/8,    uploadThroughput: 400*1024/8,    latency: 400 },
};

async function executar() {
  console.log('═════════════════════════════════════════════════════════');
  console.log('PACIENTE FANTASMA — Quiz vita id');
  console.log('═════════════════════════════════════════════════════════');
  console.log('Rede:    ', NET);
  console.log('Email:   ', EMAIL_TESTE);
  console.log('Celular: ', CELULAR_TESTE);
  console.log('CPF:     ', CPF_TESTE);
  console.log('Foto:    ', FOTO_PATH, '(' + fs.statSync(FOTO_PATH).size + ' bytes)');
  console.log('---------------------------------------------------------');

  const browser = await chromium.launch({ headless: !HEADED });
  const ctx = await browser.newContext({
    viewport: { width: 414, height: 900 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  });
  const page = await ctx.newPage();

  // Throttle de rede se aplicavel
  if (NET_PROFILES[NET]) {
    const client = await ctx.newCDPSession(page);
    await client.send('Network.emulateNetworkConditions', { offline: false, ...NET_PROFILES[NET] });
    console.log('[NET] throttle aplicado:', NET_PROFILES[NET]);
  }

  // Pre-config: pular onboarding logo
  await page.addInitScript(() => {
    localStorage.setItem('vitae_onb_quiz_visto', '1');
    localStorage.setItem('vitae_tipo_escolhido', 'PACIENTE');
  });

  // Captura console e erros pra reportar
  const consoleMsgs = [];
  const pageErrors = [];
  const failedReqs = [];
  const networkOps = [];
  page.on('console', m => consoleMsgs.push({ type: m.type(), text: m.text() }));
  page.on('pageerror', e => pageErrors.push({ message: e.message }));
  page.on('requestfailed', r => failedReqs.push({ url: r.url(), reason: r.failure()?.errorText }));
  page.on('response', r => {
    if (r.url().includes('/perfil') || r.url().includes('/auth') || r.url().includes('cloudinary')) {
      networkOps.push({ url: r.url(), status: r.status(), method: r.request().method() });
    }
  });

  const metricas = { passos: {}, tempoTotal: 0 };

  try {
    // ====== PASSO 1: Cadastro ======
    console.log('\n[1/3] Abrindo tela de cadastro...');
    const t0 = Date.now();
    await page.goto(`${BASE}/app-v3/26-cadastro.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('.field-input', { timeout: 10000 });

    const inputs = await page.locator('.field-input').all();
    await inputs[0].fill('Maria Teste Robo');
    // celular: o app formata, precisa digitar so digitos
    await inputs[1].fill(CELULAR_TESTE.replace('+55',''));
    await inputs[2].fill(EMAIL_TESTE);
    await page.locator('#passInput').fill(SENHA_TESTE);
    await page.locator('#termsCheck').click();
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-cadastro-preenchido.png') });

    await page.locator('#btnCreate').click();
    metricas.passos.cadastro = Date.now() - t0;
    console.log(`  Cadastro OK (${metricas.passos.cadastro}ms)`);

    // ====== PASSO 2: Quiz inteiro ate o passo da foto ======
    console.log('\n[2/3] Esperando quiz aparecer...');
    await page.waitForURL(/30-quiz\.html|28-onboarding\.html/, { timeout: 15000 });

    // Se caiu no onboarding (mesmo com flag), pula
    if (page.url().includes('28-onboarding')) {
      console.log('  Caiu no onboarding — pulando manualmente...');
      await page.evaluate(() => {
        localStorage.setItem('vitae_onb_quiz_visto', '1');
        window.location.href = '30-quiz.html';
      });
      await page.waitForURL(/30-quiz\.html/, { timeout: 15000 });
    }

    await page.waitForSelector('#step0.active', { timeout: 10000 });
    const tQuizStart = Date.now();

    // ====== STEP 0: Dados basicos ======
    console.log('  Step 0 — dados basicos...');
    // Sexo (picker modal)
    await page.locator('#sexoField').click();
    await page.waitForSelector('#pickerOverlay.active', { timeout: 5000 });
    await page.locator('.picker-option', { hasText: 'Feminino' }).first().click();
    await page.waitForFunction(() => !document.getElementById('pickerOverlay').classList.contains('active'), null, { timeout: 5000 });

    // Data de nascimento — digita direto no input texto
    await page.locator('#nascimentoInput').fill('15/03/1990');
    await page.locator('#alturaInput').fill('165');
    await page.locator('#pesoInput').fill('60');
    await page.locator('#cpfInput').fill(CPF_TESTE);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-step0-preenchido.png') });

    // Click proximo
    await page.locator('#step0 .btn-next').click();
    await page.waitForSelector('#step1.active', { timeout: 5000 });

    // ====== STEP 1: Saude geral (tipo sanguineo + plano sao obrigatorios) ======
    console.log('  Step 1 — tipo sanguineo + plano...');
    await page.locator('#tipoSangueField').click();
    await page.waitForSelector('#pickerOverlay.active', { timeout: 5000 });
    await page.locator('.picker-option', { hasText: /^O\+$/ }).first().click();
    await page.waitForFunction(() => !document.getElementById('pickerOverlay').classList.contains('active'), null, { timeout: 5000 });

    await page.locator('#planoField').click();
    await page.waitForSelector('#pickerOverlay.active', { timeout: 5000 });
    await page.locator('.picker-option', { hasText: /^SUS$/ }).first().click();
    await page.waitForFunction(() => !document.getElementById('pickerOverlay').classList.contains('active'), null, { timeout: 5000 });

    await page.locator('#step1 .btn-next').click();
    await page.waitForSelector('#step2.active', { timeout: 5000 });

    // ====== STEP 2: Contato emergencia ======
    console.log('  Step 2 — contato emergencia...');
    await page.locator('#emergenciaNome').fill('Joao Teste');
    await page.locator('#emergenciaTel').fill('11999998888');
    await page.locator('#step2 .btn-next').click();
    await page.waitForSelector('#step3.active', { timeout: 5000 });

    // ====== STEPS 3-5: pular vazio (opcionais) ======
    for (let s of [3,4,5]) {
      console.log(`  Step ${s} — proximo vazio...`);
      await page.locator(`#step${s} .btn-next`).first().click();
      await page.waitForSelector(`#step${s+1}.active`, { timeout: 5000 });
    }

    metricas.passos.preencherQuiz = Date.now() - tQuizStart;
    console.log(`  Quiz preenchido ate foto (${metricas.passos.preencherQuiz}ms)`);

    // ====== STEP 6: Foto ======
    console.log('\n[3/3] Step 6 — upload foto + CRONOMETRO clique-redirect...');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-step6-antes-foto.png') });

    // Upload foto via input hidden
    await page.locator('#fotoGaleria').setInputFiles(FOTO_PATH);
    // Espera o preview aparecer (handleFotoSelect e async via FileReader)
    await page.waitForSelector('#fotoPreview[src^="data:"]', { timeout: 10000 });
    await page.waitForFunction(() => !document.getElementById('btnConcluir').disabled, null, { timeout: 5000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-step6-com-foto.png') });

    // ===== CRONOMETRO START =====
    const tClick = Date.now();
    await page.locator('#btnConcluir').click();

    // Captura estado do botao logo apos o clique (50ms depois) — deve estar "Salvando..."
    await page.waitForTimeout(50);
    const estadoBotao = await page.evaluate(() => {
      const btn = document.getElementById('btnConcluir');
      return btn ? {
        disabled: btn.disabled,
        text: btn.textContent,
        opacity: btn.style.opacity,
        cursor: btn.style.cursor,
      } : null;
    });
    console.log(`  Botao apos clique: disabled=${estadoBotao.disabled} text="${estadoBotao.text}" opacity=${estadoBotao.opacity}`);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04b-botao-salvando.png'), fullPage: false });

    // Tenta clicar mais 3 vezes (testa anti duplo-clique)
    const cliquesIgnorados = await page.evaluate(() => {
      let ignorados = 0;
      const btn = document.getElementById('btnConcluir');
      for (let i=0; i<3; i++) {
        try { btn.click(); } catch(_){}
        if (btn.disabled) ignorados++;
      }
      return ignorados;
    });
    console.log(`  Botao trava: ${cliquesIgnorados}/3 cliques extras ignorados`);

    // Esperar redirect pro 31-pronto.html
    try {
      await page.waitForURL(/31-pronto\.html|pre-consulta\.html/, { timeout: 15000 });
      const tRedirect = Date.now() - tClick;
      metricas.passos.cliqueAteRedirect = tRedirect;
      // ===== CRONOMETRO STOP =====

      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-pos-conclude.png') });
      console.log(`\n  ✅ REDIRECIONOU em ${tRedirect}ms (${(tRedirect/1000).toFixed(2)}s)`);
      metricas.tempoTotal = tRedirect;

      // ===== Verificacao pos-redirect: consentimentos + foto chegaram? =====
      console.log('\n  Verificando que dados foram persistidos no servidor...');
      await page.waitForTimeout(2500); // da tempo dos fire-and-forget chegarem
      const verif = await page.evaluate(async () => {
        const token = localStorage.getItem('vitae_token');
        const apiUrl = 'https://vitae-app-production.up.railway.app';
        const fetchAuth = (p) => fetch(apiUrl + p, { headers: { Authorization: 'Bearer ' + token } }).then(r => r.ok ? r.json() : { erro: r.status });
        const [perfil, consentimentos] = await Promise.all([
          fetchAuth('/perfil'),
          fetchAuth('/consentimento'),
        ]);
        return {
          fotoSalva: !!(perfil && perfil.usuario && perfil.usuario.fotoUrl),
          fotoUrlPrefix: perfil && perfil.usuario && perfil.usuario.fotoUrl ? String(perfil.usuario.fotoUrl).slice(0, 30) : null,
          consentimentosCount: Array.isArray(consentimentos) ? consentimentos.length : (consentimentos && consentimentos.consentimentos ? consentimentos.consentimentos.length : 0),
          consentimentosTipos: Array.isArray(consentimentos) ? consentimentos.map(c => c.tipo) : (consentimentos && consentimentos.consentimentos ? consentimentos.consentimentos.map(c => c.tipo) : []),
          perfilDataNasc: perfil && perfil.perfil && perfil.perfil.dataNascimento ? perfil.perfil.dataNascimento.slice(0, 10) : null,
        };
      });
      metricas.verificacaoPos = verif;
      console.log('    Foto salva no banco:', verif.fotoSalva, verif.fotoUrlPrefix ? `(${verif.fotoUrlPrefix}...)` : '');
      console.log('    Consentimentos:', verif.consentimentosCount, verif.consentimentosTipos);
      console.log('    Data nasc no banco:', verif.perfilDataNasc);
    } catch (e) {
      const tFail = Date.now() - tClick;
      metricas.passos.cliqueAteRedirect = tFail;
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-FALHA-timeout.png') });
      console.log(`\n  ❌ TIMEOUT ${tFail}ms — botao ficou travado/sem redirect`);
      metricas.tempoTotal = tFail;
      metricas.timeout = true;
    }

    // Print das requisicoes relevantes
    console.log('\n--- Requisicoes de rede capturadas ---');
    networkOps.forEach(o => console.log(`  ${o.method} ${o.status} ${o.url.slice(0,80)}`));

    if (failedReqs.length) {
      console.log('\n--- Requisicoes falhas ---');
      failedReqs.forEach(r => console.log(`  ${r.reason || 'fail'} -> ${r.url.slice(0,100)}`));
    }
    if (pageErrors.length) {
      console.log('\n--- Erros JS ---');
      pageErrors.forEach(e => console.log(`  ${e.message.slice(0,150)}`));
    }
  } catch (err) {
    console.log('\n[FATAL] Excecao no fluxo:', err.message);
    metricas.erro = err.message;
    try { await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'FATAL.png'), fullPage: true }); } catch(_){}
  } finally {
    // Salvar metricas
    const relatorio = {
      timestamp: new Date().toISOString(),
      net: NET,
      email: EMAIL_TESTE,
      celular: CELULAR_TESTE,
      cpf: CPF_TESTE,
      foto: { path: FOTO_PATH, bytes: fs.statSync(FOTO_PATH).size },
      metricas,
      networkOps,
      failedReqs,
      pageErrors,
      consoleMsgs: consoleMsgs.filter(m => m.type === 'error' || m.text.includes('[QUIZ]')).slice(0,20),
    };
    const relPath = path.join(SCREENSHOT_DIR, `relatorio-${NET}-${TIMESTAMP}.json`);
    fs.writeFileSync(relPath, JSON.stringify(relatorio, null, 2));
    console.log('\n📊 Relatorio salvo:', relPath);

    await browser.close();
  }

  console.log('\n═════════════════════════════════════════════════════════');
  console.log('RESULTADO:', metricas.tempoTotal, 'ms', metricas.timeout ? '(TIMEOUT)' : '(OK)');
  console.log('═════════════════════════════════════════════════════════');

  // Exit code: 0 = OK, 1 = falhou (timeout ou >5s)
  process.exit(metricas.timeout || metricas.tempoTotal > 5000 ? 1 : 0);
}

executar().catch(e => {
  console.error('FATAL:', e);
  process.exit(2);
});
