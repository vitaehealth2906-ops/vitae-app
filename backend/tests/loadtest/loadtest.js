// ============================================================
// Teste de carga/escala do painel do gestor B2B (Sessao 36)
// Roda via:  railway run node tests/loadtest/loadtest.js <cmd>
//   seed <N>   -> cria 1 empresa de teste + N membros sinteticos (marcados)
//   measure    -> mede a performance REAL das queries do painel nesse volume
//   cleanup    -> apaga 100% dos dados de teste (por marcador) + checa integridade
//
// TUDO marcado por email "loadtest+...@vitae-loadtest.invalid" e empresa
// "LOADTEST ORG ...". Cleanup deleta SO o marcado e confere os reais antes/depois.
// ============================================================
const prisma = require('../../src/utils/prisma');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MARK = 'vitae-loadtest.invalid';
const API = process.env.LOADTEST_API || 'https://vitae-app-production.up.railway.app';
const STATE = path.join(__dirname, '_state.json');
const cmd = process.argv[2];

const FN = ['Marina','Pedro','Beatriz','Rafael','Sofia','Lucas','Ana','Carlos','Julia','Bruno','Larissa','Diego','Camila','Felipe','Mariana','Gabriel','Leticia','Thiago','Aline','Rodrigo'];
const LN = ['Alves','Lima','Souza','Mendes','Rocha','Silva','Costa','Pereira','Gomes','Ribeiro','Carvalho','Almeida','Barbosa','Nunes','Teixeira'];
const nomeFake = (i) => FN[i % FN.length] + ' ' + LN[(i * 7) % LN.length];

