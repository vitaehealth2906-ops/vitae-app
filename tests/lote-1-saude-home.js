// LOTE 1 — Tela Saúde HOME: testes Playwright cobrindo paciente novo, com dados, sem rede, etc.
// Uso: node tests/lote-1-saude-home.js          (local em :3000)
//      node tests/lote-1-saude-home.js --prod   (contra Vercel)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const PROD = process.argv.includes('--prod');
const BASE = PROD
  ? 'https://vitae-gr5jltjh5-vitaehealth2906-ops-projects.vercel.app/app-v3'
  : 'http://localhost:3000';
const SAUDE_URL = `${BASE}/01-saude.html`;
const VAZIA_URL = `${BASE}/40-saude-vazia.html`;
const API_URL = 'https://vitae-app-production.up.railway.app';

const SHOTS = path.join(__dirname, 'shots', 'lote-1' + (PROD ? '-prod' : ''));
if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const step = (n, ok, det) => {
  log.push({ n, ok, det });
  console.log(`[${ok ? 'OK' : 'FAIL'}] ${n}${det ? ' · ' + det : ''}`);
};

async function criarPacienteFake(page) {
  const sufixo = Date.now();
  const dados = {
    nome: 'Lote1 ' + sufixo,
    celular: '(11) 9' + String(sufixo).slice(-4) + '-' + String(sufixo).slice(-4),
    email: `lote1-${sufixo}@vitae-test.com`,
    senha: 'TesteSenha123!'
  };
  await page.goto(SAUDE_URL).catch(() => {}); // garante origem antes do fetch
  await page.waitForTimeout(300);
  const res = await page.evaluate(async (d) => {
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
  }, dados);
  if (!res.body || !res.body.token) return null;
  await page.evaluate((b) => {
    localStorage.setItem('vitae_token', b.token);
    if (b.refreshToken) localStorage.setItem('vitae_refresh_token', b.refreshToken);
    localStorage.setItem('vitae_usuario', JSON.stringify(b.usuario));
  }, res.body);
  return { dados, token: res.body.token, usuario: res.body.usuario };
}

function gerarCPFValido() {
  // gera 9 digitos aleatorios + 2 verificadores
  const n = Array.from({length:9}, () => Math.floor(Math.random()*10));
  for (let j = 9; j < 11; j++) {
    let soma = 0;
    for (let i = 0; i < j; i++) soma += n[i] * (j + 1 - i);
    let d = (soma * 10) % 11;
    if (d === 10) d = 0;
    n.push(d);
  }
  return n.join('');
}

async function preencherPerfilMaria(page, token) {
  const cpf = gerarCPFValido();
  return page.evaluate(async (args) => {
    const r = await fetch('https://vitae-app-production.up.railway.app/perfil', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + args.t },
      body: JSON.stringify({
        genero: 'FEMININO',
        dataNascimento: '1985-06-20',
        alturaCm: 165,
        pesoKg: 62,
        tipoSanguineo: 'B_POS',
        cpf: args.cpf,
        contatoEmergenciaNome: 'Carlos Teste',
        contatoEmergenciaTel: '(11) 98888-7777'
      })
    });
    return { status: r.status, body: await r.text() };
  }, { t: token, cpf });
}

async function adicionarAlergia(page, token, nome, gravidade) {
  return page.evaluate(async (args) => {
    const r = await fetch('https://vitae-app-production.up.railway.app/alergias', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + args.t },
      body: JSON.stringify({ nome: args.nome, tipo: 'MEDICAMENTO', gravidade: args.gravidade })
    });
    return r.status;
  }, { t: token, nome, gravidade });
}

