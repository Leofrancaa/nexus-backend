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

// CORS Configuration
const corsOptions = {
    origin: [
        "http://localhost:3000",       // local dev
        "http://10.88.80.40:3000",     // teste LAN
        "https://nexus-frontend-liard-one.vercel.app" // front em produção
    ],
    credentials: false, // Não precisamos mais de cookies
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}

// Middlewares globais
app.set("trust proxy", 1)
app.use(cors(corsOptions))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

// Logging middleware para desenvolvimento
if (process.env.NODE_ENV === 'development') {
    app.use((req: Request, res: Response, next) => {
        const timestamp = new Date().toISOString()
        console.log(`[${timestamp}] ${req.method} ${req.path}`)
        next()
    })
}

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

// Health check routes
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
            message: 'Erro ao conectar no banco de dados.',
            error: process.env.NODE_ENV === 'development' ? error : undefined
        })
    }
})

app.get('/health', (req: Request, res: Response): void => {
    res.status(200).json({
        status: 'OK',
        message: 'API Nexus funcionando',
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
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

// Error handler global
app.use((error: Error, req: Request, res: Response, next: any): void => {
    console.error('Erro não tratado:', error)

    res.status(500).json({
        error: 'Erro interno do servidor',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Algo deu errado',
        timestamp: new Date().toISOString()
    })
})

// Inicialização do servidor
const PORT = process.env.PORT || 3001

const startServer = async (): Promise<void> => {
    try {
        // Testar conexão com o banco
        const dbConnected = await testConnection()

        if (!dbConnected) {
            console.error('❌ Falha ao conectar com o banco de dados. Encerrando aplicação.')
            process.exit(1)
        }

        // Iniciar servidor
        app.listen(PORT, () => {
            console.log(`🚀 Servidor rodando na porta ${PORT}`)
            console.log(`📊 API Nexus - Versão TypeScript`)
            console.log(`🔐 Autenticação: Bearer Token apenas`)
            console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`)
            console.log(`📍 Health check: http://localhost:${PORT}/health`)
        })
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error)
        process.exit(1)
    }
}

// Tratamento de sinais para graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Recebido SIGINT. Encerrando servidor graciosamente...')
    await pool.end()
    process.exit(0)
})

process.on('SIGTERM', async () => {
    console.log('\n🛑 Recebido SIGTERM. Encerrando servidor graciosamente...')
    await pool.end()
    process.exit(0)
})

// Iniciar a aplicação
startServer()

export default app