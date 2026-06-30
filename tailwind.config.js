/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ── Core Navy (Primary) ──
        "primary":                    "#0d1b3e",
        "primary-container":          "#162244",
        "primary-fixed":              "#dce8ff",
        "primary-fixed-dim":          "#a8c4f0",
        "inverse-primary":            "#a8c4f0",
        "on-primary":                 "#ffffff",
        "on-primary-container":       "#c0d8ff",
        "on-primary-fixed":           "#001c3b",
        "on-primary-fixed-variant":   "#1e2e58",

        // ── Green (Secondary) ──
        "secondary":                  "#1b6b35",
        "secondary-container":        "#2ea043",
        "secondary-fixed":            "#c8f0d4",
        "secondary-fixed-dim":        "#2ea043",
        "on-secondary":               "#ffffff",
        "on-secondary-container":     "#0d2a1a",
        "on-secondary-fixed":         "#0d1b0f",
        "on-secondary-fixed-variant": "#135228",

        // ── Tertiary (teal — unchanged) ──
        "tertiary":                   "#293e47",
        "tertiary-container":         "#40555f",
        "tertiary-fixed":             "#cfe6f2",
        "tertiary-fixed-dim":         "#b4cad6",
        "on-tertiary":                "#ffffff",
        "on-tertiary-container":      "#b3c9d5",
        "on-tertiary-fixed":          "#071e27",
        "on-tertiary-fixed-variant":  "#354a53",

        // ── Surface / Background ──
        "background":                 "#f4f6f8",
        "surface":                    "#f4f6f8",
        "surface-bright":             "#ffffff",
        "surface-dim":                "#d7dadc",
        "surface-variant":            "#e0e3e5",
        "surface-container-lowest":   "#ffffff",
        "surface-container-low":      "#f1f4f6",
        "surface-container":          "#ebeef0",
        "surface-container-high":     "#e5e9eb",
        "surface-container-highest":  "#e0e3e5",
        "surface-tint":               "#1d5fa8",
        "inverse-surface":            "#2d3133",
        "inverse-on-surface":         "#eef1f3",

        // ── On-Surface ──
        "on-surface":                 "#181c1e",
        "on-surface-variant":         "#424751",
        "on-background":              "#181c1e",
        "outline":                    "#727782",
        "outline-variant":            "#c2c6d3",

        // ── Error ──
        "error":                      "#ba1a1a",
        "error-container":            "#ffdad6",
        "on-error":                   "#ffffff",
        "on-error-container":         "#93000a",

        // ── Semantic ──
        "success":                    "#16a34a",
        "warning":                    "#eab308",
      },
      borderRadius: {
        DEFAULT: "0.125rem",
        lg: "0.25rem",
        xl: "0.5rem",
        full: "0.75rem"
      },
      fontFamily: {
        headline: ["Inter", "sans-serif"],
        body:     ["Inter", "sans-serif"],
        label:    ["Space Grotesk", "Inter", "sans-serif"]
      }
    },
  },
  plugins: [],
}
