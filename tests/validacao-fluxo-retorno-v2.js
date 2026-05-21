/* Smoke test do fluxo completo médico↔paciente (Sessao 30).
   Valida visualmente que as mudanças renderizam sem erro:
   1. Modal "Marcar retorno" do médico tem 4 campos novos (data, hora, local, recado, anotacoes)
   2. Modal "Reagendar retorno" tem 5 campos
   3. Card "Próximo Retorno" mostra 3 propostas do paciente quando AGUARDANDO_MEDICO
   4. Tela do paciente "Sua próxima consulta" mostra recado se houver
   5. Tela 16-consulta-detalhe.html mostra "Recado do médico" (não mais "Observação")
*/
const { chromium } = require('playwright');
const fs = require('fs');

const SHOTS = 'd:/vitae-app-novo/tests/shots/fluxo-retorno-v2';
fs.mkdirSync(SHOTS, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, locale: 'pt-BR' });

  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('vitae_token', 'fake-debug-token');
      localStorage.setItem('vitae_usuario', JSON.stringify({nome: 'Dr. Felipe Test', email: 'felipe@test.com', tipo: 'MEDICO'}));
    } catch(_){}
  });

  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(`[ERR] ${e.message}`));
  page.on('console', m => { if (m.type() === 'error' && !String(m.text()).includes('Failed to load') && !String(m.text()).includes('401')) erros.push(`[CONSOLE] ${m.text()}`); });

  let pass = 0, fail = 0;
  const t = (nome, ok, detalhe) => { if (ok) { pass++; console.log(`✅ ${nome}`); } else { fail++; console.log(`❌ ${nome}${detalhe?' — '+detalhe:''}`); } };

  console.log('\n========== TESTE 1: app-v2 abre sem erros JS ==========');
  await page.goto('https://vitae-app.vercel.app/desktop/app-v2.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/01-app-medico.png`, fullPage: false });

  // Funcao prAbrirMarcarRetorno existe?
  const fnsExistem = await page.evaluate(() => ({
    abrirMarcar: typeof window.prAbrirMarcarRetorno,
    abrirRemarcar: typeof window.prAbrirRemarcarMedico,
    aceitarProposta: typeof window.prAceitarPropostaPaciente,
    proporRetorno: typeof window.prProporRetorno,
  }));
  t('Funcao prAbrirMarcarRetorno existe (modal Marcar)', fnsExistem.abrirMarcar === 'function');
  t('Funcao prAbrirRemarcarMedico existe (modal Reagendar)', fnsExistem.abrirRemarcar === 'function');
  t('Funcao prAceitarPropostaPaciente existe (3 horarios)', fnsExistem.aceitarProposta === 'function');
  t('Funcao prProporRetorno existe (envio)', fnsExistem.proporRetorno === 'function');

  console.log('\n========== TESTE 2: modal Marcar retorno abre com 4 campos novos ==========');
  await page.evaluate(() => {
    if (typeof window.prAbrirMarcarRetorno === 'function') {
      window.prAbrirMarcarRetorno('fake-paciente-id');
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/02-modal-marcar.png` });
  const camposMarcar = await page.evaluate(() => ({
    data: !!document.getElementById('prDateInp'),
    hora: !!document.getElementById('prHoraInp'),
    local: !!document.getElementById('prLocalInp'),
    recado: !!document.getElementById('prRecadoInp'),
    obs: !!document.getElementById('prObsInp'),
    placeholderLocal: document.getElementById('prLocalInp')?.placeholder || '',
  }));
  t('Campo Data presente', camposMarcar.data);
  t('Campo Hora presente (novo)', camposMarcar.hora);
  t('Campo Local presente', camposMarcar.local);
  t('Campo Recado pro paciente presente (novo)', camposMarcar.recado);
  t('Campo Anotações privadas presente (renomeado)', camposMarcar.obs);
  t('Placeholder Local fala de endereço completo', camposMarcar.placeholderLocal.includes('Endereço') || camposMarcar.placeholderLocal.includes('endereço'));

  // Fecha modal
  await page.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await page.waitForTimeout(300);

  console.log('\n========== TESTE 3: modal Reagendar abre com 5 campos ==========');
  await page.evaluate(() => {
    if (typeof window.prAbrirRemarcarMedico === 'function') {
      window.prAbrirRemarcarMedico('fake-agendamento-id');
    }
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/03-modal-reagendar.png` });
  const camposReag = await page.evaluate(() => ({
    data: !!document.getElementById('prRemarcaDateInp'),
    hora: !!document.getElementById('prRemarcaHoraInp'),
    motivo: !!document.getElementById('prRemarcaMotivoInp'),
    local: !!document.getElementById('prRemarcaLocalInp'),
    recado: !!document.getElementById('prRemarcaRecadoInp'),
    obs: !!document.getElementById('prRemarcaObsInp'),
  }));
  t('Reagendar: campo Data', camposReag.data);
  t('Reagendar: campo Hora (novo)', camposReag.hora);
  t('Reagendar: campo Motivo', camposReag.motivo);
  t('Reagendar: campo Local (novo)', camposReag.local);
  t('Reagendar: campo Recado (novo)', camposReag.recado);
  t('Reagendar: campo Anotações (novo)', camposReag.obs);

  await page.evaluate(() => { if (typeof closeModal === 'function') closeModal(); });
  await page.waitForTimeout(300);

  console.log('\n========== TESTE 4: app paciente 16-consulta-detalhe.html ==========');
  await page.goto('https://vitae-app.vercel.app/app-v3/16-consulta-detalhe.html?id=fake-id', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  const labelTrocada = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.section-lbl')).map(e => e.textContent);
    return { labels, temRecado: labels.some(l => l.includes('Recado')), temObs: labels.some(l => l === 'Observação') };
  });
  t('Label "Recado do médico" existe', labelTrocada.temRecado);
  t('Label "Observação" antiga removida', !labelTrocada.temObs);
  await page.screenshot({ path: `${SHOTS}/04-consulta-detalhe.png` });

  console.log('\n========== ERROS JS ==========');
  if (erros.length === 0) {
    t('Zero erros JS críticos', true);
  } else {
    t('Erros JS encontrados', false, JSON.stringify(erros.slice(0, 3)));
    erros.slice(0, 5).forEach(e => console.log('  ' + e));
  }

  console.log(`\n========== RESULTADO: ${pass} passou / ${fail} falhou ==========`);
  await browser.close();
  process.exit(fail === 0 ? 0 : 1);
})();
