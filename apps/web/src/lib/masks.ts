/** Máscaras de digitação (apenas visual; o servidor normaliza e valida). */
const digits = (v: string, max: number) => v.replace(/\D/g, "").slice(0, max);

export const maskCpfInput = (v: string) =>
  digits(v, 11).replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
export const maskPhone = (v: string) => {
  const d = digits(v, 11);
  return d.length <= 10
    ? d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2")
    : d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
};
export const maskCep = (v: string) => digits(v, 8).replace(/(\d{5})(\d)/, "$1-$2");
export const maskCnh = (v: string) => digits(v, 11);
