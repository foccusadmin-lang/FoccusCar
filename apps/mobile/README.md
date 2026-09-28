# Foccus Car — app Android e iPhone

O app nativo abre o próprio site da Foccus Car e acrescenta o que o navegador não permite:
**enviar a localização do celular em segundo plano durante a locação**. Não há outra base de
código: telas, regras e login são os do site (`apps/web`).

## Como funciona

- `capacitor.config.ts` aponta para o site publicado (`FOCCUS_APP_URL`, padrão `https://app.foccuscar.com.br`).
- `www/index.html` só aparece quando não há internet.
- O plugin `@capacitor-community/background-geolocation` é chamado pelo site em
  `apps/web/src/lib/location-tracker.ts`. No Android ele roda um serviço com notificação fixa
  ("Locação em andamento"); no iPhone usa o modo de localização em segundo plano.
- O servidor decide quando enviar: só com aceite LGPD e locação em andamento (docs/ARQUITETURA.md, seção 13).

## Gerar o app

Pré-requisitos: Node 22 e pnpm. Android Studio para Android; um Mac com Xcode para iPhone.

```bash
pnpm install
cd apps/mobile
FOCCUS_APP_URL=https://SEU-ENDERECO pnpm android   # abre o Android Studio
FOCCUS_APP_URL=https://SEU-ENDERECO pnpm ios       # abre o Xcode (só no Mac)
```

No Android Studio: **Build → Generate Signed App Bundle** para enviar à Google Play.
No Xcode: selecione o time da conta Apple Developer e use **Product → Archive**.

## Permissões já configuradas

- Android (`android/app/src/main/AndroidManifest.xml`): localização precisa e aproximada,
  serviço em primeiro plano do tipo localização, notificações e câmera.
- iPhone (`ios/App/App/Info.plist`): textos de uso da localização ("durante o uso" e "sempre"),
  câmera e `UIBackgroundModes = location`.

## Publicação nas lojas

- **Google Play:** declare o uso de "serviço em primeiro plano de localização" e explique que ele
  só roda durante a locação, para segurança do veículo. Tenha a política de privacidade publicada.
- **App Store:** a Apple revisa o uso de localização "sempre"; o texto do `Info.plist` e a tela de
  autorização do cadastro já explicam o motivo.

## Pendências conhecidas

- **Login com Google dentro do app:** o Google não aceita login dentro de WebView. No app, o
  login por e-mail e senha funciona; para Google/Apple é preciso abrir o navegador do sistema
  (plugin de navegador + retorno por link do app). Fica para a etapa de produção.
- Ícones e tela de abertura ainda são os padrões do Capacitor; gerar a partir de
  `apps/web/public/icons` com `npx @capacitor/assets generate`.
