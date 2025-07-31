import express from 'express'
import {
    createExpense,
    getExpenses,
    updateExpense,
    deleteExpense,
    getExpenseHistory,
    getTotalByCategoria
} from '../controllers/expenseController.js'

import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', authenticateToken, createExpense)
router.get('/', authenticateToken, getExpenses)
router.get('/history/:id', authenticateToken, getExpenseHistory)
router.get("/total-by-category/:categoryId", authenticateToken, getTotalByCategoria);
router.put('/:id', authenticateToken, updateExpense)
router.delete('/:id', authenticateToken, deleteExpense)

export default router;

