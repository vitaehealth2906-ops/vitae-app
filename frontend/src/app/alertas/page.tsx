'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useExamesStore, type ExameParametro } from '@/stores/exames';
import { useAuthStore } from '@/stores/auth';
import { isLoggedIn } from '@/lib/auth';

/* ---------- types ---------- */

interface AlertParam extends ExameParametro {
  exameNome: string;
  exameId: string;
  exameLab?: string;
  exameData?: string;
}

/* ---------- helpers ---------- */

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function severityOrder(status: string): number {
  switch (status) {
    case 'CRITICO': return 0;
    case 'ATENCAO': return 1;
    default: return 2;
  }
}

function severityColor(status: string) {
  switch (status) {
    case 'CRITICO':
      return { bar: '#EF4444', text: 'text-[#EF4444]', bg: 'bg-[#EF4444]', bgLight: 'rgba(239,68,68,0.10)', label: 'alto' };
    case 'ATENCAO':
      return { bar: '#F59E0B', text: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]', bgLight: 'rgba(245,158,11,0.10)', label: 'atenção' };
    default:
      return { bar: '#00C47A', text: 'text-[#00C47A]', bg: 'bg-[#00C47A]', bgLight: 'rgba(0,196,122,0.10)', label: 'normal' };
  }
}

/* ---------- Range bar (from prototype) ---------- */

