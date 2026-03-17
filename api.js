/**
 * VITAE — Modulo API compartilhado
 * Todas as telas HTML usam este arquivo para se comunicar com o backend.
 */

const API_URL = ['localhost','127.0.0.1'].includes(window.location.hostname) || window.location.protocol === 'file:'
  ? 'http://localhost:3002'
  : 'https://vitae-app-production.up.railway.app';

// ---- Token management ----

function getToken() {
  return localStorage.getItem('vitae_token');
}

function getRefreshToken() {
  return localStorage.getItem('vitae_refresh_token');
}

function setTokens(token, refreshToken) {
  localStorage.setItem('vitae_token', token);
  if (refreshToken) localStorage.setItem('vitae_refresh_token', refreshToken);
}

function getUsuario() {
  const data = localStorage.getItem('vitae_usuario');
  return data ? JSON.parse(data) : null;
}

function setUsuario(usuario) {
  localStorage.setItem('vitae_usuario', JSON.stringify(usuario));
}

function logout() {
  localStorage.removeItem('vitae_token');
  localStorage.removeItem('vitae_refresh_token');
  localStorage.removeItem('vitae_usuario');
  window.location.href = '00-escolha.html';
}

function isLoggedIn() {
  return !!getToken();
}

// Redireciona para login se nao estiver logado
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = '00-escolha.html';
    return false;
  }
  return true;
}

// ---- HTTP helpers ----

async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Remove Content-Type for FormData
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
  });

  // Se token expirou, tenta refresh
  if (response.status === 401 && getRefreshToken()) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      // Retry com novo token
      headers['Authorization'] = `Bearer ${getToken()}`;
      const retryResponse = await fetch(`${API_URL}${path}`, {
        ...options,
        headers,
        body: options.body instanceof FormData ? options.body : (options.body ? JSON.stringify(options.body) : undefined),
      });
      return handleResponse(retryResponse);
    } else {
      logout();
      throw new Error('Sessao expirada');
    }
  }

  return handleResponse(response);
}

async function handleResponse(response) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const erro = data.erro || data.message || `Erro ${response.status}`;
    throw new Error(erro);
  }

  return data;
}

