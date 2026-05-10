const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const SHOTS = 'd:/vitae-app-novo/tests/shots/fix-validation';
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  const RAND = Math.floor(Math.random() * 1e9);
  await page.goto('https://vitae-app.vercel.app/desktop/02-cadastro.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  await page.fill('#nome', 'Dr Validacao ' + RAND);
  await page.fill('#email', 'med-fix-' + RAND + '@vitae-debug.local');
  await page.fill('#celular', '11998' + Math.floor(100000 + Math.random() * 899999));
  await page.fill('#senha', 'TesteSenha123!');
  await page.fill('#senha2', 'TesteSenha123!');
  await page.check('#aceite');
  await page.click('#btn');
  await page.waitForURL(/03-quiz-medico/, { timeout: 30000 });

  await page.waitForTimeout(1500);
  await page.selectOption('#uf', 'SP');
  await page.fill('#crm', '99999');
  await page.fill('#esp', 'Clinica Geral');
  await page.click('text=Avançar');
  await page.waitForTimeout(700);
  await page.click('text=Pular este passo').catch(() => {});
  await page.waitForTimeout(700);
  await page.fill('#clinica', 'Teste').catch(() => {});
  await page.click('text=Avançar');
  await page.waitForTimeout(700);
  await page.click('text=Avançar');
  await page.waitForTimeout(700);
  await page.click('text=Pular este passo').catch(() => {});
  await page.waitForTimeout(700);
  await page.click('text=Salvar e continuar').catch(() => {});
  await page.waitForTimeout(2500);
  await page.click('text=Entrar no app').catch(() => {});
  await page.waitForURL(/app-v2/, { timeout: 15000 });
  await page.waitForTimeout(4500);

  console.log('--- Validando fix 1: empty state Templates ---');
  await page.evaluate(() => goto('templates'));
  await page.waitForTimeout(2000);
  await page.evaluate(() => { try { tplOnbClose(); } catch (e) {} });
  await page.waitForTimeout(800);
  await page.screenshot({ path: SHOTS + '/01-templates-empty-state-novo.png', fullPage: true });
  const temNovoCTA = await page.locator('text=/Crie seu primeiro template/').count();
  const temBotaoCriar = await page.locator('button:has-text("Criar primeiro template")').count();
  console.log('  CTA hero "Crie seu primeiro template": ' + (temNovoCTA > 0 ? '✓ OK' : '✗ FALHOU'));
  console.log('  Botão "Criar primeiro template": ' + (temBotaoCriar > 0 ? '✓ OK' : '✗ FALHOU'));

  console.log('\n--- Validando fix 2: overlay fecha ao mudar de view ---');
  await page.evaluate(() => tplOnbShow());
  await page.waitForTimeout(500);
  const overlayAntes = await page.locator('#tpl-onbOverlay.show').count();
  console.log('  Overlay aberto antes do goto: ' + (overlayAntes > 0 ? 'sim' : 'não'));

  await page.evaluate(() => goto('hoje'));
  await page.waitForTimeout(800);
  const overlayDepois = await page.locator('#tpl-onbOverlay.show').count();
  console.log('  Overlay aberto depois do goto(hoje): ' + (overlayDepois > 0 ? 'sim' : 'não'));

  if (overlayAntes > 0 && overlayDepois === 0) {
    console.log('  ✓ FIX FUNCIONA: overlay fechou automaticamente ao mudar de view');
  } else if (overlayDepois === 0) {
    console.log('  ⚠ Overlay não estava aberto inicialmente');
  } else {
    console.log('  ✗ FALHOU: overlay continua bloqueando');
  }
  await page.screenshot({ path: SHOTS + '/02-hoje-sem-overlay.png', fullPage: true });

  await browser.close();
  console.log('\nPrints: ' + SHOTS);
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
