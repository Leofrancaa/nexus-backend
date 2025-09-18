import { Router } from 'express'
import {
    getDashboardData,
    getQuickStats,
    getTendencias
} from '../controllers/dashboardController'
import { authenticateToken } from '../middlewares/authMiddleware'

const router = Router()

// Aplicar middleware de autenticação a todas as rotas
router.use(authenticateToken)

// GET /api/dashboard - Dados completos do dashboard
router.get('/', getDashboardData)

// GET /api/dashboard/quick-stats - Estatísticas rápidas
router.get('/quick-stats', getQuickStats)

// GET /api/dashboard/trends - Tendências dos últimos 6 meses
router.get('/trends', getTendencias)

export default router