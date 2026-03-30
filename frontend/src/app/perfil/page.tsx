'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useAuthStore } from '@/stores/auth';
import { useScoresStore, type Score } from '@/stores/scores';
import { useExamesStore, type Exame } from '@/stores/exames';
import { useMedicamentosStore } from '@/stores/medicamentos';
import { useAlergiasStore } from '@/stores/alergias';
import { usePerfilStore } from '@/stores/perfil';
import { isLoggedIn } from '@/lib/auth';
import CompletionCard from '@/components/ui/CompletionCard';
import ExamAlertCard, { type ExamAlert } from '@/components/ui/ExamAlertCard';

/* ---------- helpers ---------- */

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function statusBadge(status?: 'NORMAL' | 'ATENCAO' | 'CRITICO') {
  switch (status) {
    case 'NORMAL':
      return { label: 'Normal', cls: 'bg-vitae-green/15 text-vitae-green' };
    case 'ATENCAO':
      return { label: 'Atencao', cls: 'bg-vitae-gold/15 text-vitae-gold' };
    case 'CRITICO':
      return { label: 'Critico', cls: 'bg-vitae-red/15 text-vitae-red' };
    default:
      return { label: '', cls: '' };
  }
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ---------- Circular progress ---------- */

function CircularScore({ score, size = 120 }: { score: number; size?: number }) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#222222"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#C5A55A"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-bold text-white">{score}</span>
        <span className="text-xs text-vitae-text-secondary">/ 100</span>
      </div>
    </div>
  );
}

/* ---------- Pillar mini score ---------- */

function PillarScore({
  label,
  value,
  color,
}: {
  label: string;
  value?: number;
  color: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold"
        style={{ backgroundColor: `${color}22`, color }}
      >
        {value ?? '--'}
      </div>
      <span className="text-[10px] text-vitae-text-secondary">{label}</span>
    </div>
  );
}

/* ---------- Skeleton ---------- */

