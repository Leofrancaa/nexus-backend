import express from 'express'
import {
    createExpense,
    getExpenses,
    updateExpense,
    deleteExpense
} from '../controllers/expenseController.js'

import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', authenticateToken, createExpense)
router.get('/', authenticateToken, getExpenses)
router.put('/:id', authenticateToken, updateExpense)
router.delete('/:id', authenticateToken, deleteExpense)

export default router
