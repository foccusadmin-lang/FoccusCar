import { z } from "zod";
import { isValidCpf, normalizeCpf } from "./cpf";

/** Schemas compartilhados entre formulário e API (a API sempre revalida). */
export const customerProfileSchema = z.object({
  fullName: z.string().trim().min(5, "Informe o nome completo."),
  cpf: z.string().transform(normalizeCpf).refine(isValidCpf, "CPF inválido."),
  birthDate: z.coerce.date().refine((d) => {
    const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000);
    return age >= 18 && age < 120;
  }, "É preciso ter pelo menos 18 anos."),
  phone: z.string().regex(/^\+?\d{10,13}$/, "Telefone inválido."),
  whatsapp: z.string().regex(/^\+?\d{10,13}$/, "WhatsApp inválido."),
  email: z.email("E-mail inválido."),
  address: z.object({
    zip: z.string().regex(/^\d{8}$/, "CEP inválido."),
    street: z.string().min(2),
    number: z.string().min(1),
    complement: z.string().optional(),
    district: z.string().min(2),
    city: z.string().min(2),
    state: z.string().length(2),
  }),
  cnh: z.object({
    number: z.string().regex(/^\d{11}$/, "Número da CNH inválido."),
    categories: z.string().regex(/^(ACC|A|B|AB|C|D|E|AC|AD|AE)$/i, "Categoria inválida."),
    expiresAt: z.coerce.date(),
    issuedAt: z.coerce.date(),
  }),
});
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;
