import { Router } from 'express'
import {
    createIncome,
    getIncomes,
    getIncomesByMonth,
    getIncomeStats,
    getMonthlyTotal,
    getTotalByCategory,
    updateIncome,
    deleteIncome,
    getCategoryResume
} from '../controllers/incomeController'
import { authenticateToken } from '../middlewares/authMiddleware'

const router = Router()

// Aplicar middleware de autenticação a todas as rotas
router.use(authenticateToken)

// POST /api/incomes - Criar receita
router.post('/', createIncome)

// GET /api/incomes - Buscar receitas (por intervalo ou mês/ano)
router.get('/', getIncomes)

// GET /api/incomes/by-month - Receitas agrupadas por mês
router.get('/by-month', getIncomesByMonth)

// GET /api/incomes/stats - Estatísticas de receitas
router.get('/stats', getIncomeStats)

// GET /api/incomes/monthly-total - Total mensal
router.get('/monthly-total', getMonthlyTotal)

// GET /api/incomes/category-resume - Resumo por categoria
router.get('/category-resume', getCategoryResume)

// GET /api/incomes/total-by-category/:categoryId - Total por categoria
router.get('/total-by-category/:categoryId', getTotalByCategory)

// PUT /api/incomes/:id - Atualizar receita
router.put('/:id', updateIncome)

// DELETE /api/incomes/:id - Deletar receita
router.delete('/:id', deleteIncome)

export default router