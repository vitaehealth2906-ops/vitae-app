/* Debug com mocks pra reproduzir estado do Lucas */
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 393, height: 852 } });

  await page.addInitScript(() => {
    localStorage.setItem('vitae_token', 'fake');
    localStorage.setItem('vitae_usuario', JSON.stringify({nome: 'Lucas Test'}));
    localStorage.setItem('vita_onb_consultas_visto', '1');
  });

  // Mock TODAS as chamadas pra Railway
  await page.route('**/up.railway.app/**', async route => {
    const url = route.request().url();
    let body = {};
    if (url.includes('/contato/medico-do-paciente')) {
      body = { medicos: [] }; // sem contatos cadastrados
    } else if (url.includes('/agendamento/retornos-pendentes')) {
      body = { retornos: [] };
    } else if (url.includes('/agendamento')) {
      body = {
        agendamentos: [{
          id: 'ag-1',
          titulo: 'Retorno com lucas borelli',
          tipo: 'RETORNO',
          medico: 'lucas borelli',
          local: 'Clinica Vida',
          dataHora: '2026-05-29T14:49:00Z',
          observacoes: null,
          recadoPaciente: null,
          statusProposta: 'CONFIRMADO',
        }],
      };
    } else if (url.includes('/documentos/meus')) {
      body = { documentos: [] };
    } else if (url.includes('/em-andamento')) {
      body = { preConsulta: null };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  const erros = [];
  page.on('pageerror', e => erros.push(`[PAGEERROR] ${e.message}`));
  page.on('console', m => {
    if (m.type() === 'error') erros.push(`[CONSOLE.error] ${m.text()}`);
  });

  await page.goto('https://vitae-app.vercel.app/app-v3/15-consultas.html', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);

  const insp = await page.evaluate(() => {
    const hero = document.querySelector('.hero-next');
    const docRow = document.querySelector('.doctor-row');
    const onb = document.querySelector('.onb');
    return {
      url: location.href,
      hasFns: { abrirMedico: typeof window.abrirMedico, abrirProx: typeof window.abrirProximaConsulta },
      heroExists: !!hero,
      heroOnclick: hero?.getAttribute('onclick'),
      docRowExists: !!docRow,
      docRowOnclick: docRow?.getAttribute('onclick'),
      onbClass: onb?.className,
      onbPointerEvents: onb ? getComputedStyle(onb).pointerEvents : null,
      onbZIndex: onb ? getComputedStyle(onb).zIndex : null,
      // Element em cima do hero?
      atHero: (() => {
        if (!hero) return null;
        const r = hero.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
        return el ? { tag: el.tagName, class: typeof el.className === 'string' ? el.className : '', sameAsHero: el === hero || hero.contains(el) } : null;
      })(),
      // Element em cima do doctor row?
      atDoc: (() => {
        if (!docRow) return null;
        const r = docRow.getBoundingClientRect();
        const el = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
        return el ? { tag: el.tagName, class: typeof el.className === 'string' ? el.className : '', sameAsDoc: el === docRow || docRow.contains(el) } : null;
      })(),
    };
  });

  console.log('=== INSPEÇÃO ===');
  console.log(JSON.stringify(insp, null, 2));

  // Tenta clicar
  if (insp.heroExists) {
    console.log('\n=== CLICA HERO ===');
    const before = page.url();
    await page.click('.hero-next').catch(e => console.log('Erro click hero:', e.message));
    await page.waitForTimeout(800);
    console.log('Antes:', before, '| Depois:', page.url());
  }

  if (insp.docRowExists) {
    await page.goBack().catch(() => {});
    await page.waitForTimeout(500);
    console.log('\n=== CLICA DOC ROW ===');
    const before = page.url();
    await page.click('.doctor-row').catch(e => console.log('Erro click doctor:', e.message));
    await page.waitForTimeout(800);
    console.log('Antes:', before, '| Depois:', page.url());
  }

  if (erros.length) {
    console.log('\n=== ERROS ===');
    erros.forEach(e => console.log(e));
  }

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
