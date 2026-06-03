# Deploy Single VPS - RifaPro SaaS

Este deploy e seguro somente para 1 processo backend.

- `singleProcessSafe=true`
- `multiInstanceSafe=false`
- Nao usar cluster.
- Nao usar PM2 cluster mode.
- Nao subir multiplas VPS/containers atendendo o mesmo banco ate migrar reservas e locks para transacoes distribuidas.

## 1. Instalar Node

Use Node LTS na VPS:

```bash
node -v
npm -v
```

## 2. Instalar Git

```bash
sudo apt update
sudo apt install -y git
```

## 3. Baixar o projeto

```bash
git clone <repo-url> rifapro-saas
cd rifapro-saas
```

## 4. Instalar dependencias

```bash
npm install
```

## 5. Configurar `.env`

Crie o arquivo `.env` a partir de `.env.example` e preencha os valores reais:

```bash
cp .env.example .env
nano .env
```

Obrigatorio em producao:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `STORAGE_DRIVER=postgres` ou `STORAGE_DRIVER=persistent`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `PUBLIC_BASE_URL`
- `ADMIN_BASE_URL`
- `JWT_SECRET` forte
- `SESSION_SECRET` forte
- `ENABLE_PUBLIC_DEBUG=false`

## 6. Build

```bash
npm run build
```

## 7. Validar producao

```bash
npm run prod:check
```

Corrija qualquer falha antes de iniciar o processo.

## 8. Iniciar com PM2

```bash
sudo npm install -g pm2
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup
```

Confirme que existe apenas 1 processo:

```bash
pm2 list
```

## 9. Configurar Nginx

Exemplo:

```nginx
server {
  server_name rifas.seudominio.com.br admin.seudominio.com.br;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

Recarregue:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 10. Configurar SSL

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rifas.seudominio.com.br -d admin.seudominio.com.br
```

## 11. Testar health

```bash
curl https://rifas.seudominio.com.br/api/health
curl https://admin.seudominio.com.br/api/system/status
```

Verifique:

- `ok=true`
- `storageDriver=postgres` ou `persistent`
- `singleProcessSafe=true`
- `multiInstanceSafe=false`
- `databaseConnected=true`
- `publicDebugEnabled=false`
- `productionReady=true`

## 12. Configurar webhook Asaas

No painel Asaas, configure a URL:

```text
https://rifas.seudominio.com.br/api/webhooks/asaas
```

Use o mesmo token configurado em:

```text
ASAAS_WEBHOOK_TOKEN
```

Eventos recomendados:

- `payment.created`
- `payment.updated`
- `payment.paid`

## 13. Rollback

Guarde o commit atual antes do deploy:

```bash
git rev-parse HEAD
```

Para voltar uma versao:

```bash
git fetch
git checkout <commit-anterior>
npm install
npm run build
npm run prod:check
pm2 restart rifapro-saas --env production
```

Se o problema for somente configuracao, corrija `.env` e rode:

```bash
npm run prod:check
pm2 restart rifapro-saas --env production
```
