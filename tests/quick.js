const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ channel: 'msedge', headless: false, args:['--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto('file:///D:/vitae-app-novo/preview-menu-reformulado.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(1500);
  const fr = p.frame({ name: 'frame-new' });
  // vai pra Templates
  await fr.click('[data-view="templates"]');
  await p.waitForTimeout(800);
  // fecha onboarding popup se abrir
  const onbClose = await fr.$('.onb-close');
  if (onbClose) { await onbClose.click(); await p.waitForTimeout(400); }
  // clica "Criar template" / "Novo template"
  const btn = await fr.$('.btn-p');
  if (btn) await btn.click();
  await p.waitForTimeout(500);
  // step 1: digitar nome + adicionar 5 perguntas
  const nomeInput = await fr.$('input[placeholder*="Cardiologia"], input[placeholder*="Ex.:"]');
  if (nomeInput) { await nomeInput.click(); await nomeInput.type('Dermatologia', { delay: 30 }); }
  // adicionar 5 perguntas (botão Geral · 11 ou + Adicionar)
  for (let i = 0; i < 5; i++) {
    const add = await fr.$('button:has-text("Adicionar pergunta")');
    if (add) await add.click();
    await p.waitForTimeout(150);
  }
  // editar primeira pergunta
  const q1 = await fr.$('#cmq_0');
  if (q1) {
    await q1.click();
    await q1.fill('O que está te incomodando hoje?');
    await p.waitForTimeout(300);
  }
  // editar a 2ª e 3ª
  const q2 = await fr.$('#cmq_1');
  if (q2) { await q2.click(); await q2.fill('Há quanto tempo você sente isso?'); }
  const q3 = await fr.$('#cmq_2');
  if (q3) { await q3.click(); await q3.fill('De 0 a 10, qual a intensidade?'); }
  await p.waitForTimeout(500);
  // screenshot do step 1 com phone preview
  await p.screenshot({ path: 'd:/vitae-app-novo/tests/shots/template_step1_real.png', fullPage: false });
  // foca só no phone frame
  const phone = await fr.$('.phone-frame');
  if (phone) await phone.screenshot({ path: 'd:/vitae-app-novo/tests/shots/template_phone_only.png' });
  console.log('Screenshots tirados');
  await b.close();
})();
