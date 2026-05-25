/**
 * Gera 5 miniaturas de exames reais pra usar no hero-vitaid.
 * Mesma técnica do tests/fixtures/gerar-foto-exame.js mas com 5 templates
 * e dimensões otimizadas pra thumb (400x480 retina).
 */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUT = __dirname;
fs.mkdirSync(OUT, { recursive: true });

const css = `
  body{margin:0;font-family:'Helvetica Neue',Arial,sans-serif;background:#fff;padding:24px;color:#1a1a1a}
  .logo{font-size:14px;font-weight:800;color:#0F766E;letter-spacing:.5px}
  .sub{font-size:9px;color:#9CA3AF;margin-top:2px;letter-spacing:.3px}
  h1{font-size:18px;margin:14px 0 4px;font-weight:800;color:#0D0F14;line-height:1.15}
  .meta{color:#6B7280;font-size:10px;margin-bottom:14px}
  table{width:100%;border-collapse:collapse;font-size:10px}
  th{background:#F4F6FA;text-align:left;padding:7px 8px;border-bottom:1px solid #E5E7EB;font-weight:700;color:#374151;font-size:9px;text-transform:uppercase;letter-spacing:.3px}
  td{padding:7px 8px;border-bottom:1px solid #F3F4F6;color:#1F2937}
  .ok{color:#059669;font-weight:600}
  .alt{color:#D97706;font-weight:600}
  .crit{color:#DC2626;font-weight:700}
  .footer{margin-top:18px;padding-top:10px;border-top:1px solid #E5E7EB;font-size:8px;color:#9CA3AF}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #00C47A;padding-bottom:10px}
  .accent{color:#00C47A}
  .ecg-chart{margin:20px 0;height:80px;background:repeating-linear-gradient(0deg,transparent 0 8px,#FFE2E2 8px 9px),repeating-linear-gradient(90deg,transparent 0 8px,#FFE2E2 8px 9px);position:relative;border:1px solid #FECACA}
  .ecg-line{position:absolute;top:0;left:0;width:100%;height:100%}
  .usg-img{margin:18px 0;height:140px;background:radial-gradient(ellipse at center,#1A1A1A 0,#000 70%);position:relative;border-radius:6px;overflow:hidden}
  .usg-shape{position:absolute;top:25%;left:25%;width:50%;height:50%;background:radial-gradient(ellipse,#3A3A3A 0,#0F0F0F 70%);border-radius:50%;filter:blur(2px)}
  .usg-text{position:absolute;top:6px;left:6px;color:#22C55E;font-family:monospace;font-size:8px}
`;

