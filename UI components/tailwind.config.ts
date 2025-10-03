import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      typography: ({ theme }: { theme: any }) => ({ // Added type for theme
        lg: { // This targets .prose-lg, which we use on the article page
          css: {
            color: theme('colors.gray.700'), // Default text color
            h1: {
              fontSize: theme('fontSize.4xl'), // Adjust as needed, e.g., 4xl (36px), 5xl (48px)
              fontWeight: '700',
              color: theme('colors.gray.900'),
              textAlign: 'left',
              marginTop: theme('spacing.8'),
              marginBottom: theme('spacing.8'),
              borderBottom: 'none',
              paddingBottom: '0',
            },
            h2: { // For chapter titles
              fontSize: theme('fontSize.2xl'), // Approx 24px
              fontWeight: '700',
              color: theme('colors.gray.900'),
              textAlign: 'left',
              marginTop: theme('spacing.16'),
              marginBottom: theme('spacing.4'),
              borderBottom: 'none',
            },
            h3: {
              fontSize: theme('fontSize.xl'), // Approx 20px
              fontWeight: '700',
              color: theme('colors.gray.800'),
              textAlign: 'left',
              marginTop: theme('spacing.12'),
              marginBottom: theme('spacing.3'),
            },
            p: {
              marginTop: theme('spacing.4'),
              marginBottom: theme('spacing.4'),
              lineHeight: '1.75',
            },
            a: {
              color: theme('colors.red.600'), // Example reddish color
              textDecoration: 'underline',
              fontWeight: '500',
              '&:hover': {
                color: theme('colors.red.700'),
              },
            },
            img: {
              marginTop: theme('spacing.8'),
              marginBottom: theme('spacing.8'),
              borderRadius: '0px',
              border: 'none',
              boxShadow: 'none',
            },
            '.featured-image > img': { // Target img directly inside .featured-image
               marginBottom: theme('spacing.6'),
            },
            // Specific styling for Table of Contents elements if they are within .prose
            '.table-of-contents > h2': { 
              fontSize: theme('fontSize.lg'), // Smaller "Index" title
              marginTop: '0',
              marginBottom: theme('spacing.4'),
              borderBottom: `1px solid ${theme('colors.gray.300')}`,
              paddingBottom: theme('spacing.2'),
              color: theme('colors.gray.800'),
              textAlign: 'left',
            },
            '.table-of-contents ul': {
              listStyleType: 'none',
              paddingLeft: '0',
              marginTop: theme('spacing.2'),
            },
            '.table-of-contents li': {
              paddingTop: theme('spacing.1'),
              paddingBottom: theme('spacing.1'),
            },
            '.table-of-contents li a': {
              color: theme('colors.red.600'), // Match link color
              textDecoration: 'none',
              fontWeight: '500',
              '&:hover': {
                color: theme('colors.red.700'),
                textDecoration: 'underline',
              },
            },
            blockquote: {
              fontWeight: '500',
              fontStyle: 'italic',
              color: theme('colors.gray.700'),
              borderLeftWidth: '0.25rem',
              borderLeftColor: theme('colors.gray.300'),
              quotes: '"\\201C""\\201D""\\2018""\\2019"',
              marginTop: theme('spacing.6'),
              marginBottom: theme('spacing.6'),
              paddingLeft: theme('spacing.4'),
            },
          },
        },
      }),
    },
  },
  plugins: [
    typography,
  ],
  variants: {
    extend: {
      scrollbar: ['rounded']
    }
  }
} satisfies Config;
