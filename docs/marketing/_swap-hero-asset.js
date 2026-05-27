// Substitui o PNG do hero (UUID 6a805543...) em site-oficial.html
// pelo novo PNG exportado em hero-export.png.
// Cria backup .bak-hero-<timestamp> antes.
const fs = require('fs');
const path = require('path');

const SITE = path.resolve(__dirname, '../../site-oficial.html');
const PNG  = path.resolve(__dirname, 'hero-export.png');
const UUID = '6a805543-5166-4d29-9bbe-769b1689ad39';

const html = fs.readFileSync(SITE, 'utf8');
const png  = fs.readFileSync(PNG);
const b64  = png.toString('base64');

console.log('PNG size      :', (png.length/1024).toFixed(1), 'KB');
console.log('Base64 length :', b64.length, 'chars');

// Encontra a entrada do asset
const entryKey = `"${UUID}":{`;
const entryStart = html.indexOf(entryKey);
if (entryStart < 0) throw new Error('UUID nao encontrado no site-oficial.html');

// Dentro da entry, acha "data":" e o ' " ' de fechamento (base64 nao tem aspas).
const dataMarker = '"data":"';
const dataStart  = html.indexOf(dataMarker, entryStart);
if (dataStart < 0) throw new Error('Campo data nao encontrado');
const valStart   = dataStart + dataMarker.length;
const valEnd     = html.indexOf('"', valStart);
if (valEnd < 0) throw new Error('Fim do data nao encontrado');

const oldB64 = html.slice(valStart, valEnd);
console.log('Old data len  :', oldB64.length, 'chars');

const newHtml = html.slice(0, valStart) + b64 + html.slice(valEnd);

// Backup
const ts = Date.now();
const bak = SITE + '.bak-hero-' + ts;
fs.copyFileSync(SITE, bak);
console.log('Backup        :', path.basename(bak));

fs.writeFileSync(SITE, newHtml, 'utf8');
console.log('Site atualizado:', path.basename(SITE));
console.log('Novo tamanho  :', (fs.statSync(SITE).size/1024).toFixed(1), 'KB');
