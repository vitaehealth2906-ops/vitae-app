// Tira screenshot de cada tela importante pra validar layout pós-fix
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const APP_URL = 'http://localhost:3000/app.html';
const SHOTS_DIR = path.join(__dirname, 'shots', 'telas-pos-fix');
if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

const TELAS = [
  'splash', 'boas-vindas', 'login', 'cadastro',
  'onboarding-quiz', 'pronto',
  'saude', 'exames', 'qr', 'consultas',
  'perfil', 'medicamentos', 'alergias'
];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 500, height: 950 } });
  const page = await ctx.newPage();

  for (const tela of TELAS) {
    try {
      await page.goto(APP_URL + '#' + tela, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1200);

      const info = await page.evaluate(() => {
        const v = document.querySelector('.view.active');
        return v ? { name: v.getAttribute('data-view'), textLen: v.innerText.trim().length } : { name: 'nenhuma', textLen: 0 };
      });

      await page.screenshot({ path: path.join(SHOTS_DIR, tela + '.png') });
      console.log(`✓ ${tela.padEnd(20)} → view ativa: ${info.name.padEnd(20)} · conteudo: ${info.textLen} chars`);
    } catch (e) {
      console.log(`✗ ${tela}: ${e.message}`);
    }
  }

  await browser.close();
})();
