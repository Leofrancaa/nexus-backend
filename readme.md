# 💰 Nexus Backend - TypeScript Edition

Sistema completo de controle financeiro pessoal desenvolvido em **TypeScript**, **Express**, **PostgreSQL** e **Supabase**.

![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18+-green?logo=node.js)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-blue?logo=postgresql)
![Express](https://img.shields.io/badge/Express-4.21+-lightgrey?logo=express)

## 🚀 Como Rodar o Projeto

### **Pré-requisitos**

- Node.js 18+
- PostgreSQL (ou conta no Supabase)
- npm ou yarn

### **1. Clonar e Instalar**

```bash
git clone <repository-url>
cd nexus-backend
npm install
```

### **2. Configurar Variáveis de Ambiente**

Crie um arquivo `.env` na raiz:

```env
# Banco de Dados (Supabase ou PostgreSQL local)
DATABASE_URL=postgresql://postgres:PASSWORD@HOST:5432/DATABASE

# JWT Secret (gere uma chave segura)
JWT_SECRET=sua_chave_jwt_super_segura_aqui

# Porta do servidor
PORT=3001

# Ambiente
NODE_ENV=development
```

### **3. Executar em Desenvolvimento**

```bash
# Compilar TypeScript e rodar em modo watch
npm run dev

# Ou compilar e rodar separadamente
npm run build
npm start

# Verificar tipos sem executar
npm run type-check
```

### **4. Testar a API**

```bash
# Executar suite de testes
npm test

# Health check
curl http://localhost:3001/health
```

## 📋 Scripts Disponíveis

```json
{
  "build": "tsc", // Compilar TypeScript
  "start": "node dist/app.js", // Rodar versão compilada
  "dev": "tsx watch src/app.ts", // Desenvolvimento com hot reload
  "type-check": "tsc --noEmit", // Verificar tipos
  "clean": "rm -rf dist" // Limpar build
}
```

## 🧪 Testando o Sistema

### **Health Check**

```bash
curl http://localhost:3001/health
# Resposta esperada: {"status":"OK","version":"2.0.0",...}
```

### **Ping Database**

```bash
curl http://localhost:3001/ping
# Resposta esperada: {"status":"OK","message":"Banco conectado!",...}
```

## 🔐 Autenticação

### **1. Registrar Usuário**

```bash
curl -X POST http://localhost:3001/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "João Silva",
    "email": "joao@email.com",
    "senha": "123456"
  }'
```

### **2. Fazer Login**

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joao@email.com",
    "senha": "123456"
  }'
```

### **3. Usar Token nas Requisições**

```bash
# Salvar o token retornado no login
TOKEN="seu_jwt_token_aqui"

# Usar em todas as requisições autenticadas
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/dashboard
```

## 📊 Endpoints Principais

### **Dashboard**

```bash
# Dashboard completo
GET /api/dashboard

# Estatísticas rápidas
GET /api/dashboard/quick-stats

# Tendências (últimos 6 meses)
GET /api/dashboard/trends
```

### **Despesas**

```bash
# Criar despesa
POST /api/expenses
{
  "metodo_pagamento": "credito",
  "tipo": "Alimentação",
  "quantidade": 50.00,
  "data": "2025-01-15",
  "card_id": 1,
  "category_id": 1
}

# Listar despesas
GET /api/expenses?start_date=2025-01-01&end_date=2025-01-31

# Estatísticas
GET /api/expenses/stats?month=1&year=2025
```

### **Receitas**

```bash
# Criar receita
POST /api/incomes
{
  "tipo": "Salário",
  "quantidade": 3000.00,
  "data": "2025-01-01",
  "fixo": true,
  "category_id": 1
}

# Listar receitas
GET /api/incomes?start_date=2025-01-01&end_date=2025-01-31
```

### **Cartões**

```bash
# Criar cartão
POST /api/cards
{
  "nome": "Nubank",
  "tipo": "credito",
  "numero": "1234",
  "cor": "#8A2BE2",
  "limite": 1000.00,
  "dia_vencimento": 10
}

# Pagar fatura
POST /api/cards/1/pay-invoice
{
  "mes": 1,
  "ano": 2025
}
```

### **Categorias**

```bash
# Criar categoria
POST /api/categories
{
  "nome": "Alimentação",
  "cor": "#FF6B6B",
  "tipo": "despesa"
}

# Listar com hierarquia
GET /api/categories?tree=true
```

### **Limites (Thresholds)**

```bash
# Criar limite
POST /api/thresholds
{
  "category_id": 1,
  "valor": 500.00
}

