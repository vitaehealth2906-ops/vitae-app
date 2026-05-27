/**
 * Insere uma NOVA seção "1ª Box" no site-oficial.html, logo após a seção "A SOLUÇÃO" (#como).
 * Contém:
 *   - Tag "01 · Antes da consulta"
 *   - Headline: "Envia a pré-consulta antes da consulta do seu paciente"
 *   - Texto explicando o fluxo
 *   - Vídeo motion (loop, autoplay, muted)
 *
 * Vídeo: docs/marketing/videos/flow-pre-consulta.webm (URL relativa)
 *
 * Faz backup antes.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'site-oficial.html');
const BAK = FILE + '.bak-box-video-' + Date.now();

const raw = fs.readFileSync(FILE, 'utf8');

// Decodifica o bundle template (que está dentro de <script type="__bundler/template">...)
const reTemplate = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
const m = raw.match(reTemplate);
if (!m) { console.error('✗ template não encontrado'); process.exit(1); }

const before = m[1];
let body = m[2];
const after = m[3];

let decoded;
try { decoded = JSON.parse(body.trim()); }
catch (e) { console.error('✗ JSON.parse falhou:', e.message); process.exit(1); }

console.log('✓ template decodificado · tamanho:', decoded.length, 'chars');

// Acha o fim da seção #como (a "A SOLUÇÃO")
const startTag = '<section class="section showcase" id="como"';
const startIdx = decoded.indexOf(startTag);
if (startIdx < 0) { console.error('✗ seção #como não encontrada'); process.exit(1); }

// Acha o fim dessa seção (próximo </section>)
const endMarker = '</section>';
const endIdx = decoded.indexOf(endMarker, startIdx) + endMarker.length;

// Idempotente: remove a seção anterior se já existe
const NEW_SECTION_ID = 'box-pre-consulta';
if (decoded.includes('id="' + NEW_SECTION_ID + '"')) {
  const oldStart = decoded.indexOf('<section class="section" id="' + NEW_SECTION_ID + '"');
  if (oldStart >= 0) {
    const oldEnd = decoded.indexOf('</section>', oldStart) + '</section>'.length;
    decoded = decoded.substring(0, oldStart) + decoded.substring(oldEnd);
    console.log('✓ seção anterior removida');
  }
}

// MARKUP — sem <style> separado, usa classes globais do site (.section, .wrap, .tag, .grad-text)
// + style="" inline pra grid/vídeo (estilos específicos não estão no global)
const newSection = `

<!-- BOX 1 — Envia pré-consulta (vídeo motion) -->
<section class="section" id="${NEW_SECTION_ID}" data-screen-label="04 box 1 pre-consulta">
  <div class="wrap">
    <div class="reveal" style="display:grid; grid-template-columns:1fr 1.15fr; gap:60px; align-items:center">
      <div>
        <span class="tag" style="margin-bottom:16px; display:inline-block">01 · Antes da consulta</span>
        <h2 style="font-size:40px; line-height:1.05; letter-spacing:-1.2px; font-weight:800; margin:14px 0 20px">Envia a <span class="grad-text">pré-consulta</span> antes da consulta do seu paciente.</h2>
        <p class="lead" style="font-size:17px; line-height:1.55; margin-bottom:24px">Em 3 cliques você manda pelo WhatsApp. O paciente responde quando puder — no caminho, no metrô, depois do almoço. E você chega na consulta já preparado, sem perder 15 minutos refazendo anamnese.</p>
        <ul style="list-style:none; padding:0; margin:0">
          <li style="font-size:15px; line-height:1.55; padding:8px 0 8px 26px; position:relative"><span style="position:absolute; left:0; top:14px; width:12px; height:12px; background:linear-gradient(120deg,#00E5A0,#00B4D8); border-radius:50%; box-shadow:0 0 0 4px rgba(0,229,160,.12)"></span><strong style="font-weight:700">3 cliques</strong> pra montar e enviar — paciente, template, mensagem.</li>
          <li style="font-size:15px; line-height:1.55; padding:8px 0 8px 26px; position:relative"><span style="position:absolute; left:0; top:14px; width:12px; height:12px; background:linear-gradient(120deg,#00E5A0,#00B4D8); border-radius:50%; box-shadow:0 0 0 4px rgba(0,229,160,.12)"></span><strong style="font-weight:700">WhatsApp direto</strong> — o canal que o paciente já usa todo dia.</li>
          <li style="font-size:15px; line-height:1.55; padding:8px 0 8px 26px; position:relative"><span style="position:absolute; left:0; top:14px; width:12px; height:12px; background:linear-gradient(120deg,#00E5A0,#00B4D8); border-radius:50%; box-shadow:0 0 0 4px rgba(0,229,160,.12)"></span><strong style="font-weight:700">Link rastreável</strong> — você sabe quando ele abriu e respondeu.</li>
        </ul>
      </div>
      <div style="position:relative; width:100%; aspect-ratio:16/9; border-radius:18px; overflow:hidden; background:#F7F8FB; box-shadow:0 1px 2px rgba(13,15,20,.04), 0 32px 64px -20px rgba(13,15,20,.22)">
        <video autoplay loop muted playsinline preload="metadata" style="width:100%; height:100%; object-fit:cover; display:block">
          <source src="docs/marketing/videos/flow-pre-consulta.webm" type="video/webm">
        </video>
      </div>
    </div>
  </div>
</section>
`;

// Insere a nova seção LOGO DEPOIS da seção #como
const newDecoded = decoded.substring(0, endIdx) + newSection + decoded.substring(endIdx);

// Backup
fs.writeFileSync(BAK, raw, 'utf8');
console.log('✓ backup →', BAK);

// Re-encoda template (JSON.stringify pra escapar de novo)
// IMPORTANTE: JSON.stringify NÃO escapa `/` por padrão. Mas o `</script>` dentro
// do JSON precisa virar `<\/script>` pra não fechar a tag <script> envolvente.
const newBody = JSON.stringify(newDecoded).replace(/<\/script>/g, '<\\/script>');

// NÃO uso String.replace pra evitar bugs com $ em replacement.
// Em vez disso, faço concatenação manual via indexOf.
const fullMatch = m[0];
const templateStart = raw.indexOf(fullMatch);
if (templateStart < 0) { console.error('✗ não localizei o match no raw'); process.exit(1); }
const newRaw = raw.substring(0, templateStart) + before + newBody + after + raw.substring(templateStart + fullMatch.length);

// Validação: o JSON ainda parseia depois da concatenação?
try {
  const re2 = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
  const m2 = newRaw.match(re2);
  JSON.parse(m2[2].trim());
  console.log('✓ JSON do template ainda válido após reescrita');
} catch (e) {
  console.error('✗ JSON do template ficou inválido:', e.message);
  process.exit(1);
}

fs.writeFileSync(FILE, newRaw, 'utf8');
console.log('✓ site-oficial.html atualizado · diff', (newRaw.length - raw.length), 'chars');
