# Foccus Car — Arquitetura (Etapa 1: Fundação)

Documento da seção 130 da Especificação Mestra: análise, arquitetura, stack, banco, módulos, relações, autenticação, RBAC, design system, estrutura de pastas, integrações e plano. É a referência técnica para todas as etapas seguintes.

---

## 1. Análise da especificação

A especificação descreve um **SaaS multiempresa** com três públicos (visitante/cliente, representante, equipe da locadora) e um núcleo operacional que vai da vitrine até a devolução do veículo. Os pontos que moldam a arquitetura:

| Requisito | Consequência técnica |
|---|---|
| Multiempresa sem vazamento (seção 12) | Isolamento no **próprio banco** (Row Level Security), não só em filtros da aplicação |
| Conta pública nunca vira admin (17) | Papéis privilegiados só por mecanismo administrativo; campos de status/perfil bloqueados no cadastro |
| Cadastro criado ≠ serviço liberado (18, 20, 21) | Máquina de estados da conta + "portão" de serviços avaliado no servidor |
| Sem conflito de reservas (32) | Restrição de exclusão no Postgres: duas reservas ativas não ocupam o mesmo veículo no mesmo período |
| Financeiro imutável (53) | Triggers impedem alterar/apagar lançamentos confirmados; correção = estorno/ajuste |
| Vida do Veículo (31, 112) | Linha do tempo única e somente inserção (`vehicle_events`) alimentada por todos os módulos |
| Gateway desacoplado (49) | Interface `PaymentGateway` + adapters (Mercado Pago, Asaas, simulado) |
| GPS ≠ bloqueio (62, 63) | `TelematicsAdapter` com capacidades do hardware + regras de segurança antes de qualquer comando |
| Web app universal + PWA (6, 7, 8) | Uma aplicação Next.js responsiva, mobile-first, instalável |

## 2. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | **TypeScript** (ponta a ponta) | Um só idioma de tipos entre banco, regras, API e interface |
| Frontend + API | **Next.js 16** (App Router, React 19) | Web app universal com renderização no servidor, rotas de API e PWA na mesma base |
| Banco | **PostgreSQL 16** | Relacional, RLS nativo, restrições de exclusão, JSONB, particionamento para GPS |
| ORM / migrations | **Drizzle ORM + drizzle-kit** | Esquema em TypeScript, SQL previsível, migrations versionadas |
| Autenticação | **Better Auth** | Biblioteca madura de OAuth/OIDC (Google, Microsoft, Apple) + e-mail/senha; nada "artesanal" |
| Validação | **Zod** | Mesmos esquemas no formulário e na API (a API sempre revalida) |
| Testes | **Vitest** + **Playwright** | Unitários, integração com Postgres real e fluxo no navegador |
| Storage | S3 compatível (S3, Cloudflare R2, MinIO) | Arquivos fora do banco, URLs assinadas |
| Hospedagem sugerida | Vercel ou container (Railway/Render/Fly) + Postgres gerenciado (Neon, Supabase, RDS) | Separação development / staging / production |

**Modelo de arquitetura:** monólito modular. Uma aplicação, uma base de código, com as regras de negócio em pacotes independentes da interface. Assim a API não depende de telas e, se um módulo precisar escalar sozinho (ex.: ingestão de GPS), ele sai para um serviço próprio sem reescrita. Tarefas de fundo (lembretes, notificações, ingestão de GPS, conciliação) rodarão num processo `worker` a partir da etapa de notificações.

## 3. Módulos e estrutura de pastas

