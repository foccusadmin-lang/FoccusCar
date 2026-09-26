/** Usuários de teste da demonstração (docs/AMBIENTE-DE-TESTES.md). Só existem onde o seed de demonstração rodou. */
export const DEMO_DOMAIN = "demo.foccuscar.com.br";
export const DEFAULT_DEMO_PASSWORD = "Foccus@2026";

export const DEMO_PROFILES = [
  { user: "admin", label: "Administrador", hint: "Tudo: frota, clientes, financeiro, segurança e usuários", area: "/admin" },
  { user: "gerente", label: "Gerente", hint: "Operação e financeiro, sem configurações do sistema", area: "/admin" },
  { user: "operador", label: "Operador", hint: "Frota, reservas, locações, checklists e cadastros", area: "/admin" },
  { user: "financeiro", label: "Financeiro", hint: "Pagamentos, lançamentos e saques", area: "/admin" },
  { user: "cliente", label: "Cliente aprovado", hint: "Mariana: locação em andamento e reserva futura", area: "/conta" },
  { user: "representante", label: "Representante", hint: "Carlos: ofertas, vendas, carteira e saques", area: "/representante" },
  { user: "analise", label: "Cliente em análise", hint: "Rafael: documentos aguardando a equipe", area: "/cadastro" },
  { user: "pendente", label: "Cadastro incompleto", hint: "Thiago: precisa completar dados e documentos", area: "/cadastro" },
  { user: "recusado", label: "Documento recusado", hint: "Beatriz: precisa reenviar a selfie", area: "/cadastro" },
  { user: "bloqueado", label: "Cliente bloqueado", hint: "Diego: acesso restrito", area: "/" },
] as const;
