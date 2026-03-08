'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useScoresStore, type Melhoria } from '@/stores/scores';
import { useAuthStore } from '@/stores/auth';
import { isLoggedIn } from '@/lib/auth';

/* ---------- Skeleton ---------- */

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-card bg-vitae-card ${className}`} />;
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

/* ---------- Accordion card ---------- */

function MelhoriaCard({ melhoria, index }: { melhoria: Melhoria; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left"
      >
        <div
          className={`rounded-card bg-vitae-card p-4 transition-all ${
            expanded ? 'ring-1 ring-vitae-gold/30' : ''
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">{melhoria.icone}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white">{melhoria.titulo}</p>
              <p className="text-xs text-vitae-text-secondary">{melhoria.categoria}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <span className="rounded-full bg-vitae-green/15 px-2.5 py-0.5 text-[10px] font-semibold text-vitae-green">
                +{melhoria.anosGanhos.toFixed(1)} anos
              </span>
              <motion.svg
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="h-4 w-4 text-vitae-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </motion.svg>
            </div>
          </div>

          <AnimatePresence>
            {expanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="mt-3 border-t border-vitae-border pt-3">
                  <p className="text-sm leading-relaxed text-vitae-text-secondary">
                    {melhoria.texto}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </button>
    </motion.div>
  );
}

/* ---------- Main page ---------- */

export default function MelhoriasPage() {
  const router = useRouter();
  const { inicializar } = useAuthStore();
  const { scoreAtual, melhorias, carregando, carregarAtual, carregarMelhorias } = useScoresStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    inicializar();
    if (!isLoggedIn()) {
      router.replace('/cadastro');
      return;
    }
    setInitialized(true);
    carregarAtual();
    carregarMelhorias();
  }, [inicializar, router, carregarAtual, carregarMelhorias]);

  if (!initialized) return null;

  const totalAnosGanhos = melhorias.reduce((sum, m) => sum + m.anosGanhos, 0);
  const projectedScore = scoreAtual
    ? Math.min(100, scoreAtual.scoreGeral + Math.round(totalAnosGanhos * 3))
    : 0;
  const scoreDelta = projectedScore - (scoreAtual?.scoreGeral || 0);

  return (
    <div className="min-h-screen bg-vitae-bg pb-24">
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
          <h1 className="text-lg font-semibold text-white">Melhorias</h1>
        </div>

        {/* Loading */}
        {carregando && melhorias.length === 0 ? (
          <div className="space-y-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : melhorias.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center py-16 text-center"
          >
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-vitae-card">
              <svg
                className="h-10 w-10 text-vitae-text-muted"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-vitae-text-secondary">
              Envie seus exames para receber recomendacoes personalizadas
            </p>
            <p className="mt-1 text-xs text-vitae-text-muted">
              Nossa IA vai analisar seus dados e sugerir melhorias
            </p>
            <Link
              href="/exames"
              className="mt-6 rounded-btn bg-vitae-gold px-6 py-3 text-sm font-semibold text-black transition-all hover:brightness-110"
            >
              Enviar exames
            </Link>
          </motion.div>
        ) : (
          <>
            {/* Summary card */}
            {scoreAtual && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 rounded-card bg-vitae-card p-5"
              >
                <div className="flex items-center justify-center gap-4">
                  {/* Current */}
                  <div className="text-center">
                    <p className="text-xs text-vitae-text-muted">Atual</p>
                    <p className="text-3xl font-bold text-white">{scoreAtual.scoreGeral}</p>
                  </div>

                  {/* Arrow */}
                  <svg
                    className="h-6 w-6 text-vitae-gold"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>

                  {/* Projected */}
                  <div className="text-center">
                    <p className="text-xs text-vitae-text-muted">Projetado</p>
                    <p className="text-3xl font-bold text-vitae-green">{projectedScore}</p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-center gap-4">
                  <span className="rounded-full bg-vitae-gold/15 px-3 py-1 text-xs font-semibold text-vitae-gold">
                    +{scoreDelta} pontos
                  </span>
                  <span className="rounded-full bg-vitae-green/15 px-3 py-1 text-xs font-semibold text-vitae-green">
                    +{totalAnosGanhos.toFixed(1)} anos de vida
                  </span>
                </div>
              </motion.div>
            )}

            {/* Improvement cards */}
            <div className="space-y-3">
              {melhorias.map((melhoria: Melhoria, index: number) => (
                <MelhoriaCard key={index} melhoria={melhoria} index={index} />
              ))}
            </div>
          </>
        )}
      </div>

      <BottomTabBar active="home" />
    </div>
  );
}
