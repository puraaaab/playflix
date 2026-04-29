/** @type {import('tailwindcss').Config} */
export default {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}', './lib/**/*.{js,jsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.08), 0 24px 80px rgba(0,0,0,0.45)'
      },
      colors: {
        ink: '#0b0d12',
        panel: '#12151d',
        panelSoft: '#1a2030',
        accent: '#e50914',
        accentSoft: '#ff6b73',
        gold: '#ffffff',
        mint: '#ff6b73'
      },
      backgroundImage: {
        'radial-glow': 'radial-gradient(circle at top left, rgba(229,9,20,0.32), transparent 35%), radial-gradient(circle at top right, rgba(255,255,255,0.1), transparent 28%), linear-gradient(180deg, rgba(255,255,255,0.04), transparent 40%)'
      }
    }
  },
  plugins: []
};
