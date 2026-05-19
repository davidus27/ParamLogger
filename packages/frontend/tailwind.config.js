/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-0': '#111827',
        'bg-1': '#1a2236',
        'bg-2': '#1f2a40',
        'bg-3': '#263350',
        'bg-hover': '#2a3a58',
        'bg-selected': '#1e3a5f',
        'bg-input': '#151d30',
        'border': '#283548',
        'border-focus': '#4a90d9',
        'text': '#d1d9e6',
        'text-dim': '#7a8ba5',
        'text-muted': '#4e5d75',
        'accent': '#4a90d9',
        'accent-bg': 'rgba(74,144,217,0.1)',
        'green': '#34d399',
        'orange': '#fb923c',
        'red': '#f87171',
        'purple': '#a78bfa',
        'yellow': '#fbbf24',
        'pink': '#f472b6',
        'cyan': '#22d3ee',
      }
    },
  },
  plugins: [],
}