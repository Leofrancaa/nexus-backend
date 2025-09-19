import { Request, Response, NextFunction } from 'express'
import { CardInvoiceService } from '../services/cardInvoiceService.js'
import {
    AuthenticatedRequest,
    ApiError
} from '../types/index.js'
import {
    sendErrorResponse,
    sendSuccessResponse,
    toNumber
} from '../utils/helper.js'

/**
 * POST /api/cards/:id/pay-invoice - Pagar fatura do cartão
 */
export const payInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const user_id = authReq.user.id
        const card_id = toNumber(req.params.id)
        const { mes, ano } = req.body

        if (!card_id) {
            sendErrorResponse(res, 'ID do cartão inválido.', 400)
            return
        }

        if (typeof mes !== 'number' || typeof ano !== 'number') {
            sendErrorResponse(res, 'Mês e ano são obrigatórios e devem ser números.', 400)
            return
        }
        const result = await CardInvoiceService.payCardInvoice({
            user_id,
            card_id,
            mes: Number(mes),
            ano: Number(ano)
        })

        sendSuccessResponse(
            res,
            result,
            'Fatura paga e limite atualizado com sucesso.'
        )
    } catch (error) {
        console.error('Erro ao pagar fatura:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao pagar fatura.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/cards/:id/invoices - Listar faturas disponíveis
 */
export const getAvailableInvoices = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const user_id = authReq.user.id
        const card_id = toNumber(req.params.id)

        if (!card_id) {
            sendErrorResponse(res, 'ID do cartão inválido.', 400)
            return
        }

        const invoices = await CardInvoiceService.getAvailableInvoices(user_id, card_id)
        sendSuccessResponse(res, invoices, 'Faturas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar faturas:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao buscar faturas.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/cards/:id/payment-history - Histórico de pagamentos
 */
export const getPaymentHistory = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const user_id = authReq.user.id
        const card_id = toNumber(req.params.id)
        const limit = toNumber(req.query.limit as string) || 10

        if (!card_id) {
            sendErrorResponse(res, 'ID do cartão inválido.', 400)
            return
        }

        const history = await CardInvoiceService.getPaymentHistory(user_id, card_id, limit)
        sendSuccessResponse(res, history, 'Histórico de pagamentos recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar histórico de pagamentos:', error)
        sendErrorResponse(res, 'Erro ao buscar histórico de pagamentos.', 500, error)
    }
}

/**
 * DELETE /api/cards/:id/cancel-payment - Cancelar pagamento de fatura
 */
export const cancelInvoicePayment = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const user_id = authReq.user.id
        const card_id = toNumber(req.params.id)
        const { competencia_mes, competencia_ano } = req.body

        if (!card_id) {
            sendErrorResponse(res, 'ID do cartão inválido.', 400)
            return
        }

        if (!competencia_mes || !competencia_ano) {
            sendErrorResponse(res, 'Mês e ano da competência são obrigatórios.', 400)
            return
        }

        const result = await CardInvoiceService.cancelInvoicePayment(
            user_id,
            card_id,
            Number(competencia_mes),
            Number(competencia_ano)
        )

        sendSuccessResponse(res, result, result.message)
    } catch (error) {
        console.error('Erro ao cancelar pagamento:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao cancelar pagamento.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/cards/:id/can-pay-invoice - Verificar se pode pagar fatura
 */
export const canPayInvoice = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const user_id = authReq.user.id
        const card_id = toNumber(req.params.id)
        const { mes, ano } = req.query

        if (!card_id) {
            sendErrorResponse(res, 'ID do cartão inválido.', 400)
            return
        }

        if (!mes || !ano) {
            sendErrorResponse(res, 'Mês e ano são obrigatórios.', 400)
            return
        }

        const result = await CardInvoiceService.canPayInvoice(
            user_id,
            card_id,
            Number(mes),
            Number(ano)
        )

        sendSuccessResponse(res, result, 'Verificação realizada com sucesso.')
    } catch (error) {
        console.error('Erro ao verificar se pode pagar fatura:', error)
        sendErrorResponse(res, 'Erro ao verificar pagamento de fatura.', 500, error)
    }
}