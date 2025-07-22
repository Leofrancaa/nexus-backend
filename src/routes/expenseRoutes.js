import express from 'express'
import {
    addExpense,
    getExpenses,
    updateExpense,
    deleteExpense
} from '../controllers/expenseController.js'

import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/', authenticateToken, getExpenses)
router.post('/', authenticateToken, addExpense)
router.put('/:id', authenticateToken, updateExpense)
router.delete('/:id', authenticateToken, deleteExpense)

export default router
