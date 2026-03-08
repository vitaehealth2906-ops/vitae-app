'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';

const CODE_LENGTH = 6;
const RESEND_TIMER_SECONDS = 60;

export default function VerificacaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const celular = searchParams.get('celular') || '';

  const { carregando, erro, verificarSms, limparErro } = useAuthStore();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [shake, setShake] = useState(false);
  const [timer, setTimer] = useState(RESEND_TIMER_SECONDS);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const submittingRef = useRef(false);

  // ─── Countdown timer ────────────────────────────────────
  useEffect(() => {
    if (timer <= 0) {
      setCanResend(true);
      return;
    }

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  // ─── Auto-focus first input on mount ────────────────────
  useEffect(() => {
    const timeout = setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 300);
    return () => clearTimeout(timeout);
  }, []);

  // ─── Format phone for display ───────────────────────────
  const formatPhoneDisplay = (phone: string): string => {
    const d = phone.replace(/\D/g, '');
    if (d.length >= 13) {
      return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
    }
    if (d.length >= 11) {
      return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4)}`;
    }
    return phone;
  };

  // ─── Submit code ────────────────────────────────────────
  const submitCode = useCallback(
    async (code: string) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      limparErro();

      try {
        await verificarSms(celular, code);
        router.push('/quiz');
      } catch {
        // Error is set in the store
        setShake(true);
        setTimeout(() => setShake(false), 600);

        // Clear digits and refocus first input
        setDigits(Array(CODE_LENGTH).fill(''));
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 100);
      } finally {
        submittingRef.current = false;
      }
    },
    [celular, verificarSms, limparErro, router]
  );

  // ─── Handle digit input ────────────────────────────────
  const handleChange = (index: number, value: string) => {
    // Only allow single digits
    const digit = value.replace(/\D/g, '').slice(-1);

    const newDigits = [...digits];
    newDigits[index] = digit;
    setDigits(newDigits);

    if (digit && index < CODE_LENGTH - 1) {
      // Move focus to next input
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all digits are filled
    if (digit && index === CODE_LENGTH - 1) {
      const fullCode = newDigits.join('');
      if (fullCode.length === CODE_LENGTH) {
        submitCode(fullCode);
      }
    }
  };

  // ─── Handle keyboard navigation ────────────────────────
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (digits[index]) {
        // Clear current digit
        const newDigits = [...digits];
        newDigits[index] = '';
        setDigits(newDigits);
      } else if (index > 0) {
        // Move focus to previous input and clear it
        inputRefs.current[index - 1]?.focus();
        const newDigits = [...digits];
        newDigits[index - 1] = '';
        setDigits(newDigits);
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // ─── Handle paste ──────────────────────────────────────
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH);

    if (pastedData.length === 0) return;

    const newDigits = [...digits];
    for (let i = 0; i < CODE_LENGTH; i++) {
      newDigits[i] = pastedData[i] || '';
    }
    setDigits(newDigits);

    // Focus the next empty input, or the last one
    const nextEmpty = newDigits.findIndex((d) => !d);
    const focusIndex = nextEmpty === -1 ? CODE_LENGTH - 1 : nextEmpty;
    inputRefs.current[focusIndex]?.focus();

    // Auto-submit if pasted full code
    if (pastedData.length === CODE_LENGTH) {
      submitCode(pastedData);
    }
  };

  // ─── Resend code ───────────────────────────────────────
  const handleResend = () => {
    if (!canResend) return;
    // Reset timer
    setTimer(RESEND_TIMER_SECONDS);
    setCanResend(false);
    limparErro();
    setDigits(Array(CODE_LENGTH).fill(''));
    inputRefs.current[0]?.focus();

    // TODO: Call resend SMS API endpoint
  };

  // ─── Format timer display ─────────────────────────────
  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-vitae-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <button
            onClick={() => router.back()}
            className="mb-8 flex items-center gap-2 text-sm text-vitae-text-secondary transition-colors hover:text-white"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5 8.25 12l7.5-7.5"
              />
            </svg>
            Voltar
          </button>
        </motion.div>

        {/* Title + subtitle */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          <h1 className="font-serif text-2xl font-bold text-white">
            Verificacao por SMS
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-vitae-text-secondary">
            Codigo enviado para{' '}
            <span className="font-medium text-white">
              {formatPhoneDisplay(celular)}
            </span>
          </p>
        </motion.div>

        {/* Code inputs */}
        <motion.div
          className="mb-6 flex justify-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{
            opacity: 1,
            y: 0,
            x: shake ? [0, -8, 8, -6, 6, -3, 3, 0] : 0,
          }}
          transition={
            shake
              ? { duration: 0.5, ease: 'easeInOut' }
              : { duration: 0.4, delay: 0.2 }
          }
        >
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              onFocus={(e) => e.target.select()}
              className={`h-14 w-12 rounded-btn border text-center font-sans text-xl font-semibold transition-all focus:outline-none ${
                digit
                  ? 'border-vitae-gold/60 bg-vitae-gold/10 text-white'
                  : 'border-vitae-border bg-vitae-card-light text-white'
              } ${
                erro
                  ? 'border-vitae-red/50'
                  : 'focus:border-vitae-gold/50'
              }`}
              disabled={carregando}
              aria-label={`Digito ${index + 1}`}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
            />
          ))}
        </motion.div>

        {/* Error message */}
        {erro && (
          <motion.p
            className="mb-4 text-center text-sm text-vitae-red"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25 }}
          >
            {erro}
          </motion.p>
        )}

        {/* Loading indicator */}
        {carregando && (
          <motion.div
            className="mb-4 flex items-center justify-center gap-2 text-sm text-vitae-text-secondary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <svg
              className="h-4 w-4 animate-spin text-vitae-gold"
              viewBox="0 0 24 24"
              fill="none"
            >
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
                className="opacity-25"
              />
              <path
                d="M4 12a8 8 0 018-8"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                className="opacity-75"
              />
            </svg>
            Verificando...
          </motion.div>
        )}

        {/* Resend timer / button */}
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {canResend ? (
            <button
              onClick={handleResend}
              className="text-sm font-medium text-vitae-gold transition-opacity hover:opacity-80"
            >
              Reenviar codigo
            </button>
          ) : (
            <p className="text-sm text-vitae-text-muted">
              Reenviar codigo em{' '}
              <span className="font-medium text-vitae-text-secondary">
                {formatTimer(timer)}
              </span>
            </p>
          )}
        </motion.div>

        {/* Bottom spacer + back link */}
        <div className="mt-auto pt-8">
          <button
            onClick={() => router.push('/cadastro')}
            className="mx-auto block text-sm text-vitae-text-secondary transition-colors hover:text-white"
          >
            Voltar para o cadastro
          </button>
        </div>
      </div>
    </div>
  );
}
