/**
 * Substitui o conteúdo do 1º <article class="pillar"> da seção "O PROBLEMA"
 * pela nova copy + vídeo motion.
 *
 * Mantém os pillars 2 e 3 intocados.
 * Remove a seção #box-pre-consulta (se existir) que tinha sido injetada antes por engano.
 */
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'site-oficial.html');
const BAK = FILE + '.bak-swap-pilar-' + Date.now();

const raw = fs.readFileSync(FILE, 'utf8');
const reTemplate = /(<script type="__bundler\/template">)([\s\S]*?)(<\/script>)/;
const m = raw.match(reTemplate);
if (!m) { console.error('✗ template não encontrado'); process.exit(1); }

const before = m[1];
let decoded = JSON.parse(m[2].trim());
const after = m[3];

console.log('✓ template decodificado · tamanho:', decoded.length);

// ETAPA 1: remover a seção #box-pre-consulta se existir
const removeBoxStart = decoded.indexOf('<section class="section" id="box-pre-consulta"');
if (removeBoxStart >= 0) {
  const removeBoxEnd = decoded.indexOf('</section>', removeBoxStart) + '</section>'.length;
  decoded = decoded.substring(0, removeBoxStart) + decoded.substring(removeBoxEnd);
  console.log('✓ seção #box-pre-consulta antiga removida');
}

// ETAPA 2: localizar o 1º <article class="pillar"> dentro da seção "O PROBLEMA"
// Marca-d'água da seção problema: data-screen-label="02 problema"
const problemaStart = decoded.indexOf('data-screen-label="02 problema"');
if (problemaStart < 0) { console.error('✗ seção O PROBLEMA não encontrada'); process.exit(1); }

const firstPillarStart = decoded.indexOf('<article class="pillar">', problemaStart);
if (firstPillarStart < 0) { console.error('✗ 1º article.pillar não encontrado'); process.exit(1); }

const firstPillarEnd = decoded.indexOf('</article>', firstPillarStart) + '</article>'.length;
const oldPillar = decoded.substring(firstPillarStart, firstPillarEnd);
console.log('✓ pillar 1 localizado · tamanho:', oldPillar.length);

// Verifica se já foi substituído antes (idempotente)
if (oldPillar.includes('box-video-pilar')) {
  // Já foi substituído por uma versão anterior — re-substituir mesmo assim
  console.log('⚠ pillar 1 já tinha vídeo · re-substituindo');
}

// ETAPA 3: novo conteúdo do pillar 1 — copy nova + vídeo motion
const newPillar = `<article class="pillar pillar-video">
        <span class="badge">Antes da consulta</span>
        <h3>Envia a pré-consulta antes da consulta do seu paciente.</h3>
        <p>Em 3 cliques você manda pelo WhatsApp. O paciente responde quando puder e você chega na consulta já preparado, sem perder 15 minutos refazendo anamnese.</p>
        <div class="vis box-video-pilar" style="aspect-ratio: 16 / 11; padding: 0; overflow: hidden; border-radius: 12px; background: #F7F8FB;">
          <video autoplay loop muted playsinline preload="metadata" style="width: 100%; height: 100%; object-fit: cover; display: block;">
            <source src="docs/marketing/videos/flow-pre-consulta.webm" type="video/webm">
          </video>
        </div>
      </article>`;

decoded = decoded.substring(0, firstPillarStart) + newPillar + decoded.substring(firstPillarEnd);
console.log('✓ pillar 1 substituído · novo tamanho do template:', decoded.length);

// Re-encoda com escape de </script>
const newBody = JSON.stringify(decoded).replace(/<\/script>/g, '<\\/script>');

// Backup
fs.writeFileSync(BAK, raw, 'utf8');
console.log('✓ backup →', BAK);

// Reescrita manual (sem String.replace pra evitar bugs com $)
const fullMatch = m[0];
const templateStart = raw.indexOf(fullMatch);
const newRaw = raw.substring(0, templateStart) + before + newBody + after + raw.substring(templateStart + fullMatch.length);

// Valida JSON
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
