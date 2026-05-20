/**
 * COBERTURA VISUAL TOTAL — 19/MAI/2026
 *
 * Navega em TODAS as telas dos 2 apps (paciente v3 + médico desktop),
 * tira prints, conta elementos, tenta clicar nos botões principais e
 * registra resultado de cada interação.
 *
 * Output: tests/cobertura-visual-<ts>/
 *   - prints/<id>-<nome>.png
 *   - relatorio.md
 *   - resultado.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const APP = 'https://vitae-app.vercel.app';
const API = 'https://vitae-app-production.up.railway.app';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join(__dirname, `cobertura-visual-${TS}`);
const PRINTS = path.join(OUT, 'prints');
fs.mkdirSync(PRINTS, { recursive: true });

const resultado = { telas: [], resumo: { total: 0, ok: 0, parcial: 0, erro: 0 } };

function log(s) { console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${s}`); }

async function loginAPI(email, senha) {
  const r = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  if (!r.ok) throw new Error('login: ' + r.status);
  return r.json();
}

async function shot(page, id, nome) {
  const safe = `${id}-${nome.replace(/[^\w-]/g, '_')}`;
  const fp = path.join(PRINTS, `${safe}.png`);
  await page.screenshot({ path: fp, fullPage: true }).catch(e => log(`     ⚠️ shot falhou: ${e.message.slice(0, 60)}`));
  return safe + '.png';
}

async function contarElementos(page) {
  return {
    botoes: await page.locator('button:visible').count(),
    inputs: await page.locator('input:visible, textarea:visible, select:visible').count(),
    cards: await page.locator('[class*="card"]:visible').count(),
    links: await page.locator('a:visible').count(),
    images: await page.locator('img:visible').count(),
    h1: await page.locator('h1:visible').count(),
    headings: await page.locator('h1:visible, h2:visible, h3:visible').count(),
  };
}

async function bodyText(page) {
  return (await page.locator('body').innerText()).slice(0, 4000);
}

async function registrarTela(page, id, nome, contexto = '') {
  try {
    await page.waitForTimeout(2000);
    const print = await shot(page, id, nome);
    const elems = await contarElementos(page);
    const txt = await bodyText(page);
    const url = page.url();
    const status = elems.botoes + elems.cards + elems.headings > 0 ? 'ok' : 'parcial';

    const entry = {
      id, nome, contexto, url, status, print, elementos: elems,
      preview: txt.slice(0, 300),
    };
    resultado.telas.push(entry);
    resultado.resumo.total++;
    resultado.resumo[status]++;
    log(`  ${status === 'ok' ? '✅' : '⚠️'} [${id}] ${nome} — botoes:${elems.botoes} cards:${elems.cards} headings:${elems.headings}`);
    fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(resultado, null, 2));
    return entry;
  } catch (err) {
    resultado.resumo.total++;
    resultado.resumo.erro++;
    log(`  ❌ [${id}] ${nome} — ${err.message.slice(0, 100)}`);
    resultado.telas.push({ id, nome, status: 'erro', erro: err.message });
    return null;
  }
}

async function tentarClicar(page, locatorOrText, descricao) {
  try {
    const loc = typeof locatorOrText === 'string'
      ? page.locator(`button:has-text("${locatorOrText}"), a:has-text("${locatorOrText}")`).first()
      : locatorOrText;
    await loc.click({ timeout: 5000 });
    await page.waitForTimeout(2000);
    return true;
  } catch (e) {
    log(`     · clique "${descricao}" não rolou: ${e.message.slice(0, 60)}`);
    return false;
  }
}

(async () => {
  log('🚀 COBERTURA VISUAL TOTAL — vita id');
  const med = await loginAPI(process.env.MEDICO_EMAIL, process.env.MEDICO_SENHA);
  const pac = await loginAPI(process.env.PACIENTE_EMAIL, process.env.PACIENTE_SENHA);
  log(`   ✓ tokens OK`);

  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  // ==========================================================
  // APP PACIENTE V3 — viewport mobile
  // ==========================================================
  log('\n📱 ============ APP PACIENTE V3 ============');
  {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
    const page = await ctx.newPage();
    await page.addInitScript(({ t, u }) => {
      localStorage.setItem('vitae_token', t);
      localStorage.setItem('vitae_usuario', JSON.stringify(u));
    }, { t: pac.token, u: pac.usuario });

    // P01 — App principal (root)
    log('\n[P01] Saúde (home do app v3)');
    await page.goto(APP + '/app-v3/app.html#saude', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P01', 'paciente-saude-home');

    // P02 — Aba Exames
    log('\n[P02] Aba Exames');
    await page.goto(APP + '/app-v3/app.html#exames', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P02', 'paciente-exames');

    // P03 — Aba QR Code
    log('\n[P03] Aba QR Code');
    await page.goto(APP + '/app-v3/app.html#qr', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P03', 'paciente-qrcode');

    // P04 — Aba Consultas
    log('\n[P04] Aba Consultas');
    await page.goto(APP + '/app-v3/app.html#consultas', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P04', 'paciente-consultas');

    // P05 — Aba Perfil
    log('\n[P05] Aba Perfil');
    await page.goto(APP + '/app-v3/app.html#perfil', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P05', 'paciente-perfil');

    // ----- Telas standalone (sem hash, arquivos próprios) -----
    log('\n[P06] 15-consultas.html standalone');
    await page.goto(APP + '/app-v3/15-consultas.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P06', 'paciente-15consultas-standalone');

    log('\n[P07] 16-consulta-detalhe.html standalone');
    await page.goto(APP + '/app-v3/16-consulta-detalhe.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P07', 'paciente-16-consulta-detalhe');

    log('\n[P08] 09-exames-lista.html');
    await page.goto(APP + '/app-v3/09-exames-lista.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P08', 'paciente-exames-lista');

    log('\n[P09] 10-exame-detalhe.html');
    await page.goto(APP + '/app-v3/10-exame-detalhe.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P09', 'paciente-exame-detalhe');

    log('\n[P10] 12-qr-code.html standalone');
    await page.goto(APP + '/app-v3/12-qr-code.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P10', 'paciente-qr-standalone');

    log('\n[P11] 18-perfil.html standalone');
    await page.goto(APP + '/app-v3/18-perfil.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P11', 'paciente-18-perfil');

    log('\n[P12] 03-medicamentos.html');
    await page.goto(APP + '/app-v3/03-medicamentos.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P12', 'paciente-medicamentos');

    log('\n[P13] 04-med-detalhe.html');
    await page.goto(APP + '/app-v3/04-med-detalhe.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P13', 'paciente-medicamento-detalhe');

    log('\n[P14] 05-add-medicamento.html');
    await page.goto(APP + '/app-v3/05-add-medicamento.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P14', 'paciente-add-medicamento');

    log('\n[P15] 06-alergias.html');
    await page.goto(APP + '/app-v3/06-alergias.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P15', 'paciente-alergias');

    log('\n[P16] 07-alergia-detalhe.html');
    await page.goto(APP + '/app-v3/07-alergia-detalhe.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P16', 'paciente-alergia-detalhe');

    log('\n[P17] 08-add-alergia.html');
    await page.goto(APP + '/app-v3/08-add-alergia.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P17', 'paciente-add-alergia');

    log('\n[P18] 71-privacidade.html');
    await page.goto(APP + '/app-v3/71-privacidade.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P18', 'paciente-privacidade');

    log('\n[P19] 01-saude.html (home standalone)');
    await page.goto(APP + '/app-v3/01-saude.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P19', 'paciente-saude-standalone');

    log('\n[P20] Estado erro: pre-consulta sem token');
    await page.goto(APP + '/app-v3/pre-consulta.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P20', 'paciente-preconsulta-sem-token');

    log('\n[P21] Estado erro: pre-consulta token inválido');
    await page.goto(APP + '/app-v3/pre-consulta.html?token=INVALIDO-' + TS, { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'P21', 'paciente-preconsulta-token-invalido');

    // INTERAÇÕES — voltar pra Consultas, tentar clicar
    log('\n[P22] Interação: clicar primeiro card da aba Consultas');
    await page.goto(APP + '/app-v3/15-consultas.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);
    const cardsP = await page.locator('[onclick], .card, [class*="card"]').count();
    log(`     · ${cardsP} elementos clicáveis na aba`);
    if (cardsP > 0) {
      const clicou = await tentarClicar(page, page.locator('[onclick]:visible, [class*="card"]:visible').first(), 'primeiro card');
      if (clicou) await registrarTela(page, 'P22', 'paciente-apos-clicar-card', 'depois clique');
      else await registrarTela(page, 'P22', 'paciente-card-nao-clicou', 'falha clique');
    } else {
      await registrarTela(page, 'P22', 'paciente-sem-cards-clicaveis', '');
    }

    await ctx.close();
  }

  // ==========================================================
  // APP MÉDICO DESKTOP — viewport desktop
  // ==========================================================
  log('\n💻 ============ APP MÉDICO DESKTOP ============');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(({ t, u }) => {
      localStorage.setItem('vitae_token', t);
      localStorage.setItem('vitae_usuario', JSON.stringify(u));
    }, { t: med.token, u: med.usuario });

    // M01 — Aba Hoje (cockpit)
    log('\n[M01] Aba Hoje (cockpit)');
    await page.goto(APP + '/desktop/app-v2.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'M01', 'medico-aba-hoje');

    // M02 — Aba Pré-Consultas
    log('\n[M02] Aba Pré-Consultas');
    await page.evaluate(() => { try { window.goto && window.goto('pre-consultas'); } catch (e) {} });
    await registrarTela(page, 'M02', 'medico-aba-pre-consultas');

    // M03 — Aba Pacientes
    log('\n[M03] Aba Pacientes (lista)');
    await page.evaluate(() => { try { window.goto && window.goto('pacientes'); } catch (e) {} });
    await registrarTela(page, 'M03', 'medico-aba-pacientes-lista');

    // M04 — Aba Pacientes — clicar no primeiro
    log('\n[M04] Pacientes — clicar no primeiro paciente');
    const pacItems = await page.locator('.pat-item, [class*="pat-item"], tr[onclick], [onclick*="selectedPaciente"]').count();
    log(`     · ${pacItems} pacientes clicáveis na lista`);
    if (pacItems > 0) {
      try {
        await page.locator('.pat-item, [class*="pat-item"], tr[onclick], [onclick*="selectedPaciente"]').first().click({ timeout: 5000 });
        await page.waitForTimeout(3000);
      } catch (e) {
        log(`     · clique falhou: ${e.message.slice(0, 60)}`);
      }
    }
    await registrarTela(page, 'M04', 'medico-paciente-detalhe-clicado');

    // M05 — Tentar clicar na timeline (briefing 1 min)
    log('\n[M05] Briefing 1 minuto');
    const timelineItems = await page.locator('.tl-evt, .tl-evt-t, [class*="timeline"]').count();
    log(`     · ${timelineItems} items na timeline`);
    if (timelineItems > 0) {
      try {
        await page.locator('.tl-evt-t, .tl-evt, [class*="timeline"]').first().click({ timeout: 5000 });
        await page.waitForTimeout(4000);
      } catch (e) {
        log(`     · timeline não clicou: ${e.message.slice(0, 60)}`);
      }
    }
    await registrarTela(page, 'M05', 'medico-briefing-1minuto');

    // M06 — Aba Templates
    log('\n[M06] Aba Templates');
    await page.evaluate(() => { try { window.goto && window.goto('templates'); } catch (e) {} });
    await registrarTela(page, 'M06', 'medico-aba-templates');

    // M07 — Aba Perfil (5 sub-abas)
    log('\n[M07] Aba Perfil');
    await page.evaluate(() => { try { window.goto && window.goto('perfil'); } catch (e) {} });
    await registrarTela(page, 'M07', 'medico-aba-perfil');

    // M08-11 — Sub-abas do Perfil
    const subAbasPerfil = [
      { id: 'M08', nome: 'perfil-dados', click: 'Dados' },
      { id: 'M09', nome: 'perfil-tempo-receita', click: 'Tempo' },
      { id: 'M10', nome: 'perfil-integracoes', click: 'Integrações' },
      { id: 'M11', nome: 'perfil-voz', click: 'Voz' },
      { id: 'M12', nome: 'perfil-conta', click: 'Conta' },
    ];
    for (const sa of subAbasPerfil) {
      log(`\n[${sa.id}] Perfil → ${sa.click}`);
      await tentarClicar(page, sa.click, sa.click);
      await registrarTela(page, sa.id, sa.nome);
    }

    // M13 — Aba Pré-Consultas e clicar numa linha pra abrir sumário
    log('\n[M13] Pré-Consultas — abrir sumário');
    await page.evaluate(() => { try { window.goto && window.goto('pre-consultas'); } catch (e) {} });
    await page.waitForTimeout(2500);
    const pcLinhas = await page.locator('.pcn-trow, tr[onclick], [class*="pcn-tr"]').count();
    log(`     · ${pcLinhas} linhas de PC`);
    if (pcLinhas > 0) {
      try {
        await page.locator('.pcn-trow, tr[onclick]').first().click({ timeout: 5000 });
        await page.waitForTimeout(3500);
      } catch (e) {}
    }
    await registrarTela(page, 'M13', 'medico-pc-sumario');

    // M14 — Modal Criar PC (tenta abrir)
    log('\n[M14] Modal Criar PC');
    await page.evaluate(() => { try { window.goto && window.goto('pacientes'); } catch (e) {} });
    await page.waitForTimeout(2500);
    // Tenta clicar em qualquer botão "Nova" ou "Criar" ou "+"
    const abriu = await tentarClicar(page, page.locator('button:has-text("Nova"), button:has-text("Criar"), button[onclick*="modalCriarPC"]').first(), 'criar PC');
    if (abriu) await registrarTela(page, 'M14', 'medico-modal-criar-pc');
    else await registrarTela(page, 'M14', 'medico-criar-pc-nao-abriu');

    // M15 — Fecha modal e tenta abrir Como Funciona Templates
    log('\n[M15] Modal Como Funciona Templates');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { window.goto && window.goto('templates'); } catch (e) {} });
    await page.waitForTimeout(2000);
    const comoFunc = await tentarClicar(page, page.locator('button:has-text("Como funciona"), [onclick*="modalComoFunciona"]').first(), 'como funciona');
    if (comoFunc) await registrarTela(page, 'M15', 'medico-como-funciona-templates');
    else await registrarTela(page, 'M15', 'medico-como-funciona-nao-abriu');

    // M16 — Tela criar template (3 passos)
    log('\n[M16] Tela criar template');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.evaluate(() => { try { window.abrirCriarTemplate && window.abrirCriarTemplate(); } catch (e) {} });
    await page.waitForTimeout(3000);
    await registrarTela(page, 'M16', 'medico-criar-template-passo1');

    // M17 — Sidebar logout modal
    log('\n[M17] Modal Logout');
    await page.evaluate(() => { try { window.goto && window.goto('hoje'); } catch (e) {} });
    await page.waitForTimeout(1500);
    const logoutClicou = await tentarClicar(page, page.locator('[onclick*="modalLogout"], #sbUserAvatar').first(), 'avatar sidebar');
    if (logoutClicou) await registrarTela(page, 'M17', 'medico-modal-logout');
    else await registrarTela(page, 'M17', 'medico-logout-nao-abriu');

    // M18 — Estado sem auth (logout simulado)
    log('\n[M18] Estado sem auth (após limpar localStorage)');
    await page.evaluate(() => localStorage.clear());
    await page.goto(APP + '/desktop/app-v2.html', { waitUntil: 'load', timeout: 30000 });
    await registrarTela(page, 'M18', 'medico-sem-auth-redireciona');

    await ctx.close();
  }

  await browser.close();

  // ==========================================================
  // GERAR RELATÓRIO MD
  // ==========================================================
  log('\n📄 Gerando relatório...');
  let md = `# Cobertura Visual Total — ${TS}\n\n`;
  md += `**Período:** ${resultado.telas[0]?.url ? new Date().toISOString() : ''}\n\n`;
  md += `## Resumo\n\n| Métrica | Valor |\n|---|---|\n`;
  md += `| Total telas testadas | ${resultado.resumo.total} |\n`;
  md += `| ✅ OK (elementos visíveis) | ${resultado.resumo.ok} |\n`;
  md += `| ⚠️ Parcial (poucos elementos) | ${resultado.resumo.parcial} |\n`;
  md += `| ❌ Erro | ${resultado.resumo.erro} |\n\n`;

  md += `## 📱 PACIENTE V3\n\n`;
  for (const t of resultado.telas.filter(x => x.id?.startsWith('P'))) {
    const ico = t.status === 'ok' ? '✅' : t.status === 'parcial' ? '⚠️' : '❌';
    md += `### ${ico} [${t.id}] ${t.nome}\n`;
    if (t.elementos) {
      md += `- **URL:** \`${t.url?.slice(-80)}\`\n`;
      md += `- **Botões visíveis:** ${t.elementos.botoes} · **Cards:** ${t.elementos.cards} · **Headings:** ${t.elementos.headings} · **Inputs:** ${t.elementos.inputs}\n`;
    }
    if (t.print) md += `- ![${t.id}](prints/${t.print})\n`;
    if (t.preview) md += `- **Preview:** \`${t.preview.replace(/\n/g, ' ').slice(0, 200)}\`\n`;
    if (t.erro) md += `- **Erro:** ${t.erro}\n`;
    md += `\n`;
  }

  md += `## 💻 MÉDICO DESKTOP\n\n`;
  for (const t of resultado.telas.filter(x => x.id?.startsWith('M'))) {
    const ico = t.status === 'ok' ? '✅' : t.status === 'parcial' ? '⚠️' : '❌';
    md += `### ${ico} [${t.id}] ${t.nome}\n`;
    if (t.elementos) {
      md += `- **URL:** \`${t.url?.slice(-80)}\`\n`;
      md += `- **Botões:** ${t.elementos.botoes} · **Cards:** ${t.elementos.cards} · **Headings:** ${t.elementos.headings} · **Inputs:** ${t.elementos.inputs}\n`;
    }
    if (t.print) md += `- ![${t.id}](prints/${t.print})\n`;
    if (t.preview) md += `- **Preview:** \`${t.preview.replace(/\n/g, ' ').slice(0, 200)}\`\n`;
    if (t.erro) md += `- **Erro:** ${t.erro}\n`;
    md += `\n`;
  }

  fs.writeFileSync(path.join(OUT, 'relatorio.md'), md);
  log(`✅ FIM — ${OUT}`);
  log(`📄 Relatório: ${path.join(OUT, 'relatorio.md')}`);
  log(`🖼️  ${resultado.telas.filter(t => t.print).length} prints em ${PRINTS}`);
})();
