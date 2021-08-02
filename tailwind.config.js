module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        inherit: 'inherit',
        brand: '#5156EA',
        'brand-alt': '#51A3EA',
        'brand-background': '#FFFFFF',
        'brand-background-alt': '#FBFCFF',
        'brand-success': '#42E735',
        'brand-warning': '#F2EC24',
        'brand-error': '#F22424',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
