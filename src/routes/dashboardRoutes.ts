// src/routes/dashboardRoutes.ts
import { Router } from 'express'
import { getDashboardData, getHealthScore } from '../controllers/dashboardController'
import { authenticateToken } from '../middlewares/authMiddleware'

const router = Router()

// Aplicar middleware de autenticação
router.use(authenticateToken)

// GET /api/dashboard - Obter dados do dashboard
router.get('/', getDashboardData)

// GET /api/dashboard/health-score - Score de saúde financeira
router.get('/health-score', getHealthScore)

export default router