```text
foccus-car/
├── apps/
│   └── web/                      Next.js: páginas, layouts, rotas /api, PWA
│       ├── src/app/              páginas (vitrine, veículo, entrar, cadastro) e /api/*
│       ├── src/components/       componentes de tela + ui/ (design system)
│       ├── src/server/           camada de servidor: auth, db, serviços, tratamento de erros
│       └── src/lib/              formatação, cliente de auth
├── packages/
│   ├── core/                     REGRAS DE NEGÓCIO puras (sem banco, sem tela)
│   │   ├── enums.ts              todos os status da especificação
│   │   ├── rbac.ts               perfis, permissões, atribuição de perfis
│   │   ├── access.ts             autorização: login + empresa + permissão + dono
│   │   ├── account.ts            ciclo de vida da conta e bloqueio de serviços
│   │   ├── eligibility.ts        elegibilidade para locação
│   │   ├── reservations.ts       conflito, próxima disponibilidade, preço, margem
│   │   ├── checklist.ts          saída x devolução, saúde da manutenção
│   │   └── validation.ts         CPF, cadastro do cliente (Zod)
│   ├── db/                       banco: esquema, migrations, RLS, seed, CLI
│   │   ├── src/schema/*.ts       65 tabelas por domínio
│   │   ├── migrations/           SQL gerado e versionado
│   │   └── sql/policies.sql      RLS, anti-conflito, imutabilidade, permissões
│   ├── auth/                     Better Auth + vínculo com empresa + contexto de acesso
│   ├── services/                 casos de uso do backend (cadastro, análise), testados contra o Postgres
│   ├── integrations/             pagamentos, telemetria, storage, notificações
│   └── ui/                       tokens do design system (cores da logo)
└── docs/                         esta documentação
```

A lista da seção 86 (`components/ pages/ services/ auth/ payments/ telemetry/ permissions/ ...`) está distribuída assim: `permissions` → `core/rbac.ts`; `payments`, `telemetry`, `storage`, `notifications` → `packages/integrations`; `database` → `packages/db`; `services` → `apps/web/src/server/services`.

## 4. Banco de dados

### Convenções (seção 11)
- `id` UUID gerado pelo Postgres; `created_at` / `updated_at` em todas as tabelas.
- `deleted_at` (exclusão lógica), `created_by` / `updated_by` onde há edição por pessoas.
- Valores monetários em **centavos** (`bigint`), nunca ponto flutuante.
- Arquivos: o banco guarda só a `storage_key`.

### Entidades por domínio (65 tabelas)

| Domínio | Tabelas |
|---|---|
| Empresas e identidade | companies, users, sessions, accounts, verifications, roles, permissions, role_permissions, company_members |
| Clientes | customers, drivers, customer_documents |
| Frota | vehicle_categories, locations, vehicles, vehicle_photos, vehicle_documents, vehicle_events, vehicle_history, availability_alerts, favorites |
| Operação | reservations, rentals, rental_drivers, contracts, checklists, checklist_items, damages, fuel_records, mileage_records, reviews |
| Manutenção e ocorrências | maintenance, maintenance_items, fines, occurrences |
| GPS e segurança | gps_devices, gps_positions, gps_events, geofences, security_alerts, telematics_commands |
| Pagamentos | payment_gateway_configs, payment_methods, payments, payment_transactions, payment_events, payment_webhooks, payment_refunds, payment_chargebacks, payment_fees |
| Financeiro | bank_accounts, financial_accounts, financial_transactions, bank_transactions, reconciliation_records, deposits, deposit_movements, rental_charges |
| Representantes | representatives, representative_listings, wallets, wallet_transactions, withdrawal_requests |
| Plataforma | notifications, audit_logs |

Todas as 52 entidades da seção 89 existem. Foram acrescentadas: `sessions/accounts/verifications` (login), `company_members` (perfis por empresa), `vehicle_categories`, `locations`, `availability_alerts` ("avise-me", seção 26), `favorites` (28), `reviews` (78), `rental_charges` (encargos, 55) e `payment_gateway_configs`.

### Relações principais

