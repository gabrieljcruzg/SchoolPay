import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paleta SchoolPay
        sp: {
          bg:     '#0b1120',
          bg2:    '#111827',
          bg3:    '#1f2937',
          bg4:    '#374151',
          gold:   '#e8b84b',
          gold2:  '#f5d07a',
          gold3:  '#c49728',
          accent: '#4fc3f7',
          green:  '#4caf82',
          red:    '#ef5350',
          purple: '#ab82f5',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'monospace'],
      },
      animation: {
        'slide-up': 'slideUp 0.2s ease',
        'fade-in':  'fadeIn 0.2s ease',
        'shake':    'shake 0.3s ease',
        'pop':      'pop 0.2s ease',
      },
      keyframes: {
        slideUp: {
          'from': { opacity: '0', transform: 'translateY(8px)' },
          'to':   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          'from': { opacity: '0' },
          'to':   { opacity: '1' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-6px)' },
          '40%,80%': { transform: 'translateX(6px)' },
        },
        pop: {
          'from': { opacity: '0', transform: 'translate(-50%, 12px)' },
          'to':   { opacity: '1', transform: 'translate(-50%, 0)' },
        },
      },
    },
  },
  plugins: [],
}

export default config
