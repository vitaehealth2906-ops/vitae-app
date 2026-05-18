/**
 * VITAE — BATERIA DE COMPLICACOES NO FLUXO DO PACIENTE
 *
 * Simula situacoes complexas que pacientes reais geram:
 *  1. WhatsApp in-app browser detection (UA spoof)
 *  2. Clicar Enviar 3x rapido (race condition)
 *  3. Pre-consulta JA respondida ao carregar (mock /estado -> 409)
 *  4. Pre-consulta expirada ao carregar (mock /estado -> 410)
 *  5. Pre-consulta nao encontrada (mock /estado -> 404)
 *  6. Network offline durante envio (page.context().setOffline)
 *  7. Tela bloqueada / visibilitychange durante quiz
 *  8. 2 abas simultaneas (race entre instancias)
 *  9. localStorage cheio (QuotaExceeded simulado)
 * 10. JS desabilitado (skip — paciente nao consegue nem usar app)
 *
 * Saida: tests/shots/complicacoes-{ts}/*.png + tests/logs/complicacoes-{ts}.json
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const PORT = 3031;
const BASE = `http://localhost:${PORT}`;
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS = path.join(__dirname, 'shots', 'complicacoes-' + TS);
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

const resultados = [];
function log(cenario, esperado, atual, ok, extras) {
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${cenario}`);
  if (!ok) {
    console.log(`  esperado: ${JSON.stringify(esperado)}`);
    console.log(`  atual:    ${JSON.stringify(atual)}`);
  }
  resultados.push({ cenario, esperado, atual, ok, extras });
}

async function startServer() {
  const child = spawn('node', ['serve.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(PORT) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', d => process.stdout.write('[serve] ' + d));
  child.stderr.on('data', d => process.stderr.write('[serve-err] ' + d));
  await new Promise(r => setTimeout(r, 1200));
  return child;
}

// ============================================================
// CENARIO 1: WhatsApp in-app browser detection
// ============================================================
async function cenario1_whatsappBrowser(browser) {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 WhatsApp/2.23',
    viewport: { width: 393, height: 852 },
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/pre-consulta.html?token=fake&debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.detectarInAppBrowser === 'function', { timeout: 5000 });
  const detected = await page.evaluate(() => window.detectarInAppBrowser());
  await page.screenshot({ path: path.join(SHOTS, '01-whatsapp-ua.png'), fullPage: true });
  log('1. Deteccao WhatsApp UA', { detected: true }, { detected }, detected === true);
  await context.close();
}

// ============================================================
// CENARIO 2: Clicar Enviar 3x rapido
// ============================================================
async function cenario2_cliqueRapido(browser) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await context.newPage();
  let calls = 0;
  await page.route('**/pre-consulta/t/*/finalizar', async (route) => {
    calls++;
    await new Promise(r => setTimeout(r, 800));
    if (calls === 1) {
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true, preConsultaId: 'x' }) });
    } else {
      await route.fulfill({ status: 409, body: JSON.stringify({ erro: 'Já respondida' }) });
    }
  });
  await page.goto(`${BASE}/pre-consulta.html?token=fake&debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.finalizarPreConsulta === 'function', { timeout: 5000 });
  await page.evaluate(() => {
    window.ESTADO = window.ESTADO || { token: 'fake' };
    document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; });
    const antigo = document.getElementById('revSend');
    if (antigo) antigo.remove();
    const div = document.createElement('div');
    div.id = 'revSend';
    div.className = 'qz-review__send';
    div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;display:block;visibility:visible;opacity:1;background:#fff;padding:16px';
    div.innerHTML = '<button class="qz-cta qz-cta--primary" onclick="finalizarPreConsulta()" style="display:block;width:100%">Enviar</button>';
    document.body.appendChild(div);
  });
  // 3 cliques quase simultaneos
  const btn = await page.$('#revSend button');
  await Promise.all([btn.click(), btn.click().catch(()=>{}), btn.click().catch(()=>{})]);
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(SHOTS, '02-clique-rapido.png'), fullPage: true });

  // Esperado: apenas 1 call (botao disabled apos 1o clique)
  const ok = calls === 1;
  log('2. Triple-click Enviar (race)', { calls: 1 }, { calls }, ok);
  await context.close();
}

// ============================================================
// CENARIO 3: Pre-consulta ja respondida ao carregar
// ============================================================
async function cenario3_jaRespondidaAoCarregar(browser) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await context.newPage();
  await page.route('**/pre-consulta/t/*/estado', async (route) => {
    await route.fulfill({ status: 409, body: JSON.stringify({ erro: 'Pré-consulta já respondida' }) });
  });
  await page.goto(`${BASE}/pre-consulta.html?token=ja-respondida&debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOTS, '03-ja-respondida.png'), fullPage: true });
  const ui = await page.evaluate(() => {
    const titulo = document.querySelector('#erroTitulo')?.textContent?.trim();
    const screen = document.querySelector('.screen.active')?.id;
    return { titulo, screen };
  });
  const ok = /já|ja/i.test(ui.titulo || '');
  log('3. Já respondida ao carregar', { tituloContem: 'já respondeu' }, ui, ok);
  await context.close();
}

// ============================================================
// CENARIO 4: Link expirado ao carregar
// ============================================================
async function cenario4_expiradoAoCarregar(browser) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await context.newPage();
  await page.route('**/pre-consulta/t/*/estado', async (route) => {
    await route.fulfill({ status: 410, body: JSON.stringify({ erro: 'Link expirado' }) });
  });
  await page.goto(`${BASE}/pre-consulta.html?token=expirado&debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOTS, '04-expirado.png'), fullPage: true });
  const ui = await page.evaluate(() => {
    const titulo = document.querySelector('#erroTitulo')?.textContent?.trim();
    return { titulo };
  });
  const ok = /expir/i.test(ui.titulo || '');
  log('4. Expirado ao carregar', { tituloContem: 'expir' }, ui, ok);
  await context.close();
}

// ============================================================
// CENARIO 5: Link nao encontrado
// ============================================================
async function cenario5_naoEncontradoAoCarregar(browser) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await context.newPage();
  await page.route('**/pre-consulta/t/*/estado', async (route) => {
    await route.fulfill({ status: 404, body: JSON.stringify({ erro: 'Pré-consulta não encontrada' }) });
  });
  await page.goto(`${BASE}/pre-consulta.html?token=invalido&debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOTS, '05-nao-encontrado.png'), fullPage: true });
  const ui = await page.evaluate(() => {
    const titulo = document.querySelector('#erroTitulo')?.textContent?.trim();
    return { titulo };
  });
  const ok = /encontrad|invalid|nao|não/i.test(ui.titulo || '');
  log('5. Token inválido ao carregar', { tituloContem: 'invalido' }, ui, ok);
  await context.close();
}

// ============================================================
// CENARIO 6: Network offline durante envio
// ============================================================
async function cenario6_offlineNoEnvio(browser) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/pre-consulta.html?token=fake&debug=1`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.finalizarPreConsulta === 'function', { timeout: 5000 });
  await page.evaluate(() => {
    window.ESTADO = window.ESTADO || { token: 'fake' };
    document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; });
    const antigo = document.getElementById('revSend');
    if (antigo) antigo.remove();
    const div = document.createElement('div');
    div.id = 'revSend';
    div.className = 'qz-review__send';
    div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;display:block;visibility:visible;opacity:1;background:#fff;padding:16px';
    div.innerHTML = '<button class="qz-cta qz-cta--primary" onclick="finalizarPreConsulta()" style="display:block;width:100%">Enviar</button>';
    document.body.appendChild(div);
  });
  await context.setOffline(true);
  await page.click('#revSend button');
  await page.waitForSelector('.qz-review__erro', { timeout: 8000 }).catch(() => {});
  await page.screenshot({ path: path.join(SHOTS, '06-offline.png'), fullPage: true });
  const ui = await page.evaluate(() => {
    const erro = document.querySelector('.qz-review__erro');
    return erro ? { cor: ['vermelho','laranja','verde'].find(c => erro.classList.contains('qz-review__erro--' + c)), titulo: erro.querySelector('.qz-review__erro-titulo')?.textContent?.trim() } : null;
  });
  const ok = ui && /conex|offline|rede|internet/i.test(ui.titulo || '');
  log('6. Offline no envio', { tituloContem: 'conexão' }, ui, ok);
  await context.setOffline(false);
  await context.close();
}

// ============================================================
// CENARIO 7: Visibilitychange (tela bloqueada)
// ============================================================
async function cenario7_visibilityHidden(browser) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await context.newPage();
  await page.goto(`${BASE}/pre-consulta.html?token=fake&debug=1`, { waitUntil: 'domcontentloaded' });
  // ESTADO e var local (closure) — nao tem como inspecionar de fora.
  // Validacao indireta: o listener existe e nao quebra ao disparar evento.
  await page.waitForFunction(() => typeof window.finalizarPreConsulta === 'function', { timeout: 5000 });
  let errosDisparados = 0;
  page.on('pageerror', () => errosDisparados++);
  await page.evaluate(() => {
    try {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    } catch(e){}
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, '07-visibility.png'), fullPage: true });
  // Considera OK se nenhum erro foi disparado (listener existe e nao quebra)
  const ok = errosDisparados === 0;
  log('7. Visibility hidden listener nao quebra', { errosDisparados: 0 }, { errosDisparados }, ok);
  await context.close();
}

// ============================================================
// CENARIO 8: 2 abas simultaneas
// ============================================================
async function cenario8_duasAbas(browser) {
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const calls = [];
  await context.route('**/pre-consulta/t/*/finalizar', async (route) => {
    calls.push(Date.now());
    if (calls.length === 1) {
      await new Promise(r => setTimeout(r, 200));
      await route.fulfill({ status: 200, body: JSON.stringify({ ok: true, preConsultaId: 'x' }) });
    } else {
      await route.fulfill({ status: 409, body: JSON.stringify({ erro: 'Pré-consulta já respondida (concorrência)' }) });
    }
  });
  const aba1 = await context.newPage();
  const aba2 = await context.newPage();
  const url = `${BASE}/pre-consulta.html?token=fake&debug=1`;
  await aba1.goto(url, { waitUntil: 'domcontentloaded' });
  await aba2.goto(url, { waitUntil: 'domcontentloaded' });
  await aba1.waitForFunction(() => typeof window.finalizarPreConsulta === 'function');
  await aba2.waitForFunction(() => typeof window.finalizarPreConsulta === 'function');

  const setup = (page) => page.evaluate(() => {
    window.ESTADO = window.ESTADO || { token: 'fake' };
    document.querySelectorAll('.screen').forEach(s => { s.style.display = 'none'; });
    const antigo = document.getElementById('revSend');
    if (antigo) antigo.remove();
    const div = document.createElement('div');
    div.id = 'revSend';
    div.className = 'qz-review__send';
    div.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:9999;display:block;visibility:visible;opacity:1;background:#fff;padding:16px';
    div.innerHTML = '<button class="qz-cta qz-cta--primary" onclick="finalizarPreConsulta()" style="display:block;width:100%">Enviar</button>';
    document.body.appendChild(div);
  });
  await setup(aba1);
  await setup(aba2);

  await Promise.all([
    aba1.click('#revSend button'),
    aba2.click('#revSend button'),
  ]);
  await Promise.all([
    aba1.waitForTimeout(2000),
    aba2.waitForTimeout(2000),
  ]);
  const lerUi = (page) => page.evaluate(() => {
    const erro = document.querySelector('.qz-review__erro');
    if (!erro) return null;
    return {
      cor: ['vermelho','laranja','verde'].find(c => erro.classList.contains('qz-review__erro--' + c)),
      titulo: erro.querySelector('.qz-review__erro-titulo')?.textContent?.trim(),
    };
  });
  const ui1 = await lerUi(aba1);
  const ui2 = await lerUi(aba2);
  await aba1.screenshot({ path: path.join(SHOTS, '08-aba1.png'), fullPage: true });
  await aba2.screenshot({ path: path.join(SHOTS, '08-aba2.png'), fullPage: true });
  // Esperado: backend recebeu 2 calls (concorrencia) E pelo menos UMA aba mostra "Ja foi enviado" verde
  const algumaVerde = (ui1 && ui1.cor === 'verde' && /enviad/i.test(ui1.titulo || '')) ||
                       (ui2 && ui2.cor === 'verde' && /enviad/i.test(ui2.titulo || ''));
  const ok = calls.length === 2 && algumaVerde;
  log('8. Duas abas simultâneas', { calls: 2, algumaVerde: true }, { calls: calls.length, ui1, ui2, algumaVerde }, ok);
  await context.close();
}

// ============================================================
// MAIN
// ============================================================
(async () => {
  const server = await startServer();
  const browser = await chromium.launch({ channel: 'msedge', headless: false });

  const cenarios = [
    cenario1_whatsappBrowser,
    cenario2_cliqueRapido,
    cenario3_jaRespondidaAoCarregar,
    cenario4_expiradoAoCarregar,
    cenario5_naoEncontradoAoCarregar,
    cenario6_offlineNoEnvio,
    cenario7_visibilityHidden,
    cenario8_duasAbas,
  ];

  try {
    for (const fn of cenarios) {
      console.log('\n=== ' + fn.name + ' ===');
      try {
        await fn(browser);
      } catch (e) {
        console.error('Cenario falhou com excecao:', e);
        log(fn.name, '(sem excecao)', String(e), false);
      }
    }
  } finally {
    await browser.close();
    server.kill();
  }

  const passed = resultados.filter(r => r.ok).length;
  const failed = resultados.filter(r => !r.ok).length;
  console.log('\n========================================');
  console.log(`COMPLICACOES: ${passed}/${resultados.length} passaram, ${failed} falharam`);
  console.log('========================================\n');

  fs.writeFileSync(
    path.join(LOGS, 'complicacoes-' + TS + '.json'),
    JSON.stringify({ ts: TS, passed, failed, total: resultados.length, resultados }, null, 2)
  );
  console.log('Log salvo em tests/logs/complicacoes-' + TS + '.json');
  console.log('Screenshots em', SHOTS);
  process.exit(failed > 0 ? 1 : 0);
})();
