import { Router } from 'express'
import {
    createPlan,
    getPlans,
    getPlan,
    updatePlan,
    deletePlan,
    addContribution,
    getPlanContributions,
    removeContribution,
    getPlanStats
} from '../controllers/planController'
import { authenticateToken } from '../middlewares/authMiddleware'

const router = Router()

// Aplicar middleware de autenticação a todas as rotas
router.use(authenticateToken)

// POST /api/plans - Criar plano
router.post('/', createPlan)

// GET /api/plans - Buscar planos do usuário
router.get('/', getPlans)

// GET /api/plans/stats - Estatísticas dos planos
router.get('/stats', getPlanStats)

// POST /api/plans/:id/contribute - Adicionar contribuição
router.post('/:id/contribute', addContribution)

// GET /api/plans/:id/contributions - Buscar contribuições do plano
router.get('/:id/contributions', getPlanContributions)

// GET /api/plans/:id - Buscar plano por ID
router.get('/:id', getPlan)

// PUT /api/plans/:id - Atualizar plano
router.put('/:id', updatePlan)

// DELETE /api/plans/:id - Deletar plano
router.delete('/:id', deletePlan)

// DELETE /api/plans/contributions/:contributionId - Remover contribuição
router.delete('/contributions/:contributionId', removeContribution)

export default router