```text
companies ─┬─< company_members >── users ──< accounts (google | microsoft | apple | credential)
           ├─< customers ─┬─< drivers ──< customer_documents
           │              └─< reservations >── vehicles ──< vehicle_events (Vida do Veículo)
           ├─< vehicles ──┬─< vehicle_photos / vehicle_documents / maintenance / fines / occurrences
           │              ├─< gps_devices ──< gps_positions / gps_events / telematics_commands
           │              └─< damages
           ├─< rentals ───┬── reservation, customer, main_driver, vehicle
           │              ├─< rental_drivers (quem podia dirigir e quando)
           │              ├─< checklists ──< checklist_items   (SAÍDA / DEVOLUÇÃO)
           │              ├─< contracts, deposits, rental_charges
           │              └─< payments ──< payment_events / refunds / chargebacks / fees
           ├─< financial_transactions (livro imutável) ── reconciliation_records ── bank_transactions
           └─< representatives ──< representative_listings ──(origem)── reservations
                               └── wallets ──< wallet_transactions / withdrawal_requests
```

### Garantias no próprio banco (`packages/db/sql/policies.sql`)
1. **Isolamento por empresa (RLS).** Toda tabela com `company_id` recebe automaticamente a política `company_id = app_current_company()`. A aplicação conecta com o papel `foccus_app` (sem superusuário) e cada operação roda em `withTenant(...)`, que fixa a empresa na transação. Sem empresa definida, nenhuma linha aparece. Testado: empresa A não lê, não grava e não altera dados da empresa B.
2. **Reservas sem conflito.** `EXCLUDE USING gist (vehicle_id WITH =, tstzrange(pickup_at, return_at) WITH &&)` para reservas pendentes/confirmadas; o mesmo para locações ativas. Devolver às 10h e retirar às 10h é permitido.
3. **Imutabilidade.** `audit_logs`, `vehicle_events`, `vehicle_history` e `payment_events` são somente inserção. `financial_transactions` confirmadas não podem ser alteradas nem apagadas.
4. **Idempotência de webhooks.** `payment_webhooks` tem chave única `(provider, event_id)`: o mesmo evento nunca é processado duas vezes.

### Escala
`gps_positions` e `audit_logs` usam chave `bigint` sequencial e índices por (veículo, tempo), prontos para particionamento mensal. Paginação e índices compostos por `company_id` em todas as listagens.

## 5. Autenticação (seções 13 a 15)

- **Better Auth** em `/api/auth/*`: Google (principal), Microsoft (tenant `common`, cobre Outlook, Hotmail e contas corporativas), Apple e e-mail/senha. Outros provedores OIDC podem ser adicionados pela mesma biblioteca.
- **Identidade interna:** cada pessoa tem um `users.id` próprio. Os logins ficam em `accounts` (`provider_id` + `account_id` do provedor), então uma pessoa pode entrar com Google e Microsoft na mesma conta, e o e-mail nunca é o identificador.
- **Fluxo Google:** "Continuar com Google" → provedor → conta existe? entra : cria conta → `/cadastro`.
- **Toda conta nova:** `status = PROFILE_INCOMPLETE`, vínculo `CLIENTE` com a empresa do domínio acessado. Os campos `status` e `isPlatformAdmin` são marcados como não editáveis pelo navegador e ainda são forçados num gancho do servidor. Testado enviando `status: ACTIVE`, `role: ADMIN` no cadastro: foram ignorados.
- **Sessão:** cookie `HttpOnly`, `Secure` em produção, 7 dias com renovação; guarda a empresa ativa.
- **Segurança:** senha mínima de 10 caracteres com hash; confirmação de e-mail obrigatória em produção; limite de 5 tentativas de login por minuto; recuperação de senha por e-mail.
- **Empresa (tenant):** descoberta pelo domínio acessado (`companies.domain`), com empresa padrão em desenvolvimento. Nunca vem de um parâmetro enviado pelo navegador.

