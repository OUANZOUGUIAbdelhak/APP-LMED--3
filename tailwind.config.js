/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1380F5',
          dark: '#0F62A6',
        },
        sidebar: {
          light: '#F6F8FB',
          dark: '#1E1E1E',
        },
        toolbar: {
          light: '#FAFBFD',
          dark: '#2D2D2D',
        },
        border: {
          light: '#E6E9EE',
          dark: '#3D3D3D',
        },
        editor: {
          light: '#FFFFFF',
          dark: '#252525',
        },
        chat: {
          user: {
            light: '#E6F0FF',
            dark: '#1A3A5C',
          },
          assistant: {
            light: '#F3F4F6',
            dark: '#2D2D2D',
          }
        },
        text: {
          primary: {
            light: '#111827',
            dark: '#E5E7EB',
          },
          muted: {
            light: '#6B7280',
            dark: '#9CA3AF',
          }
        }
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'Roboto', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        base: '14px',
      },
      spacing: {
        'toolbar': '56px',
        'bottombar': '36px',
      }
    },
  },
  plugins: [],
}

