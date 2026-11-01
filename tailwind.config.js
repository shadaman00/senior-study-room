/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // 흰 배경 기준 명도 대비 7:1 이상이 되도록 고른 색
        ink: '#111111',
        brand: { DEFAULT: '#0B3D91', dark: '#072A66' },
        done: { bg: '#DCF5DF', text: '#0A4D16', border: '#1E7B34' },
        danger: '#8A1010',
      },
      fontFamily: {
        sans: ['"Pretendard"', '"Noto Sans KR"', '"Malgun Gothic"', 'sans-serif'],
      },
      minHeight: { touch: '48px' },
      minWidth: { touch: '48px' },
    },
  },
  plugins: [],
}
