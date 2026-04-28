/**
 * VITAE — Modulo API compartilhado
 * Todas as telas HTML usam este arquivo para se comunicar com o backend.
 */

// ---- Security: sanitize HTML to prevent XSS ----

function sanitize(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ---- Security: prevent double-click on buttons ----

function disableBtn(btn) {
  if (!btn) return;
  btn.disabled = true;
  btn.style.opacity = '0.6';
  btn.style.pointerEvents = 'none';
  btn.dataset.originalText = btn.textContent;
  btn.textContent = 'Aguarde...';
}

function enableBtn(btn, text) {
  if (!btn) return;
  btn.disabled = false;
  btn.style.opacity = '1';
  btn.style.pointerEvents = 'auto';
  btn.textContent = text || btn.dataset.originalText || 'OK';
}

// ---- Standard navigation (shared by all pages) ----

function vitaeNav(target) {
  const overlay = document.getElementById('exitOverlay');
  if (overlay) { overlay.classList.add('active'); }
  const routes = {
    'perfil': '08-perfil.html?from=nav',
    'score': '10-score.html',
    'exames': '11-exames-lista.html',
    'qrcode': '21-qrcode.html',
    'editar': '09-dados-pessoais.html',
    'medicamentos': '16-medicamentos.html',
    'alergias': '17-alergias.html',
    'agendamentos': '23-agendamentos.html',
    'autorizacao': '22-autorizacao.html',
    'bioage': '15-bioage-sem-dados.html',
  };
  setTimeout(() => {
    window.location.href = routes[target] || '08-perfil.html';
  }, 400);
}

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
    const detalhes = data.detalhes && data.detalhes.length ? '\n' + data.detalhes.join('\n') : '';
    throw new Error(erro + detalhes);
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

  async loginSocial(provider, providerToken, nome, email) {
    const data = await apiRequest('/auth/login-social', {
      method: 'POST',
      body: { provider, providerToken, nome, email },
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

  async buscarPerfil() {
    return apiRequest('/perfil');
  },

  async atualizarPerfil(dados) {
    return apiRequest('/perfil', { method: 'PUT', body: dados });
  },
  async atualizarConta(dados) {
    return apiRequest('/perfil/conta', { method: 'PATCH', body: dados });
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

  async atualizarMedicamento(id, dados) {
    return apiRequest(`/medicamentos/${id}`, { method: 'PUT', body: dados });
  },

  async infoMedicamento(nome) {
    return apiRequest(`/medicamentos/info/${encodeURIComponent(nome)}`);
  },

  async scanReceita(file) {
    const formData = new FormData();
    formData.append('arquivo', file);
    // AbortController: aborta em 28s (antes do Railway matar em 30s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);
    try {
      return await apiRequest('/medicamentos/scan', { method: 'POST', body: formData, signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Processamento demorou demais. Tente com foto menor.');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
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

  async scanAlergia(file) {
    const formData = new FormData();
    formData.append('arquivo', file);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 28000);
    try {
      return await apiRequest('/alergias/scan', { method: 'POST', body: formData, signal: controller.signal });
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Processamento demorou demais. Tente com foto menor.');
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
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

  async buscarPacientesMedico(query) {
    const q = encodeURIComponent(String(query || '').trim());
    return apiRequest(`/medico/pacientes/buscar?q=${q}`);
  },

  async getPerfilPacienteMedico(pacienteId) {
    return apiRequest(`/medico/pacientes/${pacienteId}`);
  },

  async migrarAutorizacoes() {
    return apiRequest('/medico/migrar-autorizacoes', { method: 'POST' });
  },

  async limpezaPreConsultasAntigas() {
    return apiRequest('/medico/limpeza-antigas', { method: 'POST' });
  },

  async regenerarSummaryPreConsulta(preConsultaId) {
    return apiRequest(`/pre-consulta/${preConsultaId}/regenerar`, { method: 'POST' });
  },

  async diagnosticoPreConsulta() {
    return apiRequest('/medico/diagnostico-pre-consulta');
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

  async responderPreConsultaComAudio(token, { respostas, transcricao, audioBlob, fotoBlob }) {
    const formData = new FormData();
    formData.append('respostas', JSON.stringify(respostas));
    formData.append('transcricao', transcricao || '');
    if (audioBlob) {
      formData.append('audio', audioBlob, 'gravacao.webm');
    }
    if (fotoBlob) {
      formData.append('foto', fotoBlob, 'foto.jpg');
    }
    return apiRequest(`/pre-consulta/t/${token}/responder-audio`, {
      method: 'POST',
      body: formData,
    });
  },

  async deletarPreConsulta(id) {
    return apiRequest(`/pre-consulta/${id}`, { method: 'DELETE' });
  },

  async deletarPaciente(pacienteNome, pacienteTel) {
    return apiRequest('/pre-consulta/by-patient', {
      method: 'DELETE',
      body: { pacienteNome, pacienteTel },
    });
  },

  async verificarTranscricao(token, transcricao) {
    return apiRequest(`/pre-consulta/t/${token}/verificar`, {
      method: 'POST',
      body: { transcricao },
    });
  },

  // Templates
  async listarTemplates() {
    return apiRequest('/templates');
  },
  async criarTemplate(dados) {
    return apiRequest('/templates', { method: 'POST', body: dados });
  },
  async editarTemplate(id, dados) {
    return apiRequest(`/templates/${id}`, { method: 'PUT', body: dados });
  },
  async apagarTemplate(id) {
    return apiRequest(`/templates/${id}`, { method: 'DELETE' });
  },
  async classificarPerguntas(texto) {
    return apiRequest('/templates/classificar', { method: 'POST', body: { texto } });
  },
  async gerarPerguntasIA(instrucao) {
    return apiRequest('/templates/gerar', { method: 'POST', body: { instrucao } });
  },
  async buscarTemplate(id) {
    return apiRequest(`/templates/${id}`);
  },
  async buscarTemplatePublico(id) {
    const r = await fetch(`${API_URL}/templates/preview-publico/${id}`);
    if (!r.ok) throw new Error('Template não encontrado.');
    return r.json();
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

  // ===== Modulo Agenda v1 (sessao 26-abr-2026) =====
  async agendaConfig() { return apiRequest('/agenda/config'); },
  async agendaConfigSalvar(dados) { return apiRequest('/agenda/config', { method: 'PUT', body: dados }); },
  async agendaConfigFinalizarTour() { return apiRequest('/agenda/config', { method: 'PUT', body: { tourCompleto: true } }); },
  async agendaLocais() { return apiRequest('/agenda/locais'); },
  async agendaCriarLocal(dados) { return apiRequest('/agenda/locais', { method: 'POST', body: dados }); },
  async agendaEditarLocal(id, dados) { return apiRequest(`/agenda/locais/${id}`, { method: 'PUT', body: dados }); },
  async agendaRemoverLocal(id) { return apiRequest(`/agenda/locais/${id}`, { method: 'DELETE' }); },
  async agendaSlots(inicio, fim) { return apiRequest(`/agenda/slots?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`); },
  async agendaCriarSlot(dados) { return apiRequest('/agenda/slots', { method: 'POST', body: dados }); },
  async agendaRemarcarSlot(id, dados) { return apiRequest(`/agenda/slots/${id}`, { method: 'PUT', body: dados }); },
  async agendaCancelarSlot(id, motivo) { return apiRequest(`/agenda/slots/${id}${motivo ? '?motivo=' + encodeURIComponent(motivo) : ''}`, { method: 'DELETE' }); },
  async agendaDesfazerCancelamento(id) { return apiRequest(`/agenda/slots/${id}/desfazer`, { method: 'POST' }); },
  async agendaMarcarComparecimento(id) { return apiRequest(`/agenda/slots/${id}/comparecer`, { method: 'POST' }); },
  async agendaMarcarFalta(id) { return apiRequest(`/agenda/slots/${id}/falta`, { method: 'POST' }); },
  async agendaSugerirRetorno(pacienteId, prazoDias = 15) {
    const q = new URLSearchParams();
    if (pacienteId) q.set('pacienteId', pacienteId);
    q.set('prazoDias', prazoDias);
    return apiRequest(`/agenda/sugestoes-retorno?${q}`);
  },
  async agendaFinalizar(preConsultaId, opts) { return apiRequest(`/agenda/finalizar/${preConsultaId}`, { method: 'POST', body: opts }); },
  async agendaDesfazerFinalizacao(preConsultaId) { return apiRequest(`/agenda/finalizar/${preConsultaId}/desfazer`, { method: 'POST' }); },
  async agendaListaEspera() { return apiRequest('/agenda/lista-espera'); },
  async agendaAdicionarEspera(dados) { return apiRequest('/agenda/lista-espera', { method: 'POST', body: dados }); },
  async agendaRemoverEspera(id) { return apiRequest(`/agenda/lista-espera/${id}`, { method: 'DELETE' }); },
  async agendaStats(mes) { return apiRequest(`/agenda/stats?mes=${mes}`); },
  async agendaGoogleAuth() { return apiRequest('/agenda/google/auth'); },
  async agendaGoogleSync() { return apiRequest('/agenda/google/sync', { method: 'POST' }); },
  async agendaGoogleDesconectar() { return apiRequest('/agenda/google/desconectar', { method: 'DELETE' }); },
  async agendaGoogleStatus() { return apiRequest('/agenda/google/status'); },
  async agendaSecretarias() { return apiRequest('/agenda/secretarias'); },
  async agendaConvidarSecretaria(email, permissoes) { return apiRequest('/agenda/secretarias/convidar', { method: 'POST', body: { email, permissoes } }); },
  async agendaAceitarConvite(token) { return apiRequest(`/agenda/secretarias/aceitar/${token}`, { method: 'POST' }); },
  async agendaRevogarSecretaria(id) { return apiRequest(`/agenda/secretarias/${id}`, { method: 'DELETE' }); },
  async agendaProximoMeu() { return apiRequest('/agenda/proximo-meu'); },
  async agendaMeusSlots() { return apiRequest('/agenda/meus-slots'); },
  async agendaPushVapidKey() { return apiRequest('/agenda/push/vapid-public-key'); },
  async agendaPushSubscribe(sub) { return apiRequest('/agenda/push/subscribe', { method: 'POST', body: sub }); },
  async agendaPushUnsubscribe(endpoint) { return apiRequest('/agenda/push/subscribe', { method: 'DELETE', body: { endpoint } }); },

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
// Expoe baseUrl pra modulos externos (pre-consulta-v2.html etc)
window.vitaeAPI.baseUrl = API_URL;
window.vitaeAPI.getToken = function(){ try { return localStorage.getItem('vitae_token') || null; } catch(_){ return null; } };
