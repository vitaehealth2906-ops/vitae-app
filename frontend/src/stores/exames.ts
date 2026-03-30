import { create } from 'zustand';
import { examesApi } from '@/lib/api';

export interface ExameParametro {
  id: string;
  nome: string;
  valor: string;
  valorNumerico?: number;
  unidade?: string;
  referenciaMin?: number;
  referenciaMax?: number;
  referenciaTexto?: string;
  status: 'NORMAL' | 'ATENCAO' | 'CRITICO';
  percentualFaixa?: number;
  explicacaoSimples?: string;
  impactoPessoal?: string;
  dicas?: string[];
}

export interface Exame {
  id: string;
  nome: string;
  tipo: string;
  dataExame?: string;
  laboratorio?: string;
  statusProcessamento: 'ENVIADO' | 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
  statusGeral?: 'NORMAL' | 'ATENCAO' | 'CRITICO';
  resumoIa?: string;
  impactosIa?: Array<{ icone: string; titulo: string; texto: string }>;
  melhoriasIa?: string[];
  parametros?: ExameParametro[];
  criadoEm: string;
}

interface ExamesState {
  exames: Exame[];
  exameAtual: Exame | null;
  carregando: boolean;
  enviando: boolean;

  listar: () => Promise<void>;
  carregar: (id: string) => Promise<void>;
  upload: (file: File) => Promise<string>;
  deletar: (id: string) => Promise<void>;
}

export const useExamesStore = create<ExamesState>((set, get) => ({
  exames: [],
  exameAtual: null,
  carregando: false,
  enviando: false,

  listar: async () => {
    set({ carregando: true });
    try {
      const { data } = await examesApi.listar();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mapped = (data.exames || []).map((e: any) => ({
        id: e.id,
        nome: e.tipoExame || e.nomeArquivo || 'Exame',
        tipo: e.tipoExame || '',
        dataExame: e.dataExame,
        laboratorio: e.laboratorio,
        statusProcessamento: e.status || e.statusProcessamento,
        statusGeral: e.statusGeral,
        parametros: e.parametros,
        criadoEm: e.criadoEm,
      }));
      set({ exames: mapped as Exame[], carregando: false });
    } catch {
      set({ carregando: false });
    }
  },

  carregar: async (id) => {
    set({ carregando: true });
    try {
      const { data } = await examesApi.detalhe(id);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = data.exame || data;
      const mapped: Exame = {
        id: e.id,
        nome: e.tipoExame || e.nomeArquivo || 'Exame',
        tipo: e.tipoExame || '',
        dataExame: e.dataExame,
        laboratorio: e.laboratorio,
        statusProcessamento: e.status || e.statusProcessamento,
        statusGeral: e.statusGeral,
        resumoIa: e.resumoIA || e.resumoIa,
        impactosIa: e.impactosIA || e.impactosIa,
        melhoriasIa: e.melhoriasIA || e.melhoriasIa,
        parametros: e.parametros,
        criadoEm: e.criadoEm,
      };
      set({ exameAtual: mapped, carregando: false });
    } catch {
      set({ carregando: false });
    }
  },

  upload: async (file) => {
    set({ enviando: true });
    try {
      const { data } = await examesApi.upload(file);
      set({ enviando: false });
      // Refresh list
      get().listar();
      return data.exameId;
    } catch {
      set({ enviando: false });
      throw new Error('Erro ao enviar exame');
    }
  },

  deletar: async (id) => {
    try {
      await examesApi.deletar(id);
      set({ exames: get().exames.filter((e) => e.id !== id) });
    } catch {
      throw new Error('Erro ao deletar exame');
    }
  },
}));
