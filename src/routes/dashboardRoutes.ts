// src/routes/dashboardRoutes.ts
import { Router } from 'express'
import { getDashboardData } from '../controllers/dashboardController.js'
import { authenticateToken } from '../middlewares/authMiddleware.js'

const router = Router()

// Aplicar middleware de autenticação
router.use(authenticateToken)

// GET /api/dashboard - Obter dados do dashboard
router.get('/', getDashboardData)

export default router