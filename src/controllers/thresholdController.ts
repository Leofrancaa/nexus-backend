import { Request, Response, NextFunction } from 'express'
import { ThresholdService } from '../services/thresholdService'
import {
    AuthenticatedRequest,
    CreateThresholdRequest,
    ApiError
} from '../types/index'
import {
    sendErrorResponse,
    sendSuccessResponse,
    toNumber,
    isPositiveNumber
} from '../utils/helper'

/**
 * POST /api/thresholds - Criar ou atualizar threshold
 */
export const createThreshold = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const thresholdData: CreateThresholdRequest = req.body

        // Validações básicas
        if (!thresholdData.category_id || !thresholdData.valor) {
            sendErrorResponse(res, 'Category ID e valor são obrigatórios.', 400)
            return
        }

        if (!isPositiveNumber(thresholdData.valor)) {
            sendErrorResponse(res, 'Valor deve ser um número positivo.', 400)
            return
        }

        const result = await ThresholdService.createOrUpdateThreshold(thresholdData, userId)
        sendSuccessResponse(res, result, 'Limite criado/atualizado com sucesso.', 201)
    } catch (error) {
        console.error('Erro ao criar threshold:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao criar limite.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/thresholds - Buscar thresholds do usuário
 */
export const getThresholds = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const thresholds = await ThresholdService.getThresholdsByUser(userId)
        sendSuccessResponse(res, thresholds, 'Limites recuperados com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar thresholds:', error)
        sendErrorResponse(res, 'Erro ao buscar limites.', 500, error)
    }
}

/**
 * GET /api/thresholds/:id - Buscar threshold por ID
 */
export const getThreshold = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const thresholdId = toNumber(req.params.id)

        if (!thresholdId) {
            sendErrorResponse(res, 'ID do limite inválido.', 400)
            return
        }

        const threshold = await ThresholdService.getThresholdById(thresholdId, userId)
        if (!threshold) {
            sendErrorResponse(res, 'Limite não encontrado.', 404)
            return
        }

        sendSuccessResponse(res, threshold, 'Limite recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar threshold:', error)
        sendErrorResponse(res, 'Erro ao buscar limite.', 500, error)
    }
}

/**
 * PUT /api/thresholds/:id - Atualizar threshold
 */
export const updateThreshold = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const thresholdId = toNumber(req.params.id)
        const updateData: Partial<CreateThresholdRequest> = req.body

        if (!thresholdId) {
            sendErrorResponse(res, 'ID do limite inválido.', 400)
            return
        }

        // Validar valor se fornecido
        if (updateData.valor !== undefined && !isPositiveNumber(updateData.valor)) {
            sendErrorResponse(res, 'Valor deve ser um número positivo.', 400)
            return
        }

        const updatedThreshold = await ThresholdService.updateThreshold(thresholdId, updateData, userId)
        sendSuccessResponse(res, updatedThreshold, 'Limite atualizado com sucesso.')
    } catch (error) {
        console.error('Erro ao atualizar threshold:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao atualizar limite.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * DELETE /api/thresholds/:id - Deletar threshold
 */
export const deleteThreshold = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const thresholdId = toNumber(req.params.id)

        if (!thresholdId) {
            sendErrorResponse(res, 'ID do limite inválido.', 400)
            return
        }

        const result = await ThresholdService.deleteThreshold(thresholdId, userId)
        sendSuccessResponse(res, result, result.message)
    } catch (error) {
        console.error('Erro ao deletar threshold:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao deletar limite.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/thresholds/alerts - Buscar alertas de limites
 */
export const getThresholdAlerts = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const { month, year } = req.query


        const parsedMonth = month ? toNumber(month) : undefined
        const parsedYear = year ? toNumber(year) : undefined

        const targetMonth = typeof parsedMonth === 'number' && !isNaN(parsedMonth) ? parsedMonth : undefined
        const targetYear = typeof parsedYear === 'number' && !isNaN(parsedYear) ? parsedYear : undefined

        // Validar mês se fornecido
        if (targetMonth && (targetMonth < 1 || targetMonth > 12)) {
            sendErrorResponse(res, 'Mês deve estar entre 1 e 12.', 400)
            return
        }

        const alerts = await ThresholdService.getThresholdAlerts(userId, targetMonth, targetYear)
        sendSuccessResponse(res, alerts, 'Alertas de limites recuperados com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar alertas de thresholds:', error)
        sendErrorResponse(res, 'Erro ao buscar alertas de limites.', 500, error)
    }
}

/**
 * POST /api/thresholds/check-violation - Verificar violação de limite
 */
export const checkThresholdViolation = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const { category_id, amount, month, year } = req.body

        if (!category_id || !amount) {
            sendErrorResponse(res, 'Category ID e amount são obrigatórios.', 400)
            return
        }

        if (!isPositiveNumber(amount)) {
            sendErrorResponse(res, 'Amount deve ser um número positivo.', 400)
            return
        }

        const targetMonth = month ? Number(month) : undefined
        const targetYear = year ? Number(year) : undefined

        const result = await ThresholdService.checkThresholdViolation(
            userId,
            Number(category_id),
            Number(amount),
            targetMonth,
            targetYear
        )

        sendSuccessResponse(res, result, 'Verificação de limite realizada com sucesso.')
    } catch (error) {
        console.error('Erro ao verificar violação de threshold:', error)
        sendErrorResponse(res, 'Erro ao verificar limite.', 500, error)
    }
}

/**
 * GET /api/thresholds/stats - Estatísticas dos thresholds
 */
export const getThresholdStats = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const stats = await ThresholdService.getThresholdStats(userId)
        sendSuccessResponse(res, stats, 'Estatísticas de limites recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar estatísticas de thresholds:', error)
        sendErrorResponse(res, 'Erro ao buscar estatísticas de limites.', 500, error)
    }
}