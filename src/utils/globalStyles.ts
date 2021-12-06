import { css } from '@emotion/css'

interface Gradient {
  style: string
  type: 'light' | 'dark'
}

const gradientList: Gradient[] = [
  {
    style: css`
      background: #2980b9;
      background: -webkit-linear-gradient(to right, #8ee1ff, #6dd5fa, #2980b9);
      background: linear-gradient(to right, #8ee1ff, #6dd5fa, #2980b9);
    `,
    type: 'dark',
  },
  {
    style: css`
      background: #c6ffdd;
      background: -webkit-linear-gradient(to right, #f7797d, #fbd786, #9dffc5);
      background: linear-gradient(to right, #f7797d, #fbd786, #9dffc5);
    `,
    type: 'dark',
  },
  {
    style: css`
      background: #7f7fd5;
      background: -webkit-linear-gradient(to right, #91eae4, #86a8e7, #7f7fd5);
      background: linear-gradient(to right, #91eae4, #86a8e7, #7f7fd5);
    `,
    type: 'dark',
  },
  {
    style: css`
      background: #4158d0;
      background: -webkit-linear-gradient(
        43deg,
        #4158d0 0%,
        #c850c0 46%,
        #ffcc70 100%
      );
      background: linear-gradient(43deg, #4158d0 0%, #c850c0 46%, #ffcc70 100%);
    `,
    type: 'dark',
  },
  {
    style: css`
      background: #85ffbd;
      background: -webkit-linear-gradient(45deg, #85ffbd 0%, #fffb7d 100%);
      background: linear-gradient(45deg, #85ffbd 0%, #fffb7d 100%);
    `,
    type: 'light',
  },
]

export const getRandomGradient = (): Gradient =>
  gradientList[Math.floor(Math.random() * gradientList.length)]

export const verticalCustomScrollBar = css`
  ::-webkit-scrollbar {
    width: 0.35rem;
    padding: 0.5rem 0;
  }
  ::-webkit-scrollbar-thumb {
    width: 0.35rem;
    background-color: #9ca3af;
    border-radius: 1rem;
  }
`

export const horizontalCustomScrollBar = css`
  ::-webkit-scrollbar {
    height: 0.25rem;
    padding: 0.5rem 0;
  }
  ::-webkit-scrollbar-thumb {
    height: 0.25rem;
    background-color: #4d4d4d;
    border-radius: 1rem;
  }
`

/**
 * TODO:
 * 1. Add more gradients from https://uigradients.com/
 * 2. Add more generic global styles
 */
