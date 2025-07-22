import express from 'express'
import {
    createInvestment,
    getInvestments,
    updateInvestment,
    deleteInvestment
} from '../controllers/investmentController.js'

import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.post('/', authenticateToken, createInvestment)
router.get('/', authenticateToken, getInvestments)
router.put('/:id', authenticateToken, updateInvestment)
router.delete('/:id', authenticateToken, deleteInvestment)

export default router
