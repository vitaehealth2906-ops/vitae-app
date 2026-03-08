import { create } from 'zustand';
import { medicamentosApi } from '@/lib/api';

export interface Medicamento {
  id: string;
  nome: string;
  dosagem?: string;
  frequencia?: string;
  horario?: string;
  motivo?: string;
  dataInicio?: string;
  ativo: boolean;
  fonte: string;
}

interface MedicamentosState {
  medicamentos: Medicamento[];
  carregando: boolean;

  listar: () => Promise<void>;
  adicionar: (dados: { nome: string; dosagem?: string; frequencia?: string; horario?: string; motivo?: string }) => Promise<void>;
  atualizar: (id: string, dados: Partial<Medicamento>) => Promise<void>;
  deletar: (id: string) => Promise<void>;
}

export const useMedicamentosStore = create<MedicamentosState>((set, get) => ({
  medicamentos: [],
  carregando: false,

  listar: async () => {
    set({ carregando: true });
    try {
      const { data } = await medicamentosApi.listar();
      set({ medicamentos: data.medicamentos, carregando: false });
    } catch {
      set({ carregando: false });
    }
  },

  adicionar: async (dados) => {
    try {
      const { data } = await medicamentosApi.adicionar(dados);
      set({ medicamentos: [...get().medicamentos, data] });
    } catch {
      throw new Error('Erro ao adicionar medicamento');
    }
  },

  atualizar: async (id, dados) => {
    try {
      const { data } = await medicamentosApi.atualizar(id, dados);
      set({
        medicamentos: get().medicamentos.map((m) => (m.id === id ? data : m)),
      });
    } catch {
      throw new Error('Erro ao atualizar medicamento');
    }
  },

  deletar: async (id) => {
    try {
      await medicamentosApi.deletar(id);
      set({ medicamentos: get().medicamentos.filter((m) => m.id !== id) });
    } catch {
      throw new Error('Erro ao deletar medicamento');
    }
  },
}));