### Status da conta (seção 21)
```text
REGISTERED → PROFILE_INCOMPLETE → PROFILE_COMPLETE → UNDER_REVIEW → ACTIVE
                          ↘ SUSPENDED / BLOCKED (a partir de qualquer estado)
```
Só `ACTIVE` usa serviços privados. `PROFILE_INCOMPLETE` recebe "Complete seu cadastro para continuar." com o botão **COMPLETAR CADASTRO**; `PROFILE_COMPLETE/UNDER_REVIEW` recebe "Seu cadastro está em análise". A elegibilidade para uma locação específica (CNH válida até a devolução, categoria, documentos aprovados, reserva, contrato) é avaliada à parte em `core/eligibility.ts`.

## 6. RBAC (seções 16, 17 e 95)

Permissões no formato `modulo:acao` (catálogo em `core/rbac.ts`, gravado na tabela `permissions`). Cada empresa tem seus perfis em `roles` + `role_permissions`, criados com o padrão abaixo e ajustáveis.

| Perfil | Pode |
|---|---|
| CLIENTE | vitrine, próprio perfil, próprias reservas, locações e pagamentos |
| REPRESENTANTE | tudo do cliente + ofertas com margem, carteira, saques |
| OPERADOR | clientes (ver, analisar documentos), frota, reservas, locações, contratos, checklists, manutenção, multas, ocorrências, GPS, alertas |
| FINANCEIRO | financeiro, estornos, contas bancárias, conciliação, saques de representantes, relatórios |
| GERENTE | operação completa + gestão de clientes/frota, cercas, comandos de segurança, representantes, relatórios, auditoria |
| ADMIN | tudo, incluindo atribuir perfis e configurações |

**Toda rota de API** chama `authorize(contexto, { permission, companyId, ownerUserId })`, que verifica em ordem: autenticado → conta não suspensa → mesma empresa → permissão → dono do recurso (para ações `self:*`). Depois disso a consulta ainda passa pelo RLS do banco.

**Atribuição de perfis:** exige `users:roles.assign`; só ADMIN concede ADMIN; ninguém altera os próprios perfis. O primeiro administrador é criado pela CLI `pnpm db:grant-role foccus-car email@dominio ADMIN`, que roda com credencial de banco (não existe rota pública para isso).

## 7. Design System

Paleta amostrada da logo (dourado `#F0B030 / #E09020 / #D08010`, preto, prata do "CAR"):

| Token | Valor | Uso |
|---|---|---|
| black 950 → 500 | `#050506` → `#3A3A43` | fundos, superfícies, bordas |
| gold 50 → 900 | `#FFF8E6` → `#3F2405`, base `#F0B030` | acento: botão principal, preços, destaques, foco |
| silver 50 → 600 | `#F7F7F8` → `#5A5A65` | textos secundários, gradiente prata |
| success / warning / danger / info | verde discreto, âmbar, vermelho, azul acinzentado | status, sempre acompanhados de texto |

- Tema escuro é o padrão da marca; tema claro (`data-theme="light"`) para leitura longa e impressão.
- Gradiente dourado só em acentos (botão principal, preço, divisores); nunca em grandes áreas.
- Área de toque mínima de 44 px; foco visível dourado; `prefers-reduced-motion` respeitado.
- Tokens em `packages/ui/src/tokens.css` e `tokens.ts`. Componentes já criados: Button, Badge, Card, Alert, EmptyState, Skeleton, Dialog (vira "bottom sheet" no celular), campos de formulário. Os demais da seção 5 entram conforme cada módulo precisar deles.
- Pontos de quebra: 480 / 768 / 1024 / 1280 / 1536. Mobile-first: uma coluna, cards e botões grandes; tablet em 2 colunas; desktop em 3 colunas com filtros em linha.

## 8. Integrações

