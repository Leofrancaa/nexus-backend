import express from 'express'

import { getCurrency, updateCurrency } from '../controllers/userController.js'
import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/currency', authenticateToken, getCurrency)
router.put('/currency', authenticateToken, updateCurrency)

export default router
