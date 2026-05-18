const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const prisma = new PrismaClient();

(async () => {
  const usuarioId = '6cfbe3b1-52e3-440c-90ac-27818d08fa54'; // Dr Gilberto
  const token = jwt.sign({ id: usuarioId, tipo: 'MEDICO' }, process.env.JWT_SECRET, { expiresIn: '30d' });
  const BASE = 'https://vitae-app-production.up.railway.app';
  const endpoints = ['/medico', '/medico/pacientes', '/pre-consulta', '/templates', '/medico/metricas?periodo=30dias'];
  for (const ep of endpoints) {
    try {
      const r = await fetch(BASE + ep, { headers: { Authorization: 'Bearer ' + token } });
      const txt = await r.text();
      console.log(`${ep} -> ${r.status} | ${txt.slice(0, 200)}...`);
    } catch (e) {
      console.log(`${ep} -> ERRO ${e.message}`);
    }
  }
})().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
