module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        inherit: 'inherit',
        brand: '#5156EA',
        'brand-alt': '#51A3EA',
        background: '#FFFFFF',
        'background-alt': '#FBFCFF',
        success: '#137547',
        warning: '#ED7D3A',
        error: '#EF2D56',
      },
    },
  },
  variants: {
    extend: {},
  },
  plugins: [],
}
