import { create } from 'zustand';
import { scoresApi } from '@/lib/api';

export interface Score {
  scoreGeral: number;
  scoreSono?: number;
  scoreAtividade?: number;
  scoreProdutividade?: number;
  scoreExame?: number;
  idadeBiologica?: number;
  idadeCronologica?: number;
  confianca: string;
  criadoEm: string;
}

export interface Melhoria {
  categoria: string;
  icone: string;
  titulo: string;
  texto: string;
  anosGanhos: number;
}

interface ScoresState {
  scoreAtual: Score | null;
  historico: Score[];
  melhorias: Melhoria[];
  carregando: boolean;

  carregarAtual: () => Promise<void>;
  carregarHistorico: () => Promise<void>;
  carregarMelhorias: () => Promise<void>;
  recalcular: () => Promise<void>;
}

export const useScoresStore = create<ScoresState>((set) => ({
  scoreAtual: null,
  historico: [],
  melhorias: [],
  carregando: false,

  carregarAtual: async () => {
    set({ carregando: true });
    try {
      const { data } = await scoresApi.atual();
      set({ scoreAtual: data.score, carregando: false });
    } catch {
      set({ carregando: false });
    }
  },

  carregarHistorico: async () => {
    try {
      const { data } = await scoresApi.historico();
      set({ historico: data.historico });
    } catch {
      // silent
    }
  },

  carregarMelhorias: async () => {
    set({ carregando: true });
    try {
      const { data } = await scoresApi.melhorias();
      set({ melhorias: data.melhorias, carregando: false });
    } catch {
      set({ carregando: false });
    }
  },

  recalcular: async () => {
    try {
      const { data } = await scoresApi.recalcular();
      set({ scoreAtual: data });
    } catch {
      // silent
    }
  },
}));
