/**
 * Mapa REAL do app paciente — Playwright + Edge + gravação .webm
 *
 * Roda contra produção (vitae-app.vercel.app).
 * Loga com a conta do Lucas, navega 27 telas, screenshota cada uma, grava vídeo.
 *
 * Uso:
 *   set VITAE_EMAIL=lucasborelli096@gmail.com
 *   set VITAE_SENHA=Lucas07.
 *   node tests/mapa-paciente-real.js
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://vitae-app.vercel.app';
const EMAIL = process.env.VITAE_EMAIL;
const SENHA = process.env.VITAE_SENHA;

if (!EMAIL || !SENHA) {
  console.error('Faltam env vars VITAE_EMAIL e VITAE_SENHA');
  process.exit(1);
}

const SHOTS = path.join(__dirname, 'shots-paciente');
const VIDEOS = path.join(__dirname, 'videos-paciente');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(VIDEOS, { recursive: true });

const TELAS = [
  // Fluxo de uso diário (autenticado)
  { id: '07-home', name: 'Perfil (HOME)', url: '/08-perfil.html', wait: 2500 },
  { id: '08-dados', name: 'Dados Pessoais', url: '/09-dados-pessoais.html', wait: 2000 },
  { id: '09-score', name: 'Score de Saúde', url: '/10-score.html', wait: 2000 },
  { id: '10-bioage', name: 'BioAge (placeholder)', url: '/15-bioage-sem-dados.html', wait: 1500 },
  { id: '11-exames', name: 'Lista de Exames', url: '/11-exames-lista.html', wait: 2500 },
  { id: '12-meds', name: 'Medicamentos', url: '/16-medicamentos.html', wait: 2000 },
  { id: '13-alergias', name: 'Alergias', url: '/17-alergias.html', wait: 2000 },
  { id: '14-scan-receita', name: 'Scan Receita', url: '/26-scan-receita.html', wait: 1500 },
  { id: '17-qrcode', name: 'QR Code', url: '/21-qrcode.html', wait: 2000 },
  { id: '18-autorizacao', name: 'Autorização Médicos', url: '/22-autorizacao.html', wait: 2000 },
  { id: '21-agendamentos', name: 'Agendamentos', url: '/23-agendamentos.html', wait: 2000 },
  { id: '22-lembretes', name: 'Lembretes', url: '/30-lembretes.html', wait: 2000 },
  { id: '27-termos', name: 'Termos de Uso', url: '/termos.html', wait: 1500 },
  { id: '28-lgpd', name: 'Política LGPD', url: '/lgpd.html', wait: 1500 },
];

(async () => {
  console.log('▶ Abrindo Edge...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    slowMo: 200,
  });

  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    recordVideo: { dir: VIDEOS, size: { width: 430, height: 932 } },
  });

  const page = await ctx.newPage();
  const log = [];

  async function shot(id, name, extra = '') {
    const file = path.join(SHOTS, `${id}.png`);
    try {
      await page.screenshot({ path: file, fullPage: false });
      log.push({ id, name, ok: true, url: page.url(), file, extra });
      console.log(`  ✓ ${id} — ${name}`);
    } catch (e) {
      log.push({ id, name, ok: false, error: e.message });
      console.log(`  ✗ ${id} — ${name}: ${e.message}`);
    }
  }

  try {
    // 1. SPLASH
    console.log('\n▶ Fluxo de onboarding (sem login)');
    await page.goto(BASE + '/01-splash.html');
    await page.waitForTimeout(2000);
    await shot('01-splash', 'Splash');
    await page.waitForTimeout(7000); // espera transição (8,2s total)

    // 2. SLIDES
    await shot('02-slides-1', 'Slides — slide 1');
    await page.waitForTimeout(800);
    // tenta avançar slides clicando na bolinha 2
    try { await page.locator('.dot, .slide-dot, [data-slide]').nth(1).click({ timeout: 1500 }); } catch {}
    await page.waitForTimeout(800);
    await shot('02-slides-2', 'Slides — slide 2');
    try { await page.locator('.dot, .slide-dot, [data-slide]').nth(2).click({ timeout: 1500 }); } catch {}
    await page.waitForTimeout(800);
    await shot('02-slides-3', 'Slides — slide 3');

    // 3. CADASTRO (vai aparecer "Criar conta" — troco pra Login)
    await page.goto(BASE + '/03-cadastro.html');
    await page.waitForTimeout(1500);
    await shot('03-cadastro-criar', 'Cadastro — modo "Criar conta"');

    // Clica em "Já tem conta? Entrar"
    try {
      await page.locator('text=Entrar').last().click({ timeout: 3000 });
      await page.waitForTimeout(800);
    } catch (e) {
      console.log('  ! Botão Entrar não achado:', e.message);
    }
    await shot('03-cadastro-login', 'Cadastro — modo Login');

    // 4. LOGIN
    console.log('\n▶ Login');
    const emailInput = page.locator('input[type=email]');
    const senhaInput = page.locator('#passInput, input[type=password]');
    await emailInput.fill(EMAIL);
    await senhaInput.fill(SENHA);
    await page.waitForTimeout(500);
    await shot('04-login-preenchido', 'Login preenchido');

    // Clica botão Entrar
    await page.locator('#btnCreate').click();
    console.log('  ⏳ Aguardando autenticação...');
    await page.waitForURL(/08-perfil|05-quiz|pre-consulta/, { timeout: 20000 });
    await page.waitForTimeout(2500);

    console.log(`  ✓ Logado, URL atual: ${page.url()}`);

    // 5. NAVEGA TODAS AS TELAS
    console.log('\n▶ Navegando telas autenticadas');
    for (const tela of TELAS) {
      await page.goto(BASE + tela.url);
      await page.waitForTimeout(tela.wait);
      await shot(tela.id, tela.name);
    }

    // 6. TELAS PUBLICAS COM TOKEN INVÁLIDO (mostra estado real de erro)
    console.log('\n▶ Telas públicas (sem dados)');
    await page.goto(BASE + '/rg-publico.html');
    await page.waitForTimeout(2000);
    await shot('19-rg-publico-vazio', 'RG Público (sem token)');

    await page.goto(BASE + '/exame-publico.html');
    await page.waitForTimeout(2000);
    await shot('20-exame-publico-vazio', 'Exame Público (sem ID)');

    // 7. PRÉ-CONSULTA E SUMMARY (estados sem dados)
    await page.goto(BASE + '/pre-consulta.html');
    await page.waitForTimeout(2000);
    await shot('23-pre-consulta-vazio', 'Pré-Consulta (sem token)');

    console.log('\n▶ Finalizando...');
  } catch (e) {
    console.error('\n✗ Erro fatal:', e.message);
    log.push({ id: 'erro-fatal', error: e.message, stack: e.stack });
  }

  // Fecha (vídeo é salvo automaticamente)
  await page.close();
  await ctx.close();
  await browser.close();

  // Renomeia vídeo pra nome legível
  const videos = fs.readdirSync(VIDEOS).filter(f => f.endsWith('.webm'));
  if (videos.length > 0) {
    const novo = `paciente-fluxo-completo-${new Date().toISOString().slice(0, 10)}.webm`;
    fs.renameSync(path.join(VIDEOS, videos[0]), path.join(VIDEOS, novo));
    console.log(`\n🎥 Vídeo salvo: tests/videos-paciente/${novo}`);
  }

  fs.writeFileSync(path.join(SHOTS, '_log.json'), JSON.stringify(log, null, 2));
  console.log(`📸 ${log.filter(l => l.ok).length} screenshots em tests/shots-paciente/`);
  console.log(`📋 Log: tests/shots-paciente/_log.json`);
})();