# Ver alertas
GET /api/thresholds/alerts
```

### **Planos**

```bash
# Criar plano
POST /api/plans
{
  "nome": "Viagem Europa",
  "meta": 10000.00,
  "prazo": "2025-12-31",
  "descricao": "Férias em família"
}

# Contribuir
POST /api/plans/1/contribute
{
  "valor": 500.00
}
```

## 🏗️ Arquitetura

```
src/
├── controllers/     # HTTP request handlers
├── services/        # Business logic layer
├── routes/         # API route definitions
├── middlewares/    # Custom middlewares
├── types/          # TypeScript type definitions
├── utils/          # Helper functions
├── database/       # Database connection
└── cache/          # Temporary cache files
```

## 🛡️ Segurança

- ✅ **JWT Authentication** - Tokens seguros com expiração
- ✅ **Password Hashing** - bcrypt com salt rounds
- ✅ **Input Validation** - Sanitização de dados
- ✅ **SQL Injection Protection** - Queries parametrizadas
- ✅ **CORS Configuration** - Controle de origem
- ✅ **Rate Limiting** - Proteção contra spam

## 🎯 Features Implementadas

### **💰 Gestão Financeira**

- [x] Receitas e despesas com categorização
- [x] Sistema completo de cartão de crédito
- [x] Pagamento automático de faturas
- [x] Receitas fixas com replicação mensal
- [x] Despesas parceladas no cartão

### **📊 Dashboard & Analytics**

- [x] Dashboard completo com métricas
- [x] Comparativos mensais
- [x] Top categorias de gasto
- [x] Tendências dos últimos 6 meses
- [x] Alertas de cartões vencendo

### **🎯 Planejamento**

- [x] Metas financeiras (planos)
- [x] Sistema de contribuições
- [x] Cálculo automático de progresso
- [x] Limites de gasto por categoria
- [x] Alertas de threshold excedido

### **🔧 Sistema**

- [x] Multi-moeda (BRL, USD, EUR, GBP)
- [x] Suporte hierárquico de categorias
- [x] API RESTful completa
- [x] Documentação automática via tipos
- [x] Tratamento robusto de erros

## 🚨 Troubleshooting

### **Erro de Conexão com Banco**

```bash
# Verificar se o PostgreSQL está rodando
pg_ctl status

# Testar conexão manual
psql $DATABASE_URL
```

### **Erro de Compilação TypeScript**

```bash
# Limpar cache e rebuild
npm run clean
npm run build

# Verificar erros de tipo
npm run type-check
```

### **Token JWT Inválido**

```bash
# Verificar se JWT_SECRET está definido
echo $JWT_SECRET

# Gerar novo token fazendo login novamente
curl -X POST http://localhost:3001/auth/login ...
```

## 📈 Próximos Passos

- [ ] Testes automatizados (Jest + Supertest)
- [ ] Docker + Docker Compose
- [ ] Documentação OpenAPI/Swagger
- [ ] Rate limiting avançado
- [ ] Cache Redis para performance
- [ ] Webhook para notificações
- [ ] Backup automático de dados
- [ ] Logs estruturados

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma feature branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -am 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença **MIT**. Veja o arquivo `LICENSE` para detalhes.

---

## ⚡ Quick Start

```bash
# Clone, instale e execute em 30 segundos
git clone <repo-url> && cd nexus-backend
npm install
cp .env.example .env  # Configure seu DATABASE_URL
npm run dev
```

**🎉 Pronto! Sua API está rodando em `http://localhost:3001`**

## Licença e Direitos Autorais

Copyright © 2025 Leonardo Franca Almeida Silva. Todos os direitos reservados.

Este projeto e todo o seu código-fonte são propriedade privada e confidencial. Nenhuma parte deste software pode ser reproduzida, distribuída, modificada ou utilizada sem autorização expressa por escrito do autor.

### Restrições de Uso

- ❌ Não é permitida a reprodução ou cópia do código
- ❌ Não é permitida a distribuição ou comercialização
- ❌ Não é permitida a modificação ou criação de trabalhos derivados
- ❌ Não é permitido o uso para fins comerciais ou pessoais sem autorização

### Isenção de Responsabilidade

Este software é fornecido "como está", sem garantias de qualquer tipo, expressas ou implícitas. O autor não se responsabiliza por quaisquer danos diretos, indiretos, incidentais, especiais ou consequenciais decorrentes do uso ou da incapacidade de uso deste software.

### Contato

Para solicitações de licenciamento ou permissões, entre em contato através de [leofrancal17@gmail.com].

---

**AVISO**: O uso não autorizado deste código está sujeito a ações legais.