| Integração | Contrato | Estado |
|---|---|---|
| Pagamentos | `PaymentGateway` (os 10 métodos da seção 49) | Mercado Pago e Asaas escritos conforme a documentação pública, com validação de webhook (HMAC do Mercado Pago, token do Asaas) testada. **Precisam ser validados em sandbox** com credenciais de teste. Gateway simulado para desenvolvimento, proibido em produção. |
| Cartão | Tokenização no navegador pelo SDK do gateway | O servidor nunca recebe número completo nem CVV; só guardamos token, bandeira e 4 últimos dígitos |
| Webhooks | `/api/payments/webhook/{provider}` | Validação de assinatura, gravação única por evento, status final não retrocede (`canMovePayment`) |
| Telemetria | `TelematicsAdapter` (posições, histórico, comandos) + `createTelematicsAdapter` (`TELEMATICS_PROVIDER`) | Interface e rastreador simulado prontos; o adapter concreto entra como um `case` na fábrica quando o fornecedor for escolhido |
| Localização do celular | `compareTrackingLayers` (carro x celular) | Pronto e testado; alimenta a central de alertas na etapa 9 (seção 13 abaixo) |
| Bloqueio remoto | `evaluateRemoteCommand` | Só com hardware compatível, confirmação, motivo, comunicação recente e veículo parado; resultado registrado como o provedor informar |
| Geofencing | ponto-em-polígono + transições | Pronto e testado |
| Storage | `StorageProvider` (URL assinada) | Validação de tipo, tamanho, extensão e conteúdo real (magic bytes); chave sempre prefixada pela empresa |
| Notificações | `NotificationChannel` (e-mail, WhatsApp, push) | Modelos de mensagem prontos; WhatsApp via Cloud API oficial da Meta ou parceiro oficial |

## 9. Segurança e LGPD

- Validação no servidor com Zod em toda entrada; erros com mensagens humanas, sem detalhes internos.
- Cabeçalhos: HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (câmera e localização só no próprio site).
- Segredos só em variáveis de ambiente (`.env.example` lista todas); dados bancários cifrados com AES-256-GCM e exibidos mascarados.
- Logs técnicos separados da auditoria de negócio (`audit_logs`).
- LGPD: dados pessoais ficam no escopo da empresa que os coletou; CPF mascarado na interface; documentos acessíveis só por URL assinada de curta duração.

## 10. O que foi validado nesta etapa

- 47 testes automatizados: regras de perfil, autorização, status, elegibilidade, conflito e preço de reservas, checklist, CPF, isolamento entre empresas no Postgres real, reservas sobrepostas recusadas pelo banco, auditoria e financeiro imutáveis, cadastro público sem escalonamento, gateways e bloqueio remoto.
- Build de produção do Next.js sem erros.
- Fluxo no navegador em celular (390 px), tablet (820 px) e desktop (1440 px), sem rolagem horizontal: vitrine → veículo → "Reservar" → login → criar conta → confirmar e-mail → cadastro incompleto → tentar reservar → **bloqueio "Complete seu cadastro para continuar." com COMPLETAR CADASTRO**.

---

## 11. Etapa 2: cadastro do cliente (concluída)

**Fluxo do cliente (`/cadastro`):** formulário em 5 passos (dados pessoais, endereço com CEP automático via ViaCEP, CNH, documentos, revisão). Documentos pelo celular: "Tirar foto" abre a câmera traseira (a frontal na selfie), a foto é comprimida no aparelho (até 1600 px, JPEG) e enviada. Documentos exigidos por padrão: CNH frente e verso, selfie e comprovante de residência (RG opcional); cada empresa pode ajustar em `companies.settings.requiredDocuments`.

**Status:** `PROFILE_INCOMPLETE` → (enviar) `PROFILE_COMPLETE` → `UNDER_REVIEW` → (equipe libera) `ACTIVE`. Documento recusado volta a conta para `PROFILE_INCOMPLETE`, com o motivo visível ao cliente e enviado por e-mail. Depois do envio, nome, CPF, nascimento e CNH ficam travados; contato e endereço seguem editáveis.

