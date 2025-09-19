import { Router } from 'express'
import {
  createThreshold,
  getThresholds,
  getThreshold,
  updateThreshold,
  deleteThreshold,
  getThresholdAlerts,
  checkThresholdViolation,
  getThresholdStats
} from '../controllers/thresholdController'
import { authenticateToken } from '../middlewares/authMiddleware'

const router = Router()

// Aplicar middleware de autenticação a todas as rotas
router.use(authenticateToken)

// POST /api/thresholds - Criar/atualizar threshold
router.post('/', createThreshold)

// GET /api/thresholds - Buscar thresholds do usuário
router.get('/', getThresholds)

// GET /api/thresholds/alerts - Buscar alertas de limites
router.get('/alerts', getThresholdAlerts)

// GET /api/thresholds/stats - Estatísticas dos thresholds
router.get('/stats', getThresholdStats)

// POST /api/thresholds/check-violation - Verificar violação
router.post('/check-violation', checkThresholdViolation)

// GET /api/thresholds/:id - Buscar threshold por ID
router.get('/:id', getThreshold)

// PUT /api/thresholds/:id - Atualizar threshold
router.put('/:id', updateThreshold)

// DELETE /api/thresholds/:id - Deletar threshold
router.delete('/:id', deleteThreshold)

export default router