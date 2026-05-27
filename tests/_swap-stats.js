// Troca números das stats no hero do site-oficial.html
// 15 min → 5-10 min   |   +25% → +12%
const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, '..', 'site-oficial.html');
let raw = fs.readFileSync(FILE, 'utf8');

const find15 = '15<\\u002Fspan> min<\\u002Fdiv><div class=\\"l\\">perdidos';
const repl15 = '5-10<\\u002Fspan> min<\\u002Fdiv><div class=\\"l\\">perdidos';
const find25 = '+25<\\u002Fspan>%<\\u002Fdiv><div class=\\"l\\">de receita';
const repl25 = '+12<\\u002Fspan>%<\\u002Fdiv><div class=\\"l\\">de receita';

console.log('match 15:', raw.includes(find15));
console.log('match 25:', raw.includes(find25));

raw = raw.replace(find15, repl15);
raw = raw.replace(find25, repl25);

fs.writeFileSync(FILE, raw);

console.log('5-10 ok?', raw.includes('5-10<\\u002Fspan> min'));
console.log('+12 ok?', raw.includes('+12<\\u002Fspan>%'));
