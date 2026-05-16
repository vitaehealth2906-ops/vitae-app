/**
 * TESTE: Dra. Helena Souza — Primeira vez no app VITAE
 * Persona: clínica geral, 42 anos, 28 consultas/dia, usa iClinic há 3 anos
 * Device: Samsung Galaxy S23 → simulando desktop 1440x900
 * Data: 15-mai-2026
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const SHOTS_DIR = path.join(__dirname, 'shots', 'helena');

if (!fs.existsSync(SHOTS_DIR)) fs.mkdirSync(SHOTS_DIR, { recursive: true });

async function shot(page, name, label) {
  const file = path.join(SHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  [SHOT] ${name}.png`);
  return file;
}

function mockJson(data) {
  return { status: 200, contentType: 'application/json', body: JSON.stringify(data) };
}

// Intercepta TODAS as chamadas ao backend Railway e retorna dados mock
async function setupNetworkMocks(context) {
  // Intercept no nível do contexto (afeta todas as páginas)
  await context.route('https://vitae-app-production.up.railway.app/**', async route => {
    const url = route.request().url();
    const path_ = url.replace('https://vitae-app-production.up.railway.app', '');

    // Auth — sempre retorna token válido
    if (path_.startsWith('/auth/refresh') || path_.startsWith('/auth/login') || path_.startsWith('/auth/me')) {
      return route.fulfill(mockJson({
        token: 'preview-mock-token',
        refreshToken: 'preview-mock-refresh',
        usuario: { id: 'preview-med-1', nome: 'Dra. Helena Souza', tipo: 'MEDICO', email: 'helena@preview.vitaid' }
      }));
    }

    // Médico — perfil
    if (path_.match(/^\/medico\/?$/) || path_.includes('/medico/me') || path_.includes('/medico/dashboard')) {
      return route.fulfill(mockJson({
        id: 'preview-med-1',
        nome: 'Dra. Helena Souza',
        email: 'helena@preview.vitaid',
        crm: '123456', uf: 'SP',
        especialidade: 'Clínica Geral',
        clinica: 'Clínica São Paulo',
        config: {
          tempoMedioConsulta: 30, tempoAnamneseAtual: 7, valorConsulta: 350,
          googleCalendarConectado: false, inteligenciaComparativaAtiva: false,
          mensagemLembrete: 'Olá {nome}, sua consulta é {data} às {hora}: {link}'
        }
      }));
    }

    // Médico — pacientes
    if (path_.includes('/medico/pacientes')) {
      return route.fulfill(mockJson([
        {
          id: 'pac-1', nome: 'Maria Silva', fotoUrl: null,
          pcsRespondidas: 3, pcsTotal: 4,
          ultimaConsulta: '2026-05-01T10:00:00Z',
          alergias: [{ nome: 'Penicilina', gravidade: 'GRAVE' }, { nome: 'Dipirona', gravidade: 'MODERADA' }],
          condicoes: [{ nome: 'Hipertensão' }, { nome: 'Diabetes Tipo 2' }],
          medicamentos: [{ nome: 'Losartana 50mg', ativo: true }, { nome: 'Metformina 500mg', ativo: true }]
        },
        {
          id: 'pac-2', nome: 'João Santos', fotoUrl: null,
          pcsRespondidas: 1, pcsTotal: 2,
          ultimaConsulta: '2026-04-28T14:00:00Z',
          alergias: [], condicoes: [{ nome: 'Asma' }],
          medicamentos: [{ nome: 'Ventolin', ativo: true }]
        },
        {
          id: 'pac-3', nome: 'Ana Costa', fotoUrl: null,
          pcsRespondidas: 2, pcsTotal: 2,
          ultimaConsulta: '2026-04-20T09:00:00Z',
          alergias: [{ nome: 'Sulfa', gravidade: 'MODERADA' }],
          condicoes: [], medicamentos: []
        },
        {
          id: 'pac-4', nome: 'Roberto Lima', fotoUrl: null,
          pcsRespondidas: 0, pcsTotal: 1,
          ultimaConsulta: null, alergias: [], condicoes: [], medicamentos: []
        }
      ]));
    }

    // Médico — métricas
    if (path_.includes('/metricas')) {
      return route.fulfill(mockJson({
        tempoEconomizadoMin: 42, atendimentosExtras: 1.4, receitaPossivel: 490,
        precisao: 85, setupConcluido: true, totalPCs: 12
      }));
    }

    // Templates
    if (path_.includes('/templates')) {
      return route.fulfill(mockJson([
        { id: 'tpl-1', nome: 'Consulta Geral', perguntas: [{ id: 'q1', texto: 'Qual o seu principal problema hoje?' }, { id: 'q2', texto: 'Há quanto tempo sente isso?' }], vezesUsado: 8, permitirAudio: true },
        { id: 'tpl-2', nome: 'Retorno Pressão', perguntas: [{ id: 'q1', texto: 'Como está sua pressão em casa?' }], vezesUsado: 3, permitirAudio: true }
      ]));
    }

    // Pré-consultas
    if (path_.startsWith('/pre-consulta')) {
      return route.fulfill(mockJson([
        {
          id: 'pc-1', pacienteNome: 'Maria Silva', pacienteId: 'pac-1',
          status: 'RESPONDIDA', criadaEm: '2026-05-14T10:00:00Z', respondidaEm: '2026-05-14T11:30:00Z',
          linkToken: 'tok-1', cobertura: 'pronta',
          descricaoBreve: 'Dores de cabeça frequentes há 3 semanas',
          queixaPrincipal: 'Dores de cabeça frequentes',
          summaryJson: {
            anamneseEstruturada: {
              queixaPrincipal: { v: 'Dores de cabeça frequentes há 3 semanas', fonte: 'audio' },
              tempoEvolucao: { v: '3 semanas', fonte: 'audio' },
              intensidade: { v: '7/10', fonte: 'audio' },
              fatoresAgravantes: { v: 'Estresse e luz forte', fonte: 'audio' }
            }
          },
          paciente: { id: 'pac-1', nome: 'Maria Silva', fotoUrl: null }
        },
        {
          id: 'pc-2', pacienteNome: 'João Santos', pacienteId: 'pac-2',
          status: 'PENDENTE', criadaEm: '2026-05-15T08:00:00Z',
          linkToken: 'tok-2', cobertura: null, descricaoBreve: null,
          paciente: { id: 'pac-2', nome: 'João Santos', fotoUrl: null }
        },
        {
          id: 'pc-3', pacienteNome: 'Ana Costa', pacienteId: 'pac-3',
          status: 'RESPONDIDA', criadaEm: '2026-05-13T14:00:00Z', respondidaEm: '2026-05-13T15:00:00Z',
          linkToken: 'tok-3', cobertura: 'parcial',
          descricaoBreve: 'Pressão alta controlada, retorno regular',
          paciente: { id: 'pac-3', nome: 'Ana Costa', fotoUrl: null }
        },
        {
          id: 'pc-4', pacienteNome: 'Beatriz Ferreira', pacienteId: null,
          status: 'ABERTO', criadaEm: '2026-05-15T07:30:00Z',
          linkToken: 'tok-4', cobertura: null, descricaoBreve: null, paciente: null
        }
      ]));
    }

    // Agenda
    if (path_.startsWith('/agenda')) {
      return route.fulfill(mockJson({ slots: [], googleConectado: false }));
    }

    // Notificações / prosódica / qualquer outra rota
    return route.fulfill(mockJson({ ok: true, data: [], total: 0 }));
  });
}

(async () => {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    args: ['--start-maximized']
  });

  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo'
  });

  // 1. Intercepta rede ANTES de criar páginas
  await setupNetworkMocks(ctx);

  // 2. Seta localStorage ANTES do JS da página rodar
  await ctx.addInitScript(() => {
    localStorage.setItem('vitae_token', 'preview-mock-token');
    localStorage.setItem('vitae_refresh_token', 'preview-mock-refresh');
    localStorage.setItem('vitae_usuario', JSON.stringify({
      id: 'preview-med-1',
      nome: 'Dra. Helena Souza',
      email: 'helena@preview.vitaid',
      tipo: 'MEDICO',
      especialidade: 'Clínica Geral',
      crm: '123456',
      uf: 'SP'
    }));
    window.__PREVIEW_MODE = true;
    window.__ACC_VERSION = 'C';
  });

  const page = await ctx.newPage();

  // 3. Intercepta redirect para login — redireciona de volta pro preview
  page.on('framenavigated', async frame => {
    if (frame !== page.mainFrame()) return;
    const url = frame.url();
    if (url.includes('01-login.html') || url.includes('chrome-error')) {
      console.log(`  [NAV-BLOCK] Redirect bloqueado: ${url}`);
      try {
        await page.goto(`${BASE_URL}/desktop/preview-nova-aba-pacientes.html`, {
          waitUntil: 'domcontentloaded', timeout: 8000
        });
      } catch(e) {}
    }
  });

  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('Failed to load resource')) {
      console.log(`  [JS] ${msg.text().slice(0, 80)}`);
    }
  });

  const TARGET = `${BASE_URL}/desktop/preview-nova-aba-pacientes.html`;
  console.log('\n=== DRA. HELENA — TESTE VITAE ===\n');

  // =====================================================
  // CENA 1 — 7h50, Abrir o app
  // =====================================================
  console.log('=== CENA 1: Manhã 7h50 — Abrir o app ===');
  await page.goto(TARGET, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(e => {
    console.log(`  [WARN] ${e.message.slice(0, 60)}`);
  });
  await page.waitForTimeout(4000); // Espera app inicializar

  const url1 = page.url();
  const title1 = await page.title();
  console.log(`  Título: ${title1}`);
  console.log(`  URL final: ${url1}`);

  // Verifica se está no app ou na tela de login
  const isInApp = url1.includes('preview-nova-aba-pacientes') || url1.includes('app-v2') || url1.includes('app.html');
  const isLogin = url1.includes('login');
  console.log(`  No app: ${isInApp} | Login: ${isLogin}`);

  // Mapeia nav
  const navItems = await page.$$eval('[data-view]', els => els.map(e => ({
    view: e.getAttribute('data-view'),
    ativo: e.classList.contains('on') || e.classList.contains('active')
  }))).catch(() => []);
  console.log(`  Nav: ${navItems.map(n => `${n.view}${n.ativo ? '(ativo)' : ''}`).join(' | ')}`);

  await shot(page, 'cena1_01_abertura', 'Cena 1 — Abertura');

  // Captura conteúdo
  const bodyText = await page.evaluate(() =>
    document.body?.innerText?.replace(/\s+/g,' ')?.slice(0, 500) || ''
  ).catch(() => '');
  console.log(`  Texto: "${bodyText.slice(0, 200)}"`);

  // Stats
  const stats = await page.$$eval('[class*="stat-num"], [class*="imp-num"], [class*="num"]', els =>
    els.map(e => e.textContent.trim()).filter(t => t && t !== '—')
  ).catch(() => []);
  console.log(`  Números: ${stats.join(', ')}`);

  // Agenda
  const agenda = await page.$$eval('.ag-row .ag-name, .ag-name', els => els.map(e => e.textContent.trim())).catch(() => []);
  console.log(`  Agenda: ${agenda.join(', ') || '(vazio)'}`);

  // Scroll
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(700);
  await shot(page, 'cena1_02_scroll', 'Cena 1 — Scroll');
  await page.evaluate(() => window.scrollTo(0, 0));

  // =====================================================
  // CENA 2 — Maria Silva
  // =====================================================
  console.log('\n=== CENA 2: Ver perfil da Maria Silva ===');

  // Clica em Pacientes
  let navPac = await page.$('[data-view="pacientes"]');
  if (!navPac) { try { navPac = await page.getByText('Pacientes').first(); } catch(e) {} }

  if (navPac) {
    await navPac.click();
    await page.waitForTimeout(2500);
    await shot(page, 'cena2_01_aba_pacientes', 'Cena 2 — Aba Pacientes');

    const bodyPac = await page.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 400)).catch(() => '');
    console.log(`  Conteúdo: "${bodyPac.slice(0, 200)}"`);

    // Botões
    const btns = await page.$$eval('button', els => els.map(e => e.innerText.trim().replace(/\s+/g,' ')).filter(Boolean)).catch(() => []);
    console.log(`  Botões: ${btns.slice(0, 12).join(' | ')}`);

    // Campo de busca
    const busca = await page.$('input[type="search"], input[placeholder*="uscar"], input[placeholder*="acient"]');
    if (busca) {
      await busca.fill('Maria');
      await page.waitForTimeout(1200);
      await shot(page, 'cena2_02_busca', 'Cena 2 — Buscando Maria');
      console.log('  Busca: encontrada e usada');
    } else {
      console.log('  Busca: campo não encontrado');
    }

    // Clica na Maria
    let maria = null;
    try { maria = await page.getByText('Maria Silva').first(); } catch(e) {}
    if (!maria) { try { maria = await page.locator('text=Maria').first(); } catch(e) {} }

    if (maria) {
      await maria.click();
      await page.waitForTimeout(2500);
      await shot(page, 'cena2_03_perfil_maria', 'Cena 2 — Perfil Maria');
      console.log('  Maria clicada');

      const perfilBody = await page.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0, 600)).catch(() => '');
      console.log(`  Perfil: "${perfilBody.slice(0, 250)}"`);

      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(600);
      await shot(page, 'cena2_04_perfil_scroll', 'Cena 2 — Perfil Maria, scroll');
      await page.evaluate(() => window.scrollTo(0, 0));
    } else {
      console.log('  Maria não encontrada na lista');
      // Tenta clicar no primeiro item
      const first = await page.$('[class*="row"], [class*="item"], tr').catch(() => null);
      if (first) { await first.click(); await page.waitForTimeout(1500); }
      await shot(page, 'cena2_03_sem_maria', 'Cena 2 — Sem Maria na lista');
    }
  } else {
    console.log('  Nav Pacientes não encontrado');
    await shot(page, 'cena2_sem_nav', 'Cena 2 — Nav Pacientes ausente');
  }

  // =====================================================
  // CENA 3 — Anexar laudo
  // =====================================================
  console.log('\n=== CENA 3: Anexar laudo ===');
  await page.evaluate(() => window.scrollTo(0, 0));

  // Verifica o HTML inteiro por palavras-chave
  const html = await page.evaluate(() => document.body.innerHTML).catch(() => '');
  const checks = {
    'upload': html.toLowerCase().includes('upload'),
    'anexar/anexo': html.toLowerCase().includes('anex'),
    'file input': html.includes('type="file"') || html.includes("type='file'"),
    'laudo': html.toLowerCase().includes('laudo'),
    'exame(s)': html.toLowerCase().includes('exame'),
    'resultado': html.toLowerCase().includes('resultado')
  };
  for (const [k, v] of Object.entries(checks)) console.log(`  HTML tem "${k}": ${v}`);

  // Procura botões/links relacionados a upload
  const uploadEls = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button, a, label, input').forEach(el => {
      const txt = (el.innerText || el.textContent || el.placeholder || el.title || el.getAttribute('aria-label') || '').trim();
      const type = el.getAttribute('type') || '';
      if (/upload|anex|laudo|exame|arquivo|pdf|resultado/i.test(txt) || type === 'file') {
        results.push({ tag: el.tagName, txt: txt.slice(0, 50), type });
      }
    });
    return results;
  }).catch(() => []);
  console.log(`  Elementos de upload: ${JSON.stringify(uploadEls)}`);

  await shot(page, 'cena3_situacao_atual', 'Cena 3 — Situação de upload/anexo');

  // =====================================================
  // CENA 4 — Marcar retorno
  // =====================================================
  console.log('\n=== CENA 4: Marcar retorno em 30 dias ===');
  await page.evaluate(() => window.scrollTo(0, 0));

  // Verifica se existe aba de Agenda no nav
  const navAgenda = await page.$('[data-view="agenda"], [data-view="agendamentos"]');
  console.log(`  Aba Agenda no nav: ${navAgenda !== null}`);

  // Procura botão de retorno/agendar em toda a tela
  const retornoEls = await page.evaluate(() => {
    const results = [];
    document.querySelectorAll('button, a, [role="button"]').forEach(el => {
      const txt = (el.innerText || el.textContent || '').trim();
      if (/retorno|agendar|marcar\s+consulta|schedule|follow.?up|30\s*dia/i.test(txt)) {
        results.push(txt.slice(0, 60));
      }
    });
    return results;
  }).catch(() => []);
  console.log(`  Botões de retorno: ${retornoEls.join(' | ') || 'nenhum'}`);

  if (navAgenda) {
    await navAgenda.click();
    await page.waitForTimeout(1800);
    const agBody = await page.evaluate(() => document.body.innerText.replace(/\s+/g,' ').slice(0,300)).catch(() => '');
    console.log(`  Conteúdo aba Agenda: "${agBody.slice(0,150)}"`);
    await shot(page, 'cena4_01_agenda', 'Cena 4 — Aba Agenda');
  } else {
    await shot(page, 'cena4_sem_retorno', 'Cena 4 — Sem opção de retorno');
    console.log('  Sem aba Agenda e sem botão de retorno — feature ausente');
  }

  // =====================================================
  // CENA 5 — Final do dia 18h
  // =====================================================
  console.log('\n=== CENA 5: Final do dia 18h ===');

  // Volta pra Hoje
  let hojeNav = await page.$('[data-view="hoje"]');
  if (!hojeNav) { try { hojeNav = await page.getByText('Hoje').first(); } catch(e) {} }
  if (hojeNav) { await hojeNav.click(); await page.waitForTimeout(1800); }

  await shot(page, 'cena5_01_hoje_fim_dia', 'Cena 5 — Aba Hoje, fim do dia');

  // Indicadores de status
  const statusBadges = await page.$$eval('[class*="ag-st"], [class*="status"], [class*="badge"], [class*="pip"]', els =>
    els.map(e => e.textContent.trim()).filter(Boolean)
  ).catch(() => []);
  console.log(`  Status badges: ${statusBadges.join(', ') || 'nenhum'}`);

  // Textos sobre confirmação/retorno
  const confirmTexts = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const found = [];
    let n;
    while ((n = walker.nextNode())) {
      const t = n.textContent.trim();
      if (t.length > 3 && t.length < 100 && /retorno|enviado|confirmad|respondid|pronta|parcial|pendente/i.test(t)) {
        found.push(t);
        if (found.length >= 8) break;
      }
    }
    return found;
  }).catch(() => []);
  console.log(`  Confirmações: ${confirmTexts.join(' | ') || 'nenhuma'}`);

  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(600);
  await shot(page, 'cena5_02_hoje_scroll', 'Cena 5 — Hoje, parte de baixo');
  await page.evaluate(() => window.scrollTo(0, 0));

  // =====================================================
  // TOUR COMPLETO — screenshots de todas as abas
  // =====================================================
  console.log('\n=== TOUR: Todas as abas ===');
  const views = ['hoje', 'pre-consultas', 'pacientes', 'templates', 'perfil'];

  for (const v of views) {
    let el = await page.$(`[data-view="${v}"]`);
    if (!el) {
      console.log(`  [${v}] nav não encontrado`);
      continue;
    }
    await el.click();
    await page.waitForTimeout(2200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);

    const s = v.replace('-', '_');
    await shot(page, `tour_${s}_01`, `Tour — ${v} topo`);

    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(400);
    await shot(page, `tour_${s}_02`, `Tour — ${v} meio`);
    await page.evaluate(() => window.scrollTo(0, 0));

    const texto = await page.evaluate(() =>
      document.body.innerText.replace(/\s+/g,' ').slice(0, 250)
    ).catch(() => '');
    console.log(`  [${v}] "${texto.slice(0, 120)}"`);
  }

  console.log('\n=== FIM DOS TESTES ===');
  const allShots = fs.readdirSync(SHOTS_DIR).filter(f => f.endsWith('.png'));
  console.log(`Total de screenshots: ${allShots.length}`);
  console.log(`Diretório: ${SHOTS_DIR}`);

  await page.waitForTimeout(1500);
  await browser.close();
})().catch(err => {
  console.error('\nERRO FATAL:', err.message.slice(0, 200));
  process.exit(1);
});
