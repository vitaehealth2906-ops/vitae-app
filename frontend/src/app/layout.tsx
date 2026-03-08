import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'VITAE — Know Your Biology',
  description:
    'Plataforma inteligente de saude pessoal. Seus exames decodificados por IA, score de saude unificado e melhorias personalizadas.',
  keywords: ['saude', 'exames', 'IA', 'score de saude', 'VITAE'],
  authors: [{ name: 'VITAE Health' }],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0A0A0A',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="bg-vitae-bg min-h-screen font-sans text-white antialiased">
        <main className="relative min-h-screen">{children}</main>
      </body>
    </html>
  );
}
