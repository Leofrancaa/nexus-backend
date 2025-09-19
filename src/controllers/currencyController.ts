import { Request, Response, NextFunction } from 'express'
import { CurrencyService } from '../services/currencyService'
import {
    AuthenticatedRequest,
    ApiError
} from '../types/index'
import {
    sendErrorResponse,
    sendSuccessResponse,
    toNumber
} from '../utils/helper'

/**
 * GET /api/users/currency - Buscar moeda atual do usuário
 */
export const getCurrency = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const result = await CurrencyService.getUserCurrency(userId)
        sendSuccessResponse(res, result, 'Moeda do usuário recuperada com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar moeda do usuário:', error)
        sendErrorResponse(res, 'Erro ao buscar moeda do usuário.', 500, error)
    }
}

/**
 * PUT /api/users/currency - Atualizar moeda do usuário
 */
export const updateCurrency = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const { currency } = req.body

        if (!currency) {
            sendErrorResponse(res, 'Moeda é obrigatória.', 400)
            return
        }

        const result = await CurrencyService.updateUserCurrency(userId, currency)
        sendSuccessResponse(res, result, result.message)
    } catch (error) {
        console.error('Erro ao atualizar moeda:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao atualizar moeda.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/users/currency/supported - Listar moedas suportadas
 */
export const getSupportedCurrencies = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const currencies = CurrencyService.getSupportedCurrencies()
        sendSuccessResponse(res, currencies, 'Moedas suportadas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar moedas suportadas:', error)
        sendErrorResponse(res, 'Erro ao buscar moedas suportadas.', 500, error)
    }
}

/**
 * POST /api/users/currency/convert - Converter entre moedas
 */
export const convertCurrency = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const { amount, from_currency, to_currency } = req.body

        if (!amount || !from_currency || !to_currency) {
            sendErrorResponse(res, 'Amount, from_currency e to_currency são obrigatórios.', 400)
            return
        }

        if (isNaN(Number(amount)) || Number(amount) <= 0) {
            sendErrorResponse(res, 'Amount deve ser um número positivo.', 400)
            return
        }

        const result = await CurrencyService.convertCurrency(
            Number(amount),
            from_currency,
            to_currency
        )

        sendSuccessResponse(res, result, 'Conversão realizada com sucesso.')
    } catch (error) {
        console.error('Erro ao converter moeda:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao converter moeda.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/users/currency/summary - Resumo financeiro formatado na moeda do usuário
 */
export const getFinancialSummary = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const summary = await CurrencyService.getUserFinancialSummary(userId)
        sendSuccessResponse(res, summary, 'Resumo financeiro recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar resumo financeiro:', error)
        sendErrorResponse(res, 'Erro ao buscar resumo financeiro.', 500, error)
    }
}