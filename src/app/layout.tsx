import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { NHomeHeader } from '@/components/layout/NHomeHeader';
import { NHomeFooter } from '@/components/layout/NHomeFooter';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'NHome Inspection Pro',
  description:
    'Professional apartment inspection tool by NHome Property Management - Algarve, Portugal',
  applicationName: 'NHome Inspection Pro',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/NHome_Icon.ico', type: 'image/x-icon' },
      { url: '/icons/NHome_V4__Logo.png', type: 'image/png', sizes: '354x354' },
    ],
    apple: [{ url: '/icons/NHome_V4__Logo.png', sizes: '180x180', type: 'image/png' }],
    shortcut: ['/icons/NHome_Icon.ico'],
    other: [{ rel: 'mask-icon', url: '/icons/NHome_Icon.ico', color: '#bcae69' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#bcae69',
  colorScheme: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const bodyClass = [
    inter.variable,
    'flex min-h-screen flex-col bg-nhome-background text-nhome-foreground',
  ].join(' ');

  return (
    <html lang='en' className='bg-nhome-background'>
      <body className={bodyClass}>
        <NHomeHeader />
        <main className='flex-1'>
          {children}
        </main>
        <NHomeFooter />
      </body>
    </html>
  );
}

