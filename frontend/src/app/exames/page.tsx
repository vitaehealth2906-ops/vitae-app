'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { useExamesStore, type Exame } from '@/stores/exames';
import { useAuthStore } from '@/stores/auth';
import { isLoggedIn } from '@/lib/auth';

/* ---------- helpers ---------- */

function formatDate(iso?: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getStatusConfig(exam: Exame) {
  switch (exam.statusProcessamento) {
    case 'ENVIADO':
      return { label: 'Enviado', cls: 'bg-vitae-text-muted/20 text-vitae-text-secondary' };
    case 'PROCESSANDO':
      return { label: 'Processando...', cls: 'bg-vitae-blue/15 text-vitae-blue' };
    case 'ERRO':
      return { label: 'Erro', cls: 'bg-vitae-red/15 text-vitae-red' };
    case 'CONCLUIDO': {
      switch (exam.statusGeral) {
        case 'NORMAL':
          return { label: 'Normal', cls: 'bg-vitae-green/15 text-vitae-green' };
        case 'ATENCAO':
          return { label: 'Atencao', cls: 'bg-vitae-gold/15 text-vitae-gold' };
        case 'CRITICO':
          return { label: 'Critico', cls: 'bg-vitae-red/15 text-vitae-red' };
        default:
          return { label: 'Concluido', cls: 'bg-vitae-green/15 text-vitae-green' };
      }
    }
    default:
      return { label: '', cls: '' };
  }
}

function examTypeIcon(tipo: string) {
  switch (tipo?.toUpperCase()) {
    case 'SANGUE':
    case 'HEMOGRAMA':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-1.2 2.4-4 6.6-4 9a4 4 0 108 0c0-2.4-2.8-6.6-4-9z" />
        </svg>
      );
    case 'IMAGEM':
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
        </svg>
      );
    default:
      return (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
  }
}

/* ---------- Skeleton card ---------- */

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-card bg-vitae-card p-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-vitae-border" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 w-3/4 rounded bg-vitae-border" />
          <div className="h-3 w-1/2 rounded bg-vitae-border" />
        </div>
        <div className="h-5 w-16 rounded-full bg-vitae-border" />
      </div>
    </div>
  );
}

/* ---------- Toast ---------- */

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed left-4 right-4 top-4 z-50 mx-auto max-w-md rounded-btn bg-vitae-green/90 px-4 py-3 text-center text-sm font-medium text-black shadow-lg"
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

/* ---------- Main page ---------- */

export default function ExamesPage() {
  const router = useRouter();
  const { inicializar } = useAuthStore();
  const { exames, carregando, enviando, listar, upload } = useExamesStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
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

  const handleFileUpload = useCallback(
    async (file: File) => {
      try {
        await upload(file);
        setToast('Exame enviado! Processando...');
      } catch {
        setToast('Erro ao enviar exame. Tente novamente.');
      }
    },
    [upload],
  );

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleFileUpload(acceptedFiles[0]);
      }
    },
    [handleFileUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
    },
    maxFiles: 1,
    disabled: enviando,
  });

  const handleButtonUpload = () => {
    fileInputRef.current?.click();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  if (!initialized) return null;

  return (
    <div className="min-h-screen bg-vitae-bg pb-24">
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
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
          <h1 className="text-lg font-semibold text-white">Seus Exames</h1>
        </div>

        {/* Upload button */}
        <motion.button
          type="button"
          onClick={handleButtonUpload}
          disabled={enviando}
          whileTap={{ scale: 0.97 }}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-btn bg-vitae-gold px-5 py-3.5 text-sm font-semibold text-black transition-all hover:brightness-110 disabled:opacity-50"
        >
          {enviando ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Enviando...
            </>
          ) : (
            <>
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Enviar exame
            </>
          )}
        </motion.button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleInputChange}
          className="hidden"
        />

        {/* Drag and drop area */}
        <div
          {...getRootProps()}
          className={`mb-6 cursor-pointer rounded-card border-2 border-dashed p-6 text-center transition-all ${
            isDragActive
              ? 'border-vitae-gold bg-vitae-gold/5'
              : 'border-vitae-border bg-vitae-card hover:border-vitae-text-muted'
          } ${enviando ? 'pointer-events-none opacity-50' : ''}`}
        >
          <input {...getInputProps()} />
          <svg
            className="mx-auto mb-2 h-8 w-8 text-vitae-text-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
            />
          </svg>
          <p className="text-sm text-vitae-text-secondary">
            {isDragActive
              ? 'Solte o arquivo aqui...'
              : 'Arraste ou toque para enviar'}
          </p>
          <p className="mt-1 text-xs text-vitae-text-muted">PDF, JPG ou PNG</p>
        </div>

        {/* Loading skeleton for uploading */}
        <AnimatePresence>
          {enviando && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-3 overflow-hidden"
            >
              <SkeletonCard />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Exam list */}
        {carregando && exames.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : exames.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-8 flex flex-col items-center text-center"
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
                  d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-vitae-text-secondary">
              Envie seu primeiro exame
            </p>
            <p className="mt-1 text-xs text-vitae-text-muted">
              Nossa IA vai analisar e gerar insights personalizados
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {exames.map((exam, index) => {
              const status = getStatusConfig(exam);
              return (
                <motion.div
                  key={exam.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link href={`/exames/${exam.id}`} className="block">
                    <div className="flex items-center gap-3 rounded-card bg-vitae-card p-4 transition-colors hover:bg-vitae-card-light">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vitae-gold/10 text-vitae-gold">
                        {examTypeIcon(exam.tipo)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-white">{exam.nome}</p>
                        <p className="text-xs text-vitae-text-muted">
                          {formatDate(exam.dataExame || exam.criadoEm)}
                          {exam.laboratorio && ` - ${exam.laboratorio}`}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${status.cls}`}
                      >
                        {status.label}
                      </span>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      <BottomTabBar active="exames" />
    </div>
  );
}
