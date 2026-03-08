import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: adiciona token em toda requisição
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('vitae_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Interceptor: refresh automático se token expirou
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('vitae_refresh_token');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });

        localStorage.setItem('vitae_token', data.token);
        localStorage.setItem('vitae_refresh_token', data.refreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${data.token}`;
        }
        return api(originalRequest);
      } catch {
        // Refresh falhou — logout
        localStorage.removeItem('vitae_token');
        localStorage.removeItem('vitae_refresh_token');
        localStorage.removeItem('vitae_user');
        if (typeof window !== 'undefined') {
          window.location.href = '/cadastro';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

// ============ AUTH ============
export const authApi = {
  cadastro: (dados: { nome: string; email: string; celular: string; senha: string }) =>
    api.post('/auth/cadastro', dados),

  verificarSms: (dados: { celular: string; codigo: string }) =>
    api.post('/auth/verificar-sms', dados),

  login: (dados: { email: string; senha: string }) =>
    api.post('/auth/login', dados),

  loginSocial: (dados: { provider: string; providerToken: string }) =>
    api.post('/auth/login-social', dados),

  esqueciSenha: (dados: { email: string }) =>
    api.post('/auth/esqueci-senha', dados),

  resetarSenha: (dados: { celular: string; codigo: string; novaSenha: string }) =>
    api.post('/auth/resetar-senha', dados),

  deletarConta: () =>
    api.delete('/auth/conta'),
};

// ============ PERFIL ============
export const perfilApi = {
  get: () => api.get('/perfil'),

  atualizar: (dados: Record<string, unknown>) =>
    api.put('/perfil', dados),

  uploadFoto: (file: File) => {
    const formData = new FormData();
    formData.append('foto', file);
    return api.post('/perfil/foto', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

// ============ EXAMES ============
export const examesApi = {
  upload: (file: File) => {
    const formData = new FormData();
    formData.append('arquivo', file);
    return api.post('/exames/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },

  listar: () => api.get('/exames'),

  detalhe: (id: string) => api.get(`/exames/${id}`),

  deletar: (id: string) => api.delete(`/exames/${id}`),

  arquivo: (id: string) => api.get(`/exames/${id}/arquivo`),
};

// ============ MEDICAMENTOS ============
export const medicamentosApi = {
  listar: () => api.get('/medicamentos'),

  adicionar: (dados: { nome: string; dosagem?: string; frequencia?: string; horario?: string; motivo?: string }) =>
    api.post('/medicamentos', dados),

  atualizar: (id: string, dados: Record<string, unknown>) =>
    api.put(`/medicamentos/${id}`, dados),

  deletar: (id: string) => api.delete(`/medicamentos/${id}`),
};

// ============ ALERGIAS ============
export const alergiasApi = {
  listar: () => api.get('/alergias'),

  adicionar: (dados: { nome: string; tipo?: string; gravidade?: string }) =>
    api.post('/alergias', dados),

  deletar: (id: string) => api.delete(`/alergias/${id}`),
};

// ============ SCORES ============
export const scoresApi = {
  atual: () => api.get('/scores/atual'),

  historico: () => api.get('/scores/historico'),

  melhorias: () => api.get('/scores/melhorias'),

  recalcular: () => api.post('/scores/recalcular'),
};

// ============ CHECKIN ============
export const checkinApi = {
  enviar: (dados: {
    sonoQualidade: number;
    atividadeFisica: string;
    humor: number;
    dor?: string;
    produtividade: number;
    notas?: string;
  }) => api.post('/checkin', dados),

  historico: () => api.get('/checkin/historico'),
};

// ============ NOTIFICAÇÕES ============
export const notificacoesApi = {
  listar: () => api.get('/notificacoes'),

  marcarLida: (id: string) => api.put(`/notificacoes/${id}/ler`),
};

// ============ PDF ============
export const pdfApi = {
  gerar: () => api.post('/pdf/gerar'),
};

export default api;
