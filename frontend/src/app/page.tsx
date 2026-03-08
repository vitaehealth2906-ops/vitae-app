'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { getToken } from '@/lib/auth';

export default function SplashPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const timer = setTimeout(() => {
      const token = getToken();
      if (token) {
        router.replace('/perfil');
      } else {
        router.replace('/onboarding');
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [mounted, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-vitae-bg">
      <div className="mx-auto flex max-w-md flex-col items-center px-6">
        {/* Background glow */}
        <motion.div
          className="pointer-events-none absolute h-64 w-64 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(197,165,90,0.12) 0%, transparent 70%)',
          }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1.2 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
        />

        {/* Logo */}
        <motion.h1
          className="relative font-serif text-6xl font-bold tracking-wider text-white"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        >
          VITAE
        </motion.h1>

        {/* Tagline */}
        <motion.p
          className="relative mt-4 font-serif text-lg tracking-widest text-vitae-gold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
        >
          Know Your Biology
        </motion.p>

        {/* Subtle loading indicator */}
        <motion.div
          className="mt-12 h-0.5 w-16 overflow-hidden rounded-full bg-vitae-border"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <motion.div
            className="h-full rounded-full bg-vitae-gold"
            initial={{ x: '-100%' }}
            animate={{ x: '100%' }}
            transition={{
              duration: 1,
              delay: 0.8,
              ease: 'easeInOut',
              repeat: Infinity,
              repeatType: 'loop',
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
