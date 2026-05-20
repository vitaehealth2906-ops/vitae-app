/**
 * Gera foto-exame-mock.jpg sintético — usa Playwright pra renderizar HTML e screenshot.
 * Roda 1x antes do master. Resultado: tests/fixtures/foto-exame-mock.jpg
 */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 800, height: 1100 } });
  const html = `<!DOCTYPE html><html><head><style>
    body{margin:0;font-family:system-ui,sans-serif;background:#fff;padding:40px}
    h1{font-size:28px;margin:0 0 12px;color:#1a1a1a;border-bottom:2px solid #00C47A;padding-bottom:8px}
    .lab{color:#787671;font-size:13px;margin-bottom:24px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th{background:#f6f5f4;text-align:left;padding:10px;border:1px solid #e5e3df}
    td{padding:10px;border:1px solid #e5e3df}
    .alt{color:#dd5b00;font-weight:600}
    .ok{color:#1aae39;font-weight:600}
    .footer{margin-top:40px;padding-top:16px;border-top:1px solid #e5e3df;font-size:11px;color:#787671}
  </style></head><body>
    <h1>EXAME LABORATORIAL — Hemograma Completo</h1>
    <p class="lab">Laboratório Mock · 19/maio/2026 · Paciente: Lucas Borelli</p>
    <table>
      <tr><th>Parâmetro</th><th>Valor</th><th>Referência</th><th>Status</th></tr>
      <tr><td>Hemoglobina</td><td>14.2 g/dL</td><td>12.0-16.0</td><td class="ok">Normal</td></tr>
      <tr><td>Hematócrito</td><td>42%</td><td>36-48%</td><td class="ok">Normal</td></tr>
      <tr><td>Leucócitos</td><td>11.500/mm³</td><td>4.000-10.000</td><td class="alt">Alterado</td></tr>
      <tr><td>Plaquetas</td><td>280.000</td><td>150-400 mil</td><td class="ok">Normal</td></tr>
      <tr><td>Glicose</td><td>92 mg/dL</td><td>70-99</td><td class="ok">Normal</td></tr>
    </table>
    <div class="footer">Arquivo gerado como fixture de teste E2E vita id — não é exame real.</div>
  </body></html>`;
  await page.setContent(html);
  await page.screenshot({
    path: path.join(__dirname, 'foto-exame-mock.jpg'),
    type: 'jpeg',
    quality: 85,
    fullPage: true,
  });
  await browser.close();
  console.log('✅ foto-exame-mock.jpg gerado');
})();