async function seed(N) {
  const ts = Date.now();
  const donoEmail = `loadtest+dono-${ts}@${MARK}`;
  const r = await fetch(API + '/auth/cadastro', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome: 'LOADTEST Gestor', email: donoEmail, celular: '+5519' + String(ts).slice(-9), senha: 'LoadTest@123', tipo: 'EMPRESA' }),
  });
  const dj = await r.json();
  if (!dj.token) throw new Error('cadastro dono falhou: ' + JSON.stringify(dj));
  const donoId = dj.usuario.id, token = dj.token;

  const empresa = await prisma.empresa.create({ data: { nome: `LOADTEST ORG ${ts}`, tipo: 'Escola', donoId, status: 'ATIVA' } });

  const BATCH = 1000;
  const senhaHash = '$2a$10$0123456789012345678901uOuVwXyZ0123456789012345678901';
  let done = 0; const t0 = Date.now();
  for (let off = 0; off < N; off += BATCH) {
    const n = Math.min(BATCH, N - off);
    const users = [], perfis = [], vincs = [], aler = [], meds = [];
    for (let k = 0; k < n; k++) {
      const idx = off + k, uid = crypto.randomUUID(), menor = idx % 5 === 0;
      users.push({ id: uid, nome: nomeFake(idx), email: `loadtest+${idx}-${ts}@${MARK}`, senhaHash, tipo: 'PACIENTE', status: 'ATIVO' });
      perfis.push({ usuarioId: uid, genero: idx % 2 ? 'MASCULINO' : 'FEMININO', dataNascimento: new Date(Date.UTC(menor ? 2012 : 1990, 0, 1 + (idx % 28))), alturaCm: 155 + (idx % 35), pesoKg: 55 + (idx % 40), tipoSanguineo: ['A_POS', 'O_POS', 'B_POS', 'AB_POS', 'O_NEG'][idx % 5], condicoes: idx % 3 ? 'Hipertensao' : null, planoSaude: 'Unimed', historicoFamiliar: [] });
      vincs.push({ empresaId: empresa.id, pacienteId: uid, status: 'ATIVO', entrouEm: new Date() });
      if (idx % 2) aler.push({ usuarioId: uid, nome: 'Dipirona', tipo: 'MEDICAMENTO', gravidade: 'GRAVE', fonte: 'loadtest' });
      if (idx % 3) meds.push({ usuarioId: uid, nome: 'Losartana 50mg', ativo: true, fonte: 'loadtest' });
    }
    await prisma.usuario.createMany({ data: users, skipDuplicates: true });
    await prisma.perfilSaude.createMany({ data: perfis, skipDuplicates: true });
    await prisma.vinculoEmpresa.createMany({ data: vincs, skipDuplicates: true });
    if (aler.length) await prisma.alergia.createMany({ data: aler, skipDuplicates: true });
    if (meds.length) await prisma.medicamento.createMany({ data: meds, skipDuplicates: true });
    done += n; process.stdout.write(`  semeados ${done}/${N}\r`);
  }
  fs.writeFileSync(STATE, JSON.stringify({ empresaId: empresa.id, donoId, donoEmail, token, total: N, ts }, null, 2));
  console.log(`\nSEED OK: ${N} membros na empresa ${empresa.id} em ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

async function bench(nome, fn, runs = 40) {
  await fn(); // warmup
  const ts = [];
  for (let i = 0; i < runs; i++) { const a = process.hrtime.bigint(); await fn(); ts.push(Number(process.hrtime.bigint() - a) / 1e6); }
  ts.sort((x, y) => x - y);
  const p = (q) => ts[Math.min(ts.length - 1, Math.floor(q * ts.length))];
  console.log(`  ${nome.padEnd(36)} p50=${p(.5).toFixed(1)}ms  p95=${p(.95).toFixed(1)}ms  max=${ts[ts.length - 1].toFixed(1)}ms`);
  return { nome, p50: p(.5), p95: p(.95), max: ts[ts.length - 1] };
}

async function measure() {
  const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const empresaId = st.empresaId;
  const total = await prisma.vinculoEmpresa.count({ where: { empresaId, status: 'ATIVO' } });
  console.log(`\nMedindo painel do gestor na empresa de teste com ${total} membros ativos:\n`);

  const lean = { id: true, paciente: { select: { id: true, nome: true, fotoUrl: true, perfilSaude: { select: { dataNascimento: true, genero: true } } } } };
  const res = [];
  res.push(await bench('Lista pagina 1 (50)', () => prisma.vinculoEmpresa.findMany({ where: { empresaId, status: 'ATIVO' }, orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }], take: 51, select: lean })));
  const meio = await prisma.vinculoEmpresa.findMany({ where: { empresaId, status: 'ATIVO' }, orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }], take: 1, skip: Math.floor(total / 2), select: { id: true } });
  const cur = meio[0] && meio[0].id;
  if (cur) res.push(await bench('Lista pagina profunda (cursor)', () => prisma.vinculoEmpresa.findMany({ where: { empresaId, status: 'ATIVO' }, orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }], cursor: { id: cur }, skip: 1, take: 51, select: lean })));
  res.push(await bench('Busca por nome ("Ana")', () => prisma.vinculoEmpresa.findMany({ where: { empresaId, status: 'ATIVO', paciente: { nome: { contains: 'Ana', mode: 'insensitive' } } }, orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }], take: 51, select: lean })));
  res.push(await bench('Metrica: count RG preenchido', () => prisma.vinculoEmpresa.count({ where: { empresaId, status: 'ATIVO', paciente: { perfilSaude: { dataNascimento: { not: null } } } } })));
  res.push(await bench('Contagem total ativos', () => prisma.vinculoEmpresa.count({ where: { empresaId, status: 'ATIVO' } })));
  const um = await prisma.vinculoEmpresa.findFirst({ where: { empresaId, status: 'ATIVO' }, select: { pacienteId: true } });
  if (um && um.pacienteId) res.push(await bench('RG de 1 membro (ficha)', () => prisma.usuario.findUnique({ where: { id: um.pacienteId }, select: { id: true, nome: true, email: true, celular: true, fotoUrl: true, perfilSaude: true, medicamentos: { orderBy: { criadoEm: 'desc' } }, alergias: { orderBy: { criadoEm: 'desc' } } } })));

  const piorP95 = Math.max(...res.map((r) => r.p95));
  const veredito = piorP95 < 150 ? 'OK COM FOLGA' : piorP95 < 400 ? 'ACEITAVEL' : 'ATENCAO';
  console.log(`\nVEREDITO (banco, ${total} membros): pior p95 = ${piorP95.toFixed(1)}ms -> ${veredito}`);
}

async function cleanup() {
  const reaisAntes = await prisma.usuario.count({ where: { NOT: { email: { contains: MARK } } } });
  const delU = await prisma.usuario.deleteMany({ where: { email: { contains: MARK } } });
  const delE = await prisma.empresa.deleteMany({ where: { nome: { startsWith: 'LOADTEST ORG ' } } });
  const reaisDepois = await prisma.usuario.count({ where: { NOT: { email: { contains: MARK } } } });
  try { fs.unlinkSync(STATE); } catch (e) {}
  console.log(JSON.stringify({ usuariosTesteApagados: delU.count, empresasTesteApagadas: delE.count, reaisAntes, reaisDepois, integro: reaisAntes === reaisDepois }, null, 2));
}

// EXPLAIN ANALYZE = tempo REAL de execucao DENTRO do banco (sem a latencia da
// internet daqui), + prova se os indices estao sendo usados (Index Scan x Seq Scan).
// E a metrica de escala que vale independente de onde a gente roda.
async function explain() {
  const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const eid = st.empresaId;
  const total = await prisma.vinculoEmpresa.count({ where: { empresaId: eid, status: 'ATIVO' } });
  console.log(`\nEXPLAIN ANALYZE (tempo dentro do banco, sem rede) — ${total} membros:\n`);
  const Q = [
    ['Lista pagina 1 (50)',
      `SELECT v.id, u.id AS uid, u.nome, u.foto_url, p.data_nascimento, p.genero
       FROM vinculos_empresa v JOIN usuarios u ON u.id = v.paciente_id
       LEFT JOIN perfil_saude p ON p.usuario_id = u.id
       WHERE v.empresa_id = $1 AND v.status = 'ATIVO'
       ORDER BY v.criado_em DESC, v.id DESC LIMIT 51`],
    ['Busca nome ILIKE %Ana%',
      `SELECT v.id, u.id AS uid, u.nome FROM vinculos_empresa v JOIN usuarios u ON u.id = v.paciente_id
       WHERE v.empresa_id = $1 AND v.status = 'ATIVO' AND u.nome ILIKE '%Ana%'
       ORDER BY v.criado_em DESC, v.id DESC LIMIT 51`],
    ['Metrica count RG preenchido',
      `SELECT count(*) FROM vinculos_empresa v
       WHERE v.empresa_id = $1 AND v.status = 'ATIVO'
       AND EXISTS (SELECT 1 FROM perfil_saude p WHERE p.usuario_id = v.paciente_id AND p.data_nascimento IS NOT NULL)`],
    ['Contagem total ativos',
      `SELECT count(*) FROM vinculos_empresa v WHERE v.empresa_id = $1 AND v.status = 'ATIVO'`],
  ];
  for (const [nome, sql] of Q) {
    const rows = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, FORMAT JSON) ${sql}`, eid);
    const plan = rows[0]['QUERY PLAN'][0];
    const exec = plan['Execution Time'];
    const txt = JSON.stringify(plan);
    const seq = (txt.match(/"Seq Scan"[^}]*?"Relation Name":"(usuarios|vinculos_empresa|perfil_saude)"/g) || []);
    const idx = (txt.match(/"(Index Scan|Index Only Scan|Bitmap Index Scan)"/g) || []).length;
    const flag = seq.length ? `SEQ SCAN(!) x${seq.length}` : `indices ok (${idx} index scans)`;
    console.log(`  ${nome.padEnd(30)} exec=${exec.toFixed(2)}ms   [${flag}]`);
  }
}