async function refreshTokens() {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: getRefreshToken() }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    setTokens(data.token, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ---- API Methods ----

const vitaeAPI = {
  // Auth
  async cadastro(nome, email, celular, senha, tipo) {
    const data = await apiRequest('/auth/cadastro', {
      method: 'POST',
      body: { nome, email, celular, senha, tipo },
    });
    return data;
  },

  async verificarSms(celular, codigo) {
    const data = await apiRequest('/auth/verificar-sms', {
      method: 'POST',
      body: { celular, codigo },
    });
    if (data.token) {
      setTokens(data.token, data.refreshToken);
      setUsuario(data.usuario);
    }
    return data;
  },

  async login(email, senha) {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, senha },
    });
    if (data.token) {
      setTokens(data.token, data.refreshToken);
      setUsuario(data.usuario);
    }
    return data;
  },

  // Perfil
  async getPerfil() {
    return apiRequest('/perfil');
  },

  async atualizarPerfil(dados) {
    return apiRequest('/perfil', { method: 'PUT', body: dados });
  },

  async uploadFoto(fotoUrl) {
    return apiRequest('/perfil/foto', { method: 'POST', body: { fotoUrl } });
  },

  // Exames
  async listarExames() {
    return apiRequest('/exames');
  },

  async getExame(id) {
    return apiRequest(`/exames/${id}`);
  },

  async uploadExame(file, dataExame) {
    const formData = new FormData();
    formData.append('arquivo', file);
    if (dataExame) formData.append('dataExame', dataExame);
    return apiRequest('/exames/upload', { method: 'POST', body: formData });
  },

  async deletarExame(id) {
    return apiRequest(`/exames/${id}`, { method: 'DELETE' });
  },

  // Medicamentos
  async listarMedicamentos() {
    return apiRequest('/medicamentos');
  },

  async adicionarMedicamento(dados) {
    return apiRequest('/medicamentos', { method: 'POST', body: dados });
  },

  async removerMedicamento(id) {
    return apiRequest(`/medicamentos/${id}`, { method: 'DELETE' });
  },

  async infoMedicamento(nome) {
    return apiRequest(`/medicamentos/info/${encodeURIComponent(nome)}`);
  },

  // Alergias
  async listarAlergias() {
    return apiRequest('/alergias');
  },

  async adicionarAlergia(dados) {
    return apiRequest('/alergias', { method: 'POST', body: dados });
  },

  async removerAlergia(id) {
    return apiRequest(`/alergias/${id}`, { method: 'DELETE' });
  },

  async infoAlergia(nome) {
    return apiRequest(`/alergias/info/${encodeURIComponent(nome)}`);
  },

  // Scores
  async getScoreAtual() {
    return apiRequest('/scores/atual');
  },

  async getHistoricoScores() {
    return apiRequest('/scores/historico');
  },

  async getMelhorias() {
    return apiRequest('/scores/melhorias');
  },

  async recalcularScores() {
    return apiRequest('/scores/recalcular', { method: 'POST' });
  },

  // Check-in
  async fazerCheckin(dados) {
    return apiRequest('/checkin', { method: 'POST', body: dados });
  },

  async getHistoricoCheckins() {
    return apiRequest('/checkin/historico');
  },

  // PDF
  async getDadosPdf() {
    return apiRequest('/pdf/gerar', { method: 'POST' });
  },

  // Notificacoes
  async getNotificacoes() {
    return apiRequest('/notificacoes');
  },

  // Medico
  async cadastroMedico(dados) {
    return apiRequest('/medico', { method: 'POST', body: dados });
  },

  async getPerfilMedico() {
    return apiRequest('/medico');
  },

  async atualizarMedico(dados) {
    return apiRequest('/medico', { method: 'PUT', body: dados });
  },

  async getPacientesMedico() {
    return apiRequest('/medico/pacientes');
  },

  async getDashboardMedico() {
    return apiRequest('/medico/dashboard');
  },

  // Pre-consulta
  async criarPreConsulta(dados) {
    return apiRequest('/pre-consulta', { method: 'POST', body: dados });
  },

  async listarPreConsultas() {
    return apiRequest('/pre-consulta');
  },

  async getPreConsulta(id) {
    return apiRequest(`/pre-consulta/${id}`);
  },

  async getPreConsultaPorToken(token) {
    return apiRequest(`/pre-consulta/t/${token}`);
  },

  async responderPreConsulta(token, dados) {
    return apiRequest(`/pre-consulta/t/${token}/responder`, {
      method: 'POST',
      body: dados,
    });
  },

  // Agendamento
  async criarAgendamento(dados) {
    return apiRequest('/agendamento', { method: 'POST', body: dados });
  },

  async listarAgendamentos() {
    return apiRequest('/agendamento');
  },

  async getProximoAgendamento() {
    return apiRequest('/agendamento/proximo');
  },

  async atualizarAgendamento(id, dados) {
    return apiRequest(`/agendamento/${id}`, { method: 'PUT', body: dados });
  },

  async deletarAgendamento(id) {
    return apiRequest(`/agendamento/${id}`, { method: 'DELETE' });
  },

  // Autorizacao
  async autorizarMedico(dados) {
    return apiRequest('/autorizacao', { method: 'POST', body: dados });
  },

  async listarAutorizacoes() {
    return apiRequest('/autorizacao');
  },

  async revogarAutorizacao(id) {
    return apiRequest(`/autorizacao/${id}`, { method: 'DELETE' });
  },

  async getQrData() {
    return apiRequest('/autorizacao/qr-data');
  },

  // Consentimento
  async registrarConsentimento(dados) {
    return apiRequest('/consentimento', { method: 'POST', body: dados });
  },

  async listarConsentimentos() {
    return apiRequest('/consentimento');
  },

  async revogarConsentimento(id) {
    return apiRequest(`/consentimento/${id}`, { method: 'DELETE' });
  },

  async getStatusConsentimentos() {
    return apiRequest('/consentimento/status');
  },

  // Timeline
  async getTimeline() {
    return apiRequest('/timeline');
  },

  // Helpers
  getToken,
  getUsuario,
  setUsuario,
  isLoggedIn,
  requireAuth,
  logout,
};

// Expoe globalmente
window.vitaeAPI = vitaeAPI;
