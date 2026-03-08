import { create } from 'zustand';
import { perfilApi } from '@/lib/api';

interface Perfil {
  genero?: string;
  dataNascimento?: string;
  alturaCm?: number;
  pesoKg?: number;
  tipoSanguineo?: string;
  historicoFamiliar?: string[];
  nivelAtividade?: string;
  horasSono?: number;
  fuma?: boolean;
  alcool?: string;
}

interface PerfilState {
  perfil: Perfil | null;
  carregando: boolean;

  carregar: () => Promise<void>;
  atualizar: (dados: Partial<Perfil>) => Promise<void>;
}

export const usePerfilStore = create<PerfilState>((set) => ({
  perfil: null,
  carregando: false,

  carregar: async () => {
    set({ carregando: true });
    try {
      const { data } = await perfilApi.get();
      set({ perfil: data.perfil, carregando: false });
    } catch {
      set({ carregando: false });
    }
  },

  atualizar: async (dados) => {
    set({ carregando: true });
    try {
      const { data } = await perfilApi.atualizar(dados);
      set({ perfil: data, carregando: false });
    } catch {
      set({ carregando: false });
    }
  },
}));
