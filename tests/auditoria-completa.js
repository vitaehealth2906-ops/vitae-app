// AUDITORIA COMPLETA do app paciente — Playwright tira print + extrai info de cada tela
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const APP_URL = 'http://localhost:3000/app.html';
const SHOTS = path.join(__dirname, 'shots', 'auditoria');
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

// Todas as 32 telas
const TELAS = [
  // Onboarding (10)
  'splash', 'boas-vindas', 'login', 'esqueci-senha', 'nova-senha',
  'cadastro', 'sms', 'onboarding-quiz', 'quiz', 'pronto',
  // Abas (4)
  'saude', 'exames', 'qr', 'consultas',
  // Filhas (10)
  'perfil', 'privacidade', 'medicamentos', 'med-detalhe', 'add-medicamento',
  'alergias', 'alergia-detalhe', 'add-alergia', 'exame-detalhe', 'consulta-detalhe',
  // Estados (8)
  'rg-publico', 'saude-vazia', 'medicamentos-vazia', 'alergias-vazia',
  'exames-vazia', 'consultas-vazia', 'loading-home', 'erro-offline'
];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 500, height: 950 } });
  const page = await ctx.newPage();

  const auditoria = [];

  // 1. CRIAR conta de teste com dados REAIS pra avaliar
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const sufixo = Date.now();
  const dadosTeste = {
    nome: 'Maria Teste ' + sufixo,
    celular: '(11) 9' + String(sufixo).slice(-4) + '-' + String(sufixo).slice(-4),
    email: `audit-${sufixo}@vitae-test.com`,
    senha: 'TesteSenha123!'
  };

  console.log('═══════════════════════════════════════════════════════');
  console.log('AUDITORIA COMPLETA — paciente:', dadosTeste.email);
  console.log('═══════════════════════════════════════════════════════\n');

  // Cadastra via API
  const cadRes = await page.evaluate(async (d) => {
    try {
      const r = await fetch('https://vitae-app-production.up.railway.app/auth/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: d.nome, email: d.email,
          celular: '+5511' + d.celular.replace(/\D/g, '').slice(-9),
          senha: d.senha, tipo: 'PACIENTE'
        })
      });
      return { status: r.status, body: await r.json() };
    } catch (e) { return { error: e.message }; }
  }, dadosTeste);

  if (!cadRes.body || !cadRes.body.token) {
    console.log('FAIL: não criou conta — abortando', cadRes);
    await browser.close();
    return;
  }

  // Salva sessão
  await page.evaluate((data) => {
    localStorage.setItem('vitae_token', data.token);
    if (data.refreshToken) localStorage.setItem('vitae_refresh_token', data.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(data.usuario));
  }, cadRes.body);
  console.log('[OK] Conta criada:', dadosTeste.email);

  // Preenche um perfil mínimo via backend pra ter dados reais nas telas
  await page.evaluate(async () => {
    const token = localStorage.getItem('vitae_token');
    // Perfil
    await fetch('https://vitae-app-production.up.railway.app/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({
        genero: 'FEMININO',
        dataNascimento: '1980-05-15',
        alturaCm: 162,
        pesoKg: 65,
        tipoSanguineo: 'O_POS',
        cpf: '93541134780',
        contatoEmergenciaNome: 'Carlos Teste',
        contatoEmergenciaTel: '(11) 98888-7777'
      })
    });
    // Medicamento
    await fetch('https://vitae-app-production.up.railway.app/medicamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ nome: 'Losartana 50mg', dosagem: '50mg', frequencia: 'diário', motivo: 'hipertensão' })
    });
    // Alergia
    await fetch('https://vitae-app-production.up.railway.app/alergias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ nome: 'Dipirona', tipo: 'MEDICAMENTO', gravidade: 'GRAVE' })
    });
  });
  console.log('[OK] Perfil + 1 medicamento + 1 alergia salvos no banco\n');

  // 2. NAVEGA cada tela e tira print + análise
  for (const tela of TELAS) {
    try {
      await page.goto(APP_URL + '#' + tela, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1500); // espera init terminar

      // Captura: view ativa real, conteúdo visível, presença de dados hardcoded
      const info = await page.evaluate((dadosTeste) => {
        const v = document.querySelector('.view.active');
        if (!v) return { viewAtiva: 'nenhuma' };
        const text = (v.innerText || '').trim();

        // Detecta dados hardcoded comuns
        const hardcoded = [];
        const checks = [
          { padrao: 'Lucas Borelli', desc: 'Nome hardcoded Lucas Borelli' },
          { padrao: 'LUCAS BORELLI', desc: 'Nome RG hardcoded' },
          { padrao: '12/03/2008', desc: 'Data nascimento hardcoded' },
          { padrao: '001234567', desc: 'ID RG hardcoded' },
          { padrao: 'Losartana 50mg', desc: 'Med Losartana hardcoded (pode ser real se você cadastrou)' },
          { padrao: 'Omeprazol 20mg', desc: 'Med Omeprazol hardcoded' },
          { padrao: 'Vitamina D 2000UI', desc: 'Med Vitamina D hardcoded' },
          { padrao: 'Penicilina', desc: 'Alergia Penicilina hardcoded' },
          { padrao: 'Marina Borelli', desc: 'Contato emergência hardcoded' },
          { padrao: 'Dra. Renata Cardoso', desc: 'Médico fictício hardcoded' },
          { padrao: '2 de 3 tomados', desc: 'Contagem meds hardcoded' },
          { padrao: '2 críticas · 1 leve', desc: 'Contagem alergias hardcoded' },
          { padrao: '(11) 98765-4321', desc: 'Telefone fictício hardcoded' }
        ];
        checks.forEach(c => { if (text.includes(c.padrao)) hardcoded.push(c.desc); });

        // Detecta dados REAIS que o paciente Maria cadastrou
        const reais = [];
        if (text.includes(dadosTeste.nome)) reais.push('Nome real: ' + dadosTeste.nome);
        if (text.includes('Maria Teste')) reais.push('Nome real Maria aparece');
        if (text.includes('O+') || text.includes('O_POS')) reais.push('Tipo sanguíneo O+ real');
        if (text.includes('1980')) reais.push('Ano nascimento real');
        if (text.includes('Carlos Teste') || text.includes('(11) 98888')) reais.push('Contato emergência real');

        // Conta elementos
        const inputs = v.querySelectorAll('input, textarea').length;
        const botoes = v.querySelectorAll('button, [onclick]').length;
        const cards = v.querySelectorAll('.card, [class*="card"]').length;

        return {
          viewAtiva: v.getAttribute('data-view'),
          textPreview: text.slice(0, 200).replace(/\n+/g, ' | '),
          textLen: text.length,
          hardcoded,
          reais,
          inputs, botoes, cards
        };
      }, dadosTeste);

      await page.screenshot({ path: path.join(SHOTS, tela.padStart(2, '0') + '.png') });

      const status = info.viewAtiva === tela ? 'OK' :
                     info.viewAtiva === 'nenhuma' ? 'SEM VIEW' :
                     'REDIRECT→' + info.viewAtiva;
      console.log(`[${status.padEnd(15)}] ${tela.padEnd(22)} · ${info.textLen.toString().padStart(4)} chars · ${info.hardcoded.length} demos · ${info.reais.length} reais`);
      if (info.hardcoded.length > 0) {
        console.log(`  hardcoded: ${info.hardcoded.slice(0, 2).join(' | ')}`);
      }

      auditoria.push({ tela, ...info, status });
    } catch (e) {
      console.log(`[ERRO]  ${tela} · ${e.message.slice(0, 80)}`);
      auditoria.push({ tela, error: e.message });
    }
  }

  // Salva log estruturado
  fs.writeFileSync(path.join(SHOTS, 'auditoria.json'), JSON.stringify(auditoria, null, 2));

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('RESUMO:');
  console.log('═══════════════════════════════════════════════════════');
  const semHard = auditoria.filter(a => a.hardcoded && a.hardcoded.length === 0).length;
  const comHard = auditoria.filter(a => a.hardcoded && a.hardcoded.length > 0).length;
  const comReais = auditoria.filter(a => a.reais && a.reais.length > 0).length;
  console.log(`Total telas auditadas: ${auditoria.length}`);
  console.log(`Telas COM dados hardcoded: ${comHard}`);
  console.log(`Telas SEM hardcoded (limpa): ${semHard}`);
  console.log(`Telas mostrando dados REAIS: ${comReais}`);
  console.log(`Screenshots em: ${SHOTS}`);

  await browser.close();
})();
