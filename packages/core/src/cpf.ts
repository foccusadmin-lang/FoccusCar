/** Validação de CPF (dígitos verificadores). Usada no servidor e no formulário. */
export function normalizeCpf(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = cpf.split("").map(Number);
  const check = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += digits[i]! * (len + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === digits[9] && check(10) === digits[10];
}

export function maskCpf(value: string): string {
  const cpf = normalizeCpf(value);
  return cpf.length === 11 ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : "***";
}
