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
        'nhome-primary': 'var(--nhome-primary)',
        'nhome-primary-light': 'var(--nhome-primary-light)',
        'nhome-primary-dark': 'var(--nhome-primary-dark)',
        'nhome-secondary': 'var(--nhome-secondary)',
        'nhome-accent': 'var(--nhome-accent)',
        'nhome-success': 'var(--nhome-success)',
        'nhome-warning': 'var(--nhome-warning)',
        'nhome-error': 'var(--nhome-error)',
        'nhome-background': 'var(--nhome-background)',
        'nhome-foreground': 'var(--nhome-foreground)',
      },
      fontFamily: {
        nhome: ['var(--font-inter)', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [forms],
};

export default config;

