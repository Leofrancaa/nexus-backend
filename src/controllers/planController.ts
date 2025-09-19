import { Request, Response, NextFunction } from 'express'
import { PlanService } from '../services/planService.js'
import {
    AuthenticatedRequest,
    CreatePlanRequest,
    ContributionRequest,
    ApiError
} from '../types/index.js'
import {
    sendErrorResponse,
    sendSuccessResponse,
    toNumber,
    isPositiveNumber
} from '../utils/helper.js'

/**
 * POST /api/plans - Criar plano
 */
export const createPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const planData: CreatePlanRequest = req.body

        const result = await PlanService.createPlan(planData, userId)
        sendSuccessResponse(res, result, 'Plano criado com sucesso.', 201)
    } catch (error) {
        console.error('Erro ao criar plano:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao criar plano.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/plans - Buscar planos do usuário
 */
export const getPlans = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const plans = await PlanService.getPlansByUser(userId)
        sendSuccessResponse(res, plans, 'Planos recuperados com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar planos:', error)
        sendErrorResponse(res, 'Erro ao buscar planos.', 500, error)
    }
}

/**
 * GET /api/plans/:id - Buscar plano por ID
 */
export const getPlan = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const planId = toNumber(req.params.id)

        if (!planId) {
            sendErrorResponse(res, 'ID do plano inválido.', 400)
            return
        }

        const plan = await PlanService.getPlanById(planId, userId)
        if (!plan) {
            sendErrorResponse(res, 'Plano não encontrado.', 404)
            return
        }

        sendSuccessResponse(res, plan, 'Plano recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar plano:', error)
        sendErrorResponse(res, 'Erro ao buscar plano.', 500, error)
    }
}

/**
 * PUT /api/plans/:id - Atualizar plano
 */
export const updatePlan = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const planId = toNumber(req.params.id)
        const updateData: Partial<CreatePlanRequest> = req.body

        if (!planId) {
            sendErrorResponse(res, 'ID do plano inválido.', 400)
            return
        }

        const updatedPlan = await PlanService.updatePlan(planId, updateData, userId)
        sendSuccessResponse(res, updatedPlan, 'Plano atualizado com sucesso.')
    } catch (error) {
        console.error('Erro ao atualizar plano:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao atualizar plano.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * DELETE /api/plans/:id - Deletar plano
 */
export const deletePlan = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const planId = toNumber(req.params.id)

        if (!planId) {
            sendErrorResponse(res, 'ID do plano inválido.', 400)
            return
        }

        const result = await PlanService.deletePlan(planId, userId)
        sendSuccessResponse(res, result, result.message)
    } catch (error) {
        console.error('Erro ao deletar plano:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao deletar plano.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * POST /api/plans/:id/contribute - Adicionar contribuição
 */
export const addContribution = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const planId = toNumber(req.params.id)
        const contributionData: ContributionRequest = req.body

        if (!planId) {
            sendErrorResponse(res, 'ID do plano inválido.', 400)
            return
        }

        if (!contributionData.valor || !isPositiveNumber(contributionData.valor)) {
            sendErrorResponse(res, 'Valor da contribuição deve ser um número positivo.', 400)
            return
        }

        const result = await PlanService.addContribution(planId, contributionData, userId)
        sendSuccessResponse(res, result, 'Contribuição adicionada com sucesso.', 201)
    } catch (error) {
        console.error('Erro ao adicionar contribuição:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao adicionar contribuição.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/plans/:id/contributions - Buscar contribuições do plano
 */
export const getPlanContributions = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const planId = toNumber(req.params.id)
        const limit = toNumber(req.query.limit as string) || 20

        if (!planId) {
            sendErrorResponse(res, 'ID do plano inválido.', 400)
            return
        }

        const contributions = await PlanService.getPlanContributions(planId, userId, limit)
        sendSuccessResponse(res, contributions, 'Contribuições recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar contribuições:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao buscar contribuições.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * DELETE /api/plans/contributions/:contributionId - Remover contribuição
 */
export const removeContribution = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const contributionId = toNumber(req.params.contributionId)

        if (!contributionId) {
            sendErrorResponse(res, 'ID da contribuição inválido.', 400)
            return
        }

        const result = await PlanService.removeContribution(contributionId, userId)
        sendSuccessResponse(res, result, result.message)
    } catch (error) {
        console.error('Erro ao remover contribuição:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao remover contribuição.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/plans/stats - Estatísticas dos planos
 */
export const getPlanStats = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const stats = await PlanService.getPlanStats(userId)
        sendSuccessResponse(res, stats, 'Estatísticas de planos recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar estatísticas de planos:', error)
        sendErrorResponse(res, 'Erro ao buscar estatísticas de planos.', 500, error)
    }
}