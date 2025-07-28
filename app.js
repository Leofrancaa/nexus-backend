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

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

app.use('/auth', authRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/incomes', incomeRoutes)
app.use('/api/cards', cardRoutes)
app.use('/api/investments', investmentRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/thresholds', thresholdRoutes)
app.use('/api/dashboard', dashboardRoutes)


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
