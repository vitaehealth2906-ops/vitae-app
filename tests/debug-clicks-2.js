/* Debug v2: força mocks no fetch */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 } });

  await ctx.addInitScript(() => {
    localStorage.setItem('vitae_token', 'fake');
    localStorage.setItem('vitae_usuario', JSON.stringify({nome: 'Lucas Test'}));
    localStorage.setItem('vita_onb_consultas_visto', '1');

    // Intercepta fetch
    const realFetch = window.fetch.bind(window);
    window.fetch = async function(url, opts) {
      const u = String(url);
      console.log('[FETCH]', u);
      const respond = (body) => Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: {'Content-Type':'application/json'} }));

      if (u.includes('/contato/medico-do-paciente')) return respond({ medicos: [] });
      if (u.includes('/agendamento/retornos-pendentes')) return respond({ retornos: [] });
      if (u.includes('/pre-consulta/em-andamento')) return respond({ preConsulta: null });
      if (u.includes('/documentos/meus')) return respond({ documentos: [] });
      if (u.includes('/agendamento')) {
        const futura = new Date(Date.now() + 86400000 * 7).toISOString();
        return respond({
          agendamentos: [{
            id: 'ag-test-1',
            usuarioId: 'u1',
            titulo: 'Retorno com lucas borelli',
            tipo: 'RETORNO',
            medico: 'lucas borelli',
            local: 'Clinica Vida',
            dataHora: futura,
            observacoes: null,
            recadoPaciente: null,
            statusProposta: 'CONFIRMADO',
            contadorTrocas: 0,
          }],
        });
      }
      return realFetch(url, opts);
    };
  });

  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(`[ERR] ${e.message}`));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error') erros.push(`[error] ${t}`);
    if (t.startsWith('[FETCH]')) console.log(t);
  });

  await page.goto('http://localhost:8765/15-consultas.html', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);

  const insp = await page.evaluate(() => {
    const hero = document.querySelector('.hero-next');
    const docRow = document.querySelector('.doctor-row');
    return {
      url: location.href,
      hasAbrirMedico: typeof window.abrirMedico,
      hasAbrirProx: typeof window.abrirProximaConsulta,
      heroExists: !!hero,
      heroOnclick: hero?.getAttribute('onclick'),
      docExists: !!docRow,
      docOnclick: docRow?.getAttribute('onclick'),
      // O que está em cima do hero?
      atHero: (() => {
        if (!hero) return null;
        const r = hero.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
        return el ? { tag: el.tagName, class: typeof el.className === 'string' ? el.className.substring(0,50) : '' } : null;
      })(),
      onbStyle: (() => {
        const o = document.querySelector('.onb');
        if (!o) return null;
        const cs = getComputedStyle(o);
        return { pe: cs.pointerEvents, op: cs.opacity, z: cs.zIndex, display: cs.display, classes: o.className };
      })(),
    };
  });

  console.log('\n=== INSPEÇÃO ===');
  console.log(JSON.stringify(insp, null, 2));

  // Tenta clicar de verdade (page.click respeita pointer-events e overlays)
  if (insp.heroExists) {
    console.log('\n=== page.click(.hero-next) — respeitando hit-test ===');
    const urlBefore = page.url();
    try {
      await page.click('.hero-next', { timeout: 5000 });
      await page.waitForTimeout(800);
      console.log('Antes:', urlBefore);
      console.log('Depois:', page.url());
      console.log(urlBefore !== page.url() ? '✅ CLIQUE FUNCIONOU' : '❌ CLIQUE NAO NAVEGOU');
    } catch (e) {
      console.log('❌ TIMEOUT — outro elemento bloqueando o click:', e.message.substring(0, 200));
    }
  }

  if (erros.length) {
    console.log('\n=== ERROS ===');
    erros.slice(0, 10).forEach(e => console.log(e));
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