**Análise pela equipe (`/admin/cadastros`):** fila por ordem de envio, fotos em tamanho real, aprovar ou recusar cada documento (recusa exige motivo) e "Liberar conta", tudo com confirmação (seção 104). Só libera com todos os obrigatórios aprovados e CNH válida. Ninguém analisa o próprio cadastro. Cada ação grava auditoria (quem, quando, valor anterior e novo, IP) e notificação para o cliente.

**Arquivos:** servidor confere tipo, tamanho, extensão e o conteúdo real do arquivo; chave `companies/{empresa}/customers/{cliente}/documents/{id}.jpg`. Entrega por `/api/documents/{id}/file`, só para o dono ou quem tem `customers:documents.review`, sem cache. Em produção: bucket S3/R2 privado (`STORAGE_*`); em desenvolvimento, pasta local.

**Senha:** "Esqueci minha senha" envia link de uso único (1 hora); a resposta é a mesma exista ou não a conta.

**APIs novas:** `GET/PUT /api/me/profile`, `POST /api/me/documents`, `POST /api/me/submit`, `GET /api/documents/{id}/file`, `POST /api/documents/{id}/review`, `GET /api/customers/review`, `GET /api/customers/{id}/detail`, `POST /api/customers/{id}/approve`.

**Validado:** 50 testes automáticos (3 novos de integração cobrindo o fluxo completo, recusa e reenvio, CPF duplicado, arquivo falso, acesso a arquivo de outra pessoa e de outra empresa) e o fluxo no navegador: cliente no celular preenche e envia, operadora no computador recusa a selfie, cliente vê o motivo e reenvia, operadora aprova e libera, cliente consegue reservar; cliente é barrado na área de análise (API responde 403); recuperação de senha e login com a nova senha.

## 12. Etapa 3: painel administrativo e frota (concluída)

- **Painel (`/admin`)** com menu lateral da seção 92: fixo no computador, gaveta no celular e no tablet em pé. Cada perfil vê só os módulos que pode usar; módulos de etapas futuras aparecem como "em breve", sem tela vazia.
- **Dashboard (seção 69):** frota por status, ocupação, reservas e locações, cadastros em análise e financeiro do mês. Cada bloco depende da permissão (o operador não vê valores). Alertas de documentos vencidos, bloqueios, manutenção atrasada e pagamentos vencidos.
- **Frota (seções 29, 30):** cadastro com validação de placa (antiga e Mercosul), RENAVAM e chassi; preços em centavos. Veículo novo entra **Inativo e fora da vitrine**. Busca, filtros combináveis e paginação; tabela vira cartões no celular (seção 96).
- **Status manual:** Reservado e Alugado só vêm da operação; carro alugado não muda à mão. Manutenção, Bloqueado e Inativo exigem motivo e confirmação; Bloqueado/Inativo tiram da vitrine e são recusados se houver reserva confirmada. **Bloqueio administrativo não envia comando ao rastreador** (seção 62), e isso aparece na tela.
- **Fotos:** câmera ou galeria, compressão no aparelho, conteúdo conferido por magic bytes, até 20 por veículo, capa e visibilidade. A rota `/api/vehicle-photos/[id]` só entrega sem login fotos públicas de veículos na vitrine; a vitrine agora mostra as fotos reais com galeria.
- **Documentos da frota (seção 74):** CRLV, licenciamento, seguro, IPVA, notas, contratos, com arquivo opcional e alerta de vencimento (30/60/90 dias em `/admin/documentos`). Arquivar exige motivo e mantém o histórico. Datas sem hora são gravadas ao meio-dia UTC para não mudarem de dia no fuso do Brasil.
- **Vida do Veículo (seção 31):** `vehicle_events` (imutável) recebe entrada na frota, fotos, documentos, status, bloqueio/desbloqueio, KM e alterações administrativas, com data, hora, responsável, descrição e origem. Paginação por cursor (data + id). Cada campo alterado também vai para `vehicle_history` com valor anterior e novo. Placa, chassi, RENAVAM, KM e aquisição exigem motivo.
- **Usuários e perfis (seções 16, 17):** a pessoa cria a conta em Entrar; o administrador a encontra pelo e-mail e concede o perfil com motivo. Regras: só quem tem `users:roles.assign`; ninguém altera os próprios perfis; ADMIN só por ADMIN; Cliente não é retirado; a empresa nunca fica sem administrador; perfil interno exige e-mail confirmado.
- **Auditoria (seção 80):** `/admin/historico` lista quem fez, o quê, quando, em qual registro, valor anterior e novo e IP, com filtros por área e período. Todas as ações desta etapa gravam auditoria na mesma transação.
- **Configurações:** categorias (com CNH exigida) e localizações.
- **Serviços:** `packages/services/src/fleet.ts`, `users.ts`, `admin.ts`. Regras puras em `packages/core/src/fleet.ts` e `rbac.ts` (`canAccessAdmin`, `canRevokeRole`).

