import { Router } from 'express'
import {
    createExpense,
    getExpenses,
    getExpensesByMonth,
    getExpenseStats,
    getMonthlyTotal,
    getTotalByCategory,
    getResumoCategorias,
    updateExpense,
    deleteExpense
} from '../controllers/expenseController'
import { authenticateToken } from '../middlewares/authMiddleware'

const router = Router()

// Aplicar middleware de autenticação a todas as rotas
router.use(authenticateToken)

// POST /api/expenses - Criar despesa
router.post('/', createExpense)

// GET /api/expenses - Buscar despesas (por intervalo ou mês/ano)
router.get('/', getExpenses)

// GET /api/expenses/by-month - Despesas agrupadas por mês
router.get('/by-month', getExpensesByMonth)

// GET /api/expenses/stats - Estatísticas de despesas
router.get('/stats', getExpenseStats)

// GET /api/expenses/monthly-total - Total mensal
router.get('/monthly-total', getMonthlyTotal)

// GET /api/expenses/total-by-category/:categoryId - Total por categoria
router.get('/total-by-category/:categoryId', getTotalByCategory)

// GET /api/expenses/category-resume - Resumo por categorias
router.get('/category-resume', getResumoCategorias)

// PUT /api/expenses/:id - Atualizar despesa
router.put('/:id', updateExpense)

// DELETE /api/expenses/:id - Deletar despesa
router.delete('/:id', deleteExpense)

export default router