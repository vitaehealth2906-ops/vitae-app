/**
 * VALIDAÇÃO — confirma que app.html#saude NÃO mostra mais "Mapa do app paciente"
 *
 * NOTA: como mexi em arquivo local mas Vercel pode ainda servir versão antiga
 * (sem deploy), testa tanto LOCAL (file://) quanto produção.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join(__dirname, `valida-saude-${TS}`);
fs.mkdirSync(OUT, { recursive: true });

function log(s) { console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${s}`); }

async function loginAPI(email, senha) {
  const r = await fetch('https://vitae-app-production.up.railway.app/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  if (!r.ok) throw new Error('login: ' + r.status);
  return r.json();
}

(async () => {
  log('🔍 Validando remoção do mapa');
  const pac = await loginAPI(process.env.PACIENTE_EMAIL, process.env.PACIENTE_SENHA);
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // 1) LOCAL (file://) — confirma que MEU arquivo editado funciona
  log('\n📁 Teste LOCAL (file://)');
  {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
    const page = await ctx.newPage();
    const localUrl = 'file:///' + path.resolve(__dirname, '..', 'app-v3', 'app.html').replace(/\\/g, '/') + '#saude';
    await page.goto(localUrl, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, 'LOCAL-app-html-saude.png'), fullPage: true });
    const txt = (await page.locator('body').innerText()).slice(0, 2000);
    const temMapa = /mapa do app|32 telas/i.test(txt);
    log(`     · LOCAL: aparece mapa? ${temMapa ? '❌ SIM (BUG)' : '✅ NÃO'}`);
    log(`     · preview: "${txt.replace(/\n/g, ' ').slice(0, 200)}"`);
    await ctx.close();
  }

  // 2) PRODUÇÃO (Vercel) — depende de deploy pra refletir
  log('\n🌐 Teste PRODUÇÃO (Vercel) — ainda versão antiga até push');
  {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
    const page = await ctx.newPage();
    await page.addInitScript(({ t, u }) => {
      localStorage.setItem('vitae_token', t);
      localStorage.setItem('vitae_usuario', JSON.stringify(u));
    }, { t: pac.token, u: pac.usuario });
    await page.goto('https://vitae-app.vercel.app/app-v3/app.html#saude', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUT, 'PROD-app-html-saude.png'), fullPage: true });
    const txt = (await page.locator('body').innerText()).slice(0, 2000);
    const temMapa = /mapa do app|32 telas/i.test(txt);
    log(`     · PROD: aparece mapa? ${temMapa ? '⚠️ AINDA SIM (precisa push)' : '✅ NÃO'}`);
    await ctx.close();
  }

  await browser.close();
  log(`\n📄 Prints em ${OUT}`);
})();
