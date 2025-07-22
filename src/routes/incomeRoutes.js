import express from 'express'
import {
    createIncome,
    getIncomes,
    updateIncome,
    deleteIncome
} from '../controllers/incomeController.js'

import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', authenticateToken, createIncome)
router.get('/', authenticateToken, getIncomes)
router.put('/:id', authenticateToken, updateIncome)
router.delete('/:id', authenticateToken, deleteIncome)

export default router
