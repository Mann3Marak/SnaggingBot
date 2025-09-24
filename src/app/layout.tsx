import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

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
      { url: '/icons/nhome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/nhome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: ['/icons/apple-touch-icon.png'],
    shortcut: ['/icons/nhome-192x192.png'],
    other: [{ rel: 'mask-icon', url: '/icons/nhome-192x192.png', color: '#2563EB' }],
  },
};

export const viewport: Viewport = {
  themeColor: '#2563EB',
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
      <body className={bodyClass}>{children}</body>
    </html>
  );
}
