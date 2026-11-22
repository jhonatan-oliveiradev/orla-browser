import type { Metadata } from 'next';
import localFont from 'next/font/local';
import type { ReactNode } from 'react';
import './globals.css';
import './site-v2.css';

const manrope = localFont({
  src: './manrope.woff2',
  weight: '400 800',
  display: 'swap',
  variable: '--font-manrope',
});

const title = 'Orla Browser — Você não trabalha em abas. Trabalha em projetos.';
const description = 'Orla é um navegador para Windows que organiza abas, capturas e sessões por espaço de trabalho. Conheça a demonstração e baixe a prévia para Windows x64.';

export const metadata: Metadata = {
  metadataBase: new URL('https://orla-browser.vercel.app'),
  title,
  description,
  applicationName: 'Orla Browser',
  alternates: { canonical: '/' },
  openGraph: {
    title,
    description,
    type: 'website',
    locale: 'pt_BR',
    siteName: 'Orla Browser',
    url: '/',
  },
  twitter: {
    card: 'summary',
    title,
    description,
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="pt-BR" className={manrope.variable}><body>{children}</body></html>;
}
