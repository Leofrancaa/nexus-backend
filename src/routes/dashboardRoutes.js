import express from 'express'
import { getDashboardData } from '../controllers/dashboardController.js'
import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = express.Router()

router.get('/', authenticateToken, getDashboardData)

export default router