function RangeBar({ param }: { param: AlertParam }) {
  const hasRange = param.referenciaMin != null && param.referenciaMax != null;
  if (!hasRange) return null;

  const min = param.referenciaMin!;
  const max = param.referenciaMax!;
  const val = param.valorNumerico ?? 0;

  // Calculate range for display: extend 30% below min and 30% above max
  const range = max - min;
  const displayMin = min - range * 0.5;
  const displayMax = max + range * 0.5;
  const displayRange = displayMax - displayMin;

  // Position of the marker (clamped 2%-98%)
  let markerPct = ((val - displayMin) / displayRange) * 100;
  markerPct = Math.max(2, Math.min(98, markerPct));

  // Normal zone boundaries
  const normalStart = ((min - displayMin) / displayRange) * 100;
  const normalEnd = ((max - displayMin) / displayRange) * 100;

  const sc = severityColor(param.status);

  return (
    <div style={{ marginTop: 12 }}>
      <div style={{
        position: 'relative',
        height: 6,
        borderRadius: 3,
        background: '#F0F2F7',
        overflow: 'visible',
      }}>
        {/* Normal zone */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${normalStart}%`,
          width: `${normalEnd - normalStart}%`,
          background: 'rgba(0,196,122,0.35)',
          borderRadius: 3,
        }} />
        {/* Low zone */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: 0,
          width: `${normalStart}%`,
          background: param.status === 'CRITICO' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)',
          borderRadius: '3px 0 0 3px',
        }} />
        {/* High zone */}
        <div style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          left: `${normalEnd}%`,
          right: 0,
          background: param.status === 'CRITICO' ? 'rgba(239,68,68,0.25)' : 'rgba(245,158,11,0.25)',
          borderRadius: '0 3px 3px 0',
        }} />
        {/* Marker */}
        <motion.div
          initial={{ left: '50%' }}
          animate={{ left: `${markerPct}%` }}
          transition={{ duration: 0.8, ease: [0.34, 1.2, 0.64, 1] }}
          style={{
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 12,
            height: 12,
            borderRadius: '50%',
            background: sc.bar,
            border: '2.5px solid #fff',
            boxShadow: `0 0 0 2px ${sc.bar}44`,
          }}
        />
      </div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 9,
        color: '#9CA3AF',
        marginTop: 4,
        fontFamily: "'Plus Jakarta Sans', sans-serif",
      }}>
        <span>{Math.round(displayMin)}</span>
        <span>{min}</span>
        <span>{max}</span>
        <span>{Math.round(displayMax)}</span>
      </div>
    </div>
  );
}

/* ---------- Expandable alert card ---------- */

function AlertDetailCard({ param, index }: { param: AlertParam; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const sc = severityColor(param.status);

  const explicacao = param.explicacaoSimples;
  const impacto = param.impactoPessoal;
  const dicas = param.dicas;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          background: '#fff',
          border: '1px solid rgba(0,0,0,0.07)',
          borderRadius: 16,
          boxShadow: '0 1px 12px rgba(0,0,0,0.07)',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: '0.2s',
        }}
      >
        {/* Top bar colored by severity */}
        <div style={{
          height: 3,
          background: sc.bar,
        }} />

        {/* Header row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          padding: '14px 16px',
        }}>
          {/* Severity bar */}
          <div style={{
            width: 3,
            height: 28,
            borderRadius: 2,
            flexShrink: 0,
            background: sc.bar,
          }} />

          {/* Name */}
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 700,
              color: '#0D0F14',
              marginBottom: 2,
            }}>
              {param.nome}
            </div>
            <div style={{
              fontSize: 10,
              color: '#9CA3AF',
            }}>
              {param.exameNome} {param.exameLab ? `· ${param.exameLab}` : ''} {param.exameData ? `· ${formatDate(param.exameData)}` : ''}
            </div>
          </div>

          {/* Value */}
          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: 16,
              fontWeight: 800,
              color: sc.bar,
              letterSpacing: -0.5,
            }}>
              {param.valor}
            </div>
            <div style={{
              fontSize: 9.5,
              color: '#9CA3AF',
            }}>
              {param.unidade}
            </div>
          </div>

          {/* Tag */}
          <div style={{
            fontSize: 9.5,
            fontWeight: 700,
            padding: '2px 7px',
            borderRadius: 4,
            background: sc.bgLight,
            color: sc.bar,
          }}>
            {sc.label}
          </div>

          {/* Chevron */}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#9CA3AF"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              transition: '0.2s',
              transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
              flexShrink: 0,
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>

        {/* Range bar (always visible) */}
        <div style={{ padding: '0 16px 12px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}>
            <span style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>
              Ref: {param.referenciaTexto || `${param.referenciaMin ?? '?'} – ${param.referenciaMax ?? '?'}`}
            </span>
          </div>
          <RangeBar param={param} />
        </div>

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                borderTop: '1px solid rgba(0,0,0,0.07)',
                padding: 16,
              }}>
                {/* O que é isso? */}
                {explicacao && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#0D0F14',
                      marginBottom: 6,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase' as const,
                    }}>
                      O que é isso?
                    </div>
                    <div style={{
                      fontSize: 12.5,
                      color: '#4B5563',
                      lineHeight: 1.55,
                    }}>
                      {explicacao}
                    </div>
                  </div>
                )}

                {/* Como te afeta? */}
                {impacto && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#0D0F14',
                      marginBottom: 6,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase' as const,
                    }}>
                      Como isso te afeta?
                    </div>
                    <div style={{
                      fontSize: 12.5,
                      color: '#4B5563',
                      lineHeight: 1.55,
                      padding: '10px 12px',
                      background: sc.bgLight,
                      borderRadius: 10,
                      borderLeft: `3px solid ${sc.bar}`,
                    }}>
                      {impacto}
                    </div>
                  </div>
                )}

                {/* O que fazer? */}
                {dicas && dicas.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#0D0F14',
                      marginBottom: 6,
                      letterSpacing: 0.5,
                      textTransform: 'uppercase' as const,
                    }}>
                      O que fazer?
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dicas.map((dica, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 8,
                            fontSize: 12.5,
                            color: '#4B5563',
                            lineHeight: 1.55,
                          }}
                        >
                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: 'rgba(0,229,160,0.10)',
                            border: '1px solid rgba(0,229,160,0.22)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginTop: 1,
                          }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </div>
                          <span>{dica}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Meta */}
                {(param.referenciaMin != null || param.referenciaMax != null) && (
                  <div style={{
                    padding: '10px 12px',
                    background: 'rgba(0,229,160,0.08)',
                    border: '1px solid rgba(0,229,160,0.18)',
                    borderRadius: 10,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00E5A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12l2 3 6-6" />
                    </svg>
                    <div style={{
                      fontSize: 11.5,
                      color: '#4B5563',
                      lineHeight: 1.5,
                    }}>
                      <strong style={{ color: '#0D0F14' }}>Meta:</strong>{' '}
                      {param.referenciaMin != null && param.referenciaMax != null
                        ? `manter entre ${param.referenciaMin} e ${param.referenciaMax} ${param.unidade || ''}`
                        : param.referenciaMax != null
                          ? `chegar abaixo de ${param.referenciaMax} ${param.unidade || ''}`
                          : `chegar acima de ${param.referenciaMin} ${param.unidade || ''}`}
                    </div>
                  </div>
                )}

                {/* No AI data fallback */}
                {!explicacao && !impacto && (!dicas || dicas.length === 0) && (
                  <div style={{
                    fontSize: 12,
                    color: '#9CA3AF',
                    textAlign: 'center' as const,
                    padding: '8px 0',
                  }}>
                    Informações detalhadas indisponíveis para este parâmetro.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ---------- Bottom tab bar ---------- */

function BottomTabBar() {
  const tabs = [
    {
      key: 'home',
      label: 'Home',
      href: '/perfil',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      key: 'exames',
      label: 'Exames',
      href: '/exames',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
    },
    {
      key: 'perfil',
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
            className="flex flex-col items-center gap-0.5 px-4 py-1 text-xs text-vitae-text-muted hover:text-vitae-text-secondary transition-colors"
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

export default function AlertasPage() {
  const router = useRouter();
  const { inicializar } = useAuthStore();
  const { exames, carregando, listar } = useExamesStore();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    inicializar();
    if (!isLoggedIn()) {
      router.replace('/cadastro');
      return;
    }
    setInitialized(true);
    listar();
  }, [inicializar, router, listar]);

  // Collect all non-normal parameters from all completed exams
  const alertParams: AlertParam[] = [];

  if (initialized) {
    for (const exam of exames) {
      if (exam.statusProcessamento !== 'CONCLUIDO') continue;
      if (!exam.parametros) continue;

      for (const param of exam.parametros) {
        if (param.status === 'NORMAL') continue;
        alertParams.push({
          ...param,
          exameNome: exam.nome,
          exameId: exam.id,
          exameLab: exam.laboratorio,
          exameData: exam.dataExame || exam.criadoEm,
        });
      }
    }

    // Sort: CRITICO first, then ATENCAO
    alertParams.sort((a, b) => severityOrder(a.status) - severityOrder(b.status));
  }

  if (!initialized) return null;

  const criticoCount = alertParams.filter((p) => p.status === 'CRITICO').length;
  const atencaoCount = alertParams.filter((p) => p.status === 'ATENCAO').length;

  return (
    <div className="min-h-screen bg-vitae-bg pb-24">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-2 flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vitae-card text-vitae-text-secondary transition-colors hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white">Atenção nos exames</h1>
        </div>

        {/* Summary */}
        <div className="mb-6 pl-12">
          <p className="text-sm text-vitae-text-secondary">
            {alertParams.length === 0
              ? 'Nenhum parâmetro fora do normal.'
              : `${alertParams.length} ${alertParams.length === 1 ? 'item precisa' : 'itens precisam'} de atenção`}
          </p>
          {(criticoCount > 0 || atencaoCount > 0) && (
            <div className="mt-1 flex gap-2">
              {criticoCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(239,68,68,0.10)',
                    color: '#EF4444',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {criticoCount} alto{criticoCount > 1 ? 's' : ''}
                </span>
              )}
              {atencaoCount > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: 'rgba(245,158,11,0.10)',
                    color: '#F59E0B',
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {atencaoCount} atenção
                </span>
              )}
            </div>
          )}
        </div>

        {/* Loading */}
        {carregando && exames.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-card bg-vitae-card h-24" />
            ))}
          </div>
        ) : alertParams.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-12 flex flex-col items-center text-center"
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: 'rgba(0,196,122,0.10)',
                border: '1px solid rgba(0,196,122,0.20)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 16,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#00C47A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <p className="text-sm font-medium text-vitae-text-secondary">
              Tudo dentro do normal!
            </p>
            <p className="mt-1 text-xs text-vitae-text-muted">
              Nenhum parâmetro fora da faixa de referência
            </p>
          </motion.div>
        ) : (
          /* Alert cards */
          <div className="space-y-3">
            {alertParams.map((param, index) => (
              <AlertDetailCard key={`${param.exameId}-${param.id}`} param={param} index={index} />
            ))}
          </div>
        )}

        {/* Disclaimer */}
        {alertParams.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            style={{
              marginTop: 20,
              padding: '12px 14px',
              background: 'rgba(0,229,160,0.06)',
              border: '1px solid rgba(0,229,160,0.15)',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#00E5A0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: 1 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div style={{
              fontSize: 11.5,
              color: '#9CA3AF',
              lineHeight: 1.55,
            }}>
              <strong style={{ color: '#fff' }}>Importante:</strong> Estes dados são educativos e não substituem orientação médica. Consulte sempre um profissional de saúde.
            </div>
          </motion.div>
        )}
      </div>

      <BottomTabBar />
    </div>
  );
}
