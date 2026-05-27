// Troca 5-10 → 7-15 nas stats do hero
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'site-oficial.html');
let raw = fs.readFileSync(FILE, 'utf8');

const find = '5-10<\\u002Fspan> min<\\u002Fdiv><div class=\\"l\\">perdidos';
const repl = '7-15<\\u002Fspan> min<\\u002Fdiv><div class=\\"l\\">perdidos';
console.log('match 5-10:', raw.includes(find));
raw = raw.replace(find, repl);
fs.writeFileSync(FILE, raw);
console.log('7-15 ok?', raw.includes('7-15<\\u002Fspan> min'));
