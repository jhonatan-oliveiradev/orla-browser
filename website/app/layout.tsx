import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import './globals.css';

const manrope = localFont({
  src: './manrope.woff2',
  weight: '400 800',
  display: 'swap',
  variable: '--font-manrope',
});

export const metadata: Metadata = {
  title: 'Orla Browser — Sua web tem espaço',
  description: 'Um navegador para Windows que reúne abas, sessões e referências em espaços de trabalho. Explore a demonstração e baixe a prévia.',
  openGraph: {
    title: 'Orla Browser — Sua web tem espaço',
    description: 'Organize abas, sessões e referências em espaços de trabalho. Experimente o Orla para Windows.',
    type: 'website',
    locale: 'pt_BR',
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR" className={manrope.variable}><body>{children}</body></html>;
}
