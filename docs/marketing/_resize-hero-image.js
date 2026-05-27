// Injeta CSS override no template do site-oficial.html pra deixar
// a imagem hero 2x maior e levemente abaixada (centralizada vertical).
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '../../site-oficial.html');

const ts = Date.now();
const bak = SITE + '.bak-resize-' + ts;
fs.copyFileSync(SITE, bak);
console.log('Backup:', path.basename(bak));

const html = fs.readFileSync(SITE, 'utf8');

const tagOpen = '<script type="__bundler/template">';
const tagClose = '</script>';
const tS = html.indexOf(tagOpen) + tagOpen.length;
const tE = html.indexOf(tagClose, tS);
const raw = html.slice(tS, tE);
const trimmed = raw.trim();
const leading = raw.slice(0, raw.indexOf(trimmed));
const trailing = raw.slice(raw.indexOf(trimmed) + trimmed.length);

let template = JSON.parse(trimmed);

// Marker to evitar dupla injecao
const MARKER = '/* HERO-RESIZE-OVERRIDE */';
const OVERRIDE = `
<style>${MARKER}
  /* Imagem hero maior + descida sutil pra centralizar visualmente */
  .sol-stage {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr) !important;
    align-items: center !important;
  }
  .sol-right {
    overflow: visible !important;
    margin-top: 120px !important;
    margin-right: clamp(-160px, -8vw, -40px) !important;
  }
  .sol-img {
    max-width: 1400px !important;
    width: 100% !important;
  }
  @media (max-width: 900px) {
    .sol-stage { grid-template-columns: 1fr !important; }
    .sol-right { margin-top: 20px !important; margin-right: 0 !important; }
    .sol-img { max-width: 100% !important; }
  }
</style>
`;

if (template.includes(MARKER)) {
  // Remove override antigo antes de inserir o novo (caso queira re-rodar)
  template = template.replace(/<style>\/\* HERO-RESIZE-OVERRIDE \*\/[\s\S]*?<\/style>/g, '');
  console.log('Override antigo removido');
}

// Injeta logo antes de </head>
const headClose = template.lastIndexOf('</head>');
if (headClose < 0) throw new Error('</head> nao encontrado no template');
template = template.slice(0, headClose) + OVERRIDE + template.slice(headClose);

// Escapa </script> e </style> pra nao quebrar o HTML parser quando re-inserido
// dentro de <script type="__bundler/template">.
const newJson = JSON.stringify(template)
  .replace(/<\/script>/g, '<\\/script>')
  .replace(/<\/style>/g, '<\\/style>');
const newHtml = html.slice(0, tS) + leading + newJson + trailing + html.slice(tE);

fs.writeFileSync(SITE, newHtml, 'utf8');
console.log('Site atualizado. Tamanho:', (fs.statSync(SITE).size/1024).toFixed(1), 'KB');
