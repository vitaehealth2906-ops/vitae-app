'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { usePerfilStore } from '@/stores/perfil';

const HISTORICO_OPCOES = [
  'Diabetes',
  'Hipertensao',
  'Cancer',
  'Doenca cardiaca',
  'Depressao',
  'Nenhum',
];

const ATIVIDADE_OPCOES = [
  { valor: 'SEDENTARIO', label: 'Sedentario' },
  { valor: 'LEVE', label: 'Leve' },
  { valor: 'MODERADO', label: 'Moderado' },
  { valor: 'INTENSO', label: 'Intenso' },
];

const GENERO_OPCOES = [
  { valor: 'MASCULINO', label: 'Masculino' },
  { valor: 'FEMININO', label: 'Feminino' },
  { valor: 'OUTRO', label: 'Outro' },
];

const TOTAL_STEPS = 4;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

export default function QuizPage() {
  const router = useRouter();
  const { atualizar, carregando } = usePerfilStore();

  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [erro, setErro] = useState<string | null>(null);

  // Step 1
  const [genero, setGenero] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');

  // Step 2
  const [altura, setAltura] = useState('');
  const [peso, setPeso] = useState('');

  // Step 3
  const [historicoFamiliar, setHistoricoFamiliar] = useState<string[]>([]);

  // Step 4
  const [nivelAtividade, setNivelAtividade] = useState('');
  const [horasSono, setHorasSono] = useState(7);

  const toggleHistorico = (opcao: string) => {
    setHistoricoFamiliar((prev) => {
      if (opcao === 'Nenhum') return ['Nenhum'];
      const filtered = prev.filter((h) => h !== 'Nenhum');
      if (filtered.includes(opcao)) {
        return filtered.filter((h) => h !== opcao);
      }
      return [...filtered, opcao];
    });
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return genero !== '' && dataNascimento !== '';
      case 1:
        return altura !== '' && peso !== '' && Number(altura) > 0 && Number(peso) > 0;
      case 2:
        return historicoFamiliar.length > 0;
      case 3:
        return nivelAtividade !== '';
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (!canAdvance()) return;
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const handleBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
  };

  const handleSave = async () => {
    if (!canAdvance()) return;
    setErro(null);

    try {
      await atualizar({
        genero,
        dataNascimento,
        alturaCm: Number(altura),
        pesoKg: Number(peso),
        historicoFamiliar: historicoFamiliar.includes('Nenhum') ? [] : historicoFamiliar,
        nivelAtividade,
        horasSono,
      });
      router.push('/perfil');
    } catch {
      setErro('Erro ao salvar dados. Tente novamente.');
    }
  };

  const progress = ((step + 1) / TOTAL_STEPS) * 100;

  return (
    <div className="flex min-h-screen flex-col items-center bg-vitae-bg px-4 py-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-2 text-center">
          <h1 className="font-serif text-2xl font-bold text-white">Sobre voce</h1>
          <p className="mt-1 text-sm text-vitae-text-secondary">
            Passo {step + 1} de {TOTAL_STEPS}
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-8 h-1.5 w-full overflow-hidden rounded-full bg-vitae-card">
          <motion.div
            className="h-full rounded-full bg-vitae-gold"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          />
        </div>

        {/* Step content */}
        <div className="relative min-h-[380px] overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="w-full"
            >
              {/* Step 1: Genero + Data de nascimento */}
              {step === 0 && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-vitae-text-secondary">
                      Genero
                    </label>
                    <div className="grid grid-cols-3 gap-3">
                      {GENERO_OPCOES.map((op) => (
                        <button
                          key={op.valor}
                          type="button"
                          onClick={() => setGenero(op.valor)}
                          className={`rounded-btn border px-4 py-3 text-sm font-medium transition-all ${
                            genero === op.valor
                              ? 'border-vitae-gold bg-vitae-gold/15 text-vitae-gold'
                              : 'border-vitae-border bg-vitae-card text-white hover:border-vitae-text-muted'
                          }`}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="dataNascimento"
                      className="mb-2 block text-sm font-medium text-vitae-text-secondary"
                    >
                      Data de nascimento
                    </label>
                    <input
                      id="dataNascimento"
                      type="date"
                      value={dataNascimento}
                      onChange={(e) => setDataNascimento(e.target.value)}
                      className="w-full rounded-btn border border-vitae-border bg-vitae-card px-4 py-3 text-white focus:border-vitae-gold focus:outline-none focus:ring-1 focus:ring-vitae-gold"
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Altura + Peso */}
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <label
                      htmlFor="altura"
                      className="mb-2 block text-sm font-medium text-vitae-text-secondary"
                    >
                      Altura (cm)
                    </label>
                    <input
                      id="altura"
                      type="number"
                      inputMode="numeric"
                      placeholder="Ex: 175"
                      value={altura}
                      onChange={(e) => setAltura(e.target.value)}
                      min={100}
                      max={250}
                      className="w-full rounded-btn border border-vitae-border bg-vitae-card px-4 py-3 text-white placeholder:text-vitae-text-muted focus:border-vitae-gold focus:outline-none focus:ring-1 focus:ring-vitae-gold"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="peso"
                      className="mb-2 block text-sm font-medium text-vitae-text-secondary"
                    >
                      Peso (kg)
                    </label>
                    <input
                      id="peso"
                      type="number"
                      inputMode="decimal"
                      placeholder="Ex: 72"
                      value={peso}
                      onChange={(e) => setPeso(e.target.value)}
                      min={30}
                      max={300}
                      className="w-full rounded-btn border border-vitae-border bg-vitae-card px-4 py-3 text-white placeholder:text-vitae-text-muted focus:border-vitae-gold focus:outline-none focus:ring-1 focus:ring-vitae-gold"
                    />
                  </div>

                  {altura && peso && Number(altura) > 0 && Number(peso) > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-card bg-vitae-card-light p-4 text-center"
                    >
                      <p className="text-sm text-vitae-text-secondary">Seu IMC</p>
                      <p className="text-2xl font-bold text-vitae-gold">
                        {(Number(peso) / (Number(altura) / 100) ** 2).toFixed(1)}
                      </p>
                    </motion.div>
                  )}
                </div>
              )}

              {/* Step 3: Historico familiar */}
              {step === 2 && (
                <div>
                  <label className="mb-3 block text-sm font-medium text-vitae-text-secondary">
                    Historico familiar
                  </label>
                  <p className="mb-4 text-xs text-vitae-text-muted">
                    Selecione condicoes presentes na sua familia
                  </p>
                  <div className="space-y-3">
                    {HISTORICO_OPCOES.map((opcao) => {
                      const checked = historicoFamiliar.includes(opcao);
                      return (
                        <button
                          key={opcao}
                          type="button"
                          onClick={() => toggleHistorico(opcao)}
                          className={`flex w-full items-center gap-3 rounded-btn border px-4 py-3.5 text-left text-sm transition-all ${
                            checked
                              ? 'border-vitae-gold bg-vitae-gold/15 text-white'
                              : 'border-vitae-border bg-vitae-card text-vitae-text-secondary hover:border-vitae-text-muted'
                          }`}
                        >
                          <div
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all ${
                              checked
                                ? 'border-vitae-gold bg-vitae-gold'
                                : 'border-vitae-text-muted bg-transparent'
                            }`}
                          >
                            {checked && (
                              <svg
                                className="h-3 w-3 text-black"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </div>
                          {opcao}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 4: Atividade + Sono */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <label className="mb-3 block text-sm font-medium text-vitae-text-secondary">
                      Nivel de atividade fisica
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {ATIVIDADE_OPCOES.map((op) => (
                        <button
                          key={op.valor}
                          type="button"
                          onClick={() => setNivelAtividade(op.valor)}
                          className={`rounded-btn border px-4 py-3 text-sm font-medium transition-all ${
                            nivelAtividade === op.valor
                              ? 'border-vitae-gold bg-vitae-gold/15 text-vitae-gold'
                              : 'border-vitae-border bg-vitae-card text-white hover:border-vitae-text-muted'
                          }`}
                        >
                          {op.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="horasSono"
                      className="mb-2 block text-sm font-medium text-vitae-text-secondary"
                    >
                      Horas de sono por noite
                    </label>
                    <div className="rounded-card bg-vitae-card p-4">
                      <div className="mb-3 text-center">
                        <span className="text-3xl font-bold text-vitae-blue">{horasSono}h</span>
                      </div>
                      <input
                        id="horasSono"
                        type="range"
                        min={4}
                        max={12}
                        step={0.5}
                        value={horasSono}
                        onChange={(e) => setHorasSono(Number(e.target.value))}
                        className="w-full accent-vitae-blue"
                      />
                      <div className="mt-1 flex justify-between text-xs text-vitae-text-muted">
                        <span>4h</span>
                        <span>8h</span>
                        <span>12h</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {erro && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-4 text-center text-sm text-vitae-red"
          >
            {erro}
          </motion.p>
        )}

        {/* Buttons */}
        <div className="mt-6 flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-3 text-sm font-medium text-vitae-text-secondary transition-colors hover:text-white"
            >
              Voltar
            </button>
          )}

          <button
            type="button"
            onClick={step === TOTAL_STEPS - 1 ? handleSave : handleNext}
            disabled={!canAdvance() || carregando}
            className="ml-auto flex-1 rounded-btn bg-vitae-gold px-6 py-3.5 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {carregando ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Salvando...
              </span>
            ) : step === TOTAL_STEPS - 1 ? (
              'Salvar'
            ) : (
              'Proximo'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
