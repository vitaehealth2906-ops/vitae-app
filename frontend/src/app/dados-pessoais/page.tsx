'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { usePerfilStore } from '@/stores/perfil';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/lib/api';
import { isLoggedIn } from '@/lib/auth';

const HISTORICO_OPCOES = [
  'Diabetes',
  'Hipertensao',
  'Cancer',
  'Doenca cardiaca',
  'Depressao',
];

const GENERO_OPCOES = [
  { valor: 'MASCULINO', label: 'Masculino' },
  { valor: 'FEMININO', label: 'Feminino' },
  { valor: 'OUTRO', label: 'Outro' },
];

const ATIVIDADE_OPCOES = [
  { valor: 'SEDENTARIO', label: 'Sedentario' },
  { valor: 'LEVE', label: 'Leve' },
  { valor: 'MODERADO', label: 'Moderado' },
  { valor: 'INTENSO', label: 'Intenso' },
];

const ALCOOL_OPCOES = [
  { valor: 'NAO', label: 'Nao bebo' },
  { valor: 'SOCIALMENTE', label: 'Socialmente' },
  { valor: 'REGULARMENTE', label: 'Regularmente' },
  { valor: 'DIARIAMENTE', label: 'Diariamente' },
];

const TIPO_SANGUINEO_OPCOES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/* ---------- Skeleton ---------- */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-vitae-card ${className}`} />;
}

/* ---------- Toast ---------- */

function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`fixed left-4 right-4 top-4 z-50 mx-auto max-w-md rounded-btn px-4 py-3 text-center text-sm font-medium shadow-lg ${
        type === 'success'
          ? 'bg-vitae-green/90 text-black'
          : 'bg-vitae-red/90 text-white'
      }`}
    >
      {message}
    </motion.div>
  );
}

/* ---------- Bottom tab bar ---------- */

function BottomTabBar({ active }: { active: 'home' | 'exames' | 'perfil' }) {
  const tabs = [
    {
      key: 'home' as const,
      label: 'Home',
      href: '/perfil',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      key: 'exames' as const,
      label: 'Exames',
      href: '/exames',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      key: 'perfil' as const,
      label: 'Perfil',
      href: '/dados-pessoais',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-vitae-border bg-vitae-bg/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-md items-center justify-around py-2">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors ${
              active === tab.key ? 'text-vitae-gold' : 'text-vitae-text-muted hover:text-vitae-text-secondary'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}

/* ---------- Section wrapper ---------- */

function Section({
  title,
  children,
  delay = 0,
}: {
  title: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="mb-6"
    >
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-vitae-text-secondary">
        {title}
      </h2>
      <div className="rounded-card bg-vitae-card p-4">{children}</div>
    </motion.section>
  );
}

/* ---------- Main page ---------- */

export default function DadosPessoaisPage() {
  const router = useRouter();
  const { usuario, inicializar, logout } = useAuthStore();
  const { perfil, carregando, carregar, atualizar } = usePerfilStore();

  const [initialized, setInitialized] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Form state
  const [genero, setGenero] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [alturaCm, setAlturaCm] = useState('');
  const [pesoKg, setPesoKg] = useState('');
  const [tipoSanguineo, setTipoSanguineo] = useState('');
  const [nivelAtividade, setNivelAtividade] = useState('');
  const [horasSono, setHorasSono] = useState(7);
  const [fuma, setFuma] = useState(false);
  const [alcool, setAlcool] = useState('');
  const [historicoFamiliar, setHistoricoFamiliar] = useState<string[]>([]);

  // Danger zone
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0); // 0 = idle, 1 = first confirm, 2 = final confirm
  const [deletando, setDeletando] = useState(false);

  useEffect(() => {
    inicializar();
    if (!isLoggedIn()) {
      router.replace('/cadastro');
      return;
    }
    setInitialized(true);
    carregar();
  }, [inicializar, router, carregar]);

  // Sync form with loaded profile
  useEffect(() => {
    if (perfil) {
      setGenero(perfil.genero || '');
      setDataNascimento(perfil.dataNascimento || '');
      setAlturaCm(perfil.alturaCm ? String(perfil.alturaCm) : '');
      setPesoKg(perfil.pesoKg ? String(perfil.pesoKg) : '');
      setTipoSanguineo(perfil.tipoSanguineo || '');
      setNivelAtividade(perfil.nivelAtividade || '');
      setHorasSono(perfil.horasSono || 7);
      setFuma(perfil.fuma || false);
      setAlcool(perfil.alcool || '');
      setHistoricoFamiliar(perfil.historicoFamiliar || []);
    }
  }, [perfil]);

  const toggleHistorico = (opcao: string) => {
    setHistoricoFamiliar((prev) => {
      if (prev.includes(opcao)) {
        return prev.filter((h) => h !== opcao);
      }
      return [...prev, opcao];
    });
  };

  const handleSave = async () => {
    setSalvando(true);
    try {
      await atualizar({
        genero: genero || undefined,
        dataNascimento: dataNascimento || undefined,
        alturaCm: alturaCm ? Number(alturaCm) : undefined,
        pesoKg: pesoKg ? Number(pesoKg) : undefined,
        tipoSanguineo: tipoSanguineo || undefined,
        nivelAtividade: nivelAtividade || undefined,
        horasSono,
        fuma,
        alcool: alcool || undefined,
        historicoFamiliar,
      });
      setToast({ message: 'Dados salvos com sucesso!', type: 'success' });
    } catch {
      setToast({ message: 'Erro ao salvar dados. Tente novamente.', type: 'error' });
    } finally {
      setSalvando(false);
    }
  };

  const handleLogout = () => {
    if (!confirmLogout) {
      setConfirmLogout(true);
      return;
    }
    logout();
  };

  const handleDeleteAccount = async () => {
    if (deleteStep < 2) {
      setDeleteStep(deleteStep + 1);
      return;
    }
    setDeletando(true);
    try {
      await authApi.deletarConta();
      logout();
    } catch {
      setToast({ message: 'Erro ao deletar conta. Tente novamente.', type: 'error' });
      setDeletando(false);
      setDeleteStep(0);
    }
  };

  if (!initialized) return null;

  return (
    <div className="min-h-screen bg-vitae-bg pb-24">
      <AnimatePresence>
        {toast && (
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-vitae-card text-vitae-text-secondary transition-colors hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white">Dados pessoais</h1>
        </div>

        {carregando && !perfil ? (
          <div className="space-y-4">
            <Skeleton className="h-40" />
            <Skeleton className="h-32" />
            <Skeleton className="h-48" />
            <Skeleton className="h-32" />
          </div>
        ) : (
          <>
            {/* Informacoes basicas */}
            <Section title="Informacoes basicas" delay={0.05}>
              <div className="space-y-4">
                {/* Nome (read-only from auth) */}
                <div>
                  <label className="mb-1 block text-xs text-vitae-text-muted">Nome</label>
                  <div className="rounded-btn bg-vitae-bg px-4 py-3 text-sm text-vitae-text-secondary">
                    {usuario?.nome || '--'}
                  </div>
                </div>

                {/* Email (read-only) */}
                <div>
                  <label className="mb-1 block text-xs text-vitae-text-muted">Email</label>
                  <div className="flex items-center gap-2 rounded-btn bg-vitae-bg px-4 py-3 text-sm text-vitae-text-secondary">
                    <svg className="h-4 w-4 shrink-0 text-vitae-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    {usuario?.email || '--'}
                  </div>
                </div>

                {/* Celular (read-only) */}
                <div>
                  <label className="mb-1 block text-xs text-vitae-text-muted">Celular</label>
                  <div className="flex items-center gap-2 rounded-btn bg-vitae-bg px-4 py-3 text-sm text-vitae-text-secondary">
                    <svg className="h-4 w-4 shrink-0 text-vitae-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                    {usuario?.celular || '--'}
                  </div>
                </div>

                {/* Genero */}
                <div>
                  <label className="mb-1 block text-xs text-vitae-text-muted">Genero</label>
                  <div className="grid grid-cols-3 gap-2">
                    {GENERO_OPCOES.map((op) => (
                      <button
                        key={op.valor}
                        type="button"
                        onClick={() => setGenero(op.valor)}
                        className={`rounded-btn border px-3 py-2.5 text-xs font-medium transition-all ${
                          genero === op.valor
                            ? 'border-vitae-gold bg-vitae-gold/15 text-vitae-gold'
                            : 'border-vitae-border bg-vitae-bg text-vitae-text-secondary hover:border-vitae-text-muted'
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Data nascimento */}
                <div>
                  <label htmlFor="dn" className="mb-1 block text-xs text-vitae-text-muted">
                    Data de nascimento
                  </label>
                  <input
                    id="dn"
                    type="date"
                    value={dataNascimento}
                    onChange={(e) => setDataNascimento(e.target.value)}
                    className="w-full rounded-btn border border-vitae-border bg-vitae-bg px-4 py-3 text-sm text-white focus:border-vitae-gold focus:outline-none focus:ring-1 focus:ring-vitae-gold"
                  />
                </div>
              </div>
            </Section>

            {/* Corpo */}
            <Section title="Corpo" delay={0.1}>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="alt" className="mb-1 block text-xs text-vitae-text-muted">
                      Altura (cm)
                    </label>
                    <input
                      id="alt"
                      type="number"
                      inputMode="numeric"
                      value={alturaCm}
                      onChange={(e) => setAlturaCm(e.target.value)}
                      placeholder="175"
                      className="w-full rounded-btn border border-vitae-border bg-vitae-bg px-4 py-3 text-sm text-white placeholder:text-vitae-text-muted focus:border-vitae-gold focus:outline-none focus:ring-1 focus:ring-vitae-gold"
                    />
                  </div>
                  <div>
                    <label htmlFor="peso" className="mb-1 block text-xs text-vitae-text-muted">
                      Peso (kg)
                    </label>
                    <input
                      id="peso"
                      type="number"
                      inputMode="decimal"
                      value={pesoKg}
                      onChange={(e) => setPesoKg(e.target.value)}
                      placeholder="72"
                      className="w-full rounded-btn border border-vitae-border bg-vitae-bg px-4 py-3 text-sm text-white placeholder:text-vitae-text-muted focus:border-vitae-gold focus:outline-none focus:ring-1 focus:ring-vitae-gold"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-vitae-text-muted">
                    Tipo sanguineo
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {TIPO_SANGUINEO_OPCOES.map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setTipoSanguineo(tipo)}
                        className={`rounded-btn border px-2 py-2 text-xs font-medium transition-all ${
                          tipoSanguineo === tipo
                            ? 'border-vitae-red bg-vitae-red/15 text-vitae-red'
                            : 'border-vitae-border bg-vitae-bg text-vitae-text-secondary hover:border-vitae-text-muted'
                        }`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Habitos */}
            <Section title="Habitos" delay={0.15}>
              <div className="space-y-4">
                {/* Nivel atividade */}
                <div>
                  <label className="mb-1 block text-xs text-vitae-text-muted">
                    Nivel de atividade
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {ATIVIDADE_OPCOES.map((op) => (
                      <button
                        key={op.valor}
                        type="button"
                        onClick={() => setNivelAtividade(op.valor)}
                        className={`rounded-btn border px-3 py-2.5 text-xs font-medium transition-all ${
                          nivelAtividade === op.valor
                            ? 'border-vitae-green bg-vitae-green/15 text-vitae-green'
                            : 'border-vitae-border bg-vitae-bg text-vitae-text-secondary hover:border-vitae-text-muted'
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Horas sono */}
                <div>
                  <label className="mb-1 block text-xs text-vitae-text-muted">
                    Horas de sono
                  </label>
                  <div className="rounded-btn bg-vitae-bg p-3">
                    <div className="mb-2 text-center">
                      <span className="text-2xl font-bold text-vitae-blue">{horasSono}h</span>
                    </div>
                    <input
                      type="range"
                      min={4}
                      max={12}
                      step={0.5}
                      value={horasSono}
                      onChange={(e) => setHorasSono(Number(e.target.value))}
                      className="w-full accent-vitae-blue"
                    />
                    <div className="mt-1 flex justify-between text-[10px] text-vitae-text-muted">
                      <span>4h</span>
                      <span>8h</span>
                      <span>12h</span>
                    </div>
                  </div>
                </div>

                {/* Fuma */}
                <div className="flex items-center justify-between">
                  <label className="text-xs text-vitae-text-muted">Fumante</label>
                  <button
                    type="button"
                    onClick={() => setFuma(!fuma)}
                    className={`relative h-7 w-12 rounded-full transition-colors ${
                      fuma ? 'bg-vitae-red' : 'bg-vitae-border'
                    }`}
                  >
                    <motion.div
                      animate={{ x: fuma ? 20 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-1 h-5 w-5 rounded-full bg-white shadow"
                    />
                  </button>
                </div>

                {/* Alcool */}
                <div>
                  <label className="mb-1 block text-xs text-vitae-text-muted">Consumo de alcool</label>
                  <div className="grid grid-cols-2 gap-2">
                    {ALCOOL_OPCOES.map((op) => (
                      <button
                        key={op.valor}
                        type="button"
                        onClick={() => setAlcool(op.valor)}
                        className={`rounded-btn border px-3 py-2.5 text-xs font-medium transition-all ${
                          alcool === op.valor
                            ? 'border-vitae-purple bg-vitae-purple/15 text-vitae-purple'
                            : 'border-vitae-border bg-vitae-bg text-vitae-text-secondary hover:border-vitae-text-muted'
                        }`}
                      >
                        {op.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Section>

            {/* Historico familiar */}
            <Section title="Historico familiar" delay={0.2}>
              <div className="space-y-2">
                {HISTORICO_OPCOES.map((opcao) => {
                  const checked = historicoFamiliar.includes(opcao);
                  return (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => toggleHistorico(opcao)}
                      className={`flex w-full items-center gap-3 rounded-btn border px-3 py-2.5 text-left text-xs transition-all ${
                        checked
                          ? 'border-vitae-gold bg-vitae-gold/10 text-white'
                          : 'border-vitae-border bg-vitae-bg text-vitae-text-secondary hover:border-vitae-text-muted'
                      }`}
                    >
                      <div
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-all ${
                          checked
                            ? 'border-vitae-gold bg-vitae-gold'
                            : 'border-vitae-text-muted bg-transparent'
                        }`}
                      >
                        {checked && (
                          <svg
                            className="h-2.5 w-2.5 text-black"
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
            </Section>

            {/* Save button */}
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mb-8"
            >
              <button
                type="button"
                onClick={handleSave}
                disabled={salvando}
                className="w-full rounded-btn bg-vitae-gold py-3.5 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50"
              >
                {salvando ? (
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
                ) : (
                  'Salvar alteracoes'
                )}
              </button>
            </motion.div>

            {/* Danger zone */}
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mb-8"
            >
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-vitae-red/70">
                Zona de perigo
              </h2>
              <div className="space-y-3 rounded-card border border-vitae-red/20 bg-vitae-card p-4">
                {/* Logout */}
                <div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={`w-full rounded-btn border py-3 text-sm font-medium transition-all ${
                      confirmLogout
                        ? 'border-vitae-gold bg-vitae-gold/15 text-vitae-gold'
                        : 'border-vitae-border text-vitae-text-secondary hover:border-vitae-text-muted hover:text-white'
                    }`}
                  >
                    {confirmLogout ? 'Confirmar saida' : 'Sair da conta'}
                  </button>
                  {confirmLogout && (
                    <button
                      type="button"
                      onClick={() => setConfirmLogout(false)}
                      className="mt-1 w-full py-1 text-xs text-vitae-text-muted hover:text-white"
                    >
                      Cancelar
                    </button>
                  )}
                </div>

                {/* Delete account */}
                <div>
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={deletando}
                    className={`w-full rounded-btn border py-3 text-sm font-medium transition-all ${
                      deleteStep > 0
                        ? 'border-vitae-red bg-vitae-red/15 text-vitae-red hover:bg-vitae-red hover:text-white'
                        : 'border-vitae-border text-vitae-text-muted hover:border-vitae-red hover:text-vitae-red'
                    }`}
                  >
                    {deletando
                      ? 'Deletando...'
                      : deleteStep === 2
                        ? 'CONFIRMAR EXCLUSAO PERMANENTE'
                        : deleteStep === 1
                          ? 'Tem certeza? Esta acao e irreversivel'
                          : 'Deletar conta'}
                  </button>
                  {deleteStep > 0 && !deletando && (
                    <button
                      type="button"
                      onClick={() => setDeleteStep(0)}
                      className="mt-1 w-full py-1 text-xs text-vitae-text-muted hover:text-white"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </motion.section>
          </>
        )}
      </div>

      <BottomTabBar active="perfil" />
    </div>
  );
}
