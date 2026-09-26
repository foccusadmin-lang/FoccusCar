/**
 * Catálogo das telas-esqueleto: cada rota das áreas logadas que ainda não tem módulo
 * pronto mostra o que vai ter, em qual etapa do plano (docs/PLANO.md) e o formato da tela.
 * Quando o módulo for implementado, a página deixa de usar este catálogo.
 */
export type Preview = "dashboard" | "table" | "cards" | "map" | "timeline" | "wallet" | "list";

export type ModuleInfo = {
  eyebrow: string;
  title: string;
  description: string;
  /** Etapa do plano que entrega o módulo; sem etapa, a tela evolui junto com os módulos relacionados. */
  stage?: number;
  preview: Preview;
  action?: string;
  link?: { href: string; label: string };
  stats?: string[];
  columns?: string[];
  features: string[];
};

export const STAGES: Record<number, string> = {
  3: "Painel administrativo e frota",
  4: "Reserva, contrato e pagamento",
  5: "Locação: retirada e devolução",
  6: "Manutenção, multas e ocorrências",
  7: "Financeiro",
  8: "Representantes",
  9: "GPS e Foccus Security",
  10: "Notificações e WhatsApp",
  11: "Relatórios e Foccus Intelligence",
};

export const MODULES = {
  // ── Cliente (seções 28, 91 e 93) ─────────────────────────────
  "conta/reservas": {
    eyebrow: "Minha conta", title: "Minhas reservas", stage: 4, preview: "cards", action: "Nova reserva",
    description: "Reservas futuras e passadas, com status, valores e contrato.",
    features: ["Reservas confirmadas, pendentes de pagamento e canceladas", "Retirada, devolução, local e valores", "Cancelamento com confirmação", "Contrato e pagamento de cada reserva"],
  },
  "conta/locacoes": {
    eyebrow: "Minha conta", title: "Minhas locações", stage: 5, preview: "cards",
    description: "Locação atual, histórico e veículos que você já utilizou.",
    features: ["Locação em andamento com previsão de devolução", "Checklists de saída e devolução com fotos", "Encargos pós-devolução", "Botão Alugar novamente"],
  },
  "conta/pagamentos": {
    eyebrow: "Minha conta", title: "Pagamentos", stage: 4, preview: "table",
    columns: ["Data", "Referência", "Método", "Valor", "Status"],
    description: "Pix, cartão e links de pagamento das suas reservas e locações.",
    features: ["Pagamentos aprovados, pendentes e estornados", "Caução separada da locação", "Comprovantes", "Pagar pendências por Pix ou cartão"],
  },
  "conta/documentos": {
    eyebrow: "Minha conta", title: "Documentos", preview: "list", link: { href: "/cadastro", label: "Abrir meus documentos" },
    description: "CNH, RG, comprovante de residência e selfie, com o status de cada análise.",
    features: ["Status: pendente, em análise, aprovado, recusado, vencido", "Motivo de recusa e reenvio pela câmera", "Aviso de CNH perto do vencimento"],
  },
  "conta/contratos": {
    eyebrow: "Minha conta", title: "Contratos", stage: 4, preview: "list",
    description: "Contratos das suas locações em PDF, com assinatura digital.",
    features: ["Contrato gerado automaticamente na reserva", "Assinatura digital", "Download e impressão em PDF"],
  },
  "conta/notificacoes": {
    eyebrow: "Minha conta", title: "Notificações", stage: 10, preview: "list",
    description: "Avisos de reserva, pagamento, retirada, devolução e documentos.",
    features: ["Central de notificações do sistema", "Preferências por e-mail, WhatsApp e push", "Avise-me quando um veículo ficar disponível"],
  },

  // ── Representante (seções 64 a 68, 90 e 94) ──────────────────
  "representante": {
    eyebrow: "Representante", title: "Dashboard", stage: 8, preview: "dashboard",
    stats: ["Vendas no mês", "Reservas", "Ganhos", "Saldo disponível"],
    description: "Seu desempenho como representante Foccus Car.",
    features: ["Vendas, reservas e locações geradas", "Margem e ganhos", "Saldo, pendências e saques"],
  },
  "representante/veiculos": {
    eyebrow: "Representante", title: "Veículos", stage: 8, preview: "cards", action: "Publicar oferta",
    description: "Frota disponível para você republicar com o preço oficial.",
    features: ["Preço oficial Foccus Car", "Disponibilidade e próxima data livre", "Publicar oferta com margem permitida"],
  },
  "representante/ofertas": {
    eyebrow: "Representante", title: "Minhas ofertas", stage: 8, preview: "table", action: "Nova oferta",
    columns: ["Veículo", "Preço oficial", "Margem", "Preço cliente", "Status"],
    description: "Ofertas publicadas com a sua margem e o link para o cliente.",
    features: ["Margem dentro do limite permitido", "Link da oferta para compartilhar", "O cliente paga pelo fluxo oficial da Foccus Car"],
  },
  "representante/clientes": {
    eyebrow: "Representante", title: "Clientes", stage: 8, preview: "table",
    columns: ["Cliente", "Reservas", "Locações", "Última compra"],
    description: "Clientes que chegaram pelas suas ofertas.",
    features: ["Somente clientes vindos das suas ofertas", "Dados pessoais mascarados (LGPD)"],
  },
  "representante/reservas": {
    eyebrow: "Representante", title: "Reservas", stage: 8, preview: "table",
    columns: ["Reserva", "Cliente", "Veículo", "Período", "Status"],
    description: "Reservas geradas pelas suas ofertas.",
    features: ["Status de pagamento e confirmação", "Margem prevista de cada reserva"],
  },
  "representante/locacoes": {
    eyebrow: "Representante", title: "Locações", stage: 8, preview: "table",
    columns: ["Locação", "Cliente", "Veículo", "Período", "Status"],
    description: "Locações em andamento e concluídas das suas vendas.",
    features: ["Acompanhamento até a devolução", "Margem liberada ao concluir"],
  },
  "representante/ganhos": {
    eyebrow: "Representante", title: "Ganhos", stage: 8, preview: "dashboard",
    stats: ["Total gerado", "Pendente", "Liberado", "Sacado"],
    description: "Margens registradas por reserva e locação.",
    features: ["Exemplo: preço Foccus R$ 1.500 + margem R$ 200 = cliente paga R$ 1.700", "Histórico por período"],
  },
  "representante/carteira": {
    eyebrow: "Representante", title: "Carteira", stage: 8, preview: "wallet",
    description: "Saldo disponível, pendente e todas as movimentações.",
    features: ["Saldo disponível, pendente, total gerado, sacado e investido", "Cada movimentação com ID, data, origem, destino, valor e status"],
  },
  "representante/saques": {
    eyebrow: "Representante", title: "Saques", stage: 8, preview: "table", action: "Solicitar saque",
    columns: ["Solicitado em", "Valor", "Conta", "Status"],
    description: "Solicitações de saque e o andamento de cada uma.",
    features: ["Fluxo: solicitado → análise → aprovado → processamento → pago", "Motivo em caso de recusa"],
  },
  "representante/invest": {
    eyebrow: "Representante", title: "Foccus Invest", stage: 8, preview: "list",
    description: "Integração opcional e separada, disponível somente quando houver provedor regulado.",
    features: ["Sacar ou reaplicar saldo, quando permitido", "Termos, riscos, liquidez e taxas do provedor", "Sem promessa de rentabilidade"],
  },
  "representante/perfil": {
    eyebrow: "Representante", title: "Perfil", stage: 8, preview: "list",
    description: "Seus dados de representante e a conta para receber saques.",
    features: ["Dados cadastrais", "Conta bancária ou chave Pix para saques (exibida mascarada)", "Termos do programa de representantes"],
  },

  // ── Equipe da locadora (seções 69 a 80 e 92) ─────────────────
  "admin": {
    eyebrow: "Painel da locadora", title: "Dashboard", stage: 3, preview: "dashboard",
    stats: ["Veículos disponíveis", "Alugados", "Em manutenção", "Receita do mês"],
    description: "Visão geral da frota, das reservas, das locações e do financeiro.",
    features: ["Disponíveis, alugados e em manutenção", "Reservas, locações, receita, despesas e inadimplência", "Ocupação da frota e rentabilidade", "Alertas de manutenção, segurança e ocorrências"],
  },
  "admin/veiculos": {
    eyebrow: "Frota", title: "Veículos", stage: 3, preview: "table", action: "Cadastrar veículo",
    columns: ["Placa", "Modelo", "Categoria", "KM", "Diária", "Status"],
    description: "Cadastro da frota com fotos, preços, documentos e a Vida do Veículo.",
    features: ["Placa, marca, modelo, versão, ano, cor, câmbio e combustível", "Preços diário, semanal, quinzenal e mensal", "Vida do Veículo: linha do tempo completa", "Status: disponível, reservado, alugado, manutenção, vistoria, limpeza, bloqueado"],
  },
  "admin/documentos": {
    eyebrow: "Frota", title: "Documentos da frota", stage: 3, preview: "table", action: "Enviar documento",
    columns: ["Veículo", "Documento", "Validade", "Situação"],
    description: "Documento do veículo, licenciamento, seguro, notas e contratos.",
    features: ["Alertas de vencimento", "Arquivos em armazenamento privado com link seguro"],
  },
  "admin/historico": {
    eyebrow: "Gestão", title: "Histórico e auditoria", stage: 3, preview: "timeline",
    description: "Quem fez o quê, quando e em qual registro.",
    features: ["Usuário, ação, data e hora, entidade, valor anterior e novo, IP", "Pagamentos, estornos, permissões, documentos, bloqueios e contratos", "Filtros combináveis por período, usuário e módulo"],
  },
  "admin/usuarios": {
    eyebrow: "Gestão", title: "Usuários e perfis", stage: 3, preview: "table", action: "Convidar usuário",
    columns: ["Nome", "E-mail", "Perfis", "Status"],
    description: "Equipe da locadora e os perfis de acesso de cada pessoa.",
    features: ["Perfis: administrador, gerente, operador, financeiro, representante", "Permissões configuráveis por perfil", "Atribuição com confirmação e auditoria"],
  },
  "admin/monitoramento": {
    eyebrow: "Monitoramento", title: "Mapa da frota", stage: 9, preview: "map",
    description: "Localização, status e última comunicação de cada veículo com rastreador.",
    features: ["Mapa + lista lateral no computador; mapa + painel expansível no celular", "Filtros: disponível, alugado, manutenção, parado, alerta, sem comunicação", "Histórico de rotas e cercas virtuais"],
  },
  "admin/clientes": {
    eyebrow: "Operação", title: "Clientes", preview: "table", link: { href: "/admin/cadastros", label: "Cadastros em análise" },
    columns: ["Cliente", "CPF", "Status", "Locações", "Total gasto"],
    description: "Cadastro, documentos, CNH e histórico completo de cada cliente.",
    features: ["Busca por nome, CPF, e-mail e telefone", "Locações, pagamentos, atrasos, multas, danos e ocorrências", "Suspender e bloquear conta com confirmação"],
  },
  "admin/reservas": {
    eyebrow: "Operação", title: "Reservas", stage: 4, preview: "table", action: "Nova reserva",
    columns: ["Reserva", "Cliente", "Veículo", "Retirada", "Devolução", "Status"],
    description: "Agenda de reservas sem conflito de veículo e período.",
    features: ["Calendário de disponibilidade", "Preço, desconto, caução e taxas", "Cancelamento com confirmação"],
  },
  "admin/locacoes": {
    eyebrow: "Operação", title: "Locações", stage: 5, preview: "table", action: "Nova locação",
    columns: ["Locação", "Condutor", "Veículo", "Início", "Retorno previsto", "Status"],
    description: "Retiradas, veículos em uso e devoluções.",
    features: ["Condutor principal e adicionais com CNH validada", "Contrato, caução, KM e combustível", "Devolução com comparação saída x retorno e encargos"],
  },
  "admin/checklists": {
    eyebrow: "Operação", title: "Checklists", stage: 5, preview: "list", action: "Iniciar checklist",
    description: "Vistoria de saída e devolução pelo celular, com fotos e assinatura.",
    features: ["KM, combustível e 23 itens (OK, dano, observação, foto)", "Câmera direto no celular e funcionamento offline", "Comparação automática de avarias"],
  },
  "admin/manutencao": {
    eyebrow: "Operação", title: "Manutenção", stage: 6, preview: "table", action: "Registrar manutenção",
    columns: ["Veículo", "Serviço", "Data", "KM", "Valor", "Situação"],
    description: "Preventiva, corretiva e revisões, com alertas por data e KM.",
    features: ["Situação: em dia, próxima e atrasada", "Oficina, peças, mão de obra, nota e fotos", "Preparação do veículo após devolução"],
  },
  "admin/seguranca": {
    eyebrow: "Foccus Security", title: "Central de segurança", stage: 9, preview: "list",
    description: "Alertas 24h dos rastreadores e comandos remotos autorizados.",
    features: ["Saída de área, perda de comunicação, ignição e movimento fora de hora", "Status: novo, em análise, resolvido, ignorado", "Bloqueio remoto só com hardware compatível e confirmação"],
  },
  "admin/ocorrencias": {
    eyebrow: "Controle", title: "Ocorrências", stage: 6, preview: "table", action: "Registrar ocorrência",
    columns: ["Data", "Veículo", "Cliente", "Descrição", "Status"],
    description: "Acidentes, sinistros e eventos com fotos, documentos e custos.",
    features: ["Veículo, cliente, condutor, local e responsável", "Fotos e documentos anexados", "Entra na Vida do Veículo"],
  },
  "admin/multas": {
    eyebrow: "Controle", title: "Multas", stage: 6, preview: "table", action: "Registrar multa",
    columns: ["Data", "Veículo", "Condutor", "Infração", "Valor", "Status"],
    description: "Multas identificadas pelo condutor autorizado no período.",
    features: ["Condutor responsável pela data e hora da infração", "Pagamento e repasse ao cliente"],
  },
  "admin/financeiro": {
    eyebrow: "Controle", title: "Financeiro", stage: 7, preview: "dashboard",
    stats: ["Receita do mês", "Despesas", "Resultado", "A receber"],
    description: "Receitas, despesas, cauções, contas bancárias e conciliação.",
    features: ["Lançamentos imutáveis: correção por estorno ou ajuste", "Rentabilidade por veículo", "Conciliação Foccus x gateway x banco"],
  },
  "admin/representantes": {
    eyebrow: "Controle", title: "Representantes", stage: 8, preview: "table",
    columns: ["Representante", "Ofertas", "Vendas", "Saldo", "Status"],
    description: "Programa de representantes: margens, carteiras e saques para aprovar.",
    features: ["Limite de margem por veículo ou categoria", "Aprovação de saques pelo financeiro"],
  },
  "admin/relatorios": {
    eyebrow: "Gestão", title: "Relatórios", stage: 11, preview: "cards",
    description: "Frota, financeiro, clientes, veículos e segurança.",
    features: ["Utilização, disponibilidade e KM da frota", "Receitas, despesas e lucro operacional", "Clientes novos e recorrentes", "Exportação"],
  },
  "admin/configuracoes": {
    eyebrow: "Gestão", title: "Configurações", preview: "list",
    description: "Dados da empresa, preços, documentos exigidos, gateway e integrações.",
    features: ["Dados da empresa e identidade", "Documentos obrigatórios do cadastro", "Gateway de pagamento e rastreador", "Canais de notificação"],
  },
} satisfies Record<string, ModuleInfo>;

export type ModuleKey = keyof typeof MODULES;
