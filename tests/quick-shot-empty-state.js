/* Pega só o screenshot do empty state novo de Templates depois de fechar onboarding. */
const { chromium } = require('playwright');
const fs = require('fs');
const SHOTS = 'd:/vitae-app-novo/tests/shots/fix-validation';
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const page = await ctx.newPage();

  const RAND = Math.floor(Math.random() * 1e9);
  console.log('Cadastrando médico fake...');
  await page.goto('https://vitae-app.vercel.app/desktop/02-cadastro.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.fill('#nome', 'Dr Fix ' + RAND);
  await page.fill('#email', 'med-fix-' + RAND + '@vitae-debug.local');
  await page.fill('#celular', '11998' + Math.floor(100000 + Math.random() * 899999));
  await page.fill('#senha', 'TesteSenha123!');
  await page.fill('#senha2', 'TesteSenha123!');
  await page.check('#aceite');
  await page.click('#btn');
  await page.waitForURL(/03-quiz-medico/, { timeout: 30000 });

  console.log('Quiz rápido...');
  await page.waitForTimeout(1500);
  await page.selectOption('#uf', 'SP').catch(() => {});
  await page.fill('#crm', '99999').catch(() => {});
  await page.fill('#esp', 'CG').catch(() => {});
  for (let i = 0; i < 6; i++) {
    await page.click('text=Avançar').catch(() => {});
    await page.click('text=Pular este passo').catch(() => {});
    await page.click('text=Salvar e continuar').catch(() => {});
    await page.waitForTimeout(800);
  }

  // Espera URL ir pra app-v2 OU clica entrar (timeout maior)
  console.log('Aguardando entrada no app...');
  try {
    await page.click('text=Entrar no app', { timeout: 5000 }).catch(() => {});
    await page.waitForURL(/app-v2/, { timeout: 60000 });
  } catch (e) {
    console.log('  Sem botão "Entrar no app", tenta navegar direto');
    await page.goto('https://vitae-app.vercel.app/desktop/app-v2.html', { waitUntil: 'domcontentloaded' });
  }
  await page.waitForTimeout(5000);

  console.log('Indo pra Templates...');
  await page.evaluate(() => { try { goto('templates'); } catch (e) {} });
  await page.waitForTimeout(2500);

  // Fecha overlay de onboarding (1ª visita)
  await page.evaluate(() => { try { tplOnbClose(); } catch (e) {} });
  await page.waitForTimeout(1200);

  await page.screenshot({ path: SHOTS + '/templates-empty-state-novo.png', fullPage: true });
  const novoCTA = await page.locator('text=/Crie seu primeiro template/').count();
  const botaoCriar = await page.locator('button:has-text("Criar primeiro template")').count();
  console.log('\n--- Fix 1: Empty state Templates ---');
  console.log('  CTA "Crie seu primeiro template":   ' + (novoCTA > 0 ? '✓ APARECE' : '✗ NÃO APARECE'));
  console.log('  Botão "Criar primeiro template":    ' + (botaoCriar > 0 ? '✓ APARECE' : '✗ NÃO APARECE'));

  console.log('\n--- Fix 2: Overlay fecha ao mudar de view ---');
  // Reabre overlay
  await page.evaluate(() => { try { tplOnbShow(); } catch (e) {} });
  await page.waitForTimeout(600);
  const antes = await page.locator('#tpl-onbOverlay.show').count();
  console.log('  Overlay aberto antes de mudar view: ' + (antes > 0 ? 'sim' : 'não'));

  await page.evaluate(() => { try { goto('hoje'); } catch (e) {} });
  await page.waitForTimeout(1000);
  const depois = await page.locator('#tpl-onbOverlay.show').count();
  console.log('  Overlay aberto depois de goto(hoje):' + (depois > 0 ? ' SIM (BUG)' : ' não (FIX OK)'));

  await page.screenshot({ path: SHOTS + '/hoje-sem-overlay.png', fullPage: true });

  await browser.close();
  console.log('\nScreenshots:');
  console.log('  ' + SHOTS + '/templates-empty-state-novo.png');
  console.log('  ' + SHOTS + '/hoje-sem-overlay.png');
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
