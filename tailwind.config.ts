import type { Config } from 'tailwindcss';
import forms from '@tailwindcss/forms';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'nhome-primary': '#2563EB',
        'nhome-secondary': '#0891B2',
        'nhome-accent': '#F59E0B',
        'nhome-success': '#10B981',
        'nhome-warning': '#F59E0B',
        'nhome-error': '#EF4444',
        'nhome-background': '#F9FAFB',
        'nhome-foreground': '#111827',
      },
      fontFamily: {
        nhome: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [forms],
};

export default config;
