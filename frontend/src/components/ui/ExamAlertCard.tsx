'use client';

import styles from './ExamAlertCard.module.css';

export interface ExamAlert {
  name: string;
  value: string;
  unit: string;
  severity: 'ok' | 'warn' | 'bad';
  label: string;
}

interface ExamAlertCardProps {
  alerts: ExamAlert[];
  onViewAll?: () => void;
}

const barClass = { ok: styles.barOk, warn: styles.barWarn, bad: styles.barBad };
const valClass = { ok: styles.valOk, warn: styles.valWarn, bad: styles.valBad };
const tagClass = { ok: styles.tagOk, warn: styles.tagWarn, bad: styles.tagBad };

export default function ExamAlertCard({ alerts, onViewAll }: ExamAlertCardProps) {
  if (alerts.length === 0) return null;

  return (
    <div className={styles.card}>
      <div className={styles.gradientBar} />

      <div className={styles.header}>
        <div className={styles.title}>Atenção nos exames</div>
        <button className={styles.link} onClick={onViewAll} type="button">
          Ver tudo →
        </button>
      </div>

      {alerts.map((alert, i) => (
        <div key={i} className={styles.row}>
          <div className={barClass[alert.severity]} />
          <div className={styles.name}>{alert.name}</div>
          <div className={valClass[alert.severity]}>
            {alert.value} {alert.unit}
          </div>
          <div className={tagClass[alert.severity]}>{alert.label}</div>
        </div>
      ))}
    </div>
  );
}
