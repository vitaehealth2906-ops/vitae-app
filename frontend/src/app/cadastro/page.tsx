'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth';

type Tab = 'criar' | 'entrar';

// ─── Phone mask helper ───────────────────────────────────────
function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  // Limit to 13 digits (55 + 2-digit DDD + 9-digit number)
  const limited = digits.slice(0, 13);

  if (limited.length <= 2) return `+${limited}`;
  if (limited.length <= 4) return `+${limited.slice(0, 2)} (${limited.slice(2)}`;
  if (limited.length <= 9)
    return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4)}`;
  return `+${limited.slice(0, 2)} (${limited.slice(2, 4)}) ${limited.slice(4, 9)}-${limited.slice(9)}`;
}

function extractDigits(formatted: string): string {
  return formatted.replace(/\D/g, '');
}

// ─── Component ───────────────────────────────────────────────
export default function CadastroPage() {
  const router = useRouter();
  const { carregando, erro, cadastro, login, limparErro } = useAuthStore();

  const [tab, setTab] = useState<Tab>('criar');

  // Signup fields
  const [nome, setNome] = useState('');
  const [emailCriar, setEmailCriar] = useState('');
  const [celular, setCelular] = useState('+55 ');
  const [senhaCriar, setSenhaCriar] = useState('');
  const [showSenhaCriar, setShowSenhaCriar] = useState(false);

  // Login fields
  const [emailEntrar, setEmailEntrar] = useState('');
  const [senhaEntrar, setSenhaEntrar] = useState('');
  const [showSenhaEntrar, setShowSenhaEntrar] = useState(false);

  // Clear errors when switching tabs
  useEffect(() => {
    limparErro();
  }, [tab, limparErro]);

  // ─── Signup handler ──────────────────────────────────────
  const handleCadastro = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      limparErro();

      const celularDigits = extractDigits(celular);

      if (!nome.trim()) return;
      if (!emailCriar.trim()) return;
      if (celularDigits.length < 12) return;
      if (senhaCriar.length < 6) return;

      try {
        await cadastro({
          nome: nome.trim(),
          email: emailCriar.trim().toLowerCase(),
          celular: celularDigits,
          senha: senhaCriar,
        });

        router.push(
          `/verificacao?celular=${encodeURIComponent(celularDigits)}`
        );
      } catch {
        // Error is set in the store
      }
    },
    [nome, emailCriar, celular, senhaCriar, cadastro, limparErro, router]
  );

  // ─── Login handler ──────────────────────────────────────
  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      limparErro();

      if (!emailEntrar.trim()) return;
      if (!senhaEntrar.trim()) return;

      try {
        await login(emailEntrar.trim().toLowerCase(), senhaEntrar);
        router.push('/perfil');
      } catch {
        // Error is set in the store
      }
    },
    [emailEntrar, senhaEntrar, login, limparErro, router]
  );

  // ─── Phone change handler ───────────────────────────────
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const digits = extractDigits(raw);

    // Always keep +55 prefix
    if (digits.length < 2) {
      setCelular('+55 ');
      return;
    }

    setCelular(formatPhone(digits));
  };

  return (
    <div className="flex min-h-screen flex-col bg-vitae-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8">
        {/* Header */}
        <motion.div
          className="mb-8 text-center"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h1 className="font-serif text-3xl font-bold text-white">VITAE</h1>
          <p className="mt-1 text-sm text-vitae-text-secondary">
            Know Your Biology
          </p>
        </motion.div>

        {/* Tab switcher */}
        <motion.div
          className="mb-6 flex rounded-btn bg-vitae-card p-1"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {(['criar', 'entrar'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex-1 rounded-[10px] py-3 text-sm font-semibold transition-colors ${
                tab === t ? 'text-black' : 'text-vitae-text-secondary'
              }`}
            >
              {tab === t && (
                <motion.div
                  className="absolute inset-0 rounded-[10px] bg-vitae-gold"
                  layoutId="tab-indicator"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10">
                {t === 'criar' ? 'Criar conta' : 'Entrar'}
              </span>
            </button>
          ))}
        </motion.div>

        {/* Error message */}
        <AnimatePresence>
          {erro && (
            <motion.div
              className="mb-4 rounded-btn border border-vitae-red/30 bg-vitae-red/10 px-4 py-3 text-center text-sm text-vitae-red"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              {erro}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Forms */}
        <AnimatePresence mode="wait">
          {tab === 'criar' ? (
            <motion.form
              key="criar"
              onSubmit={handleCadastro}
              className="flex flex-1 flex-col"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="space-y-4">
                {/* Nome */}
                <div>
                  <label className="vitae-label" htmlFor="nome">
                    Nome completo
                  </label>
                  <input
                    id="nome"
                    type="text"
                    className="vitae-input"
                    placeholder="Seu nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    autoComplete="name"
                    required
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="vitae-label" htmlFor="email-criar">
                    Email
                  </label>
                  <input
                    id="email-criar"
                    type="email"
                    className="vitae-input"
                    placeholder="seu@email.com"
                    value={emailCriar}
                    onChange={(e) => setEmailCriar(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                {/* Celular */}
                <div>
                  <label className="vitae-label" htmlFor="celular">
                    Celular
                  </label>
                  <input
                    id="celular"
                    type="tel"
                    className="vitae-input"
                    placeholder="+55 (11) 99999-9999"
                    value={celular}
                    onChange={handlePhoneChange}
                    autoComplete="tel"
                    required
                  />
                </div>

                {/* Senha */}
                <div>
                  <label className="vitae-label" htmlFor="senha-criar">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="senha-criar"
                      type={showSenhaCriar ? 'text' : 'password'}
                      className="vitae-input pr-12"
                      placeholder="Minimo 6 caracteres"
                      value={senhaCriar}
                      onChange={(e) => setSenhaCriar(e.target.value)}
                      autoComplete="new-password"
                      minLength={6}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhaCriar(!showSenhaCriar)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-vitae-text-muted transition-colors hover:text-white"
                      aria-label={showSenhaCriar ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showSenhaCriar ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                  {senhaCriar.length > 0 && senhaCriar.length < 6 && (
                    <p className="mt-1.5 text-xs text-vitae-text-muted">
                      A senha deve ter pelo menos 6 caracteres
                    </p>
                  )}
                </div>
              </div>

              {/* Signup button */}
              <div className="mt-8">
                <motion.button
                  type="submit"
                  className="vitae-btn-primary disabled:opacity-50"
                  disabled={carregando}
                  whileTap={{ scale: 0.97 }}
                >
                  {carregando ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
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
                      Criando conta...
                    </span>
                  ) : (
                    'Criar conta'
                  )}
                </motion.button>
              </div>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-vitae-border" />
                <span className="text-xs text-vitae-text-muted">ou</span>
                <div className="h-px flex-1 bg-vitae-border" />
              </div>

              {/* Social login */}
              <div className="space-y-3">
                <button
                  type="button"
                  className="vitae-btn-secondary flex items-center justify-center gap-3"
                  onClick={() => {
                    /* TODO: Google login */
                  }}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continuar com Google
                </button>

                <button
                  type="button"
                  className="vitae-btn-secondary flex items-center justify-center gap-3"
                  onClick={() => {
                    /* TODO: Apple login */
                  }}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  Continuar com Apple
                </button>
              </div>
            </motion.form>
          ) : (
            <motion.form
              key="entrar"
              onSubmit={handleLogin}
              className="flex flex-1 flex-col"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label className="vitae-label" htmlFor="email-entrar">
                    Email
                  </label>
                  <input
                    id="email-entrar"
                    type="email"
                    className="vitae-input"
                    placeholder="seu@email.com"
                    value={emailEntrar}
                    onChange={(e) => setEmailEntrar(e.target.value)}
                    autoComplete="email"
                    required
                  />
                </div>

                {/* Senha */}
                <div>
                  <label className="vitae-label" htmlFor="senha-entrar">
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="senha-entrar"
                      type={showSenhaEntrar ? 'text' : 'password'}
                      className="vitae-input pr-12"
                      placeholder="Sua senha"
                      value={senhaEntrar}
                      onChange={(e) => setSenhaEntrar(e.target.value)}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowSenhaEntrar(!showSenhaEntrar)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-vitae-text-muted transition-colors hover:text-white"
                      aria-label={showSenhaEntrar ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showSenhaEntrar ? (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12c1.292 4.338 5.31 7.5 10.066 7.5.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                          />
                        </svg>
                      ) : (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={1.5}
                          stroke="currentColor"
                          className="h-5 w-5"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Forgot password */}
              <button
                type="button"
                className="mt-3 self-end text-sm font-medium text-vitae-gold transition-opacity hover:opacity-80"
                onClick={() => {
                  /* TODO: navigate to forgot password flow */
                }}
              >
                Esqueci minha senha
              </button>

              {/* Login button */}
              <div className="mt-8">
                <motion.button
                  type="submit"
                  className="vitae-btn-primary disabled:opacity-50"
                  disabled={carregando}
                  whileTap={{ scale: 0.97 }}
                >
                  {carregando ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
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
                      Entrando...
                    </span>
                  ) : (
                    'Entrar'
                  )}
                </motion.button>
              </div>

              {/* Divider */}
              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-vitae-border" />
                <span className="text-xs text-vitae-text-muted">ou</span>
                <div className="h-px flex-1 bg-vitae-border" />
              </div>

              {/* Social login */}
              <div className="space-y-3">
                <button
                  type="button"
                  className="vitae-btn-secondary flex items-center justify-center gap-3"
                  onClick={() => {
                    /* TODO: Google login */
                  }}
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                      fill="#4285F4"
                    />
                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </svg>
                  Continuar com Google
                </button>

                <button
                  type="button"
                  className="vitae-btn-secondary flex items-center justify-center gap-3"
                  onClick={() => {
                    /* TODO: Apple login */
                  }}
                >
                  <svg
                    className="h-5 w-5"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                  </svg>
                  Continuar com Apple
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