function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-card bg-vitae-card ${className}`} />
  );
}

/* ---------- Modals ---------- */

function MedicamentoModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { adicionar } = useMedicamentosStore();
  const [nome, setNome] = useState('');
  const [dosagem, setDosagem] = useState('');
  const [frequencia, setFrequencia] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const handleSave = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    setErro('');
    try {
      await adicionar({ nome: nome.trim(), dosagem: dosagem.trim() || undefined, frequencia: frequencia.trim() || undefined });
      setNome('');
      setDosagem('');
      setFrequencia('');
      onClose();
    } catch {
      setErro('Erro ao adicionar medicamento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-card bg-vitae-card p-6 sm:rounded-card"
          >
            <h3 className="mb-4 text-lg font-semibold text-white">Adicionar medicamento</h3>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nome do medicamento *"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-btn border border-vitae-border bg-vitae-bg px-4 py-3 text-sm text-white placeholder:text-vitae-text-muted focus:border-vitae-gold focus:outline-none"
              />
              <input
                type="text"
                placeholder="Dosagem (ex: 500mg)"
                value={dosagem}
                onChange={(e) => setDosagem(e.target.value)}
                className="w-full rounded-btn border border-vitae-border bg-vitae-bg px-4 py-3 text-sm text-white placeholder:text-vitae-text-muted focus:border-vitae-gold focus:outline-none"
              />
              <input
                type="text"
                placeholder="Frequencia (ex: 2x ao dia)"
                value={frequencia}
                onChange={(e) => setFrequencia(e.target.value)}
                className="w-full rounded-btn border border-vitae-border bg-vitae-bg px-4 py-3 text-sm text-white placeholder:text-vitae-text-muted focus:border-vitae-gold focus:outline-none"
              />
            </div>

            {erro && <p className="mt-2 text-xs text-vitae-red">{erro}</p>}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-btn border border-vitae-border py-3 text-sm text-vitae-text-secondary transition-colors hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!nome.trim() || salvando}
                className="flex-1 rounded-btn bg-vitae-gold py-3 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function AlergiaModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { adicionar } = useAlergiasStore();
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('');
  const [gravidade, setGravidade] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const handleSave = async () => {
    if (!nome.trim()) return;
    setSalvando(true);
    setErro('');
    try {
      await adicionar({ nome: nome.trim(), tipo: tipo.trim() || undefined, gravidade: gravidade.trim() || undefined });
      setNome('');
      setTipo('');
      setGravidade('');
      onClose();
    } catch {
      setErro('Erro ao adicionar alergia.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-t-card bg-vitae-card p-6 sm:rounded-card"
          >
            <h3 className="mb-4 text-lg font-semibold text-white">Adicionar alergia</h3>

            <div className="space-y-3">
              <input
                type="text"
                placeholder="Nome da alergia *"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className="w-full rounded-btn border border-vitae-border bg-vitae-bg px-4 py-3 text-sm text-white placeholder:text-vitae-text-muted focus:border-vitae-gold focus:outline-none"
              />
              <input
                type="text"
                placeholder="Tipo (ex: Alimento, Medicamento)"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full rounded-btn border border-vitae-border bg-vitae-bg px-4 py-3 text-sm text-white placeholder:text-vitae-text-muted focus:border-vitae-gold focus:outline-none"
              />
              <select
                value={gravidade}
                onChange={(e) => setGravidade(e.target.value)}
                className="w-full rounded-btn border border-vitae-border bg-vitae-bg px-4 py-3 text-sm text-white focus:border-vitae-gold focus:outline-none"
              >
                <option value="">Gravidade</option>
                <option value="LEVE">Leve</option>
                <option value="MODERADA">Moderada</option>
                <option value="GRAVE">Grave</option>
              </select>
            </div>

            {erro && <p className="mt-2 text-xs text-vitae-red">{erro}</p>}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-btn border border-vitae-border py-3 text-sm text-vitae-text-secondary transition-colors hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!nome.trim() || salvando}
                className="flex-1 rounded-btn bg-vitae-gold py-3 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Adicionar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Tab bar ---------- */

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

/* ---------- Main page ---------- */

export default function PerfilPage() {
  const router = useRouter();
  const { usuario, inicializar } = useAuthStore();
  const { scoreAtual, historico, carregando: scoresLoading, carregarAtual, carregarHistorico } = useScoresStore();
  const { exames, carregando: examesLoading, listar: listarExames } = useExamesStore();
  const { medicamentos, carregando: medsLoading, listar: listarMeds, deletar: deletarMed } = useMedicamentosStore();
  const { alergias, carregando: alergiasLoading, listar: listarAlergias, deletar: deletarAlergia } = useAlergiasStore();
  const { perfil, carregar: carregarPerfil } = usePerfilStore();

  const [medModalOpen, setMedModalOpen] = useState(false);
  const [alergiaModalOpen, setAlergiaModalOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const loadAll = useCallback(async () => {
    await Promise.all([
      carregarAtual(),
      carregarHistorico(),
      listarExames(),
      listarMeds(),
      listarAlergias(),
      carregarPerfil(),
    ]);
  }, [carregarAtual, carregarHistorico, listarExames, listarMeds, listarAlergias, carregarPerfil]);

  useEffect(() => {
    inicializar();
    if (!isLoggedIn()) {
      router.replace('/cadastro');
      return;
    }
    setInitialized(true);
    loadAll();
  }, [inicializar, router, loadAll]);

  if (!initialized) return null;

  const loading = scoresLoading || examesLoading || medsLoading || alergiasLoading;
  const last3Exams = exames
    .filter((e) => e.statusProcessamento === 'CONCLUIDO')
    .slice(0, 3);

  /* ---- Completion card data ---- */
  const completionFields = [
    { name: 'Nome', done: !!usuario?.nome },
    { name: 'Nascimento', done: !!perfil?.dataNascimento },
    { name: 'Sangue', done: !!perfil?.tipoSanguineo },
    { name: 'Alergias', done: alergias.length > 0 },
    { name: 'Exames', done: exames.some((e) => e.statusProcessamento === 'CONCLUIDO') },
    { name: 'Peso', done: !!perfil?.pesoKg },
    { name: 'Altura', done: !!perfil?.alturaCm },
  ];
  const filledCount = completionFields.filter((f) => f.done).length;
  const completionPct = Math.round((filledCount / completionFields.length) * 100);
  const missingCount = completionFields.length - filledCount;

  /* ---- Exam alerts data ---- */
  const examAlerts: ExamAlert[] = [];
  for (const exam of exames) {
    if (exam.statusProcessamento !== 'CONCLUIDO' || !exam.parametros) continue;
    for (const p of exam.parametros) {
      if (p.status === 'NORMAL') continue;
      examAlerts.push({
        name: p.nome,
        value: p.valor,
        unit: p.unidade || '',
        severity: p.status === 'CRITICO' ? 'bad' : 'warn',
        label: p.status === 'CRITICO' ? 'alto' : 'atenção',
      });
    }
  }
  // Sort: bad first, then warn; limit to top 3
  examAlerts.sort((a, b) => (a.severity === 'bad' ? 0 : 1) - (b.severity === 'bad' ? 0 : 1));
  const topAlerts = examAlerts.slice(0, 3);

  /* chart data */
  const chartData = historico.map((s: Score) => ({
    mes: new Date(s.criadoEm).toLocaleDateString('pt-BR', { month: 'short' }),
    score: s.scoreGeral,
  }));

  // projection: simple linear projection for 3 months
  const projectionData = chartData.length >= 2
    ? (() => {
        const last = chartData[chartData.length - 1];
        const prev = chartData[chartData.length - 2];
        const delta = last.score - prev.score;
        const months = ['abr', 'mai', 'jun'];
        return [
          last,
          ...months.map((m, i) => ({
            mes: m,
            score: null as number | null,
            proj: Math.min(100, Math.max(0, last.score + delta * (i + 1))),
          })),
        ];
      })()
    : [];

  const mergedChartData = chartData.length >= 2
    ? [
        ...chartData.map((d) => ({ ...d, proj: null as number | null })),
        ...projectionData.slice(1),
      ]
    : chartData.map((d) => ({ ...d, proj: null as number | null }));

  return (
    <div className="min-h-screen bg-vitae-bg pb-24">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* ---- User header ---- */}
        {loading && !scoreAtual ? (
          <div className="mb-6 flex items-center gap-4">
            <Skeleton className="h-14 w-14 !rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-4"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-vitae-gold/20 text-lg font-bold text-vitae-gold">
              {usuario?.nome ? getInitials(usuario.nome) : '?'}
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                {usuario?.nome || 'Usuario'}
              </h1>
              {scoreAtual?.idadeBiologica && (
                <p className="text-sm text-vitae-text-secondary">
                  Idade biologica:{' '}
                  <span className="font-medium text-vitae-gold">
                    {scoreAtual.idadeBiologica} anos
                  </span>
                </p>
              )}
            </div>
          </motion.div>
        )}

        {/* ---- Health score card ---- */}
        {loading && !scoreAtual ? (
          <Skeleton className="mb-4 h-52" />
        ) : scoreAtual ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Link href="/melhorias" className="block">
              <div className="mb-4 rounded-card bg-vitae-card p-5">
                <p className="mb-3 text-center text-xs font-medium uppercase tracking-wider text-vitae-text-secondary">
                  Health Score
                </p>

                <div className="mb-4 flex justify-center">
                  <CircularScore score={scoreAtual.scoreGeral} />
                </div>

                <div className="flex justify-around">
                  <PillarScore label="Sono" value={scoreAtual.scoreSono} color="#4A9FD9" />
                  <PillarScore label="Atividade" value={scoreAtual.scoreAtividade} color="#4AD9A4" />
                  <PillarScore label="Produtividade" value={scoreAtual.scoreProdutividade} color="#B482FF" />
                  <PillarScore label="Exame" value={scoreAtual.scoreExame} color="#C5A55A" />
                </div>
              </div>
            </Link>
          </motion.div>
        ) : (
          <div className="mb-4 rounded-card bg-vitae-card p-6 text-center">
            <p className="text-sm text-vitae-text-secondary">
              Envie seus exames para calcular seu Health Score
            </p>
            <Link
              href="/exames"
              className="mt-3 inline-block rounded-btn bg-vitae-gold px-5 py-2 text-sm font-semibold text-black"
            >
              Enviar exame
            </Link>
          </div>
        )}

        {/* ---- Completion card ---- */}
        {completionPct < 100 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-4"
          >
            <CompletionCard
              percentage={completionPct}
              missingCount={missingCount}
              fields={completionFields}
              onComplete={() => router.push('/dados-pessoais')}
            />
          </motion.div>
        )}

        {/* ---- Exam alerts ---- */}
        {topAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="mb-4"
          >
            <ExamAlertCard
              alerts={topAlerts}
              onViewAll={() => router.push('/alertas')}
            />
          </motion.div>
        )}

        {/* ---- Health chart ---- */}
        {mergedChartData.length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Link href="/melhorias" className="block">
              <div className="mb-4 rounded-card bg-vitae-card p-4">
                <p className="mb-2 text-xs font-medium uppercase tracking-wider text-vitae-text-secondary">
                  Evolucao
                </p>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={mergedChartData}>
                    <XAxis
                      dataKey="mes"
                      tick={{ fill: '#555555', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#555555', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={30}
                    />
                    <Tooltip
                      contentStyle={{ background: '#141414', border: '1px solid #222', borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: '#888' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#C5A55A"
                      strokeWidth={2}
                      dot={{ fill: '#C5A55A', r: 3 }}
                      connectNulls={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="proj"
                      stroke="#4AD9A4"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Link>
          </motion.div>
        )}

        {/* ---- Seus exames ---- */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Seus exames</h2>
            <Link href="/exames" className="text-xs text-vitae-gold hover:underline">
              Ver todos
            </Link>
          </div>

          {examesLoading && exames.length === 0 ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : last3Exams.length === 0 ? (
            <div className="rounded-card bg-vitae-card p-4 text-center">
              <p className="text-sm text-vitae-text-secondary">Nenhum exame concluido ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {last3Exams.map((exam: Exame) => {
                const badge = statusBadge(exam.statusGeral);
                return (
                  <Link key={exam.id} href={`/exames/${exam.id}`} className="block">
                    <div className="flex items-center gap-3 rounded-card bg-vitae-card p-4 transition-colors hover:bg-vitae-card-light">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vitae-gold/10 text-vitae-gold">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-white">{exam.nome}</p>
                        <p className="text-xs text-vitae-text-muted">
                          {formatDate(exam.dataExame || exam.criadoEm)}
                          {exam.laboratorio && ` - ${exam.laboratorio}`}
                        </p>
                      </div>
                      {badge.label && (
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </motion.section>

        {/* ---- Medicamentos ---- */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Medicamentos</h2>
            <button
              type="button"
              onClick={() => setMedModalOpen(true)}
              className="flex items-center gap-1 text-xs text-vitae-gold hover:underline"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar
            </button>
          </div>

          {medsLoading && medicamentos.length === 0 ? (
            <Skeleton className="h-16" />
          ) : medicamentos.length === 0 ? (
            <div className="rounded-card bg-vitae-card p-4 text-center">
              <p className="text-sm text-vitae-text-secondary">Nenhum medicamento cadastrado</p>
            </div>
          ) : (
            <div className="space-y-2">
              {medicamentos.map((med) => (
                <div
                  key={med.id}
                  className="flex items-center gap-3 rounded-card bg-vitae-card p-4"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vitae-purple/15 text-vitae-purple">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-white">{med.nome}</p>
                    <p className="text-xs text-vitae-text-muted">
                      {[med.dosagem, med.frequencia].filter(Boolean).join(' - ') || 'Sem detalhes'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => deletarMed(med.id)}
                    className="shrink-0 p-1 text-vitae-text-muted transition-colors hover:text-vitae-red"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ---- Alergias ---- */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-4"
        >
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Alergias</h2>
            <button
              type="button"
              onClick={() => setAlergiaModalOpen(true)}
              className="flex items-center gap-1 text-xs text-vitae-gold hover:underline"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Adicionar
            </button>
          </div>

          {alergiasLoading && alergias.length === 0 ? (
            <Skeleton className="h-16" />
          ) : alergias.length === 0 ? (
            <div className="rounded-card bg-vitae-card p-4 text-center">
              <p className="text-sm text-vitae-text-secondary">Nenhuma alergia cadastrada</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {alergias.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-full bg-vitae-red/10 px-3 py-1.5 text-sm text-vitae-red"
                >
                  <span>{a.nome}</span>
                  <button
                    type="button"
                    onClick={() => deletarAlergia(a.id)}
                    className="transition-colors hover:text-white"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </motion.section>
      </div>

      {/* Modals */}
      <MedicamentoModal open={medModalOpen} onClose={() => setMedModalOpen(false)} />
      <AlergiaModal open={alergiaModalOpen} onClose={() => setAlergiaModalOpen(false)} />

      {/* Bottom tab bar */}
      <BottomTabBar active="home" />
    </div>
  );
}
