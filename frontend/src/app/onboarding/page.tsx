'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

interface Slide {
  emoji: string;
  title: string;
  subtitle: string;
}

const slides: Slide[] = [
  {
    emoji: '🧬',
    title: 'Seus exames, decodificados',
    subtitle:
      'Nossa IA analisa seus exames de sangue e transforma numeros confusos em insights claros sobre sua saude.',
  },
  {
    emoji: '💯',
    title: 'Sua saude em um numero',
    subtitle:
      'Receba um score unico de saude de 0 a 100, calculado a partir dos seus biomarcadores reais.',
  },
  {
    emoji: '🎯',
    title: 'Melhorias personalizadas',
    subtitle:
      'Recomendacoes de alimentacao, suplementos e habitos feitas sob medida para o seu corpo.',
  },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [direction, setDirection] = useState(0);

  const isLastSlide = currentSlide === slides.length - 1;

  const goToSlide = useCallback(
    (index: number) => {
      if (index < 0 || index >= slides.length) return;
      setDirection(index > currentSlide ? 1 : -1);
      setCurrentSlide(index);
    },
    [currentSlide]
  );

  const nextSlide = useCallback(() => {
    if (isLastSlide) {
      router.push('/cadastro');
    } else {
      goToSlide(currentSlide + 1);
    }
  }, [currentSlide, isLastSlide, goToSlide, router]);

  const handleSkip = useCallback(() => {
    router.push('/cadastro');
  }, [router]);

  // Swipe detection
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;

    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    const threshold = 50;

    if (diff > threshold && currentSlide < slides.length - 1) {
      goToSlide(currentSlide + 1);
    } else if (diff < -threshold && currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }

    setTouchStart(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-vitae-bg">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-8">
        {/* Skip button */}
        {!isLastSlide && (
          <motion.button
            className="self-end text-sm font-medium text-vitae-text-secondary transition-colors hover:text-white"
            onClick={handleSkip}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            Pular
          </motion.button>
        )}
        {/* Spacer to keep layout consistent when skip button hidden */}
        {isLastSlide && <div className="h-5" />}

        {/* Slide content */}
        <div
          className="relative flex flex-1 items-center justify-center overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentSlide}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.25 },
              }}
              className="flex w-full flex-col items-center text-center"
            >
              {/* Emoji icon */}
              <motion.div
                className="mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-vitae-card-light"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.15, duration: 0.4, ease: 'easeOut' }}
              >
                <span className="text-6xl">{slides[currentSlide].emoji}</span>
              </motion.div>

              {/* Title */}
              <motion.h2
                className="mb-4 font-serif text-3xl font-bold leading-tight text-white"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.4 }}
              >
                {slides[currentSlide].title}
              </motion.h2>

              {/* Subtitle */}
              <motion.p
                className="max-w-xs text-base leading-relaxed text-vitae-text-secondary"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.4 }}
              >
                {slides[currentSlide].subtitle}
              </motion.p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Bottom section: dots + action button */}
        <div className="flex flex-col items-center gap-8 pb-4">
          {/* Dot indicators */}
          <div className="flex items-center gap-2.5">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                aria-label={`Ir para slide ${index + 1}`}
                className="p-1"
              >
                <motion.div
                  className="rounded-full"
                  animate={{
                    width: index === currentSlide ? 24 : 8,
                    height: 8,
                    backgroundColor:
                      index === currentSlide ? '#C5A55A' : '#333333',
                  }}
                  transition={{ duration: 0.3, ease: 'easeInOut' }}
                />
              </button>
            ))}
          </div>

          {/* Action buttons */}
          {isLastSlide ? (
            <motion.button
              className="vitae-btn-primary"
              onClick={nextSlide}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.97 }}
            >
              Comecar
            </motion.button>
          ) : (
            <motion.button
              className="vitae-btn-secondary"
              onClick={nextSlide}
              whileTap={{ scale: 0.97 }}
            >
              Proximo
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
}
