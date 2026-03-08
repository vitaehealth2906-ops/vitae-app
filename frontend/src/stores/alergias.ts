import { create } from 'zustand';
import { alergiasApi } from '@/lib/api';

export interface Alergia {
  id: string;
  nome: string;
  tipo: string;
  gravidade: string;
  fonte: string;
}

interface AlergiasState {
  alergias: Alergia[];
  carregando: boolean;

  listar: () => Promise<void>;
  adicionar: (dados: { nome: string; tipo?: string; gravidade?: string }) => Promise<void>;
  deletar: (id: string) => Promise<void>;
}

export const useAlergiasStore = create<AlergiasState>((set, get) => ({
  alergias: [],
  carregando: false,

  listar: async () => {
    set({ carregando: true });
    try {
      const { data } = await alergiasApi.listar();
      set({ alergias: data.alergias, carregando: false });
    } catch {
      set({ carregando: false });
    }
  },

  adicionar: async (dados) => {
    try {
      const { data } = await alergiasApi.adicionar(dados);
      set({ alergias: [...get().alergias, data] });
    } catch {
      throw new Error('Erro ao adicionar alergia');
    }
  },

  deletar: async (id) => {
    try {
      await alergiasApi.deletar(id);
      set({ alergias: get().alergias.filter((a) => a.id !== id) });
    } catch {
      throw new Error('Erro ao deletar alergia');
    }
  },
}));
