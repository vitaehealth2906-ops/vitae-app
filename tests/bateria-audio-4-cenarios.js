/**
 * BATERIA AUDIO — 4 cenarios usando microfone fake do Chrome
 *
 * Flags do browser:
 *   --use-fake-ui-for-media-stream      → permissao mic auto-aprovada
 *   --use-fake-device-for-media-stream  → mic virtual
 *   --use-file-for-fake-audio-capture=X → toca WAV no mic (loop automatico)
 *
 * WAV: tests/fixtures/audio/resposta-robo.wav (TTS SAPI Microsoft, PT-BR sintetizado)
 *
 * Cenarios:
 *  1. audio-tudo    — 11 perguntas em audio
 *  2. audio-misto   — alterna audio e texto
 *  3. audio-bebo    — 10 audio + 1 texto "Bebo" (replica seu cenario do iPhone)
 *  4. audio-cancela — grava, cancela, regrava, envia
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const BASE = 'https://vitae-app.vercel.app';
const MED_URL = BASE + '/desktop/app-v2.html';
const WAV = path.resolve(__dirname, 'fixtures', 'audio', 'resposta-robo.wav');
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const SHOTS_ROOT = path.join(__dirname, 'shots', 'audio-' + TS);
const LOGS = path.join(__dirname, 'logs');
fs.mkdirSync(SHOTS_ROOT, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

if (!fs.existsSync(WAV)) {
  console.error('ERRO: WAV nao existe em ' + WAV);
  process.exit(1);
}

const MED_EMAIL = process.env.MEDICO_EMAIL;
const MED_SENHA = process.env.MEDICO_SENHA;
const PAC_EMAIL = process.env.PACIENTE_EMAIL;
const PAC_SENHA = process.env.PACIENTE_SENHA;

const CENARIOS = [
  { id: 1, nome: 'audio-tudo',    perguntas: 11, padraoModo: i => 'audio' },
  { id: 2, nome: 'audio-misto',   perguntas: 11, padraoModo: i => i % 2 === 0 ? 'audio' : 'texto' },
  { id: 3, nome: 'audio-bebo',    perguntas: 11, padraoModo: i => i === 9 ? 'texto-bebo' : 'audio' },
  { id: 4, nome: 'audio-cancela', perguntas: 11, padraoModo: i => i === 0 ? 'audio-cancelar' : 'audio' },
];

const RESPOSTAS_TEXTO = [
  'Cabeça doendo forte',
  'Faz 3 dias',
  'Intensidade 8 de 10',
  'Piora com tela',
  'Melhora no escuro',
  'Tenho náusea',
  'Sem remédio',
  'Já tive antes',
  'Mãe tem',
  'Bebo',
  'Durmo 5 horas'
];

const relatorio = { ts: TS, inicio: new Date().toISOString(), cenarios: [], tokens: [] };

function log(m) { console.log(m); }
async function snap(p, dir, n) { try { await p.screenshot({ path: path.join(dir, n + '.png'), fullPage: true }); } catch (e) {} }

async function loginMedico(page) {
  await page.goto(MED_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2500);
  if (page.url().includes('login')) {
    await page.locator('input[type="email"]').first().fill(MED_EMAIL);
    await page.locator('input[type="password"]').first().fill(MED_SENHA);
    await page.locator('button:has-text("Entrar"), button[type="submit"]').first().click();
    await page.waitForTimeout(5000);
  }
  if (!page.url().includes('app-v2')) {
    await page.goto(MED_URL); await page.waitForTimeout(3000);
  }
}

async function criarPC(pageM, scen) {
  await pageM.evaluate(() => { try { tplOnbClose(); } catch (e) {} }).catch(() => {});
  await pageM.waitForTimeout(400);
  await pageM.evaluate(() => { try { abrirCriarPC(); } catch (e) { try { goto('criar-pc'); } catch (_) {} } });
  await pageM.waitForTimeout(2200);
  const tem = await pageM.locator('#cpcNome').count();
  if (tem === 0) return { erro: 'form nao abriu' };
  await pageM.fill('#cpcNome', 'AUDIO-C' + scen.id + '-' + scen.nome);
  await pageM.fill('#cpcPhone', '11987654321').catch(() => {});
  await pageM.fill('#cpcEmail', PAC_EMAIL).catch(() => {});
  const amanha = new Date(Date.now() + 24*60*60*1000).toISOString().slice(0, 10);
  await pageM.fill('#cpcData', amanha).catch(() => {});
  await pageM.fill('#cpcHora', '14:00').catch(() => {});
  await pageM.fill('#cpcObs', 'BATERIA AUDIO ' + TS).catch(() => {});
  const rp = pageM.waitForResponse(r => r.url().includes('/pre-consulta') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
  await pageM.click('#cpcGerarBtn');
  const resp = await rp;
  if (!resp) return { erro: 'POST nao capturado' };
  const data = await resp.json().catch(() => ({}));
  const pc = data.preConsulta || data;
  if (!pc.linkToken && !pc.token) return { erro: 'sem token' };
  await pageM.waitForTimeout(1200);
  return { token: pc.linkToken || pc.token, pcId: pc.id };
}

async function rodarPacienteAudio(browser, scen, token, dirShots) {
  const log_ = []; const bugs = [];
  function add(n, ok, d) { log_.push({ n, ok, d: d||null }); console.log(`  ${ok?'✓':'✗'} ${n}` + (d?' — '+d:'')); }
  function bug(l, d) { bugs.push({ l, d }); console.log(`  🐛 ${l}: ${d}`); }

  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    locale: 'pt-BR',
    permissions: ['microphone'],
  });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('vitae_prefer_login', '1'); } catch (e) {} });
  // Concede permissao de mic pro origin
  await ctx.grantPermissions(['microphone'], { origin: BASE });

  const page = await ctx.newPage();
  const apiCalls = [];
  const consoleErrors = [];
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', e => consoleErrors.push('pageerror: ' + e.message.slice(0, 200)));
  page.on('response', async r => {
    const u = r.url();
    if (u.includes('/responder') || u.includes('/finalizar') || u.includes('/auth/login')) {
      let body = ''; try { body = await r.text(); } catch (_) {}
      apiCalls.push({ s: r.status(), m: r.request().method(), u: u.slice(-90), b: body.slice(0, 250) });
    }
  });

  try {
    const link = BASE + '/pre-consulta.html?token=' + encodeURIComponent(token);
    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(4500);
    await snap(page, dirShots, '01-link');

    // Onb1
    const onb1 = await page.locator('#screen-onb1-1:visible').count();
    if (onb1 > 0) {
      await page.evaluate(() => { try { window.onb1Avancar(); } catch (e) {} });
      await page.waitForTimeout(600);
      await page.evaluate(() => { try { window.onb1Concluir(); } catch (e) {} });
      await page.waitForTimeout(1500);
    }

    // Login
    const tlogin = await page.locator('#screen-login:visible').count();
    if (tlogin > 0) {
      const ti = await page.locator('#lgTi').textContent().catch(() => '');
      if (ti && ti.toLowerCase().includes('criar')) {
        await page.evaluate(() => { try { window.lgToggleMode(); } catch (e) {} });
        await page.waitForTimeout(500);
      }
      await page.fill('#lgEmail', PAC_EMAIL);
      await page.fill('#lgSenha', PAC_SENHA);
      const rp = page.waitForResponse(r => r.url().includes('/auth/login') && r.request().method() === 'POST', { timeout: 15000 }).catch(() => null);
      await page.evaluate(() => { try { window.lgSubmit(); } catch (e) {} });
      const lr = await rp;
      add('Login', lr && lr.status() === 200);
      await page.waitForTimeout(5000);
    }

    // Onb2
    const onb2 = await page.locator('#screen-onb2-1').count();
    if (onb2 > 0) {
      await page.evaluate(() => { try { window.onb2Ir(2); } catch (e) {} });
      await page.waitForTimeout(700);
      await page.evaluate(() => { try { window.onb2Ir(3); } catch (e) {} });
      await page.waitForTimeout(700);
      await page.evaluate(() => { try { window.onb2Concluir(); } catch (e) {} });
      await page.waitForTimeout(1500);
    }
    await snap(page, dirShots, '02-pre-quiz');

    // Quiz V4 — cada pergunta conforme padraoModo
    let resp = 0;
    for (let i = 0; i < scen.perguntas + 2; i++) {
      await page.waitForTimeout(800);

      const temRev = await page.locator('#screen-revisao:visible').count();
      if (temRev > 0) break;

      const modo = scen.padraoModo(i);

      if (modo === 'audio' || modo === 'audio-cancelar') {
        // Garante que esta em modo audio (botao mic visivel)
        const btnMic = page.locator('#btnMic');
        const micVis = await btnMic.isVisible().catch(() => false);
        if (!micVis) {
          // Pode estar em modo texto — clica voltar pra audio
          const btnVoz = page.locator('button:has-text("Voltar pra voz"), button:has-text("voz")').first();
          if (await btnVoz.count() > 0) await btnVoz.click().catch(() => {});
          await page.waitForTimeout(800);
        }

        // Clica mic pra iniciar gravacao
        await page.evaluate(() => { try { window.iniciarGravacao(); } catch (e) {} });
        await page.waitForTimeout(modo === 'audio-cancelar' ? 1500 : 6000);

        if (modo === 'audio-cancelar') {
          // Cancela gravacao no meio
          await page.evaluate(() => { try { window.pararGravacao(true); } catch (e) {} });
          await page.waitForTimeout(1200);
          add(`Q${i+1} audio CANCELADO`, true);
          // Regrava com sucesso
          await page.evaluate(() => { try { window.iniciarGravacao(); } catch (e) {} });
          await page.waitForTimeout(6000);
        }

        // Para gravacao normalmente (envia)
        const respPromise = page.waitForResponse(
          r => r.url().includes('/responder-pergunta') && r.request().method() === 'POST',
          { timeout: 45000 }
        ).catch(() => null);
        await page.evaluate(() => { try { window.pararGravacao(false); } catch (e) {} });

        const respApi = await respPromise;
        if (respApi) {
          const ok = respApi.status() === 200;
          const body = await respApi.text().catch(() => '');
          add(`Q${i+1} audio → ${respApi.status()}`, ok, body.slice(0, 80));
          if (ok) resp++;
        } else {
          bug(`Q${i+1}-audio`, 'POST /responder-pergunta nao foi capturado em 45s');
        }
        await page.waitForTimeout(1500);

      } else if (modo === 'texto' || modo === 'texto-bebo') {
        // Forca modo texto
        const btnTexto = page.locator('button:has-text("digitar"), button:has-text("texto")').first();
        if (await btnTexto.count() > 0 && await btnTexto.isVisible().catch(() => false)) {
          await btnTexto.click().catch(() => {});
          await page.waitForTimeout(700);
        }
        const ta = page.locator('#textareaInput');
        if (!await ta.isVisible().catch(() => false)) {
          bug(`Q${i+1}-texto`, 'textarea nao apareceu apos clicar digitar');
          break;
        }
        const r = modo === 'texto-bebo' ? 'Bebo' : (RESPOSTAS_TEXTO[i] || 'Resposta extra');
        await ta.fill(r);
        await page.evaluate(() => { try { window.onTextoChange(); } catch (e) {} });
        await page.waitForTimeout(400);
        const btn = page.locator('#btnContinuar');
        if (await btn.isVisible().catch(() => false)) {
          await btn.click().catch(() => {});
          add(`Q${i+1} texto "${r}"`, true);
          resp++;
        }
        await page.waitForTimeout(1200);
      }
    }
    add(`Quiz V4 — ${resp} respostas`, resp >= 7);
    await snap(page, dirShots, '03-quiz-fim');

    // Revisao + Enviar
    await page.waitForTimeout(2000);
    await snap(page, dirShots, '04-revisao');
    const btnEnviar = page.locator('button:has-text("Enviar pro médico"), button:has-text("Enviar pro medico")').first();
    let envCliques = 0;
    if (await btnEnviar.count() > 0) {
      const rpFin = page.waitForResponse(r => r.url().includes('/finalizar') && r.request().method() === 'POST', { timeout: 30000 }).catch(() => null);
      await btnEnviar.click().catch(() => {});
      envCliques = 1;
      const rf = await rpFin;
      if (rf) {
        const body = await rf.text().catch(() => '');
        add(`POST /finalizar → ${rf.status()}`, rf.status() === 200, body.slice(0, 100));
      } else {
        bug('finalizar', 'POST /finalizar nao capturado');
      }
    } else {
      // Fallback: chama finalizar direto
      await page.evaluate(() => { try { window.finalizarPreConsulta(); } catch (e) {} });
      envCliques = 1;
    }
    await page.waitForTimeout(6000);
    await snap(page, dirShots, '05-pos-enviar');

    const pronto = await page.locator('text=/[Bb]riefing.*chegou|[Pp]ronto.*briefing|[Ee]nviado.*sucesso/').count();
    add(`Tela final "Pronto/briefing chegou"`, pronto > 0);

  } catch (e) {
    bug('fluxo', 'Excecao: ' + e.message);
    await snap(page, dirShots, '99-erro');
  }

  await page.close();
  await ctx.close();
  return { etapas: log_, bugs, apiCalls, consoleErrors };
}

(async () => {
  log('\n══════════════════════════════════════════════════');
  log('🎤 BATERIA AUDIO — 4 cenarios');
  log('══════════════════════════════════════════════════');
  log(`WAV:       ${WAV}`);
  log(`Medico:    ${MED_EMAIL}`);
  log(`Paciente:  ${PAC_EMAIL}\n`);

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: [
      '--no-sandbox',
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-file-for-fake-audio-capture=' + WAV,
      '--autoplay-policy=no-user-gesture-required',
    ],
  });

  // FASE A — Medico cria 4 PCs
  log('═══ FASE A — MEDICO CRIA 4 PCs ═══\n');
  const ctxMed = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const pageM = await ctxMed.newPage();
  await loginMedico(pageM);
  log('✓ Medico logado');

  for (const scen of CENARIOS) {
    log(`  → C${scen.id} ${scen.nome}`);
    const r = await criarPC(pageM, scen);
    if (r.erro) { log(`    ✗ ${r.erro}`); relatorio.tokens.push({ scen: scen.id, erro: r.erro }); }
    else { log(`    ✓ token ${r.token.slice(0,16)}...`); relatorio.tokens.push({ scen: scen.id, token: r.token, pcId: r.pcId }); }
    await pageM.evaluate(() => { try { goto('hoje'); } catch (e) {} });
    await pageM.waitForTimeout(1200);
  }

  // FASE B — Paciente roda 4 cenarios
  log('\n═══ FASE B — PACIENTE RODA 4 CENARIOS ═══\n');
  for (const scen of CENARIOS) {
    const tk = relatorio.tokens.find(t => t.scen === scen.id);
    if (!tk || !tk.token) { log(`C${scen.id} ${scen.nome} — PULADO`); continue; }
    log(`\n─── C${scen.id}: ${scen.nome} ───`);
    const dir = path.join(SHOTS_ROOT, 'c' + scen.id + '-' + scen.nome);
    fs.mkdirSync(dir, { recursive: true });
    const t0 = Date.now();
    const res = await rodarPacienteAudio(browser, scen, tk.token, dir);
    const dur = Math.round((Date.now() - t0) / 1000);
    const ok = res.etapas.filter(e => e.ok).length;
    const fail = res.etapas.filter(e => !e.ok).length;
    log(`  → ${ok}ok ${fail}fail ${res.bugs.length}bugs ${dur}s`);
    relatorio.cenarios.push({ ...scen, padraoModo: undefined, token: tk.token, pcId: tk.pcId, dur, ok, fail, ...res });
  }

  await ctxMed.close();
  await browser.close();
  relatorio.fim = new Date().toISOString();
  const logPath = path.join(LOGS, 'audio-' + TS + '.json');
  fs.writeFileSync(logPath, JSON.stringify(relatorio, null, 2));

  log('\n══════════════════════════════════════════════════');
  log('📊 RELATORIO AUDIO');
  log('══════════════════════════════════════════════════');
  for (const c of relatorio.cenarios) {
    const s = c.bugs && c.bugs.length > 0 ? `${c.bugs.length} BUG(S)` : (c.fail === 0 ? 'OK' : `${c.fail} FALHA(S)`);
    log(`  C${c.id} ${c.nome.padEnd(20)} → ${s} (${c.dur}s)`);
    if (c.bugs && c.bugs.length > 0) c.bugs.forEach(b => log(`       🐛 ${b.l}: ${b.d.slice(0,100)}`));
  }
  log(`\nLog:    ${logPath}`);
  log(`Prints: ${SHOTS_ROOT}`);
})();
