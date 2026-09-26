# Foccus Car — Plano de implementação

Segue a ordem da seção 119, agrupada em entregas que sempre deixam o sistema funcionando de ponta a ponta. Cada etapa entrega frontend + backend + banco + testes.

| # | Etapa | Entrega | Seções |
|---|---|---|---|
| 1 | **Fundação** ✅ | Arquitetura, banco completo (65 tabelas) com RLS, login (Google/Microsoft/Apple/e-mail), RBAC, tokens da marca, vitrine inicial, bloqueio de serviços, PWA básico | 1–21, 86–89, 95 |
| 2 | **Cadastro do cliente** ✅ | Formulário completo (dados, endereço, CNH), upload de documentos com câmera, análise pelo operador, PROFILE_COMPLETE → UNDER_REVIEW → ACTIVE, recuperação de senha, notificação por e-mail | 18, 21–24, 82–83, 99 |
| 3 | Painel administrativo e frota | Layout com sidebar (seção 92), usuários e perfis, cadastro de veículos com fotos, documentos da frota, Vida do Veículo, auditoria automática | 29–31, 69, 74, 80, 92, 104 |
| 4 | Reserva → contrato → pagamento | Calendário de disponibilidade, criação de reserva sem conflito, contrato em PDF com assinatura, Pix/cartão/link, webhooks idempotentes, caução, confirmação | 25–27, 32–37, 48–54 |
| 5 | Locação: retirada e devolução | Condutores, checklist mobile (KM, combustível, 23 itens, fotos, assinatura), comparação saída x devolução, avarias, encargos, finalização, preparação do veículo, offline para checklist | 34–43, 55, 85, 98 |
| 6 | Manutenção, multas e ocorrências | Manutenção GREEN/YELLOW/RED, multas com condutor, ocorrências, alertas de vencimento | 44–45, 72–74 |
| 7 | Financeiro | Receitas/despesas, rentabilidade por veículo, contas bancárias, conciliação Foccus x gateway x banco | 46–47, 56–57 |
| 8 | Representantes | Ofertas com margem, carteira, saques, painel do representante (Foccus Invest só com integração regulada) | 64–68, 90, 94 |
| 9 | GPS e Foccus Security | Adapter do rastreador escolhido, mapa da frota, histórico, cercas, central de alertas, bloqueio seguro | 58–63, 70, 97, 114 |
| 10 | Notificações e WhatsApp | Central, e-mail, WhatsApp oficial, push PWA, lembretes automáticos (worker) | 75–77 |
| 11 | Relatórios e Foccus Intelligence | Relatórios de frota, financeiro, clientes, segurança; alertas inteligentes | 77, 79 |
| 12 | Produção | Staging e produção separados, backups com restauração testada, monitoramento, testes E2E completos (seções 111–114) | 110, 115–118 |

## Decisões pendentes com o dono do produto

1. **Gateway de pagamento principal:** Mercado Pago ou Asaas (ambos preparados).
2. **Fornecedor de rastreador/telemetria** (define o que é possível em bloqueio remoto).
3. **Domínio** (ex.: app.foccuscar.com.br) e **hospedagem**.
4. **Contas de desenvolvedor** Google Cloud, Microsoft Entra e Apple Developer para ativar os logins sociais.
5. **Revisão de cadastro:** aprovação manual pelo operador ou automática quando documentos forem validados.
