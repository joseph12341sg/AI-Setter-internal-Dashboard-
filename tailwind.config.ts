import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0E1116",
        card: "#161B22",
        "card-hover": "#1C2128",
        accent: "#5B7C99",
        "accent-hover": "#6E8FAC",
        text: "#F2F4F8",
        muted: "#A1A8B3",
        border: "#2D333B",
        success: "#3FB950",
        warning: "#D29922",
        danger: "#F85149",
      },
      fontFamily: {
        heading: ["Montserrat", "sans-serif"],
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
