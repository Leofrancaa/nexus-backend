import { Router } from 'express'
import { AuthenticatedRequest } from '../types/index.js'
import { authenticateToken } from '../middlewares/authMiddleware.js'
import { sendSuccessResponse } from '../utils/helper.js'
import { Request, Response } from 'express'

const router = Router()

/**
 * GET /api/me - Buscar dados do usuário logado
 */
router.get('/me', authenticateToken, (req: Request, res: Response): void => {
    const authReq = req as AuthenticatedRequest
    sendSuccessResponse(res, { user: authReq.user }, 'Dados do usuário recuperados com sucesso.')
})

export default router