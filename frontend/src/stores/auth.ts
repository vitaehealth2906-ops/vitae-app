import { create } from 'zustand';
import { authApi } from '@/lib/api';
import { salvarAuth, getUser, logout as doLogout, type UserData } from '@/lib/auth';

interface AuthState {
  usuario: UserData | null;
  carregando: boolean;
  erro: string | null;

  inicializar: () => void;
  cadastro: (dados: { nome: string; email: string; celular: string; senha: string }) => Promise<string>;
  verificarSms: (celular: string, codigo: string) => Promise<void>;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  limparErro: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  carregando: false,
  erro: null,

  inicializar: () => {
    const user = getUser();
    if (user) set({ usuario: user });
  },

  cadastro: async (dados) => {
    set({ carregando: true, erro: null });
    try {
      const { data } = await authApi.cadastro(dados);
      set({ carregando: false });
      return data.userId;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } })?.response?.data?.erro || 'Erro ao criar conta';
      set({ carregando: false, erro: msg });
      throw new Error(msg);
    }
  },

  verificarSms: async (celular, codigo) => {
    set({ carregando: true, erro: null });
    try {
      const { data } = await authApi.verificarSms({ celular, codigo });
      salvarAuth(data.token, data.refreshToken, data.usuario);
      set({ carregando: false, usuario: data.usuario });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } })?.response?.data?.erro || 'Codigo invalido';
      set({ carregando: false, erro: msg });
      throw new Error(msg);
    }
  },

  login: async (email, senha) => {
    set({ carregando: true, erro: null });
    try {
      const { data } = await authApi.login({ email, senha });
      salvarAuth(data.token, data.refreshToken, data.usuario);
      set({ carregando: false, usuario: data.usuario });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { erro?: string } } })?.response?.data?.erro || 'Email ou senha incorretos';
      set({ carregando: false, erro: msg });
      throw new Error(msg);
    }
  },

  logout: () => {
    set({ usuario: null });
    doLogout();
  },

  limparErro: () => set({ erro: null }),
}));