const exams = [
  {
    name: 'hemograma',
    html: `
      <div class="head">
        <div><div class="logo">FLEURY MEDICINA E SAÚDE</div><div class="sub">Unidade Higienópolis · São Paulo/SP</div></div>
        <div style="text-align:right;font-size:9px;color:#6B7280">Protocolo<br><strong style="color:#0D0F14">2026-05-06-3847</strong></div>
      </div>
      <h1>Hemograma Completo</h1>
      <div class="meta">Coleta: 06/mai/2026 · Paciente: Beatriz Oliveira · 34 anos</div>
      <table>
        <tr><th>Parâmetro</th><th>Valor</th><th>Referência</th><th>Status</th></tr>
        <tr><td>Hemoglobina</td><td>13.8 g/dL</td><td>12.0 – 16.0</td><td class="ok">Normal</td></tr>
        <tr><td>Hematócrito</td><td>41.5 %</td><td>36 – 48</td><td class="ok">Normal</td></tr>
        <tr><td>Hemácias</td><td>4.62 mi/mm³</td><td>4.0 – 5.4</td><td class="ok">Normal</td></tr>
        <tr><td>VCM</td><td>89.8 fL</td><td>80 – 100</td><td class="ok">Normal</td></tr>
        <tr><td>HCM</td><td>29.9 pg</td><td>27 – 32</td><td class="ok">Normal</td></tr>
        <tr><td>Leucócitos</td><td>6.840 /mm³</td><td>4.000 – 10.000</td><td class="ok">Normal</td></tr>
        <tr><td>Neutrófilos</td><td>58 %</td><td>40 – 70</td><td class="ok">Normal</td></tr>
        <tr><td>Linfócitos</td><td>34 %</td><td>20 – 45</td><td class="ok">Normal</td></tr>
        <tr><td>Plaquetas</td><td>289.000 /mm³</td><td>150.000 – 400.000</td><td class="ok">Normal</td></tr>
      </table>
      <div class="footer">Liberado por Dra. Carla M. Souza · CRBM 8231 · 06/mai/2026 14:32 · Equipamento Sysmex XN-1000</div>`
  },
  {
    name: 'tsh',
    html: `
      <div class="head">
        <div><div class="logo">DELBONI MEDICINA DIAGNÓSTICA</div><div class="sub">Unidade Vila Olímpia · São Paulo/SP</div></div>
        <div style="text-align:right;font-size:9px;color:#6B7280">Pedido<br><strong style="color:#0D0F14">DM-2026-44219</strong></div>
      </div>
      <h1>Função Tireoidiana — TSH e T4 livre</h1>
      <div class="meta">Coleta: 03/mai/2026 · Jejum: 8h · Paciente: Beatriz Oliveira</div>
      <table>
        <tr><th>Parâmetro</th><th>Valor</th><th>Referência</th><th>Status</th></tr>
        <tr><td>TSH ultrassensível</td><td><strong>5.84 μUI/mL</strong></td><td>0.40 – 4.50</td><td class="alt">↑ Elevado</td></tr>
        <tr><td>T4 livre</td><td>1.02 ng/dL</td><td>0.89 – 1.76</td><td class="ok">Normal</td></tr>
        <tr><td>T3 total</td><td>112 ng/dL</td><td>80 – 200</td><td class="ok">Normal</td></tr>
        <tr><td>Anti-TPO</td><td>28 UI/mL</td><td>&lt; 35</td><td class="ok">Normal</td></tr>
      </table>
      <div style="margin-top:14px;padding:10px 12px;background:#FEF3C7;border-left:3px solid #F59E0B;font-size:9.5px;line-height:1.5;color:#92400E">
        <strong>Comentário:</strong> TSH discretamente elevado com T4 livre normal — padrão compatível com hipotireoidismo subclínico. Sugere-se repetir em 8 semanas associado ao Anti-TPO.
      </div>
      <div class="footer">Liberado por Dra. Marina P. Tavares · CRM 156784-SP · 03/mai/2026</div>`
  },
  {
    name: 'glicemia',
    html: `
      <div class="head">
        <div><div class="logo">DELBONI MEDICINA DIAGNÓSTICA</div><div class="sub">Unidade Vila Olímpia · São Paulo/SP</div></div>
        <div style="text-align:right;font-size:9px;color:#6B7280">Pedido<br><strong style="color:#0D0F14">DM-2026-44219</strong></div>
      </div>
      <h1>Glicemia em Jejum</h1>
      <div class="meta">Coleta: 03/mai/2026 · Jejum confirmado: 10h · Paciente: Beatriz Oliveira</div>
      <table>
        <tr><th>Parâmetro</th><th>Valor</th><th>Referência</th><th>Status</th></tr>
        <tr><td>Glicose</td><td><strong>87 mg/dL</strong></td><td>70 – 99</td><td class="ok">Normal</td></tr>
        <tr><td>Hemoglobina glicada (HbA1c)</td><td>5.2 %</td><td>&lt; 5.7</td><td class="ok">Normal</td></tr>
        <tr><td>Insulina basal</td><td>8.4 μUI/mL</td><td>2.6 – 24.9</td><td class="ok">Normal</td></tr>
        <tr><td>HOMA-IR</td><td>1.8</td><td>&lt; 2.7</td><td class="ok">Normal</td></tr>
      </table>
      <div style="margin-top:14px;padding:10px 12px;background:#ECFDF5;border-left:3px solid #00C47A;font-size:9.5px;line-height:1.5;color:#065F46">
        <strong>Interpretação:</strong> Valores dentro da normalidade. Sem indícios de resistência insulínica ou diabetes mellitus no momento.
      </div>
      <div class="footer">Liberado por Dr. Henrique A. Câmara · CRM 098431-SP · 03/mai/2026</div>`
  },
  {
    name: 'ecg',
    html: `
      <div class="head">
        <div><div class="logo">HOSPITAL SÍRIO-LIBANÊS</div><div class="sub">Centro Diagnóstico Cardiológico · Bela Vista</div></div>
        <div style="text-align:right;font-size:9px;color:#6B7280">Atendimento<br><strong style="color:#0D0F14">HSL-2026-09822</strong></div>
      </div>
      <h1>Eletrocardiograma de Repouso (12 derivações)</h1>
      <div class="meta">Realizado em: 17/fev/2026 · Solicitante: Dr. Lucas Borelli (CRM 09876543-SP)</div>
      <div class="ecg-chart">
        <svg class="ecg-line" viewBox="0 0 400 80" preserveAspectRatio="none">
          <polyline fill="none" stroke="#DC2626" stroke-width="1.4"
            points="0,40 30,40 35,38 38,32 42,52 46,8 50,72 54,30 58,40 90,40 110,40 115,38 118,32 122,52 126,8 130,72 134,30 138,40 170,40 190,40 195,38 198,32 202,52 206,8 210,72 214,30 218,40 250,40 270,40 275,38 278,32 282,52 286,8 290,72 294,30 298,40 330,40 350,40 355,38 358,32 362,52 366,8 370,72 374,30 378,40 400,40"/>
        </svg>
      </div>
      <table>
        <tr><th>Parâmetro</th><th>Valor</th><th>Referência</th><th>Status</th></tr>
        <tr><td>Ritmo</td><td>Sinusal</td><td>Sinusal</td><td class="ok">Normal</td></tr>
        <tr><td>Frequência cardíaca</td><td>72 bpm</td><td>60 – 100</td><td class="ok">Normal</td></tr>
        <tr><td>Intervalo PR</td><td>148 ms</td><td>120 – 200</td><td class="ok">Normal</td></tr>
        <tr><td>QRS</td><td>92 ms</td><td>&lt; 120</td><td class="ok">Normal</td></tr>
        <tr><td>QT corrigido</td><td>402 ms</td><td>&lt; 450</td><td class="ok">Normal</td></tr>
      </table>
      <div style="margin-top:12px;font-size:9.5px;color:#1F2937;line-height:1.5"><strong>Laudo:</strong> Eletrocardiograma dentro dos limites da normalidade. Sem alterações isquêmicas agudas ou arritmias.</div>
      <div class="footer">Dr. Roberto T. Aguiar · CRM 084221-SP · Cardiologia · 17/fev/2026</div>`
  },
  {
    name: 'usg',
    html: `
      <div class="head">
        <div><div class="logo">FLEURY MEDICINA E SAÚDE</div><div class="sub">Centro Diagnóstico por Imagem · Higienópolis</div></div>
        <div style="text-align:right;font-size:9px;color:#6B7280">Exame<br><strong style="color:#0D0F14">USG-2026-018442</strong></div>
      </div>
      <h1>Ultrassonografia de Abdome Total</h1>
      <div class="meta">Realizado: 12/fev/2026 · Equipamento: GE LOGIQ E10 · Sonda convex 3.5 MHz</div>
      <div class="usg-img">
        <div class="usg-shape"></div>
        <div class="usg-text">FLEURY · USG ABD<br>12/02/26  14:08</div>
        <svg style="position:absolute;inset:0;width:100%;height:100%" viewBox="0 0 400 140" preserveAspectRatio="none">
          <ellipse cx="200" cy="70" rx="120" ry="55" fill="#1F1F1F" opacity="0.6"/>
          <ellipse cx="180" cy="70" rx="60" ry="35" fill="#2F2F2F" opacity="0.7"/>
          <circle cx="200" cy="70" r="3" fill="#22C55E"/>
        </svg>
      </div>
      <table>
        <tr><th>Órgão</th><th>Achados</th><th>Status</th></tr>
        <tr><td>Fígado</td><td>Dimensões normais, contornos regulares, ecotextura homogênea</td><td class="ok">Normal</td></tr>
        <tr><td>Vesícula biliar</td><td>Paredes finas, sem cálculos</td><td class="ok">Normal</td></tr>
        <tr><td>Pâncreas</td><td>Visualizado parcialmente, sem alterações</td><td class="ok">Normal</td></tr>
        <tr><td>Baço</td><td>Dimensões e ecogenicidade normais</td><td class="ok">Normal</td></tr>
        <tr><td>Rins</td><td>Bilaterais, tópicos, sem dilatações pielocaliciais</td><td class="ok">Normal</td></tr>
      </table>
      <div style="margin-top:10px;font-size:9.5px;color:#1F2937"><strong>Conclusão:</strong> Exame ecográfico de abdome total dentro dos limites da normalidade.</div>
      <div class="footer">Dra. Patrícia Vasconcelos · CRM 094572-SP · Radiologia · 12/fev/2026</div>`
  }
];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  for (const e of exams) {
    const page = await browser.newPage({ viewport: { width: 500, height: 600 } });
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>${e.html}</body></html>`;
    await page.setContent(html);
    const out = path.join(OUT, e.name + '.jpg');
    await page.screenshot({ path: out, type: 'jpeg', quality: 88, fullPage: true });
    console.log('✓', e.name, '→', out);
    await page.close();
  }
  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