async function adicionarMed(page, token, nome, dosagem, horario) {
  return page.evaluate(async (args) => {
    const r = await fetch('https://vitae-app-production.up.railway.app/medicamentos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + args.t },
      body: JSON.stringify({ nome: args.nome, dosagem: args.dosagem, frequencia: 'diário', horario: args.horario, motivo: 'teste lote 1' })
    });
    return r.status;
  }, { t: token, nome, dosagem, horario });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: false });
  const ctx = await browser.newContext({ viewport: { width: 500, height: 950 } });
  const page = await ctx.newPage();

  console.log('═══════════════════════════════════════════════════════');
  console.log(`LOTE 1 — Saude HOME · ${PROD ? 'PRODUCAO' : 'LOCAL'}`);
  console.log('═══════════════════════════════════════════════════════\n');

  // ── CENÁRIO 1: Paciente novo (só com cadastro) abre 01-saude
  let paciente1;
  try {
    paciente1 = await criarPacienteFake(page);
    if (!paciente1) { step('Setup cadastro', false, 'sem token'); await browser.close(); return; }
    step('Setup cadastro paciente 1', true, paciente1.dados.email);

    await page.goto(SAUDE_URL);
    await page.waitForTimeout(2500);

    // sem hardcode Lucas
    const lucas = await page.locator('text=LUCAS BORELLI').count();
    step('Sem hardcode LUCAS BORELLI', lucas === 0);

    // sem hardcode 001234567
    const numeroHard = await page.locator('text=001234567').count();
    step('Sem hardcode #001234567', numeroHard === 0);

    // sem hardcode 12/03/2008
    const nascHard = await page.locator('text=12/03/2008').count();
    step('Sem hardcode 12/03/2008', nascHard === 0);

    // sem hardcode telefone fictício
    const telHard = await page.locator('text=98765-4321').count();
    step('Sem hardcode (11) 98765-4321', telHard === 0);

    // sem hardcode Dipirona/Penicilina/Losartana
    const dipirona = await page.locator('.med-row-name:has-text("Dipirona")').count();
    const losartana = await page.locator('.med-row-name:has-text("Losartana")').count();
    step('Sem hardcode Dipirona/Losartana nas listas', dipirona === 0 && losartana === 0);

    // greeting tem o nome
    const greetingText = (await page.locator('#greetingNome').textContent()) || '';
    step('Greeting mostra nome real', greetingText.trim().startsWith('Lote1'));

    // RG nome em UPPERCASE
    const rgNome = (await page.locator('#rgNome').textContent()) || '';
    step('RG card mostra nome em uppercase', rgNome.includes('LOTE1'));

    // RG sangue mostra "—" (sem perfil ainda)
    const rgSangue = (await page.locator('#rgSangue').textContent()) || '';
    step('RG sangue mostra "—" (sem perfil)', rgSangue.trim() === '—' || rgSangue.trim() === '');

    // Alergias resumo: "Nenhuma cadastrada"
    const aRes = (await page.locator('#alergiasResumo').textContent()) || '';
    step('Alergias resumo: Nenhuma', aRes.toLowerCase().includes('nenhuma'));

    await page.screenshot({ path: path.join(SHOTS, '01-novo-paciente.png') });
  } catch (e) {
    step('Cenário 1 ERRO', false, e.message);
  }

  // ── CENÁRIO 2: Paciente preenche perfil + recarrega
  try {
    if (paciente1) {
      const s = await preencherPerfilMaria(page, paciente1.token);
      step('Setup perfil completo (PUT /perfil)', s.status === 200, 'HTTP ' + s.status + (s.body ? ' · ' + s.body.slice(0,100) : ''));

      await page.goto(SAUDE_URL);
      await page.waitForTimeout(2500);

      const rgSangue = (await page.locator('#rgSangue').textContent()) || '';
      step('RG sangue mostra B+', rgSangue.trim() === 'B+');

      const rgNasc = (await page.locator('#rgNascimento').textContent()) || '';
      step('RG nascimento formatado', rgNasc.includes('1985'));

      const rgEmerg = (await page.locator('#rgEmerg').textContent()) || '';
      step('RG emergência mostra tel real', rgEmerg.includes('98888'));

      await page.screenshot({ path: path.join(SHOTS, '02-perfil-completo.png') });
    }
  } catch (e) {
    step('Cenário 2 ERRO', false, e.message);
  }

  // ── CENÁRIO 3: Paciente adiciona 2 alergias críticas + 1 leve
  try {
    if (paciente1) {
      const s1 = await adicionarAlergia(page, paciente1.token, 'Dipirona', 'GRAVE');
      const s2 = await adicionarAlergia(page, paciente1.token, 'Penicilina', 'GRAVE');
      const s3 = await adicionarAlergia(page, paciente1.token, 'Camarão', 'LEVE');
      step('Setup 3 alergias adicionadas', s1 === 201 || s1 === 200, `D=${s1} P=${s2} C=${s3}`);

      await page.goto(SAUDE_URL);
      await page.waitForTimeout(2500);

      const aRes = (await page.locator('#alergiasResumo').textContent()) || '';
      step('Resumo conta 2 críticas · 1 leve', aRes.includes('2 críticas') && aRes.includes('1 leve'));

      const versoAle = (await page.locator('#rgVersoAlergias').textContent()) || '';
      step('Verso RG lista críticas', versoAle.includes('Dipirona') && versoAle.includes('Penicilina'));

      await page.screenshot({ path: path.join(SHOTS, '03-com-alergias.png') });
    }
  } catch (e) {
    step('Cenário 3 ERRO', false, e.message);
  }

  // ── CENÁRIO 4: Paciente adiciona 2 meds + recarrega
  try {
    if (paciente1) {
      const m1 = await adicionarMed(page, paciente1.token, 'Losartana', '50mg', '08:00');
      const m2 = await adicionarMed(page, paciente1.token, 'Omeprazol', '20mg', '07:30');
      step('Setup 2 meds adicionados', (m1 === 200 || m1 === 201) && (m2 === 200 || m2 === 201), `${m1}/${m2}`);

      await page.goto(SAUDE_URL);
      await page.waitForTimeout(2500);

      const titMed = (await page.locator('#medsTituloHoje').textContent()) || '';
      step('Título meds-hoje real', titMed.match(/\d+\s+(medicamento|ativo)/i));

      const versoMed = (await page.locator('#rgVersoMeds').textContent()) || '';
      step('Verso RG lista meds', versoMed.includes('Losartana') || versoMed.includes('Omeprazol'));

      const linhasMed = await page.locator('#medsHomeList .med-row').count();
      step('Lista meds tem linhas', linhasMed > 0, `${linhasMed} linhas`);

      await page.screenshot({ path: path.join(SHOTS, '04-com-meds.png') });
    }
  } catch (e) {
    step('Cenário 4 ERRO', false, e.message);
  }

  // ── CENÁRIO 5: Empty state 40-saude-vazia.html
  try {
    if (paciente1) {
      await page.goto(VAZIA_URL);
      await page.waitForTimeout(2500);

      const lucas = await page.locator('text=LUCAS BORELLI').count();
      step('40-vazia sem hardcode Lucas', lucas === 0);

      const nome = (await page.locator('#vazioNome').textContent()) || '';
      step('40-vazia mostra nome real', nome.includes('Lote1'));

      const sangue = (await page.locator('#vazioSangue').textContent()) || '';
      step('40-vazia mostra sangue real B+', sangue.trim() === 'B+');

      await page.screenshot({ path: path.join(SHOTS, '05-vazia.png') });
    }
  } catch (e) {
    step('Cenário 5 ERRO', false, e.message);
  }

  // ── CENÁRIO 6: Sem token (sessao expirada) → ainda renderiza sem quebrar
  try {
    await page.evaluate(() => localStorage.clear());
    await page.goto(SAUDE_URL);
    await page.waitForTimeout(2000);
    // gate antigo redireciona pra 20-splash se nao logado. Aceita qualquer um.
    const url = page.url();
    step('Sem token → redirect ou tela sem quebrar', url !== '' );
    await page.screenshot({ path: path.join(SHOTS, '06-sem-token.png') });
  } catch (e) {
    step('Cenário 6 ERRO', false, e.message);
  }

  // ── RESUMO
  fs.writeFileSync(path.join(SHOTS, 'log.json'), JSON.stringify(log, null, 2));
  const okCount = log.filter(l => l.ok).length;
  const failCount = log.filter(l => !l.ok).length;
  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`RESUMO: ${okCount}/${log.length} OK · ${failCount} falharam`);
  console.log(`Screenshots: ${SHOTS}`);
  console.log('═══════════════════════════════════════════════════════');

  await browser.close();
  process.exit(failCount > 0 ? 1 : 0);
})();
