import typography from '@tailwindcss/typography';

export default {
  content: ['./apps/web/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Slightly bump up small font sizes for better readability
      fontSize: {
        xs: ['0.8125rem', { lineHeight: '1.25rem' }], // 13px (was 12px)
        sm: ['0.9375rem', { lineHeight: '1.375rem' }], // 15px (was 14px)
      },
      // Typography plugin customization for dark mode
      typography: {
        DEFAULT: {
          css: {
            '--tw-prose-body': 'rgb(229 229 229)', // neutral-200
            '--tw-prose-headings': 'rgb(250 250 250)', // neutral-50
            '--tw-prose-links': 'rgb(125 211 252)', // sky-300
            '--tw-prose-bold': 'rgb(250 250 250)',
            '--tw-prose-counters': 'rgb(163 163 163)', // neutral-400
            '--tw-prose-bullets': 'rgb(115 115 115)', // neutral-500
            '--tw-prose-hr': 'rgb(64 64 64)', // neutral-700
            '--tw-prose-quotes': 'rgb(212 212 212)', // neutral-300
            '--tw-prose-quote-borders': 'rgb(64 64 64)',
            '--tw-prose-captions': 'rgb(163 163 163)',
            '--tw-prose-code': 'rgb(250 250 250)',
            '--tw-prose-pre-code': 'rgb(229 229 229)',
            '--tw-prose-pre-bg': 'rgb(23 23 23)', // neutral-900
            '--tw-prose-th-borders': 'rgb(64 64 64)',
            '--tw-prose-td-borders': 'rgb(38 38 38)', // neutral-800
          },
        },
      },
    },
  },
  plugins: [typography],
};
