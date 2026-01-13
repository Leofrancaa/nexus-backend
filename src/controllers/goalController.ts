import { Request, Response, NextFunction } from 'express'
import { GoalService } from '../services/goalService'
import { AuthenticatedRequest, ApiError } from '../types/index'
import { sendErrorResponse, sendSuccessResponse, toNumber, isPositiveNumber } from '../utils/helper'

/**
 * POST /api/goals - Criar nova meta de receita mensal
 */
export const createGoal = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const goalData = req.body

        // Validações básicas
        if (!goalData.nome || !goalData.valor_alvo || !goalData.mes || !goalData.ano) {
            sendErrorResponse(res, 'Nome, valor_alvo, mes e ano são obrigatórios.', 400)
            return
        }

        if (!isPositiveNumber(goalData.valor_alvo)) {
            sendErrorResponse(res, 'Valor deve ser um número positivo.', 400)
            return
        }

        const result = await GoalService.createGoal(goalData, userId)
        sendSuccessResponse(res, result, 'Meta criada com sucesso.', 201)
    } catch (error) {
        console.error('Erro ao criar meta:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao criar meta.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/goals - Buscar metas do usuário
 */
export const getGoals = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const mes = req.query.mes ? toNumber(req.query.mes as string) : undefined
        const ano = req.query.ano ? toNumber(req.query.ano as string) : undefined

        const goals = await GoalService.getGoalsByUser(userId, mes, ano)
        sendSuccessResponse(res, goals, 'Metas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar metas:', error)
        sendErrorResponse(res, 'Erro ao buscar metas.', 500, error)
    }
}

/**
 * GET /api/goals/:id - Buscar meta por ID
 */
export const getGoal = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const goalId = toNumber(req.params.id)

        if (!goalId) {
            sendErrorResponse(res, 'ID da meta inválido.', 400)
            return
        }

        const goal = await GoalService.getGoalById(goalId, userId)
        if (!goal) {
            sendErrorResponse(res, 'Meta não encontrada.', 404)
            return
        }

        sendSuccessResponse(res, goal, 'Meta recuperada com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar meta:', error)
        sendErrorResponse(res, 'Erro ao buscar meta.', 500, error)
    }
}

/**
 * PUT /api/goals/:id - Atualizar meta
 */
export const updateGoal = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const goalId = toNumber(req.params.id)

        if (!goalId) {
            sendErrorResponse(res, 'ID da meta inválido.', 400)
            return
        }

        const updateData = req.body

        if (updateData.valor_alvo !== undefined && !isPositiveNumber(updateData.valor_alvo)) {
            sendErrorResponse(res, 'Valor deve ser um número positivo.', 400)
            return
        }

        const result = await GoalService.updateGoal(goalId, updateData, userId)
        sendSuccessResponse(res, result, 'Meta atualizada com sucesso.')
    } catch (error) {
        console.error('Erro ao atualizar meta:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao atualizar meta.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * DELETE /api/goals/:id - Remover meta
 */
export const deleteGoal = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const goalId = toNumber(req.params.id)

        if (!goalId) {
            sendErrorResponse(res, 'ID da meta inválido.', 400)
            return
        }

        const result = await GoalService.deleteGoal(goalId, userId)
        sendSuccessResponse(res, result, 'Meta removida com sucesso.')
    } catch (error) {
        console.error('Erro ao remover meta:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao remover meta.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/goals/stats - Buscar estatísticas das metas
 */
export const getGoalStats = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const mes = req.query.mes ? toNumber(req.query.mes as string) : undefined
        const ano = req.query.ano ? toNumber(req.query.ano as string) : undefined

        const stats = await GoalService.getGoalStats(userId, mes, ano)
        sendSuccessResponse(res, stats, 'Estatísticas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error)
        sendErrorResponse(res, 'Erro ao buscar estatísticas.', 500, error)
    }
}
