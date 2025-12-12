# WhatsApp SaaS Backend

Backend API para WhatsApp SaaS construído com Node.js, Express e whatsapp-web.js.

## 🚀 Deploy Rápido no Railway

### Variáveis Necessárias:

\`\`\`env
SUPABASE_URL=https://jjywkbaqukbexnpsdpcf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key_do_supabase
FRONTEND_URL=https://seu-projeto.vercel.app
PORT=3001
NODE_ENV=production
\`\`\`

**Como pegar a Service Role Key:**
1. Acesse: https://supabase.com/dashboard/project/jjywkbaqukbexnpsdpcf/settings/api
2. Copie a "Service Role Key" (clique no olho para revelar)

---

## 📦 Setup Local

1. Instalar dependências:
\`\`\`bash
npm install
\`\`\`

2. Copiar `.env.example` para `.env`:
\`\`\`bash
cp .env.example .env
\`\`\`

3. Preencher as variáveis no `.env`

4. Rodar em desenvolvimento:
\`\`\`bash
npm run dev
\`\`\`

5. Build para produção:
\`\`\`bash
npm run build
npm start
\`\`\`

---

## 🔌 API Endpoints

### Autenticação
Todos os endpoints (exceto webhooks) requerem Bearer token no header Authorization.

### Instâncias WhatsApp
- `POST /api/instances` - Criar nova instância
- `POST /api/instances/:id/start` - Iniciar instância e gerar QR
- `GET /api/instances` - Listar todas as instâncias
- `GET /api/instances/:id/status` - Status da instância
- `GET /api/instances/:id/contacts` - Contatos da instância

### Mensagens
- `GET /api/instances/:instanceId/chats/:contactId/messages` - Histórico de mensagens
- `POST /api/instances/:instanceId/messages` - Enviar mensagem

### Dashboard
- `GET /api/dashboard?projectId=xxx` - Métricas diárias

### Webhooks
- `POST /api/webhooks/sales` - Registrar evento de venda

---

## 🔄 Eventos Socket.IO

### Emitidos pelo servidor:
- `qr` - QR code gerado
- `instance_status` - Status da instância mudou
- `message_received` - Nova mensagem recebida

---

## 📁 Arquitetura

\`\`\`
backend/
├── src/
│   ├── config/         # Arquivos de configuração
│   ├── whatsapp/       # Gerenciamento de clientes WhatsApp
│   ├── routes/         # Rotas da API
│   ├── middleware/     # Middlewares Express
│   └── server.ts       # Servidor principal
├── package.json
└── tsconfig.json
\`\`\`

---

## 🐛 Troubleshooting

**Backend não inicia:**
- Verifique se todas as variáveis de ambiente estão configuradas
- Verifique se o Supabase está acessível

**QR Code não aparece:**
- Aguarde alguns segundos após iniciar a instância
- Verifique os logs do Socket.IO no console

**Mensagens não chegam:**
- Verifique se a instância está com status "connected"
- Verifique se o número está correto (formato internacional)
