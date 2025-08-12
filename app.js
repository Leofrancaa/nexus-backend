import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { pool } from './src/database/index.js'
import authRoutes from './src/routes/authRoutes.js'
import expenseRoutes from './src/routes/expenseRoutes.js'
import incomeRoutes from './src/routes/incomeRoutes.js'
import cardRoutes from './src/routes/cardRoutes.js'
import investmentRoutes from './src/routes/investmentRoutes.js'
import categoryRoutes from './src/routes/categoryRoutes.js'
import thresholdRoutes from './src/routes/thresholdRoutes.js'
import dashboardRoutes from './src/routes/dashboardRoutes.js'
import userRoutes from './src/routes/userRoutes.js'
import currencyRoutes from './src/routes/currencyRoutes.js'
import planRoutes from "./src/routes/planRoutes.js";
import financeRoutes from './src/routes/financeRoutes.js';



import cookieParser from 'cookie-parser'

dotenv.config()

const app = express()

const corsOptions = {
    origin: [
        "http://localhost:3000",       // local dev
        "http://10.88.80.40:3000",     // teste LAN
        "https://nexus-tpz3.onrender.com" // front em produção
    ],
    credentials: true, // permite cookies/autenticação
};

app.set("trust proxy", 1); // para aceitar o cabeçalho X-Forwarded-For em produção

app.use(cors(corsOptions));
app.use(express.json())

app.use(cookieParser())

app.use('/auth', authRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/incomes', incomeRoutes)
app.use('/api/cards', cardRoutes)
app.use('/api/investments', investmentRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/thresholds', thresholdRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/users', currencyRoutes)
app.use("/api", userRoutes);
app.use("/api/plans", planRoutes);
app.use('/api/finance', financeRoutes);

// Rota de teste para verificar conexão com o banco
app.get('/ping', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()')
        res.send(`Banco conectado! Hora atual: ${result.rows[0].now}`)
    } catch (error) {
        console.error('Erro ao conectar no banco:', error)
        res.status(500).send('Erro ao conectar no banco de dados.')
    }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`)
})
