'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { useExamesStore, type ExameParametro } from '@/stores/exames';
import { useScoresStore } from '@/stores/scores';
import { useAuthStore } from '@/stores/auth';
import { isLoggedIn } from '@/lib/auth';

/* ---------- helpers ---------- */

function statusColor(status: string) {
  switch (status) {
    case 'NORMAL':
      return { text: 'text-vitae-green', bg: 'bg-vitae-green', bgLight: 'bg-vitae-green/15', label: 'Normal' };
    case 'ATENCAO':
      return { text: 'text-vitae-gold', bg: 'bg-vitae-gold', bgLight: 'bg-vitae-gold/15', label: 'Atencao' };
    case 'CRITICO':
      return { text: 'text-vitae-red', bg: 'bg-vitae-red', bgLight: 'bg-vitae-red/15', label: 'Critico' };
    default:
      return { text: 'text-vitae-text-secondary', bg: 'bg-vitae-text-muted', bgLight: 'bg-vitae-card', label: status };
  }
}

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

/* ---------- Skeleton ---------- */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-vitae-card ${className}`} />;
}

/* ---------- Parameter bar ---------- */

function ParameterBar({ param }: { param: ExameParametro }) {
  const sc = statusColor(param.status);

  // Calculate percentage position within reference range
  let pct = param.percentualFaixa ?? 50;
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;

  const hasRange = param.referenciaMin != null && param.referenciaMax != null;

  return (
    <div className="rounded-card bg-vitae-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-white">{param.nome}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${sc.bgLight} ${sc.text}`}>
          {sc.label}
        </span>
      </div>

      <div className="mb-2 flex items-baseline gap-1">
        <span className={`text-lg font-bold ${sc.text}`}>{param.valor}</span>
        {param.unidade && (
          <span className="text-xs text-vitae-text-muted">{param.unidade}</span>
        )}
      </div>

      {hasRange && (
        <>
          {/* Reference range bar */}
          <div className="relative mb-1 h-2 w-full overflow-hidden rounded-full bg-vitae-border">
            {/* Normal zone (green) in the middle */}
            <div className="absolute inset-y-0 left-[20%] right-[20%] bg-vitae-green/30" />

            {/* Position indicator */}
            <motion.div
              className={`absolute top-0 h-full w-1 rounded-full ${sc.bg}`}
              initial={{ left: '0%' }}
              animate={{ left: `${pct}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ marginLeft: '-2px' }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-vitae-text-muted">
            <span>{param.referenciaMin}</span>
            <span className="text-vitae-text-secondary">
              {param.referenciaTexto || `${param.referenciaMin} - ${param.referenciaMax}`}
            </span>
            <span>{param.referenciaMax}</span>
          </div>
        </>
      )}

      {!hasRange && param.referenciaTexto && (
        <p className="text-xs text-vitae-text-muted">Ref: {param.referenciaTexto}</p>
      )}
    </div>
  );
}

/* ---------- Main page ---------- */

export default function ExameDetalhePage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const { inicializar } = useAuthStore();
  const { exameAtual, carregando, carregar, deletar } = useExamesStore();
  const { historico, carregarHistorico } = useScoresStore();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    inicializar();
    if (!isLoggedIn()) {
      router.replace('/cadastro');
      return;
    }
    carregar(id);
    carregarHistorico();
  }, [inicializar, router, id, carregar, carregarHistorico]);

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deletar(id);
      router.replace('/exames');
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  /* Mini chart data */
  const chartData = historico.map((s) => ({
    mes: new Date(s.criadoEm).toLocaleDateString('pt-BR', { month: 'short' }),
    score: s.scoreGeral,
  }));

  if (carregando || !exameAtual) {
    return (
      <div className="min-h-screen bg-vitae-bg">
        <div className="mx-auto max-w-md space-y-4 px-4 py-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 !rounded-full" />
            <Skeleton className="h-5 w-48" />
          </div>
          <Skeleton className="h-32" />
          <Skeleton className="h-64" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  const exam = exameAtual;
  const isProcessing = exam.statusProcessamento !== 'CONCLUIDO';
  const overallStatus = statusColor(exam.statusGeral || '');

  return (
    <div className="min-h-screen bg-vitae-bg pb-12">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vitae-card text-vitae-text-secondary transition-colors hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="truncate text-lg font-semibold text-white">{exam.nome}</h1>
        </div>

        {/* Processing state */}
        {isProcessing ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-16 text-center"
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center">
              <svg
                className="h-12 w-12 animate-spin text-vitae-blue"
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
            </div>
            <p className="text-sm font-medium text-white">
              {exam.statusProcessamento === 'ERRO'
                ? 'Ocorreu um erro ao processar este exame'
                : 'Processando seu exame...'}
            </p>
            <p className="mt-1 text-xs text-vitae-text-muted">
              {exam.statusProcessamento === 'ERRO'
                ? 'Tente enviar novamente'
                : 'Nossa IA esta analisando seus resultados. Isso pode levar alguns minutos.'}
            </p>

            {exam.statusProcessamento === 'ERRO' && (
              <button
                type="button"
                onClick={() => router.push('/exames')}
                className="mt-6 rounded-btn bg-vitae-gold px-5 py-2.5 text-sm font-semibold text-black"
              >
                Voltar para exames
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-4">
            {/* Section 1: Resumo */}
            <motion.section
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
            >
              <div className="rounded-card bg-vitae-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-vitae-text-secondary uppercase tracking-wider">
                    Resumo
                  </h2>
                  {exam.statusGeral && (
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${overallStatus.bgLight} ${overallStatus.text}`}
                    >
                      {overallStatus.label}
                    </span>
                  )}
                </div>
                {exam.resumoIa ? (
                  <p className="text-sm leading-relaxed text-vitae-text-secondary">
                    {exam.resumoIa}
                  </p>
                ) : (
                  <p className="text-sm text-vitae-text-muted">Resumo nao disponivel.</p>
                )}
                {exam.dataExame && (
                  <p className="mt-3 text-xs text-vitae-text-muted">
                    Data do exame: {formatDate(exam.dataExame)}
                  </p>
                )}
                {exam.laboratorio && (
                  <p className="text-xs text-vitae-text-muted">
                    Laboratorio: {exam.laboratorio}
                  </p>
                )}
              </div>
            </motion.section>

            {/* Section 2: Parametros */}
            {exam.parametros && exam.parametros.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <h2 className="mb-3 text-sm font-semibold text-vitae-text-secondary uppercase tracking-wider">
                  Parametros
                </h2>
                <div className="space-y-2">
                  {exam.parametros.map((param: ExameParametro) => (
                    <ParameterBar key={param.id} param={param} />
                  ))}
                </div>
              </motion.section>
            )}

            {/* Section 3: Impacto no dia a dia */}
            {exam.impactosIa && exam.impactosIa.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                <h2 className="mb-3 text-sm font-semibold text-vitae-text-secondary uppercase tracking-wider">
                  Impacto no dia a dia
                </h2>
                <div className="space-y-2">
                  {exam.impactosIa.map((impacto, i) => (
                    <div
                      key={i}
                      className="rounded-card bg-vitae-card p-4"
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-xl">{impacto.icone}</span>
                        <span className="text-sm font-medium text-white">
                          {impacto.titulo}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-vitae-text-secondary">
                        {impacto.texto}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* Section 4: Melhorias sugeridas */}
            {exam.melhoriasIa && exam.melhoriasIa.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                <h2 className="mb-3 text-sm font-semibold text-vitae-text-secondary uppercase tracking-wider">
                  Melhorias sugeridas
                </h2>
                <div className="rounded-card bg-vitae-card p-4">
                  <div className="space-y-3">
                    {exam.melhoriasIa.map((melhoria, i) => (
                      <label
                        key={i}
                        className="flex items-start gap-3 text-sm text-vitae-text-secondary"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-vitae-border bg-vitae-bg text-vitae-gold accent-vitae-gold focus:ring-vitae-gold"
                        />
                        <span>{melhoria}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </motion.section>
            )}

            {/* Section 5: Mini chart */}
            {chartData.length >= 2 && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
              >
                <h2 className="mb-3 text-sm font-semibold text-vitae-text-secondary uppercase tracking-wider">
                  Evolucao do score
                </h2>
                <div className="rounded-card bg-vitae-card p-4">
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={chartData}>
                      <XAxis
                        dataKey="mes"
                        tick={{ fill: '#555555', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fill: '#555555', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={25}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#141414',
                          border: '1px solid #222',
                          borderRadius: 8,
                          fontSize: 11,
                        }}
                        labelStyle={{ color: '#888' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="score"
                        stroke="#C5A55A"
                        strokeWidth={2}
                        dot={{ fill: '#C5A55A', r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </motion.section>
            )}

            {/* Delete button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="pt-4"
            >
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={`w-full rounded-btn border py-3 text-sm font-medium transition-all ${
                  confirmDelete
                    ? 'border-vitae-red bg-vitae-red/15 text-vitae-red hover:bg-vitae-red hover:text-white'
                    : 'border-vitae-border text-vitae-text-muted hover:border-vitae-red hover:text-vitae-red'
                }`}
              >
                {deleting
                  ? 'Deletando...'
                  : confirmDelete
                    ? 'Confirmar exclusao'
                    : 'Deletar exame'}
              </button>
              {confirmDelete && !deleting && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="mt-2 w-full py-2 text-xs text-vitae-text-muted hover:text-white"
                >
                  Cancelar
                </button>
              )}
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}
