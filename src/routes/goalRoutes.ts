import { Router } from 'express'
import {
  createGoal,
  getGoals,
  getGoal,
  updateGoal,
  deleteGoal,
  getGoalStats
} from '../controllers/goalController'
import { authenticateToken } from '../middlewares/authMiddleware'

const router = Router()

// Aplicar middleware de autenticação a todas as rotas
router.use(authenticateToken)

// POST /api/goals - Criar meta
router.post('/', createGoal)

// GET /api/goals - Buscar metas do usuário
router.get('/', getGoals)

// GET /api/goals/stats - Estatísticas das metas
router.get('/stats', getGoalStats)

// GET /api/goals/:id - Buscar meta por ID
router.get('/:id', getGoal)

// PUT /api/goals/:id - Atualizar meta
router.put('/:id', updateGoal)

// DELETE /api/goals/:id - Deletar meta
router.delete('/:id', deleteGoal)

export default router
