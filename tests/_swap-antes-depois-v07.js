// _swap-antes-depois-v07.js
// Substitui a seção "antes vs depois" (CUSTO REAL) no site-oficial.html
// pelo layout V07 — Gradient Divider — mantendo eyebrow/título/sub atuais do site.
//
// USO:  node tests/_swap-antes-depois-v07.js

const fs = require('fs');
const path = require('path');

const SITE = path.join(__dirname, '..', 'site-oficial.html');
const BACKUP = `${SITE}.bak-antes-depois-v07-${Date.now()}`;

const html = fs.readFileSync(SITE, 'utf8');
fs.writeFileSync(BACKUP, html);
console.log('backup salvo em:', BACKUP);

const tplPattern = /(<script type="__bundler\/template">)([\s\S]+?)(<\/script>)/;
const tplMatch = html.match(tplPattern);
if (!tplMatch) {
  console.error('FATAL: tag <script type="__bundler/template"> não encontrada.');
  process.exit(1);
}
const oldJson = tplMatch[2].trim();
const oldStr = JSON.parse(oldJson);
console.log('template length antes:', oldStr.length);

const START_MARKER = '<!-- CUSTO REAL — Antes vs Depois -->';
const END_MARKER = '<!-- DEPOIMENTO -->';

const startIdx = oldStr.indexOf(START_MARKER);
const endIdx = oldStr.indexOf(END_MARKER, startIdx);
if (startIdx < 0 || endIdx < 0) {
  console.error('FATAL: marcadores não encontrados', { startIdx, endIdx });
  process.exit(1);
}
const oldSection = oldStr.slice(startIdx, endIdx);
console.log('seção antiga length:', oldSection.length, 'chars');

