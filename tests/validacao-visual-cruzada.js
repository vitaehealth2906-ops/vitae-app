/**
 * VALIDAÇÃO VISUAL CRUZADA — confirma que os dados criados na bateria APARECEM:
 *   1. No app paciente v3 (aba Consultas — retornos, documentos, próxima, histórico)
 *   2. No app médico desktop (aba Pacientes — lista, detalhe do paciente Lucas)
 *
 * NÃO chama API direto — só Playwright UI + leitura do DOM.
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const APP = 'https://vitae-app.vercel.app';
const API = 'https://vitae-app-production.up.railway.app';
const TS = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const OUT = path.join(__dirname, `validacao-visual-${TS}`);
fs.mkdirSync(OUT, { recursive: true });

async function login(email, senha) {
  const r = await fetch(API + '/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, senha }),
  });
  if (!r.ok) throw new Error('login: ' + r.status);
  return r.json();
}

function log(s) { console.log(`[${new Date().toLocaleTimeString('pt-BR')}] ${s}`); }

async function shot(page, nome) {
  await page.screenshot({ path: path.join(OUT, `${nome}.png`), fullPage: true });
}

(async () => {
  log('🚀 VALIDAÇÃO VISUAL CRUZADA');
  const med = await login(process.env.MEDICO_EMAIL, process.env.MEDICO_SENHA);
  const pac = await login(process.env.PACIENTE_EMAIL, process.env.PACIENTE_SENHA);
  log(`   ✓ médico ${med.usuario.tipo} · paciente ${pac.usuario.tipo}`);

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const resultado = { paciente: {}, medico: {} };

  // ============== PACIENTE — Aba Consultas ==============
  log('\n📱 [PACIENTE] Abrindo aba Consultas...');
  {
    const ctx = await browser.newContext({ viewport: { width: 414, height: 896 } });
    const page = await ctx.newPage();
    await page.addInitScript(({ t, u }) => {
      localStorage.setItem('vitae_token', t);
      localStorage.setItem('vitae_usuario', JSON.stringify(u));
    }, { t: pac.token, u: pac.usuario });
    await page.goto(APP + '/app-v3/15-consultas.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(4000); // espera dados carregarem

    await shot(page, 'paciente-consultas-fullpage');

    // Conta elementos visíveis
    resultado.paciente.bodyText = (await page.locator('body').innerText()).slice(0, 2000);

    // Tenta achar containers conhecidos
    resultado.paciente.retornoContainer = await page.locator('#retornos-container, [id*="retorno"], .retorno-card').count();
    resultado.paciente.documentosContainer = await page.locator('#documentos-container, [id*="documentos"], .doc-card').count();
    resultado.paciente.proximaContainer = await page.locator('#proxima-consulta-container, [id*="proxima"]').count();
    resultado.paciente.historicoContainer = await page.locator('#historico-container, [id*="historico"]').count();

    // Conta total de cards na página
    resultado.paciente.cardsTotal = await page.locator('.card, [class*="card"]').count();

    // Vê se há texto-chave que indica dados visíveis
    const txt = resultado.paciente.bodyText.toLowerCase();
    resultado.paciente.menciona = {
      retorno: txt.includes('retorno'),
      proximaConsulta: txt.includes('próxima') || txt.includes('proxima'),
      historico: txt.includes('histórico') || txt.includes('historico'),
      documento: txt.includes('documento'),
      vazio: txt.includes('nenhuma') || txt.includes('vazio') || txt.includes('sem '),
      laudo: txt.includes('laudo'),
      receita: txt.includes('receita'),
      'robo-fase2': txt.includes('robo-fase2'),
      'robo-master': txt.includes('robo-master'),
    };

    log('   📊 PACIENTE — aba Consultas:');
    log(`      · ${resultado.paciente.cardsTotal} cards totais na página`);
    log(`      · retorno container: ${resultado.paciente.retornoContainer}`);
    log(`      · documentos container: ${resultado.paciente.documentosContainer}`);
    log(`      · proxima consulta container: ${resultado.paciente.proximaContainer}`);
    log(`      · historico container: ${resultado.paciente.historicoContainer}`);
    log(`      · menciona retorno: ${resultado.paciente.menciona.retorno}`);
    log(`      · menciona documento: ${resultado.paciente.menciona.documento}`);
    log(`      · menciona laudo: ${resultado.paciente.menciona.laudo}`);
    log(`      · menciona ROBO-FASE2 (lixo de teste): ${resultado.paciente.menciona['robo-fase2']}`);

    // Tenta clicar no primeiro card que apareça (próxima ou histórico) e validar detalhe
    const cardsClicaveis = await page.locator('[onclick*="vitaeNav"], a[href*="16-consulta-detalhe"]').count();
    log(`      · ${cardsClicaveis} cards clicáveis pra ver detalhe`);
    resultado.paciente.cardsClicaveis = cardsClicaveis;

    if (cardsClicaveis > 0) {
      try {
        await page.locator('[onclick*="vitaeNav"], a[href*="16-consulta-detalhe"]').first().click({ timeout: 5000 });
        await page.waitForTimeout(3000);
        await shot(page, 'paciente-consulta-detalhe');
        const detalheUrl = page.url();
        const detalheTxt = (await page.locator('body').innerText()).slice(0, 1500);
        resultado.paciente.detalhe = {
          url: detalheUrl,
          texto: detalheTxt,
          temMedico: /dr\.?|doutora?|médic/i.test(detalheTxt),
          temData: /(202[5-9]|\d{1,2}[/-]\d{1,2})/.test(detalheTxt),
        };
        log(`      · clicou no primeiro card → detalhe url=${detalheUrl.slice(-60)}`);
        log(`      · detalhe mostra médico: ${resultado.paciente.detalhe.temMedico}`);
        log(`      · detalhe mostra data: ${resultado.paciente.detalhe.temData}`);
      } catch (e) {
        log(`      ⚠️ clique no card falhou: ${e.message.slice(0, 80)}`);
      }
    }

    await ctx.close();
  }

  // ============== MÉDICO — Aba Pacientes ==============
  log('\n💻 [MÉDICO] Abrindo aba Pacientes...');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.addInitScript(({ t, u }) => {
      localStorage.setItem('vitae_token', t);
      localStorage.setItem('vitae_usuario', JSON.stringify(u));
    }, { t: med.token, u: med.usuario });
    await page.goto(APP + '/desktop/app-v2.html', { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Vai direto pra aba Pacientes
    await page.evaluate(() => { try { window.goto && window.goto('pacientes'); } catch (e) {} });
    await page.waitForTimeout(3000);
    await shot(page, 'medico-aba-pacientes-lista');

    const bodyText = (await page.locator('body').innerText()).slice(0, 3000);
    resultado.medico.bodyText = bodyText;

    // Conta cards/linhas de pacientes na lista esquerda
    const pacItens = await page.locator('.pat-item, [class*="pat-list"] > div, [class*="paciente"]').count();
    const pacItemsAvatar = await page.locator('.pat-item-av').count();
    log(`   📊 MÉDICO — Aba Pacientes:`);
    log(`      · ${pacItens} containers de paciente na lista`);
    log(`      · ${pacItemsAvatar} avatares na lista`);

    resultado.medico.pacItens = pacItens;
    resultado.medico.menciona = {
      lucas: /lucas/i.test(bodyText),
      borelli: /borelli/i.test(bodyText),
      'robo-fase2': /robo-fase2/i.test(bodyText),
      'robo-master': /robo-master/i.test(bodyText),
      'preconsulta': /pré-consulta|preconsulta/i.test(bodyText),
    };
    log(`      · menciona "Lucas": ${resultado.medico.menciona.lucas}`);
    log(`      · menciona "Borelli": ${resultado.medico.menciona.borelli}`);
    log(`      · menciona ROBO-FASE2: ${resultado.medico.menciona['robo-fase2']}`);

    // Tenta clicar no primeiro paciente da lista
    try {
      await page.locator('.pat-item').first().click({ timeout: 5000 });
      await page.waitForTimeout(3500);
      await shot(page, 'medico-paciente-detalhe');

      const detTxt = (await page.locator('body').innerText()).slice(0, 4000);
      const detalheHeroNome = await page.locator('.pat-name-big, .pt-name-big, [class*="pat-name"]').first().textContent().catch(() => '?');
      const accordionCount = await page.locator('[class*="accordion"], [class*="acc-"], summary, details').count();
      const timelineItems = await page.locator('.tl-evt, [class*="timeline"]').count();
      const insightCards = await page.locator('.compare-card, .compare-cta, [class*="insight"]').count();

      log(`      · paciente aberto: "${detalheHeroNome.slice(0, 60)}"`);
      log(`      · ${accordionCount} accordions / ${timelineItems} timeline items / ${insightCards} insight cards`);

      resultado.medico.detalhe = {
        nomeHero: detalheHeroNome,
        textoSample: detTxt.slice(0, 1500),
        accordions: accordionCount,
        timeline: timelineItems,
        insights: insightCards,
        menciona: {
          'pre-consulta': /pré-consulta|preconsulta/i.test(detTxt),
          medicamentos: /medicament/i.test(detTxt),
          alergias: /alergia/i.test(detTxt),
          exames: /exame/i.test(detTxt),
          retorno: /retorno/i.test(detTxt),
          documento: /documento/i.test(detTxt),
        },
      };

      // Tenta clicar numa anamnese da timeline pra ver o briefing
      if (timelineItems > 0) {
        try {
          await page.locator('.tl-evt-t, [class*="timeline"] [onclick]').first().click({ timeout: 5000 });
          await page.waitForTimeout(4000);
          await shot(page, 'medico-briefing-1minuto');
          const briefTxt = (await page.locator('body').innerText()).slice(0, 2500);
          resultado.medico.briefing = {
            texto: briefTxt.slice(0, 1500),
            temPlayer: await page.locator('audio, .pl-play, .player').count() > 0,
            temTranscricao: /transcri/i.test(briefTxt),
            temAnamnese: /anamnese/i.test(briefTxt),
            temQueixa: /queixa/i.test(briefTxt),
          };
          log(`      · briefing aberto: player=${resultado.medico.briefing.temPlayer}, transcricao=${resultado.medico.briefing.temTranscricao}, anamnese=${resultado.medico.briefing.temAnamnese}, queixa=${resultado.medico.briefing.temQueixa}`);
        } catch (e) {
          log(`      ⚠️ clique na timeline falhou: ${e.message.slice(0, 80)}`);
        }
      }
    } catch (e) {
      log(`      ⚠️ clique no paciente falhou: ${e.message.slice(0, 80)}`);
    }

    await ctx.close();
  }

  await browser.close();

  // Salva relatório JSON
  fs.writeFileSync(path.join(OUT, 'resultado.json'), JSON.stringify(resultado, null, 2));

  // Gera MD
  let md = `# Validação Visual Cruzada — ${TS}\n\n`;
  md += `Validação de DOM real do app paciente e médico, confirmando que os dados chegam visualmente.\n\n`;

  md += `## 📱 Paciente — Aba Consultas\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| Cards totais visíveis | ${resultado.paciente.cardsTotal} |\n`;
  md += `| Container "retornos" | ${resultado.paciente.retornoContainer} |\n`;
  md += `| Container "documentos" | ${resultado.paciente.documentosContainer} |\n`;
  md += `| Container "próxima" | ${resultado.paciente.proximaContainer} |\n`;
  md += `| Container "histórico" | ${resultado.paciente.historicoContainer} |\n`;
  md += `| Cards clicáveis (→ detalhe) | ${resultado.paciente.cardsClicaveis} |\n`;
  md += `\n**Palavras-chave encontradas no DOM:**\n`;
  for (const [k, v] of Object.entries(resultado.paciente.menciona)) {
    md += `- ${v ? '✅' : '❌'} ${k}\n`;
  }
  if (resultado.paciente.detalhe) {
    md += `\n**Tela detalhe da consulta:**\n`;
    md += `- URL: \`${resultado.paciente.detalhe.url}\`\n`;
    md += `- Mostra médico: ${resultado.paciente.detalhe.temMedico ? '✅' : '❌'}\n`;
    md += `- Mostra data: ${resultado.paciente.detalhe.temData ? '✅' : '❌'}\n`;
  }

  md += `\n## 💻 Médico — Aba Pacientes\n\n`;
  md += `| Métrica | Valor |\n|---|---|\n`;
  md += `| Pacientes na lista | ${resultado.medico.pacItens} |\n`;
  md += `\n**Palavras-chave no DOM:**\n`;
  for (const [k, v] of Object.entries(resultado.medico.menciona)) {
    md += `- ${v ? '✅' : '❌'} ${k}\n`;
  }

  if (resultado.medico.detalhe) {
    md += `\n**Tela detalhe do paciente (clique no primeiro):**\n`;
    md += `- Nome no hero: "${resultado.medico.detalhe.nomeHero}"\n`;
    md += `- Accordions: ${resultado.medico.detalhe.accordions}\n`;
    md += `- Timeline items: ${resultado.medico.detalhe.timeline}\n`;
    md += `- Insight cards: ${resultado.medico.detalhe.insights}\n`;
    md += `\n**Termos no detalhe:**\n`;
    for (const [k, v] of Object.entries(resultado.medico.detalhe.menciona)) {
      md += `- ${v ? '✅' : '❌'} ${k}\n`;
    }
  }

  if (resultado.medico.briefing) {
    md += `\n**Briefing de 1 minuto (clique na timeline):**\n`;
    md += `- Player de áudio: ${resultado.medico.briefing.temPlayer ? '✅' : '❌'}\n`;
    md += `- Transcrição: ${resultado.medico.briefing.temTranscricao ? '✅' : '❌'}\n`;
    md += `- Anamnese: ${resultado.medico.briefing.temAnamnese ? '✅' : '❌'}\n`;
    md += `- Queixa principal: ${resultado.medico.briefing.temQueixa ? '✅' : '❌'}\n`;
  }

  md += `\n## 📁 Prints\n\n`;
  const prints = fs.readdirSync(OUT).filter(f => f.endsWith('.png'));
  for (const p of prints) md += `- ${p}\n`;

  fs.writeFileSync(path.join(OUT, 'relatorio.md'), md);
  log(`\n✅ FIM — ${OUT}`);
  log(`📄 Relatório: ${path.join(OUT, 'relatorio.md')}`);
})();
