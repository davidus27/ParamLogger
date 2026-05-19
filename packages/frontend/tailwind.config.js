import caidoTailwindConfig from '@caido/tailwindcss';

/** @type {import('tailwindcss').Config} */
export default {
  ...caidoTailwindConfig,
  content: ['./src/**/*.{vue,js,ts,jsx,tsx}'],
  plugins: [
    ...(caidoTailwindConfig.plugins || []),
    require('tailwindcss-primeui'),
  ],
}