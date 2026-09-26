# Ambiente de testes (Vercel + Neon ou Supabase)

Um endereço na internet com o Foccus Car rodando e uma **locadora de demonstração** já preenchida, para testar
como administrador, equipe, cliente e representante antes de liberar para clientes reais.

## O que vem pronto

- **Frota:** 14 veículos em todos os status (disponível, alugado, reservado, manutenção, preparação, bloqueado, inativo),
  com fotos ilustrativas, documentos (CRLV, seguro, IPVA; alguns vencendo e um vencido) e a Vida do Veículo preenchida.
- **Clientes:** 17 clientes em todas as situações de cadastro, com documentos (imagens marcadas "DEMONSTRAÇÃO").
- **Operação:** cerca de 150 reservas e locações nos últimos 6 meses, 3 locações em andamento (uma atrasada),
  reservas futuras, uma aguardando pagamento e uma cancelada com estorno; contratos, checklists, avarias, cauções.
- **Financeiro:** pagamentos, taxas do gateway, despesas fixas e 6 meses de lançamentos.
- **Manutenção, multas, ocorrências, rastreamento** (posições, alerta de saída de área com bloqueio confirmado)
  e **representantes** (ofertas, vendas, carteira e saques).

Todas as telas mostram esses dados. As telas de módulos que ainda não foram construídos aparecem como
**Consulta liberada**: dá para ver os registros, e cadastrar/editar por ali chega na etapa indicada.

## Usuários de teste

Na tela **Entrar** aparece o quadro **Entrar como**: um toque em cada perfil. Senha de todos: `Foccus@2026`.

| Perfil | E-mail | O que testar |
|---|---|---|
| Administrador | admin@demo.foccuscar.com.br | Tudo: painel, frota, clientes, financeiro, segurança, usuários |
| Gerente | gerente@demo.foccuscar.com.br | Operação e financeiro |
| Operador | operador@demo.foccuscar.com.br | Frota, reservas, locações, análise de cadastros |
| Financeiro | financeiro@demo.foccuscar.com.br | Pagamentos, lançamentos, saques |
| Cliente aprovado | cliente@demo.foccuscar.com.br | Locação em andamento, reserva futura, pagamentos |
| Representante | representante@demo.foccuscar.com.br | Ofertas, vendas, carteira e saques |
| Cliente em análise | analise@demo.foccuscar.com.br | Documentos aguardando a equipe (aprove pelo Operador) |
| Cadastro incompleto | pendente@demo.foccuscar.com.br | Completar dados e enviar documentos pela câmera |
| Documento recusado | recusado@demo.foccuscar.com.br | Reenviar a selfie recusada |
| Cliente bloqueado | bloqueado@demo.foccuscar.com.br | Acesso restrito |

Também dá para criar contas novas pelo **Criar conta**: no ambiente de testes não há envio de e-mail, então a
conta entra sem confirmação.

> Nunca use dados reais de clientes neste ambiente: as senhas acima são públicas.

## Como publicar (uma vez, uns 10 minutos)

Só é preciso **uma conta na Vercel**, criada com o próprio GitHub. O banco (Neon) e o armazenamento de arquivos
(Blob) são criados de dentro da Vercel, sem cadastro separado.

1. **Criar a conta:** acesse vercel.com/signup, escolha **Continue with GitHub** e o plano **Hobby** (grátis).
2. **Importar o projeto:** clique em **Add New… → Project**, autorize a Vercel a ver o repositório
   `FoccusCar` e clique em **Import**.
3. **Configurar antes do primeiro deploy:**
   - **Root Directory:** clique em **Edit** e escolha `apps/web`.
   - **Environment Variables:** adicione
     - `DEMO_MODE` = `true`
     - `BETTER_AUTH_SECRET` = um texto aleatório longo (gere um em generate-secret.vercel.app/32 e cole).
   - Clique em **Deploy**. Este primeiro deploy **vai falhar** com "Banco não conectado": é esperado.
4. **Criar o banco:** no projeto, aba **Storage → Create Database → Neon (Serverless Postgres)** → aceite os
   termos, região **São Paulo (sa-east-1)** se aparecer, plano Free → **Connect** ao projeto (marque Production e Preview).
5. **Criar o armazenamento de arquivos:** ainda em **Storage → Create → Blob**, escolha acesso **Private**
   e conecte ao projeto.
6. **Publicar:** aba **Deployments** → no último deploy, menu **⋯ → Redeploy**. Em uns 3 minutos o endereço
   (algo como `foccus-car.vercel.app`) abre o app já com a locadora de demonstração.

Depois disso, cada mudança que entrar na branch `main` publica sozinha no mesmo endereço.

### Usando o Supabase no lugar da Neon

Nos passos 4 e 5, em vez de Neon e Blob, use **Storage → Supabase** (ou conecte um projeto do Supabase pela
integração da Vercel). O mesmo projeto do Supabase serve de banco e de armazenamento de arquivos: as fotos e
os documentos ficam num bucket **privado** `foccus-car`, criado sozinho no primeiro envio.

- Use um projeto **novo e vazio** do Supabase só para o Foccus Car. Se o banco já tiver tabelas de outro
  sistema, o build para com uma mensagem e não altera nada.
- O build retira o acesso da API pública do Supabase (chave `anon`) às tabelas do Foccus Car: tudo passa
  pelo servidor do app, com o isolamento por empresa.
- Variáveis que a integração preenche e o app reconhece: `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`,
  `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

### O que acontece no build

`apps/web/vercel.json` roda `prepare:test-env` antes do `next build`:

1. cria o papel `foccus_app` no banco (sem superusuário e sem `BYPASSRLS`, com senha derivada do
   `BETTER_AUTH_SECRET`), para o isolamento por empresa valer como em produção;
2. aplica migrations e políticas (RLS);
3. com `DEMO_MODE=true`, instala a demonstração só na primeira vez (não duplica nem apaga nada depois);
4. confere que a aplicação conecta como `foccus_app`.

Variáveis que a Vercel preenche sozinha: `DATABASE_URL`, `DATABASE_URL_UNPOOLED` (Neon), `BLOB_READ_WRITE_TOKEN`
(Blob), `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase) e o endereço público do projeto (usado no login quando `BETTER_AUTH_URL` não está definida).

### Recomeçar do zero

No Neon (Storage → abrir o banco), apague e recrie o banco `neondb` ou crie uma branch nova; depois faça
**Redeploy**. A demonstração é instalada de novo, com as datas relativas ao dia.

### Rodar a demonstração no computador

Com o Postgres local do README: `pnpm db:migrate && pnpm db:seed:demo`, e `DEMO_MODE=true` em
`apps/web/.env.local` para ver o quadro **Entrar como**.

## Antes de ir para produção

- Criar um projeto separado (outro banco, sem `DEMO_MODE`), com domínio próprio.
- Plano **Pro** da Vercel: o Hobby é para uso pessoal e não comercial.
- Configurar provedor de e-mail, gateway de pagamento e storage definitivo (S3 ou Cloudflare R2).