## 13. Rastreamento em duas camadas: veículo + celular do cliente

Decisão do dono (2026-09-28): usar as duas formas por precaução.

1. **Rastreador GPS no veículo (principal).** Funciona com o celular do cliente desligado. Integração pela interface genérica `TelematicsAdapter` (`packages/integrations/src/telematics`); o fornecedor ainda não foi escolhido, então só existe o adapter simulado (`TELEMATICS_PROVIDER=fake`, proibido em produção).
2. **Localização do celular do cliente (complemento).** Ativada obrigatoriamente na etapa **Localização** do cadastro: o cliente lê a autorização, marca o aceite e o app pede a permissão do aparelho. O aceite só é gravado junto com uma posição real (prova de que a permissão foi concedida). Sem isso o cadastro não é enviado para análise e a elegibilidade de locação falha (`TRACKING_CONSENT`).

**Segundo plano exige app nativo.** Navegador e PWA só entregam localização com a tela aberta (limite do Android e do iOS). Por isso o site é empacotado com **Capacitor** em `apps/mobile` (Android e iPhone), usando o plugin `@capacitor-community/background-geolocation`: durante a locação o Android mostra uma notificação fixa ("Locação em andamento") e o iPhone usa o modo de localização em segundo plano. O mesmo código do site detecta o app (`window.Capacitor`) em `apps/web/src/lib/location-tracker.ts`; no navegador cai para o modo com tela aberta.

**Quando o celular envia.** `TrackingAgent` (montado no cabeçalho para quem está logado) pergunta ao servidor (`GET /api/me/tracking`). Só há envio com aceite vigente **e** locação em retirada, ativa ou em devolução (`TRACKED_RENTAL_STATUSES`). Fora disso `POST /api/me/locations` não grava nada e responde `track: false`, e o app para sozinho. Lotes de até 200 pontos; pontos com data no futuro ou com mais de 7 dias são descartados.

**LGPD.**
- Tabela `consents`: tipo, versão e SHA-256 do texto exibido, plataforma, data, IP e aparelho. Não pode ser apagada nem alterada (trigger `consents_protect`); só a retirada (`revoked_at`) é registrada. Mudou o texto? Troque `TRACKING_CONSENT_VERSION` e todos aceitam de novo.
- Tabela `customer_locations`: somente inserção pelo papel da aplicação, vinculada ao aceite e à locação; isolada por empresa (RLS).
- Retirada: `DELETE /api/me/tracking`. Bloqueia novas locações, avisa o cliente e registra na auditoria; o rastreador do veículo continua ativo porque pertence à frota.
- O painel de análise mostra se o cliente autorizou e por qual aparelho.
- O contrato da etapa 4 deve repetir a cláusula de rastreamento (texto em `TRACKING_CONSENT_TEXT`) e o prazo de retenção das posições, a definir com o jurídico.

**Cruzamento das camadas.** `compareTrackingLayers` classifica: juntos, separados (celular longe do carro), só o celular comunica (rastreador sem sinal ou violado) e só o carro comunica. Na etapa 9 isso vira alerta na central Foccus Security.