// ──────────────────────────────────────────────────────────────────────────
// NEW SECTION — V07 Gradient Divider
// CSS escopado por prefixo vs7-* (não vaza pro resto do site).
// Mantém o header (tag/h2/lead) com a copy atual do site.
// Substitui só o componente .vs-grid pelas 2 listas com gradient central.
// ──────────────────────────────────────────────────────────────────────────
const NEW_SECTION = `<!-- CUSTO REAL — Antes vs Depois -->
<!-- variant: V07 Gradient Divider -->
<section class="section bg-2" data-screen-label="04 custo real">
  <style>
    .vs7-wrap{
      display:grid;
      grid-template-columns:1fr 4px 1fr;
      gap:0;
      background:#FFFFFF;
      border:1px solid rgba(13,15,20,0.06);
      border-radius:24px;
      overflow:hidden;
      box-shadow:0 1px 12px rgba(0,0,0,0.07);
      max-width:1100px;
      margin:48px auto 0;
    }
    .vs7-col{padding:36px 32px;display:flex;flex-direction:column}
    .vs7-col--before{background:#F7F8FB}
    .vs7-col--after{background:#FFFFFF}
    .vs7-col-head{
      display:flex;align-items:center;gap:10px;
      font-size:11px;font-weight:700;
      text-transform:uppercase;letter-spacing:1.8px;
      margin-bottom:28px;
      padding-bottom:18px;
      border-bottom:1px solid rgba(13,15,20,0.06);
      font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    }
    .vs7-col--before .vs7-col-head{color:#9CA3AF}
    .vs7-col--before .vs7-col-head .d{width:6px;height:6px;border-radius:50%;background:#C4C9D4}
    .vs7-col--after .vs7-col-head{color:#0F8A75}
    .vs7-col--after .vs7-col-head .d{width:6px;height:6px;border-radius:50%;background:#00E5A0}

    .vs7-list{display:flex;flex-direction:column;gap:18px;flex:1;list-style:none;padding:0;margin:0}
    .vs7-item{
      display:flex;align-items:flex-start;gap:14px;
      font-size:14px;line-height:1.5;
      font-family:'Plus Jakarta Sans',system-ui,sans-serif;
    }
    .vs7-item-num{
      font-family:'JetBrains Mono',ui-monospace,monospace;
      font-size:11px;font-weight:600;
      color:#9CA3AF;
      margin-top:2px;
      flex-shrink:0;
      width:24px;
    }
    .vs7-col--before .vs7-item-text{
      color:#6B7280;
      text-decoration:line-through;
      text-decoration-color:rgba(13,15,20,0.18);
      font-weight:500;
    }
    .vs7-col--after .vs7-item-text{
      color:#0D0F14;
      font-weight:600;
    }
    .vs7-divider{
      background:linear-gradient(180deg, #00E5A0, #00B4D8);
      position:relative;
    }
    .vs7-divider::before{
      content:'vs';
      position:absolute;
      top:50%;left:50%;transform:translate(-50%,-50%);
      font-family:'JetBrains Mono',ui-monospace,monospace;
      font-size:10px;font-weight:700;
      color:#fff;
      background:#0D0F14;
      border-radius:50%;
      width:32px;height:32px;
      display:flex;align-items:center;justify-content:center;
      letter-spacing:0.05em;
    }
    @media (max-width:880px){
      .vs7-wrap{grid-template-columns:1fr;border-radius:18px}
      .vs7-col{padding:28px 24px}
      .vs7-divider{height:4px;width:100%}
      .vs7-divider::before{display:none}
    }
  </style>
  <div class="wrap">
    <div class="sh reveal">
      <span class="tag">O custo real</span>
      <h2>Antes do vitaid. <span class="grad-text">Depois do vitaid.</span></h2>
      <p class="lead">Cada minuto perdido com anamnese repetitiva é um minuto que você poderia usar para diagnosticar melhor — ou atender mais um paciente.</p>
    </div>

    <div class="vs7-wrap reveal" data-d="1">
      <div class="vs7-col vs7-col--before">
        <div class="vs7-col-head"><span class="d"></span> Sem vitaid</div>
        <ul class="vs7-list">
          <li class="vs7-item"><span class="vs7-item-num">01</span><span class="vs7-item-text">5 minutos repetindo "tem alergia? toma algum remédio?"</span></li>
          <li class="vs7-item"><span class="vs7-item-num">02</span><span class="vs7-item-text">Dados espalhados — exame numa pasta, receita no WhatsApp, histórico na memória.</span></li>
          <li class="vs7-item"><span class="vs7-item-num">03</span><span class="vs7-item-text">30 min digitando depois de cada consulta.</span></li>
          <li class="vs7-item"><span class="vs7-item-num">04</span><span class="vs7-item-text">Receita amassada, laudo perdido — paciente esquece o que tomar.</span></li>
          <li class="vs7-item"><span class="vs7-item-num">05</span><span class="vs7-item-text">Marcou retorno no papel — paciente esqueceu, vínculo perdido.</span></li>
        </ul>
      </div>
      <div class="vs7-divider"></div>
      <div class="vs7-col vs7-col--after">
        <div class="vs7-col-head"><span class="d"></span> Com vitaid</div>
        <ul class="vs7-list">
          <li class="vs7-item"><span class="vs7-item-num">01</span><span class="vs7-item-text">O paciente conta antes. Você entende quem ele é antes dele entrar na sala.</span></li>
          <li class="vs7-item"><span class="vs7-item-num">02</span><span class="vs7-item-text">Tudo do paciente num painel só. Alergias, exames, medicações — centralizado.</span></li>
          <li class="vs7-item"><span class="vs7-item-num">03</span><span class="vs7-item-text">Sobe pro seu prontuário em segundos. Sem digitar.</span></li>
          <li class="vs7-item"><span class="vs7-item-num">04</span><span class="vs7-item-text">Você envia laudos e receitas. Aparece no app do paciente na hora.</span></li>
          <li class="vs7-item"><span class="vs7-item-num">05</span><span class="vs7-item-text">Você marca o retorno no seu app. O paciente confirma no dele.</span></li>
        </ul>
      </div>
    </div>
  </div>
</section>

`;

const newStr = oldStr.slice(0, startIdx) + NEW_SECTION + oldStr.slice(endIdx);
console.log('template length depois:', newStr.length);

// Sanity: ensure marker reappears
if (newStr.indexOf(END_MARKER) < 0) {
  console.error('FATAL: marcador DEPOIMENTO sumiu — abortei.');
  process.exit(1);
}
if (newStr.indexOf(START_MARKER) < 0) {
  console.error('FATAL: marcador CUSTO REAL sumiu — abortei.');
  process.exit(1);
}

// CRITICO: bundler escapa </script> como <\/script> dentro do JSON
// pra impedir o parser HTML de encerrar a tag <script type="..."> prematuramente.
// JSON.stringify nativo NAO faz esse escape — precisamos aplicar manualmente.
const newJson = '\n' + JSON.stringify(newStr).replace(/<\/script>/g, '<\\/script>') + '\n  ';
const newHtml = html.replace(tplPattern, (_m, a, _b, c) => `${a}${newJson}${c}`);

if (newHtml === html) {
  console.error('FATAL: HTML não mudou — substituição falhou.');
  process.exit(1);
}

fs.writeFileSync(SITE, newHtml);
const sz = fs.statSync(SITE).size;
console.log('OK. site-oficial.html novo size:', sz, 'bytes');
console.log('rollback: copie', BACKUP, '->', SITE);
