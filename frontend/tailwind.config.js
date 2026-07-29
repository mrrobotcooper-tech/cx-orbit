/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#0c1b2a',
          soft: '#243447',
          mute: '#5a6d7e',
        },
        paper: {
          DEFAULT: '#eef3f6',
          raised: '#f7fafc',
        },
        teal: {
          DEFAULT: '#0d7377',
          deep: '#095456',
          mist: '#c5e4e5',
        },
        signal: {
          DEFAULT: '#d97706',
          soft: '#fef3c7',
        },
        danger: {
          DEFAULT: '#c23b22',
          soft: '#fde8e4',
        },
        ok: {
          DEFAULT: '#2a9d6e',
          soft: '#e3f6ee',
        },
      },
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        sans: ['"Figtree"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 0 rgba(12, 27, 42, 0.06), 0 12px 32px rgba(12, 27, 42, 0.06)',
      },
      keyframes: {
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.45', transform: 'scale(0.85)' },
        },
        sweep: {
          from: { backgroundPosition: '0% 50%' },
          to: { backgroundPosition: '100% 50%' },
        },
      },
      animation: {
        rise: 'rise 0.45s ease-out both',
        'pulse-dot': 'pulseDot 1.6s ease-in-out infinite',
        sweep: 'sweep 8s ease infinite',
      },
    },
  },
  plugins: [],
};
