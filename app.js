import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';

import { pool } from './src/database/index.js';
import authRoutes from './src/routes/authRoutes.js';
import expenseRoutes from './src/routes/expenseRoutes.js';
import incomeRoutes from './src/routes/incomeRoutes.js';
import cardRoutes from './src/routes/cardRoutes.js';
import investmentRoutes from './src/routes/investmentRoutes.js';
import categoryRoutes from './src/routes/categoryRoutes.js';
import thresholdRoutes from './src/routes/thresholdRoutes.js';
import dashboardRoutes from './src/routes/dashboardRoutes.js';
import userRoutes from './src/routes/userRoutes.js';
import currencyRoutes from './src/routes/currencyRoutes.js';
import planRoutes from "./src/routes/planRoutes.js";
import financeRoutes from './src/routes/financeRoutes.js';

dotenv.config();

const app = express();

const ALLOWED_ORIGINS = [
    'https://nexus-frontend-liard-one.vercel.app', // ✅ front atual na Vercel
    'http://localhost:3000',                        // dev local
    'http://10.88.80.40:3000'                       // teste LAN
];

const corsOptions = {
    origin(origin, cb) {
        if (!origin) return cb(null, true); // permite curl/postman/healthchecks
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        return cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
};

app.set('trust proxy', 1);

// CORS precisa vir antes das rotas
app.use(cors(corsOptions));
// Responde preflight para todas as rotas
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(cookieParser());

// Rotas
app.use('/auth', authRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/incomes', incomeRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/investments', investmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/thresholds', thresholdRoutes);
app.use('/api/dashboard', dashboardRoutes);

// ⚠️ confira se esses mounts estão nos paths corretos:
app.use('/api/users', currencyRoutes); // parece trocado (currency em /users)
app.use('/api', userRoutes);           // e userRoutes em /api genérico
app.use('/api/plans', planRoutes);
app.use('/api/finance', financeRoutes);

// Healthcheck
app.get('/ping', async (req, res) => {
    try {
        const result = await pool.query('SELECT NOW()');
        res.send(`Banco conectado! Hora atual: ${result.rows[0].now}`);
    } catch (error) {
        console.error('Erro ao conectar no banco:', error);
        res.status(500).send('Erro ao conectar no banco de dados.');
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
