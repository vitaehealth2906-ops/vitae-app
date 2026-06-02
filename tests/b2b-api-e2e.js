// Teste E2E de API da Fundacao B2B (roda contra producao). Dados com prefixo TESTE-B2B.
const API = 'https://vitae-app-production.up.railway.app';
const ts = Date.now();
const cel = () => '+5511' + Math.floor(100000000 + Math.random() * 900000000);
const results = [];
function check(name, ok, extra = '') {
  results.push({ name, ok: !!ok });
  console.log((ok ? 'PASS ' : 'FALHA') + ' | ' + name + (extra ? '  -> ' + extra : ''));
}
async function req(method, path, { token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = 'Bearer ' + token;
  const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json = null; try { json = await res.json(); } catch (_) {}
  return { status: res.status, json };
}

(async () => {
  const donoEmail = `teste-b2b-dono-${ts}@vitae-test.com`;
  const funcEmail = `teste-b2b-func-${ts}@vitae-test.com`;
  const func2Email = `teste-b2b-func2-${ts}@vitae-test.com`;
  const empresaNome = `TESTE-B2B Empresa ${ts}`;

  let r = await req('POST', '/auth/cadastro', { body: { nome: 'TESTE-B2B Dono', email: donoEmail, celular: cel(), senha: 'senha12345', tipo: 'EMPRESA' } });
  check('T1.1 Dono cria conta tipo EMPRESA', r.status === 201 && r.json?.usuario?.tipo === 'EMPRESA', `status=${r.status} tipo=${r.json?.usuario?.tipo}`);
  const donoToken = r.json?.token;

  r = await req('POST', '/empresa', { token: donoToken, body: { nome: empresaNome } });
  check('T1.2 Dono cria empresa', r.status === 201 && !!r.json?.empresa?.id, `status=${r.status}`);

  r = await req('POST', '/empresa/convite', { token: donoToken });
  check('T1.3 Dono gera convite (token+link)', r.status === 201 && !!r.json?.token && !!r.json?.link, `status=${r.status} link=${r.json?.link}`);
  const conviteToken = r.json?.token;

  r = await req('GET', '/empresa/convite/' + conviteToken);
  check('T1.4 Validar convite (publico) mostra nome certo', r.status === 200 && r.json?.empresaNome === empresaNome, `status=${r.status} nome=${r.json?.empresaNome}`);

  r = await req('POST', '/auth/cadastro', { body: { nome: 'TESTE-B2B Func', email: funcEmail, celular: cel(), senha: 'senha12345' } });
  check('T1.5 Funcionario cria conta (PACIENTE)', r.status === 201 && r.json?.usuario?.tipo === 'PACIENTE', `status=${r.status} tipo=${r.json?.usuario?.tipo}`);
  const funcToken = r.json?.token;

  r = await req('POST', '/empresa/vincular', { token: funcToken, body: { token: conviteToken } });
  check('T1.6 Funcionario vincula (cola a etiqueta)', r.status === 200 && r.json?.vinculado === true, `status=${r.status} ${JSON.stringify(r.json)}`);

  r = await req('POST', '/empresa/vincular', { token: funcToken, body: { token: conviteToken } });
  check('T1.7 IDEMPOTENCIA: vincular de novo -> duplicate', r.status === 200 && r.json?.duplicate === true, `status=${r.status} ${JSON.stringify(r.json)}`);

  r = await req('GET', '/empresa/me', { token: donoToken });
  check('T1.8 Dono /me -> funcionariosAtivos = 1', r.status === 200 && r.json?.funcionariosAtivos === 1, `status=${r.status} ativos=${r.json?.funcionariosAtivos}`);
  const keys = r.json ? Object.keys(r.json).sort().join(',') : '';
  check('T1.9 PRIVACIDADE: /me so empresa+contagem (sem dado individual)', keys === 'empresa,funcionariosAtivos', `keys=${keys}`);

  r = await req('GET', '/empresa/convite/naoexiste-' + ts);
  check('T1.10 Convite inexistente -> 404', r.status === 404, `status=${r.status}`);

  // SONDA: o mesmo link serve pra um 2o funcionario? (1 link p/ time todo vs 1 link por pessoa)
  r = await req('POST', '/auth/cadastro', { body: { nome: 'TESTE-B2B Func2', email: func2Email, celular: cel(), senha: 'senha12345' } });
  const func2Token = r.json?.token;
  r = await req('POST', '/empresa/vincular', { token: func2Token, body: { token: conviteToken } });
  check('SONDA Link reutilizavel por 2o funcionario', r.status === 200 && r.json?.vinculado === true, `status=${r.status} ${JSON.stringify(r.json)} (409 = link e single-use)`);

  const pass = results.filter(x => x.ok).length;
  console.log(`\n=== ${pass}/${results.length} checagens passaram ===`);
  console.log('DADOS DE TESTE (pra limpar depois):');
  console.log('  emails:', donoEmail + ',', funcEmail + ',', func2Email);
  console.log('  empresa:', empresaNome);
})().catch(e => console.error('ERRO FATAL:', e));
