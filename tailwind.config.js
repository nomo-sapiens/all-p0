/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          primary: "#0d1117",
          secondary: "#161b22",
          tertiary: "#21262d",
        },
        border: {
          DEFAULT: "#30363d",
          muted: "#21262d",
        },
        fg: {
          primary: "#e6edf3",
          secondary: "#8b949e",
          muted: "#6e7681",
        },
        accent: {
          DEFAULT: "#6366f1",
          hover: "#4f46e5",
          muted: "#1e1b4b",
          text: "#a5b4fc",
        },
        success: "#3fb950",
        danger: "#f85149",
        warning: "#d29922",
      },
    },
  },
  plugins: [],
};
