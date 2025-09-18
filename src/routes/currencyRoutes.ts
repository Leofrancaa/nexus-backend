import { Router } from 'express'
import {
    getCurrency,
    updateCurrency,
    getSupportedCurrencies,
    convertCurrency,
    getFinancialSummary
} from '../controllers/currencyController.js'
import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = Router()

// Aplicar middleware de autenticação a todas as rotas
router.use(authenticateToken)

// GET /api/users/currency - Buscar moeda atual do usuário
router.get('/currency', getCurrency)

// PUT /api/users/currency - Atualizar moeda do usuário
router.put('/currency', updateCurrency)

// GET /api/users/currency/supported - Moedas suportadas
router.get('/currency/supported', getSupportedCurrencies)

// POST /api/users/currency/convert - Converter entre moedas
router.post('/currency/convert', convertCurrency)

// GET /api/users/currency/summary - Resumo financeiro formatado
router.get('/currency/summary', getFinancialSummary)

export default router