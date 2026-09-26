import { z } from "zod";
import { isValidCpf, normalizeCpf } from "./cpf";

/** Schemas compartilhados entre formulário e API (a API sempre revalida). */
const phone = (msg: string) => z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(/^\d{10,13}$/, msg));

export const personalSchema = z.object({
  fullName: z.string().trim().min(5, "Informe o nome completo.").max(120),
  cpf: z.string().transform(normalizeCpf).refine(isValidCpf, "CPF inválido."),
  birthDate: z.coerce.date({ error: "Data inválida." }).refine((d) => {
    const age = (Date.now() - d.getTime()) / (365.25 * 86_400_000);
    return age >= 18 && age < 120;
  }, "É preciso ter pelo menos 18 anos."),
  phone: phone("Telefone inválido."),
  whatsapp: phone("WhatsApp inválido."),
  email: z.email("E-mail inválido."),
});

export const addressSchema = z.object({
  zip: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(/^\d{8}$/, "CEP inválido.")),
  street: z.string().trim().min(2, "Informe o endereço.").max(160),
  number: z.string().trim().min(1, "Informe o número.").max(20),
  complement: z.string().trim().max(80).optional().or(z.literal("")),
  district: z.string().trim().min(2, "Informe o bairro.").max(80),
  city: z.string().trim().min(2, "Informe a cidade.").max(80),
  state: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "UF inválida."),
});

export const cnhSchema = z
  .object({
    number: z.string().transform((v) => v.replace(/\D/g, "")).pipe(z.string().regex(/^\d{11}$/, "O número da CNH tem 11 dígitos.")),
    categories: z.string().trim().toUpperCase().regex(/^(ACC|A|B|AB|C|D|E|AC|AD|AE)$/, "Categoria inválida."),
    expiresAt: z.coerce.date({ error: "Data inválida." }),
    issuedAt: z.coerce.date({ error: "Data inválida." }),
  })
  .refine((c) => c.expiresAt.getTime() > Date.now(), { path: ["expiresAt"], message: "A CNH está vencida." })
  .refine((c) => c.issuedAt.getTime() <= Date.now(), { path: ["issuedAt"], message: "A data de emissão não pode ser no futuro." });

export const customerProfileSchema = personalSchema.extend({
  address: addressSchema,
  cnh: cnhSchema,
});
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;
