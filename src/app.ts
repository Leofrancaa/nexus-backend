import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { pool, testConnection } from './database/index'

// Routes
import authRoutes from './routes/authRoutes'
import expenseRoutes from './routes/expenseRoutes'
import incomeRoutes from './routes/incomeRoutes'
import cardRoutes from './routes/cardRoutes'
import categoryRoutes from './routes/categoryRoutes'
import thresholdRoutes from './routes/thresholdRoutes'
import dashboardRoutes from './routes/dashboardRoutes'
import userRoutes from './routes/userRoutes'
import currencyRoutes from './routes/currencyRoutes'
import planRoutes from './routes/planRoutes'

// Carregar variáveis de ambiente
dotenv.config()

const app: Application = express()

// CORS Configuration para Vercel
const allowedOrigins: (string | RegExp)[] = [
    "http://localhost:3000",
    "http://10.88.80.40:3000",
    "https://nexus-frontend-virid.vercel.app",
    /\.vercel\.app$/
]

if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL)
}

const corsOptions = {
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}

// Middlewares
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Routes
app.use('/auth', authRoutes)
app.use('/api/expenses', expenseRoutes)
app.use('/api/incomes', incomeRoutes)
app.use('/api/cards', cardRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/thresholds', thresholdRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/users', currencyRoutes)
app.use('/api', userRoutes)
app.use('/api/plans', planRoutes)

// Health check
app.get('/ping', async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query('SELECT NOW() as current_time')
        res.status(200).json({
            status: 'OK',
            message: 'Banco conectado!',
            database_time: result.rows[0].current_time,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error('Erro ao conectar no banco:', error)
        res.status(500).json({
            status: 'ERROR',
            message: 'Erro ao conectar no banco de dados.'
        })
    }
})

app.get('/health', (req: Request, res: Response): void => {
    res.status(200).json({
        status: 'OK',
        message: 'API Nexus funcionando no Vercel',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'production',
        timestamp: new Date().toISOString()
    })
})

app.get('/', (req: Request, res: Response): void => {
    res.status(200).json({
        message: 'Nexus Backend API está rodando!',
        version: '2.0.0',
        endpoints: {
            health: '/health',
            ping: '/ping',
            auth: '/auth',
            api: '/api'
        }
    })
})

// 404 handler
app.use('*', (req: Request, res: Response): void => {
    res.status(404).json({
        error: 'Rota não encontrada',
        path: req.originalUrl,
        method: req.method
    })
})

// Não usar app.listen no Vercel (serverless)
// Para desenvolvimento local, descomente:
// if (process.env.NODE_ENV !== 'production') {
//     const PORT = process.env.PORT || 3001
//     app.listen(PORT, () => {
//         console.log(`🚀 Servidor rodando na porta ${PORT}`)
//     })
// }

export default app