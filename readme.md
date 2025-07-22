# 📊 Nexus Backend

Este é o backend da aplicação **Nexus**, uma ferramenta de controle financeiro pessoal. A API foi construída com **Node.js**, **Express**, **PostgreSQL** e integra-se com o **Supabase** como banco de dados.

---

## 🚀 Tecnologias Utilizadas

- Node.js
- Express.js
- PostgreSQL
- Supabase (PostgreSQL como serviço)
- JWT (Autenticação)
- Bcrypt (Hash de senha)
- dotenv (Configuração de variáveis ambiente)
- pg (Conexão com PostgreSQL)

---

## 📂 Estrutura de Pastas

```
nexus-backend/
│
├── src/
│   ├── controllers/         # Controladores de rotas
│   ├── database/            # Conexão com banco (pool do PostgreSQL)
│   ├── middlewares/         # Autenticação JWT
│   ├── routes/              # Definição das rotas Express
│   └── services/            # Lógica de negócios e queries SQL
│
├── .env                     # Variáveis de ambiente
├── app.js                   # Entrada principal da aplicação
└── package.json             # Dependências e scripts

```

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` na raiz com o seguinte conteúdo:

```
DATABASE_URL=postgresql://postgres:<SUA_SENHA>@<host_do_supabase>:5432/postgres
PORT=3001
JWT_SECRET=sua_chave_jwt_segura

````

---

## 🧪 Scripts

- `npm install` – Instala dependências
- `npm run dev` – Inicia o servidor em modo desenvolvimento com `nodemon`

Adicione no `package.json`:

```json
"scripts": {
  "dev": "nodemon app.js"
}
````

---

## 🔐 Autenticação

Utiliza JWT para autenticação. Após login, o token deve ser enviado no header `Authorization` como:

```
Bearer <seu_token_aqui>
```

---

## 📌 Endpoints

### 🔑 Auth

* `POST /auth/register`
  Registra um novo usuário.
  Body:

  ```json
  {
    "nome": "Leonardo",
    "email": "leo@email.com",
    "senha": "123456"
  }
  ```

* `POST /auth/login`
  Retorna token de autenticação.
  Body:

  ```json
  {
    "email": "leo@email.com",
    "senha": "123456"
  }
  ```

---

### 💸 Despesas (`/expenses`)

* `POST /expenses`
* `GET /expenses?mes=7&ano=2025`
* `PUT /expenses/:id`
* `DELETE /expenses/:id`

Campos esperados:

```json
{
  "descricao": "Almoço",
  "valor": 50,
  "data": "2025-07-22",
  "forma_pagamento": "dinheiro",
  "categoria_id": 1,
  "cartao_id": null (ou id de cartão)
}
```

---

### 💰 Receitas (`/incomes`)

* `POST /incomes`
* `GET /incomes?mes=7&ano=2025`
* `PUT /incomes/:id`
* `DELETE /incomes/:id`

Campos esperados:

```json
{
  "descricao": "Salário",
  "valor": 3000,
  "data": "2025-07-20",
  "tipo": "fixa" (ou "variável")
}
```

---

### 💳 Cartões (`/cards`)

* `POST /cards`
* `GET /cards`
* `PUT /cards/:id`
* `DELETE /cards/:id`

Campos esperados:

```json
{
  "apelido": "Nubank",
  "numero": "1234", // últimos 4 dígitos
  "cor": "#9BD60C"
}
```

---

### 🏦 Investimentos (`/investments`)

* `POST /investments`
* `GET /investments?mes=7&ano=2025`
* `PUT /investments/:id`
* `DELETE /investments/:id`

Campos esperados:

```json
{
  "tipo": "Cripto",
  "nome": "Bitcoin",
  "quantidade": 0.05,
  "descricao": "Compra mensal",
  "data": "2025-07-10"
}
```

---

### 🏷️ Categorias (`/categories`)

* `POST /categories`
* `GET /categories`
* `PUT /categories/:id`
* `DELETE /categories/:id`

Campos esperados:

```json
{
  "nome": "Alimentação",
  "cor": "#FF5733"
}
```

---

## 🔐 Middleware

* `authenticateToken`: Middleware responsável por verificar e validar o token JWT em rotas protegidas.

---

## ✅ Testes

Utilize o **Insomnia** ou **Postman** para testar todas as rotas com e sem token JWT.
Certifique-se de sempre enviar `Authorization: Bearer <token>` nas rotas protegidas.

---

## 🧠 Observações

* Cada usuário acessa **apenas seus próprios dados**.
* Integração com Supabase é feita via conexão direta PostgreSQL (`DATABASE_URL`).
* Tabelas com chaves estrangeiras garantem integridade referencial.

---

## 📅 Futuro

* Validação com `Joi` ou `Zod`
* Paginação de resultados
* Exportação de dados (CSV, PDF)
* Notificações por e-mail/SMS
* Dashboard com alertas de limite

---

## 👨‍💻 Autor

Desenvolvido por **Leonardo Franca Almeida Silva**
Engenharia de Computação · CIMATEC · 2025


