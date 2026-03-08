'use client';

import { motion } from 'framer-motion';

type ParameterStatus = 'NORMAL' | 'ATENCAO' | 'CRITICO';

interface ParameterBarProps {
  nome: string;
  valor: number | string;
  unidade: string;
  referenciaMin?: number;
  referenciaMax?: number;
  referenciaTexto?: string;
  status: ParameterStatus;
  percentualFaixa: number;
}

const barColors: Record<ParameterStatus, string> = {
  NORMAL: 'bg-green-500',
  ATENCAO: 'bg-[#C5A55A]',
  CRITICO: 'bg-red-500',
};

const valueColors: Record<ParameterStatus, string> = {
  NORMAL: 'text-green-400',
  ATENCAO: 'text-[#C5A55A]',
  CRITICO: 'text-red-400',
};

export default function ParameterBar({
  nome,
  valor,
  unidade,
  referenciaMin,
  referenciaMax,
  referenciaTexto,
  status,
  percentualFaixa,
}: ParameterBarProps) {
  const isOutOfRange = percentualFaixa < 0 || percentualFaixa > 100;
  const clampedPercentual = Math.max(0, Math.min(100, percentualFaixa));

  const referenceLabel =
    referenciaTexto ||
    (referenciaMin !== undefined && referenciaMax !== undefined
      ? `${referenciaMin} - ${referenciaMax} ${unidade}`
      : '');

  return (
    <motion.div
      className="py-3"
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      {/* Top row: name and value */}
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-sm text-gray-300 font-medium">{nome}</span>
        <span className={`text-sm font-semibold ${valueColors[status]}`}>
          {valor}{' '}
          <span className="text-xs font-normal text-gray-500">{unidade}</span>
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${barColors[status]} ${
            isOutOfRange ? 'opacity-80' : ''
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${clampedPercentual}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
        />

        {/* Out-of-range overflow indicator */}
        {isOutOfRange && (
          <motion.div
            className={`absolute inset-y-0 right-0 rounded-full ${barColors[status]} opacity-30`}
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          />
        )}
      </div>

      {/* Reference range */}
      {referenceLabel && (
        <p className="text-xs text-gray-500 mt-1">Ref: {referenceLabel}</p>
      )}
    </motion.div>
  );
}
