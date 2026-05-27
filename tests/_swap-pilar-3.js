/**
 * Substitui o 3º <article class="pillar"> (era "Medicamentos / Tratamento")
 * pela copy nova + vídeo motion box3.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'site-oficial.html');
const BAK = FILE + '.bak-swap-pilar3-' + Date.now();

const raw = fs.readFileSync(FILE, 'utf8');
const reTemplate = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
const m = raw.match(reTemplate);
if (!m) { console.error('✗ template não encontrado'); process.exit(1); }

const before = m[1];
let decoded = JSON.parse(m[2].trim());
const after = m[3];

console.log('✓ template decodificado · tamanho:', decoded.length);

// Localiza seção O PROBLEMA
const problemaStart = decoded.indexOf('data-screen-label="02 problema"');
if (problemaStart < 0) { console.error('✗ seção O PROBLEMA não encontrada'); process.exit(1); }

// Encontra o 3º <article class="pillar"> dentro da seção
let cursor = problemaStart;
const p1 = decoded.indexOf('<article class="pillar', cursor);
cursor = decoded.indexOf('</article>', p1) + '</article>'.length;
const p2 = decoded.indexOf('<article class="pillar', cursor);
cursor = decoded.indexOf('</article>', p2) + '</article>'.length;
const p3 = decoded.indexOf('<article class="pillar', cursor);
if (p3 < 0) { console.error('✗ 3º pillar não encontrado'); process.exit(1); }
const p3End = decoded.indexOf('</article>', p3) + '</article>'.length;

const oldPillar = decoded.substring(p3, p3End);
console.log('✓ pillar 3 localizado · tamanho:', oldPillar.length);

const newPillar = `<article class="pillar pillar-video">
        <span class="badge">Depois da consulta</span>
        <h3>Marca retorno, envia receita e laudo — o paciente vê na hora.</h3>
        <p>Não tem mais ligação pra remarcar, WhatsApp pra mandar receita ou papel pra perder. Tudo direto entre médico e paciente, dentro do app.</p>
        <div class="vis box-video-pilar" style="aspect-ratio: 16 / 11; padding: 0; overflow: hidden; border-radius: 12px; background: #F4F6FA;">
          <video autoplay loop muted playsinline preload="metadata" style="width: 100%; height: 100%; object-fit: cover; display: block;">
            <source src="docs/marketing/videos/flow-box3.webm" type="video/webm">
          </video>
        </div>
      </article>`;

decoded = decoded.substring(0, p3) + newPillar + decoded.substring(p3End);
console.log('✓ pillar 3 substituído · novo tamanho:', decoded.length);

const newBody = JSON.stringify(decoded).replace(/<\/script>/g, '<\\/script>');

fs.writeFileSync(BAK, raw, 'utf8');
console.log('✓ backup →', BAK);

const fullMatch = m[0];
const templateStart = raw.indexOf(fullMatch);
const newRaw = raw.substring(0, templateStart) + before + newBody + after + raw.substring(templateStart + fullMatch.length);

// Valida
try {
  const m2 = newRaw.match(reTemplate);
  JSON.parse(m2[2].trim());
  console.log('✓ JSON válido após reescrita');
} catch (e) {
  console.error('✗ JSON inválido:', e.message);
  process.exit(1);
}

fs.writeFileSync(FILE, newRaw, 'utf8');
console.log('✓ site-oficial.html atualizado · diff', (newRaw.length - raw.length), 'chars');
