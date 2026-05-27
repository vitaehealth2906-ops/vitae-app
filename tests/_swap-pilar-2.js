/**
 * Substitui o 2º <article class="pillar"> (era "Histórico clínico")
 * pela copy nova + vídeo motion summary.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'site-oficial.html');
const BAK = FILE + '.bak-swap-pilar2-' + Date.now();

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

// Encontra o 2º <article class="pillar"> dentro da seção
let cursor = problemaStart;
const firstPillar = decoded.indexOf('<article class="pillar', cursor);
if (firstPillar < 0) { console.error('✗ 1º pillar não encontrado'); process.exit(1); }
cursor = decoded.indexOf('</article>', firstPillar) + '</article>'.length;
const secondPillar = decoded.indexOf('<article class="pillar', cursor);
if (secondPillar < 0) { console.error('✗ 2º pillar não encontrado'); process.exit(1); }
const secondPillarEnd = decoded.indexOf('</article>', secondPillar) + '</article>'.length;

const oldPillar = decoded.substring(secondPillar, secondPillarEnd);
console.log('✓ pillar 2 localizado · tamanho:', oldPillar.length);

const newPillar = `<article class="pillar pillar-video">
        <span class="badge">Durante a consulta</span>
        <h3>Saiba tudo sobre seu paciente antes dele entrar na sua sala.</h3>
        <p>Faça uma consulta mais precisa, com mais dados e de maneira mais rápida — com queixa, alergias, medicamentos, exames e padrões clínicos prontos em 1 minuto.</p>
        <div class="vis box-video-pilar" style="aspect-ratio: 16 / 11; padding: 0; overflow: hidden; border-radius: 12px; background: #F4F6FA;">
          <video autoplay loop muted playsinline preload="metadata" style="width: 100%; height: 100%; object-fit: cover; display: block;">
            <source src="docs/marketing/videos/flow-summary.webm" type="video/webm">
          </video>
        </div>
      </article>`;

decoded = decoded.substring(0, secondPillar) + newPillar + decoded.substring(secondPillarEnd);
console.log('✓ pillar 2 substituído · novo tamanho:', decoded.length);

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
