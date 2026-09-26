/** Imagem ilustrativa (derivada da identidade da marca) enquanto o veículo não tem fotos reais. */
const COLORS: [RegExp, string][] = [
  [/grafite|chumbo/i, "grafite"], [/prata|cinza/i, "prata"], [/branc/i, "branco"], [/azul/i, "azul"],
  [/vermelh/i, "vermelho"], [/dourad|champanhe|bege/i, "dourado"], [/verde/i, "verde"], [/laranja/i, "laranja"],
  [/pret/i, "preto"],
];

export function vehicleImage(coverUrl: string | null, color?: string | null) {
  if (coverUrl) return coverUrl;
  const match = COLORS.find(([re]) => color && re.test(color));
  return `/brand/cars/${match?.[1] ?? "preto"}.webp`;
}
