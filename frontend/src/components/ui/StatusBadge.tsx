'use client';

type Status = 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'PROCESSANDO' | 'ENVIADO' | 'ERRO';

interface StatusBadgeProps {
  status: Status;
}

const statusConfig: Record<Status, { label: string; bg: string; text: string }> = {
  NORMAL: {
    label: 'Normal',
    bg: 'bg-green-500/15',
    text: 'text-green-400',
  },
  ATENCAO: {
    label: 'Atenção',
    bg: 'bg-[#C5A55A]/15',
    text: 'text-[#C5A55A]',
  },
  CRITICO: {
    label: 'Crítico',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
  },
  PROCESSANDO: {
    label: 'Processando...',
    bg: 'bg-blue-500/15',
    text: 'text-blue-400',
  },
  ENVIADO: {
    label: 'Enviado',
    bg: 'bg-gray-500/15',
    text: 'text-gray-400',
  },
  ERRO: {
    label: 'Erro',
    bg: 'bg-red-500/15',
    text: 'text-red-400',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}
