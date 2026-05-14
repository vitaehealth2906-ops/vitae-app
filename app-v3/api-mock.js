// ============================================
// API MOCK — App v3 paciente (modo protótipo)
// Substitui chamadas reais ao backend por respostas simuladas
// Pra preview navegavel sem servidor.
// ============================================

(function () {
  const STORAGE_USER = 'vitae_usuario';
  const STORAGE_TOKEN = 'vitae_token';

  function getUsuario() {
    try { return JSON.parse(localStorage.getItem(STORAGE_USER) || 'null'); } catch (e) { return null; }
  }

  function isLoggedIn() {
    return !!localStorage.getItem(STORAGE_TOKEN);
  }

  function setSession(usuario) {
    localStorage.setItem(STORAGE_TOKEN, 'mock-' + Date.now());
    localStorage.setItem(STORAGE_USER, JSON.stringify(usuario || { id: 'mock', nome: 'Lucas Borelli', tipo: 'PACIENTE' }));
  }

  function marcarQuizCompleto() {
    localStorage.setItem('vitae_quiz_completo', '1');
  }

  function jaTemRG() {
    return localStorage.getItem('vitae_quiz_completo') === '1';
  }

  function resetarPrototipo() {
    localStorage.removeItem(STORAGE_TOKEN);
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem('vitae_quiz_completo');
    localStorage.removeItem('vitae_onb_quiz_visto');
    localStorage.removeItem('vitae_tipo_escolhido');
    localStorage.removeItem('vitae_quiz_retorno');
    sessionStorage.clear();
  }

  function fakeOK(extra) {
    return Promise.resolve(Object.assign({ ok: true }, extra || {}));
  }

  // Substitui qualquer fetch contra backend por resposta mock
  const originalFetch = window.fetch;
  window.fetch = function (url, opts) {
    if (typeof url === 'string' && (url.includes('/auth') || url.includes('vitae-app-production') || url.includes('localhost:3002'))) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          ok: true,
          token: 'mock-' + Date.now(),
          refreshToken: 'mock-refresh',
          usuario: { id: 'mock', nome: 'Lucas Borelli', email: 'lucas@email.com', tipo: 'PACIENTE' }
        })
      });
    }
    return originalFetch.apply(this, arguments);
  };

  // Objeto vitaeAPI esperado pelas telas originais
  window.vitaeAPI = {
    getUsuario,
    isLoggedIn,
    jaTemRG,
    marcarQuizCompleto,
    resetarPrototipo,
    getToken: () => localStorage.getItem(STORAGE_TOKEN),

    // Login simulado: sempre passa
    login: (email, senha) => {
      setSession({ id: 'mock', nome: 'Lucas Borelli', email: email || 'lucas@email.com', tipo: 'PACIENTE' });
      return fakeOK({ usuario: getUsuario() });
    },
    loginSocial: () => {
      setSession();
      return fakeOK({ usuario: getUsuario(), perfilJaCompleto: true });
    },

    // Cadastro: sempre cria
    cadastrar: (dados) => {
      setSession({ id: 'mock', nome: dados && dados.nome || 'Lucas Borelli', email: dados && dados.email || '', tipo: 'PACIENTE' });
      return fakeOK({ usuario: getUsuario() });
    },

    // Verificacao SMS: aceita qualquer codigo
    verificarSMS: () => fakeOK({ verificado: true }),
    reenviarSMS: () => fakeOK(),

    // Recuperacao de senha
    esqueciSenha: () => fakeOK({ enviado: true }),
    resetSenha: () => fakeOK({ trocada: true }),

    // Perfil
    getPerfil: () => Promise.resolve({
      perfil: { nascimento: '2008-03-12', tipoSanguineo: 'A+', genero: 'M', cpf: '39446366860' }
    }),
    atualizarPerfil: () => fakeOK(),
    uploadFoto: () => fakeOK({ fotoUrl: '' }),

    // Logout
    logout: () => {
      resetarPrototipo();
      window.location.href = '20-splash.html';
    },

    // Fallback geral pra qualquer método não coberto
  };

  // Proxy pra qualquer método não definido retornar sucesso vazio
  window.vitaeAPI = new Proxy(window.vitaeAPI, {
    get(target, prop) {
      if (prop in target) return target[prop];
      return () => fakeOK();
    }
  });

  // Modo preview (mapa/index): paciente já vê tudo pronto.
  // Sessão + RG marcados pra qualquer iframe filho renderizar sem gate.
  if (location.pathname.match(/(mapa-v3|index)\.html?$/i) || location.pathname.endsWith('/app-v3/') || location.pathname.endsWith('/app-v3')) {
    if (!isLoggedIn()) setSession();
    if (!jaTemRG()) marcarQuizCompleto();
  }

  // Telas de cadastro/quiz/onboarding: garante sessão mas NÃO marca quiz.
  // O 30-quiz precisa de token mock pra simular salvar dados.
  else if (location.pathname.match(/(28-onboarding|30-quiz|31-pronto|27-sms|quiz-preconsulta|pre-consulta)/i)) {
    if (!isLoggedIn()) setSession();
  }

  // Demais telas internas (depois do RG criado): garante sessão. Se entrou direto
  // sem RG, a própria tela 01-saude redireciona pro 30-quiz via vitaeAPI.jaTemRG().
  else if (!location.pathname.match(/(20-splash|21-boas|23-login|24-esqueci|25-nova|26-cadastro|22-escolha)/i)) {
    if (!isLoggedIn()) setSession();
  }
})();
