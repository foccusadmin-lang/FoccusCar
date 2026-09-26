/**
 * Tokens do Design System Foccus Car, derivados da logo:
 * preto profundo, grafite, dourado metálico (#F0B030 / #E09020 / #D08010 amostrados da logo),
 * prata do "CAR" e branco para contraste. O dourado é acento, nunca preenchimento de massa.
 */
export const palette = {
  black: { 950: "#050506", 900: "#0B0B0D", 850: "#111114", 800: "#17171B", 700: "#212127", 600: "#2C2C33", 500: "#3A3A43" },
  gold: {
    50: "#FFF8E6", 100: "#FDEDC2", 200: "#F9DC8A", 300: "#F4C95A", 400: "#F0B030",
    500: "#E09020", 600: "#C07410", 700: "#945609", 800: "#6A3D07", 900: "#3F2405",
  },
  silver: { 50: "#F7F7F8", 100: "#ECECEF", 200: "#D9D9DE", 300: "#BDBDC5", 400: "#9A9AA5", 500: "#767682", 600: "#5A5A65" },
  white: "#FFFFFF",
  offWhite: "#F4F2EE",
  success: { base: "#3FA56B", soft: "#173826" },
  warning: { base: "#E3A33B", soft: "#3A2A10" },
  danger: { base: "#D9534F", soft: "#3B1717" },
  info: { base: "#6E9BD1", soft: "#16263A" },
} as const;

export const breakpoints = { sm: 480, md: 768, lg: 1024, xl: 1280, xxl: 1536 } as const;
export const radii = { sm: 6, md: 10, lg: 16, xl: 24, pill: 999 } as const;
export const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80] as const;

/** Mapeia status de domínio para tom visual (sem depender só de cor: sempre com rótulo). */
export const statusTone = {
  AVAILABLE: "success", RESERVED: "info", RENTED: "gold", MAINTENANCE: "warning", INSPECTION: "warning",
  CLEANING: "info", BLOCKED: "danger", INACTIVE: "neutral",
} as const;
