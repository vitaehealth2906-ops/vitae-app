'use client';

import Link from 'next/link';

type Tab = 'home' | 'exames' | 'perfil';

interface TabBarProps {
  activeTab: Tab;
}

const tabs: { key: Tab; label: string; href: string; icon: (active: boolean) => React.ReactNode }[] = [
  {
    key: 'home',
    label: 'Home',
    href: '/',
    icon: (active) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? '#C5A55A' : '#555'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
        <path d="M9 21V12h6v9" />
      </svg>
    ),
  },
  {
    key: 'exames',
    label: 'Exames',
    href: '/exames',
    icon: (active) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? '#C5A55A' : '#555'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M16 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8l-5-5z" />
        <path d="M16 3v5h5" />
        <path d="M8 13h8" />
        <path d="M8 17h8" />
        <path d="M8 9h2" />
      </svg>
    ),
  },
  {
    key: 'perfil',
    label: 'Perfil',
    href: '/dados-pessoais',
    icon: (active) => (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke={active ? '#C5A55A' : '#555'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="8" r="4" />
        <path d="M20 21c0-3.866-3.582-7-8-7s-8 3.134-8 7" />
      </svg>
    ),
  },
];

export default function TabBar({ activeTab }: TabBarProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 h-20 bg-black/80 backdrop-blur-lg border-t border-white/5 pb-6">
      <div className="max-w-md mx-auto flex items-center justify-around h-full px-4">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <Link
              key={tab.key}
              href={tab.href}
              className="flex flex-col items-center gap-1 min-w-[64px]"
            >
              {tab.icon(isActive)}
              <span
                className="text-xs font-medium transition-colors"
                style={{ color: isActive ? '#C5A55A' : '#555' }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
