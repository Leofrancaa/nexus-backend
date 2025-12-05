import express, { Application, Request, Response } from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'

// Routes
import authRoutes from './routes/authRoutes'
import expenseRoutes from './routes/expenseRoutes'
import incomeRoutes from './routes/incomeRoutes'
import cardRoutes from './routes/cardRoutes'
import categoryRoutes from './routes/categoryRoutes'
import thresholdRoutes from './routes/thresholdRoutes'
import goalRoutes from './routes/goalRoutes'
import dashboardRoutes from './routes/dashboardRoutes'
import userRoutes from './routes/userRoutes'
import currencyRoutes from './routes/currencyRoutes'
import planRoutes from './routes/planRoutes'
import inviteCodeRoutes from './routes/inviteCodeRoutes'
import adminRoutes from './routes/adminRoutes'

// Carregar variáveis de ambiente
dotenv.config()

const app: Application = express()

// CORS Configuration para Vercel
const allowedOrigins: (string | RegExp)[] = [
    "http://localhost:3000",
    "http://10.88.80.40:3000",
    "https://nexus-frontend-virid.vercel.app",
    "https://nexus-fintool.vercel.app",
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

// Security Middlewares
app.use(helmet({
    contentSecurityPolicy: false, // Desabilitar CSP para compatibilidade com Vercel
    crossOriginEmbedderPolicy: false
}))

// Rate limiting para prevenir ataques de força bruta
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Máximo de 100 requisições por IP
    message: 'Muitas requisições deste IP, tente novamente em alguns minutos.',
    standardHeaders: true,
    legacyHeaders: false,
})

// Rate limiting mais restritivo para rotas de autenticação
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Máximo de 10 tentativas de login por IP
    message: 'Muitas tentativas de login, tente novamente em alguns minutos.',
    standardHeaders: true,
    legacyHeaders: false,
})

// Aplicar rate limiters
app.use('/auth/login', authLimiter)
app.use('/auth/register', authLimiter)
app.use(limiter)

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
app.use('/api/goals', goalRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/users', currencyRoutes)
app.use('/api', userRoutes)
app.use('/api/plans', planRoutes)
app.use('/api/invite-codes', inviteCodeRoutes)
app.use('/api/admin', adminRoutes)

// Health check
app.get('/ping', async (req: Request, res: Response): Promise<void> => {
    try {
        console.log('Testing database connection...')

        // Teste simples sem pool existente
        const { Pool } = require('pg')
        const testPool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false },
            max: 1,
            connectionTimeoutMillis: 10000
        })

        const result = await testPool.query('SELECT NOW() as current_time')
        await testPool.end()

        res.status(200).json({
            status: 'OK',
            message: 'Banco conectado!',
            database_time: result.rows[0].current_time,
            timestamp: new Date().toISOString()
        })
    } catch (error) {
        console.error('Database error:', error)
        res.status(500).json({
            status: 'ERROR',
            message: 'Erro ao conectar no banco de dados.',
            error: {
                message: (error as any)?.message,
                code: (error as any)?.code,
                address: (error as any)?.address,
                port: (error as any)?.port
            }
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

// Adicione este endpoint simples no src/app.ts:

app.get('/test-env', (req: Request, res: Response) => {
    res.json({
        DATABASE_URL: process.env.DATABASE_URL ? 'CONFIGURED' : 'NOT SET',
        DATABASE_URL_preview: process.env.DATABASE_URL ?
            process.env.DATABASE_URL.substring(0, 30) + '...' : 'N/A',
        NODE_ENV: process.env.NODE_ENV,
        timestamp: new Date().toISOString()
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
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3001
    app.listen(PORT, () => {
        console.log(`🚀 Servidor rodando na porta ${PORT}`)
    })
}

export default app