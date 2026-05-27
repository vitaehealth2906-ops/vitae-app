const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const pc = await p.preConsulta.findUnique({
    where: { id: '34671191-2157-46b9-9a76-9f8a0cc9f286' },
    select: { summaryJson: true }
  });
  const sj = pc.summaryJson || {};
  console.log('anamneseEstruturada total campos:', Object.keys(sj.anamneseEstruturada || {}).length);
  console.log('pontosAtencao count:', (sj.pontosAtencao || []).length);
  console.log('descricaoBreve:', (sj.descricaoBreve || '').slice(0, 120));
  console.log('---');
  console.log('queixaPrincipal:', JSON.stringify(sj.anamneseEstruturada && sj.anamneseEstruturada.queixaPrincipal));
  console.log('intensidade:', JSON.stringify(sj.anamneseEstruturada && sj.anamneseEstruturada.intensidade));
  console.log('antecedentesFamiliares:', JSON.stringify(sj.anamneseEstruturada && sj.anamneseEstruturada.antecedentesFamiliares));
  console.log('---');
  for (const pt of (sj.pontosAtencao || [])) {
    console.log('•', pt.titulo + ':', (pt.mensagem || '').slice(0, 100) + '...', '[' + pt.gravidade + ']');
  }
  await p.$disconnect();
})();
