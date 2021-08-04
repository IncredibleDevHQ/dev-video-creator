const Color = require('color')

const alpha = (clr, val) => Color(clr).alpha(val).rgb().string()
const lighten = (clr, val) => Color(clr).lighten(val).rgb().string()
const darken = (clr, val) => Color(clr).darken(val).rgb().string()

module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      colors: {
        inherit: 'inherit',
        brand: {
          DEFAULT: '#5156EA',
          lighter: lighten('#5156EA', 0.05),
          dark: darken('#5156EA', 0.05),
          darker: darken('#5156EA', 0.1),
          75: alpha('#5156EA', 0.75),
        },
        'brand-alt': {
          DEFAULT: '#51A3EA',
          lighter: lighten('#51A3EA', 0.05),
          darker: darken('#51A3EA', 0.05),
          75: alpha('#51A3EA', 0.75),
        },
        'brand-alt': '#51A3EA',
        background: '#FFFFFF',
        'background-alt': '#FBFCFF',
        success: '#137547',
        warning: '#ED7D3A',
        error: '#EF2D56',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  variants: {
    extend: {
      border: ['hover'],
      backgroundColor: ['active'],
      borderColor: ['active'],
      transform: ['group-hover'],
      translate: ['group-hover'],
    },
  },
  plugins: [],
}
