const Color = require('color')
const { fontFamily } = require('tailwindcss/defaultTheme')
const colors = require('tailwindcss/colors')

const alpha = (clr, val) => Color(clr).alpha(val).rgb().string()
const lighten = (clr, val) => Color(clr).lighten(val).rgb().string()
const darken = (clr, val) => Color(clr).darken(val).rgb().string()
const fade = (clr, val) => Color(clr).fade(val).rgb().string()

module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: false, // or 'media' or 'class'
  theme: {
    extend: {
      borderWidth: {
        1.5: '1.5px',
      },
      borderRadius: {
        sm: '0.25rem',
      },
      fontFamily: {
        main: ['Gilroy', ...fontFamily.sans],
        body: ['InterBody', ...fontFamily.sans],
      },
      minHeight: {
        32: '8rem',
        48: '12rem',
      },
      colors: {
        inherit: 'inherit',
        cyan: colors.cyan,
        brand: {
          DEFAULT: '#16A34A',
          lighter: lighten('#16A34A', 0.05),
          dark: darken('#16A34A', 0.05),
          darker: darken('#16A34A', 0.1),
          grey: '#3F3F46',
          75: alpha('#16A34A', 0.75),
          10: alpha('#16A34A', 0.1),
        },
        'brand-alt': {
          DEFAULT: '#51A3EA',
          lighter: lighten('#51A3EA', 0.05),
          darker: darken('#51A3EA', 0.05),
          75: alpha('#51A3EA', 0.75),
        },
        background: '#FFFFFF',
        'background-alt': '#FAFAFA',
        grey: {
          DEFAULT: '#1f1f1f',
          lighter: lighten('#1f1f1f', 0.5),
          darker: darken('#1f1f1f', 0.05),
          75: alpha('#1f1f1f', 0.75),
          400: '#23272A',
          500: '#27272A',
          900: '#18181B',
        },
        'incredible-green': {
          500: '#15803D',
          600: '#16A34A',
        },
        'incredible-green-light': {
          600: 'rgb(22 163 74 / 10%)',
        },
        'incredible-purple': {
          600: '#7C3AED',
        },
        'incredible-purple-light': {
          600: 'rgb(124 58 237 / 10%)',
        },
        'incredible-blue': {
          600: '#0891B2',
        },
        'incredible-blue-light': {
          600: 'rgb(8 145 178 / 10%)',
        },
        light: {
          DEFAULT: '#fafafa',
        },
        dark: {
          DEFAULT: '#000000',
          title: '#929397',
          100: '#383b40',
          200: '#2e2f34',
          300: '#28292d',
          400: '#1f2024',
          500: '#121212',
          600: '#D4D4D8',
          700: '#c5c5c5',
        },
        orange: {
          DEFAULT: '#FFEDD5',
          lighter: lighten('#FFEDD5', 0.5),
          darker: '#C2410C',
        },
        success: { DEFAULT: '#137547', 10: `rgba(19,117,71, 0.1)` },
        warning: '#ED7D3A',
        error: {
          DEFAULT: '#EF2D56',
          10: `rgba(239,45,86, 0.1)`,
        },
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
      },
      cursor: {
        'zoom-in': 'zoom-in',
        'zoom-out': 'zoom-out',
      },
    },
  },
  variants: {
    opacity: ({ after }) => after(['disabled']),
    cursor: ({ after }) => after(['disabled']),
    extend: {
      border: ['hover', 'group-hover'],
      borderWidth: ['hover', 'group-hover'],
      backgroundColor: ['active'],
      borderColor: ['active', 'important'],
      transform: ['group-hover'],
      translate: ['group-hover'],
      margin: ['last'],
      display: ['hover', 'group-hover'],
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
    require('@tailwindcss/forms'),
    require('tailwindcss-important')(),
    require('@tailwindcss/aspect-ratio'),
  ],
}
