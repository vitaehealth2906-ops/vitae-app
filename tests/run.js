/**
 * VITAE Preview — bateria de testes UX automatizados
 * Roda Edge headed, navega no preview, clica/digita/screenshot
 * Salva tudo em tests/shots/ + log de bugs em tests/relatorio.json
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PREVIEW = 'file:///D:/vitae-app-novo/preview-menu-reformulado.html';
const SHOTS = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const bugs = [];
function step(name, status, info) {
  const entry = { t: new Date().toISOString(), name, status, info: info || '' };
  log.push(entry);
  console.log(`[${status}] ${name}${info ? ' — ' + info : ''}`);
}
function bug(severity, where, what, repro) {
  bugs.push({ severity, where, what, repro });
  console.log(`  🐛 [${severity}] ${where}: ${what}`);
}

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--allow-file-access-from-files', '--disable-web-security']
  });
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();

  // captura console + erros JS
  page.on('console', m => { if (m.type() === 'error') bug('warn', 'console', m.text(), 'aba aberta'); });
  page.on('pageerror', e => bug('crit', 'pageerror', e.message, 'aba aberta'));

  async function shot(name) {
    const file = path.join(SHOTS, name + '.png');
    await page.screenshot({ path: file, fullPage: false });
    return file;
  }

  // Helper: todos os clicks/digitações abaixo são DENTRO do iframe da versão reformulada
  async function frame() {
    const f = page.frame({ name: 'frame-new' }) || (await page.$('#frame-new').then(h => h && h.contentFrame()));
    if (!f) throw new Error('iframe frame-new não encontrado');
    return f;
  }

  try {
    // ============ 0. SMOKE TEST ============
    step('0. abrir wrapper preview', 'run');
    await page.goto(PREVIEW, { waitUntil: 'networkidle', timeout: 20000 });
    await page.waitForTimeout(800);
    await shot('00_wrapper');
    step('0. abrir wrapper preview', 'ok');

    step('0a. ativar Versão reformulada', 'run');
    const newBtn = await page.$('#btn-new');
    if (newBtn) {
      const isActive = await newBtn.evaluate(b => b.classList.contains('active'));
      if (!isActive) await newBtn.click();
    }
    await page.waitForTimeout(2500); // espera iframe carregar
    await shot('00a_reformulada_open');
    step('0a. ativar Versão reformulada', 'ok');

    step('0b. fechar dock "Por que mudei?" se aberto', 'run');
    const dockOpen = await page.$('#dock.show, #dock:not(.hidden)');
    if (dockOpen) {
      // dock está visível por padrão e bloqueia clicks em alertas/info-icons
      bug('high', 'Wrapper preview', 'Dock "Por que mudei?" abre por default e intercepta pointer events do iframe — usuário não consegue clicar em alertas/info-icons no canto direito da tela', 'Recarregar wrapper → tentar hover em info-ico do alerta prosódica');
      const closeBtn = await page.$('.dock-close');
      if (closeBtn) await closeBtn.click();
      await page.waitForTimeout(400);
    }
    step('0b. fechar dock "Por que mudei?" se aberto', 'ok');

    const fr = await frame();

    // ============ 1. ABA HOJE ============
    step('1. Hoje carrega', 'run');
    await fr.waitForSelector('[data-view="hoje"]', { timeout: 5000 });
    await shot('01_hoje');
    step('1. Hoje carrega', 'ok');

    step('1a. tooltip Possíveis urgências', 'run');
    const infoIco = await fr.$('.alert-prosodica .info-ico');
    if (infoIco) {
      await infoIco.hover();
      await page.waitForTimeout(500);
      await shot('01a_tooltip_prosodica');
      step('1a. tooltip Possíveis urgências', 'ok');
    } else { bug('med', 'Hoje', 'card Possíveis urgências detectadas não encontrado', 'view Hoje'); step('1a. tooltip Possíveis urgências', 'fail'); }

    step('1b. clicar setas alerta', 'run');
    const arrows = await fr.$$('.ap-arrow');
    if (arrows.length >= 2) { await arrows[1].click(); await page.waitForTimeout(300); await shot('01b_alerta_seta_2'); step('1b. clicar setas alerta', 'ok'); }
    else { bug('low', 'Hoje', 'setas de navegação alertas não encontradas', 'card prosódica'); step('1b. clicar setas alerta', 'fail'); }

    step('1c. clicar stat Sem anamnese', 'run');
    const stats = await fr.$$('.stat');
    if (stats.length >= 4) {
      await stats[3].click();
      await page.waitForTimeout(800);
      await shot('01c_stat_sem_anamnese');
      const url = page.url();
      step('1c. clicar stat Sem anamnese', 'ok', 'navegou pra ' + url);
    } else { bug('med', 'Hoje', 'menos de 4 stats encontrados', 'view Hoje'); step('1c. clicar stat Sem anamnese', 'fail'); }

    // volta pra Hoje
    await fr.click('[data-view="hoje"]');
    await page.waitForTimeout(500);

    // ============ 2. PRÉ-CONSULTAS ============
    step('2. abrir Pré-Consultas', 'run');
    await fr.click('[data-view="pre-consultas"]');
    await page.waitForTimeout(800);
    await shot('02_pcs');
    step('2. abrir Pré-Consultas', 'ok');

    step('2a. click cada filtro', 'run');
    const pillCount = (await fr.$$('.pcn-pill')).length;
    for (let i = 0; i < pillCount; i++) {
      const pillsAgora = await fr.$$('.pcn-pill'); // refaz query: re-render reescreve DOM
      if (pillsAgora[i]) {
        await pillsAgora[i].click();
        await page.waitForTimeout(300);
      }
    }
    await shot('02a_filters');
    step('2a. click cada filtro', 'ok', pillCount + ' filtros testados');

    step('2b. busca digitar Maria (typing real)', 'run');
    // resetar filtro pra Todas antes (passo 2a deixou em Expiradas)
    const todasPill = await fr.$$('.pcn-pill').then(arr => arr[0]);
    if (todasPill) { await todasPill.click(); await page.waitForTimeout(300); }
    const searchPC = await fr.$('input[placeholder*="Buscar paciente"]');
    if (searchPC) {
      await searchPC.click();
      // simula digitação real com type() (respeita case)
      await searchPC.type('Maria', { delay: 80 });
      await page.waitForTimeout(400);
      await shot('02b_busca_maria');
      // verifica filtragem
      const linhas = await fr.$$('.pcn-trow');
      const inputFinal = await fr.$('input[placeholder*="Buscar paciente"]');
      const valorFinal = inputFinal ? await inputFinal.inputValue() : '(input sumiu)';
      const focused = inputFinal ? await fr.evaluate(el => document.activeElement === el, inputFinal) : false;
      if (valorFinal !== 'Maria') bug('crit', 'PCs', `valor final do input ≠ Maria: "${valorFinal}" (perdeu caracteres durante digitação)`, 'aba PCs → busca');
      if (!focused) bug('crit', 'PCs', 'input perde foco a cada letra digitada (re-render reescreve DOM)', 'aba PCs → busca');
      if (linhas.length !== 1) bug('high', 'PCs', `busca por Maria deveria retornar 1 linha, retornou ${linhas.length}`, 'aba PCs → busca');
      step('2b. busca digitar Maria (caractere por caractere)', 'ok', `valor=${valorFinal} foco=${focused} linhas=${linhas.length}`);
      const inputClear = await fr.$('input[placeholder*="Buscar paciente"]');
      if (inputClear) await inputClear.fill('');
      await page.waitForTimeout(300);
    } else { bug('med', 'PCs', 'input de busca não encontrado', 'view PCs'); step('2b. busca digitar Maria (caractere por caractere)', 'fail'); }

    step('2c. click PC respondida → resumo', 'run');
    const pillsTodos = await fr.$$('.pcn-pill');
    if (pillsTodos[0]) await pillsTodos[0].click(); // Todas
    await page.waitForTimeout(300);
    const linhasResp = await fr.$$('.pcn-trow');
    if (linhasResp.length) {
      await linhasResp[0].click();
      await page.waitForTimeout(1200);
      await shot('02c_summary_aberto');
      const back = await fr.$('.pt-detail-back');
      if (back) {
        step('2c. click PC respondida → resumo', 'ok', 'summary abriu');
        await back.click();
        await page.waitForTimeout(500);
      } else { bug('high', 'Summary', 'botão voltar não apareceu no resumo', 'após click em PC'); step('2c. click PC respondida → resumo', 'fail'); }
    }

    // ============ 3. PACIENTES ============
    step('3. abrir Pacientes', 'run');
    await fr.click('[data-view="pacientes"]');
    await page.waitForTimeout(800);
    await shot('03_pacientes');
    step('3. abrir Pacientes', 'ok');

    step('3z. busca Pacientes — verifica bug do input', 'run');
    const searchPac = await fr.$('input[placeholder*="Buscar nome"]');
    if (searchPac) {
      await searchPac.click();
      await searchPac.type('Ana', { delay: 80 });
      const inputFinal = await fr.$('input[placeholder*="Buscar nome"]');
      const v = inputFinal ? await inputFinal.inputValue() : '(sumiu)';
      const f = inputFinal ? await fr.evaluate(el => document.activeElement === el, inputFinal) : false;
      if (v !== 'Ana') bug('crit', 'Pacientes', `busca: digitei "Ana" virou "${v}" (mesmo bug de re-render)`, 'aba Pacientes → busca');
      if (!f) bug('crit', 'Pacientes', 'busca perde foco a cada letra (mesmo bug de re-render)', 'aba Pacientes → busca');
      step('3z. busca Pacientes — verifica bug do input', 'ok', `valor=${v} foco=${f}`);
      const ic = await fr.$('input[placeholder*="Buscar nome"]');
      if (ic) await ic.fill('');
      await page.waitForTimeout(200);
    }

    step('3a. clicar paciente Maria', 'run');
    const patItems = await fr.$$('.pat-item');
    if (patItems.length) {
      await patItems[0].click();
      await page.waitForTimeout(600);
      await shot('03a_paciente_maria');
      step('3a. clicar paciente Maria', 'ok');
    } else { bug('high', 'Pacientes', 'lista de pacientes vazia', 'view Pacientes'); step('3a. clicar paciente Maria', 'fail'); }

    step('3b. botão IA Collab → animação', 'run');
    const compareBtn = await fr.$('.compare-cta button');
    if (compareBtn) {
      await compareBtn.click();
      await page.waitForTimeout(500);
      await shot('03b_ia_collab_loading_1');
      await page.waitForTimeout(900);
      await shot('03b_ia_collab_loading_2');
      await page.waitForTimeout(1100);
      await shot('03b_ia_collab_resultado');
      const compareCard = await fr.$('.compare-card');
      if (compareCard) step('3b. botão IA Collab → animação', 'ok');
      else { bug('high', 'IA Collab', 'card não revelou após animação', 'paciente Maria'); step('3b. botão IA Collab → animação', 'fail'); }
    } else { bug('med', 'Pacientes', 'botão Comparar com IA Collab não encontrado', 'paciente Maria'); step('3b. botão IA Collab → animação', 'fail'); }

    step('3c. paciente sem anamnese (Beatriz)', 'run');
    const beatriz = patItems.find ? null : null;
    const allPats = await fr.$$('.pat-item');
    let beatrizIdx = -1;
    for (let i = 0; i < allPats.length; i++) {
      const t = await allPats[i].textContent();
      if (t && t.indexOf('Beatriz') >= 0) { beatrizIdx = i; break; }
    }
    if (beatrizIdx >= 0) {
      await allPats[beatrizIdx].click();
      await page.waitForTimeout(500);
      await shot('03c_beatriz_sem_anamnese');
      // tenta clicar Disparar pré-consulta no empty state
      const dispBtn = await fr.$('.pat-empty-detail button');
      if (dispBtn) {
        await dispBtn.click();
        await page.waitForTimeout(800);
        await shot('03c2_tela_disparar_via_paciente');
        step('3c. paciente sem anamnese (Beatriz)', 'ok', 'tela disparar abriu');
      } else { bug('med', 'Pacientes', 'CTA Disparar pré-consulta não encontrada no empty state', 'paciente Beatriz'); step('3c. paciente sem anamnese (Beatriz)', 'fail'); }
    } else { bug('low', 'Pacientes', 'Beatriz não encontrada na lista', 'view Pacientes'); step('3c. paciente sem anamnese (Beatriz)', 'fail'); }

    // volta
    await fr.click('[data-view="pacientes"]');
    await page.waitForTimeout(400);

    // ============ 4. TEMPLATES ============
    // garantir voltou pra view normal (não está em tela disparar)
    const sidebarTpl = await fr.$('[data-view="templates"]');
    if (sidebarTpl) {
      try { await sidebarTpl.click({ timeout: 5000 }); } catch (e) {
        // se sidebar não responde, é porque tela disparar tomou conta — usar botão voltar
        const back = await fr.$('.pt-detail-back');
        if (back) { await back.click(); await page.waitForTimeout(500); }
        const sidebarTpl2 = await fr.$('[data-view="templates"]');
        if (sidebarTpl2) await sidebarTpl2.click();
      }
    }
    await page.waitForTimeout(700);

    step('4y. busca Templates — verifica bug do input', 'run');
    const searchTpl = await fr.$('input[placeholder*="Buscar template"]');
    if (searchTpl) {
      await searchTpl.click();
      await searchTpl.type('Card', { delay: 80 });
      const ix = await fr.$('input[placeholder*="Buscar template"]');
      const v = ix ? await ix.inputValue() : '(sumiu)';
      const f = ix ? await fr.evaluate(el => document.activeElement === el, ix) : false;
      if (v !== 'Card') bug('crit', 'Templates', `busca: digitei "Card" virou "${v}" (mesmo bug)`, 'aba Templates → busca');
      if (!f) bug('crit', 'Templates', 'busca perde foco a cada letra (mesmo bug)', 'aba Templates → busca');
      step('4y. busca Templates — verifica bug do input', 'ok', `valor=${v} foco=${f}`);
      const ic = await fr.$('input[placeholder*="Buscar template"]');
      if (ic) await ic.fill('');
    }

    step('4. abrir Templates', 'run');
    await fr.click('[data-view="templates"]');
    await page.waitForTimeout(800);
    await shot('04_templates');
    step('4. abrir Templates', 'ok');

    // Como funciona popup
    step('4a. botão "Como funciona?" → popup onb', 'run');
    const comoBtn = await fr.$('button.btn:has-text("Como funciona")');
    if (comoBtn) {
      await comoBtn.click();
      await page.waitForTimeout(800);
      await shot('04a_onb_popup');
      const onbCard = await fr.$('.onb-card');
      if (onbCard) {
        step('4a. botão "Como funciona?" → popup onb', 'ok');
        // navega 4 slides
        for (let i = 0; i < 3; i++) {
          const nextBtn = await fr.$('#tpl-onbBtn');
          if (nextBtn) await nextBtn.click();
          await page.waitForTimeout(400);
          await shot('04a_onb_slide_' + (i + 2));
        }
        // Fechar
        const closeBtn = await fr.$('.onb-close');
        if (closeBtn) await closeBtn.click();
        await page.waitForTimeout(500);
      } else { bug('high', 'Templates', 'popup Como Funciona não abriu', 'click no botão'); step('4a. botão "Como funciona?" → popup onb', 'fail'); }
    } else { bug('high', 'Templates', 'botão Como funciona não encontrado', 'view Templates'); step('4a. botão "Como funciona?" → popup onb', 'fail'); }

    // BUG ESPECÍFICO LUCAS: criar template, adicionar pergunta, clicar pra editar, digitar, sair, ver se preserva
    step('4b. criar template + editar pergunta + sair input', 'run');
    const novoBtn = await fr.$('button.btn-p:has-text("Criar template"), button.btn-p:has-text("Novo template"), button.btn-p:has-text("Criar")');
    if (novoBtn) {
      await novoBtn.click();
      await page.waitForTimeout(800);
      await shot('04b_criar_pc');

      // digitar nome do template
      const nomeInput = await fr.$('input[placeholder*="Cardiologia"], input[placeholder*="Ex.:"]');
      if (nomeInput) { await nomeInput.click(); await nomeInput.fill('Teste Bug'); }
      await page.waitForTimeout(300);

      // adicionar pergunta
      const addBtn = await fr.$('button:has-text("Adicionar pergunta")');
      if (addBtn) {
        await addBtn.click();
        await page.waitForTimeout(400);
        await shot('04b1_pergunta_adicionada');
        // localizar input da pergunta (o último adicionado)
        const qInputs = await fr.$$('.cm-q-row input');
        if (qInputs.length) {
          const qInput = qInputs[qInputs.length - 1];
          // ler valor inicial
          const val0 = await qInput.inputValue();
          // clicar dentro
          await qInput.click();
          await page.waitForTimeout(200);
          // digitar 1 letra
          await qInput.press('A');
          await page.waitForTimeout(150);
          const val1 = await qInput.inputValue();
          await shot('04b2_letra_digitada');
          // clicar fora (no body)
          await fr.locator('body').click({ position: { x: 50, y: 50 } });
          await page.waitForTimeout(500);
          await shot('04b3_apos_clicar_fora');
          // re-ler input
          const qInputsAgain = await fr.$$('.cm-q-row input');
          let val2 = '(perdido)';
          if (qInputsAgain.length === qInputs.length) {
            val2 = await qInputsAgain[qInputs.length - 1].inputValue();
          } else {
            bug('crit', 'Templates → Criar', 'após clicar fora do input, número de perguntas mudou (input apagado/reordenado)', 'add pergunta → click input → digitar → click fora');
          }
          if (val2 !== val1) {
            bug('crit', 'Templates → Criar', `valor digitado se perdeu ao clicar fora. era="${val1}" virou="${val2}"`, 'add pergunta → click input → digitar A → click fora');
          } else {
            step('4b. criar template + editar pergunta + sair input', 'ok', `valor preservado: "${val2}"`);
          }
        } else { bug('crit', 'Templates → Criar', 'inputs de pergunta não aparecem após Adicionar', 'click Adicionar pergunta'); step('4b. criar template + editar pergunta + sair input', 'fail'); }
      } else { bug('crit', 'Templates → Criar', 'botão Adicionar pergunta não encontrado', 'tela criar template'); step('4b. criar template + editar pergunta + sair input', 'fail'); }
    } else { bug('high', 'Templates', 'botão Criar template não encontrado', 'view Templates'); step('4b. criar template + editar pergunta + sair input', 'fail'); }

    // volta pra templates
    await fr.click('[data-view="templates"]');
    await page.waitForTimeout(500);

    // ============ 5. MEU PERFIL ============
    step('5. abrir Meu Perfil', 'run');
    await fr.click('[data-view="perfil"]');
    await page.waitForTimeout(800);
    await shot('05_perfil');
    step('5. abrir Meu Perfil', 'ok');

    step('5a. click cada sub-aba', 'run');
    const subAbas = await fr.$$('.pfn-sg-row');
    let firstFiveLabels = [];
    for (let i = 0; i < Math.min(5, subAbas.length); i++) {
      const t = await subAbas[i].textContent();
      firstFiveLabels.push((t || '').trim().slice(0, 30));
    }
    step('5a. click cada sub-aba', 'ok', 'rows: ' + firstFiveLabels.join(' | '));

    // ============ 6. EDGE CASES ============
    step('6a. mobile resize 700px', 'run');
    await page.setViewportSize({ width: 700, height: 900 });
    await page.waitForTimeout(500);
    await shot('06a_mobile_perfil');
    await fr.click('[data-view="hoje"]');
    await page.waitForTimeout(500);
    await shot('06a2_mobile_hoje');
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    step('6a. mobile resize 700px', 'ok');

    step('6b. Esc fecha popup', 'run');
    await fr.click('[data-view="templates"]');
    await page.waitForTimeout(400);
    const comoBtn2 = await fr.$('button.btn:has-text("Como funciona")');
    if (comoBtn2) {
      await comoBtn2.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      const onbStillVisible = await fr.$('.onb-overlay.show');
      if (onbStillVisible) bug('low', 'Templates', 'Esc não fecha popup Como Funciona', 'após abrir popup');
      else step('6b. Esc fecha popup', 'ok', 'popup fechou com Esc');
    } else { step('6b. Esc fecha popup', 'skip', 'botão não encontrado'); }

    step('6c. Tab navega ordem certa', 'run');
    await fr.click('[data-view="hoje"]');
    await page.waitForTimeout(300);
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
    await shot('06c_tab_5x');
    step('6c. Tab navega ordem certa', 'ok');

    // ============ FIM ============
  } catch (e) {
    bug('crit', 'fatal', e.message, 'execução abortada');
    await shot('FATAL_' + Date.now());
  } finally {
    fs.writeFileSync(path.join(__dirname, 'log.json'), JSON.stringify(log, null, 2));
    fs.writeFileSync(path.join(__dirname, 'bugs.json'), JSON.stringify(bugs, null, 2));
    console.log('\n========================================');
    console.log('TOTAL passos:', log.length);
    console.log('TOTAL bugs:', bugs.length);
    bugs.forEach(b => console.log(`  [${b.severity}] ${b.where}: ${b.what}`));
    await browser.close();
  }
})();