// Smoke das rotas DEPLOYADAS (produção) usando o token do gestor de teste.
async function http() {
  const st = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  const H = { Authorization: 'Bearer ' + st.token, 'Content-Type': 'application/json' };
  const t = async (nome, p) => { const a = Date.now(); const r = await fetch(API + p, { headers: H }); const j = await r.json().catch(() => ({})); console.log(`  ${nome.padEnd(32)} HTTP ${r.status}  (${Date.now() - a}ms ida-e-volta c/ minha internet)`); return { r, j }; };
  console.log('\nSmoke HTTP nas rotas DEPLOYADAS (produção):\n');
  const me = await t('GET /empresa/me', '/empresa/me');
  console.log(`      -> ativos=${me.j.funcionariosAtivos}  comRgPreenchido=${me.j.comRgPreenchido}`);
  const list = await t('GET /empresa/membros', '/empresa/membros');
  const m0 = (list.j.membros || [])[0];
  console.log(`      -> ${(list.j.membros || []).length} na pagina, proximaPagina=${list.j.nextCursor ? 'sim' : 'nao'}, ex: ${m0 ? m0.nome + ' ' + m0.idade + 'a ' + (m0.menor ? '(menor)' : '') : '-'}`);
  const busca = await t('GET /empresa/membros?q=Ana', '/empresa/membros?q=Ana');
  console.log(`      -> ${(busca.j.membros || []).length} resultados para "Ana"`);
  if (m0) {
    const rg = await t('GET /empresa/membro/:id', '/empresa/membro/' + m0.id);
    const m = rg.j.membro || {};
    console.log(`      -> RG de ${m.nome}: perfil=${!!m.perfilSaude} alergias=${(m.alergias || []).length} meds=${(m.medicamentos || []).length} exames=${m.exames === undefined ? 'CORTADOS (ok)' : 'PRESENTES (!)'}`);
  }
  const sec = await t('SEGURANCA: membro de fora', '/empresa/membro/00000000-0000-0000-0000-000000000000');
  console.log(`      -> esperado 403, veio ${sec.r.status} ${sec.r.status === 403 ? '(porteiro bloqueou ok)' : '(ATENCAO)'}`);
}

(async () => {
  try {
    if (cmd === 'seed') await seed(parseInt(process.argv[3] || '10000', 10));
    else if (cmd === 'measure') await measure();
    else if (cmd === 'explain') await explain();
    else if (cmd === 'http') await http();
    else if (cmd === 'cleanup') await cleanup();
    else console.log('uso: node loadtest.js seed <N> | measure | explain | http | cleanup');
  } catch (e) {
    console.error('ERRO:', e && e.message ? e.message : e);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
