'use client';

import { useEffect, useId, useState } from 'react';
import styles from './CompletionCard.module.css';

interface Field {
  name: string;
  done: boolean;
}

interface CompletionCardProps {
  percentage: number;
  missingCount: number;
  fields: Field[];
  onComplete?: () => void;
}

export default function CompletionCard({
  percentage,
  missingCount,
  fields,
  onComplete,
}: CompletionCardProps) {
  const gradientId = useId();
  const circumference = 164;
  const targetOffset = circumference - (circumference * percentage) / 100;

  // Animate on mount: start fully hidden, then transition to target
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    // Small delay so the browser paints the initial state first
    const raf = requestAnimationFrame(() => {
      setOffset(targetOffset);
    });
    return () => cancelAnimationFrame(raf);
  }, [targetOffset]);

  return (
    <div className={styles.card}>
      <div className={styles.gradientBar} />

      <div className={styles.top}>
        {/* Ring progress */}
        <div className={styles.ring}>
          <svg viewBox="0 0 62 62">
            <circle className={styles.ringBg} cx="31" cy="31" r="26" />
            <circle
              className={styles.ringFill}
              cx="31"
              cy="31"
              r="26"
              stroke={`url(#${gradientId})`}
              style={{ strokeDashoffset: offset }}
            />
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#00E5A0" />
                <stop offset="100%" stopColor="#00B4D8" />
              </linearGradient>
            </defs>
          </svg>
          <div className={styles.ringNum}>
            <span className={styles.ringPct}>{percentage}%</span>
          </div>
        </div>

        {/* Info */}
        <div className={styles.info}>
          <div className={styles.title}>Completude do RG</div>
          <div className={styles.sub}>
            {missingCount === 0
              ? 'Seu perfil está completo!'
              : `${missingCount} ${missingCount === 1 ? 'informação importante ainda falta' : 'informações importantes ainda faltam'} para seu perfil ficar completo.`}
          </div>
          {missingCount > 0 && (
            <button className={styles.btn} onClick={onComplete} type="button">
              <svg viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Completar agora
            </button>
          )}
        </div>
      </div>

      {/* Field dots */}
      <div className={styles.fields}>
        {fields.map((field) => (
          <div
            key={field.name}
            className={field.done ? styles.dotDone : styles.dotMiss}
          >
            <div
              className={field.done ? styles.dotIconDone : styles.dotIconMiss}
            />
            {field.name}
          </div>
        ))}
      </div>
    </div>
  );
}
