// src/controllers/balanceCarryoverController.ts
import { Request, Response, NextFunction } from 'express'
import { BalanceCarryoverService } from '../services/balanceCarryoverService'
import { AuthenticatedRequest } from '../types/index'
import { sendErrorResponse, sendSuccessResponse, toNumber, resolveUserMessage } from '../utils/helper'

/**
 * GET /api/balance/carryover/check?mes=X&ano=Y
 * Verifica se há saldo do mês anterior a ser carregado para o mês informado.
 */
export const checkCarryover = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const now = new Date()
        const mes = toNumber(req.query.mes as string) ?? now.getMonth() + 1
        const ano = toNumber(req.query.ano as string) ?? now.getFullYear()

        if (mes < 1 || mes > 12) {
            sendErrorResponse(res, 'Mês deve estar entre 1 e 12.', 400)
            return
        }

        const status = await BalanceCarryoverService.check(userId, mes, ano)
        sendSuccessResponse(res, status, 'Status do carryover verificado.')
    } catch (error) {
        console.error('Erro ao verificar carryover:', error)
        sendErrorResponse(res, 'Erro ao verificar saldo anterior.', 500, error)
    }
}

/**
 * POST /api/balance/carryover/apply
 * Body: { mes, ano } — mês/ano de destino (onde o saldo será lançado)
 * Aplica o carryover do mês anterior para o mês informado.
 */
export const applyCarryover = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const now = new Date()
        const mes = toNumber(req.body.mes) ?? now.getMonth() + 1
        const ano = toNumber(req.body.ano) ?? now.getFullYear()

        if (mes < 1 || mes > 12) {
            sendErrorResponse(res, 'Mês deve estar entre 1 e 12.', 400)
            return
        }

        const result = await BalanceCarryoverService.apply(userId, mes, ano)
        const msg = result.tipo === 'positivo'
            ? `Saldo de R$ ${result.saldo.toFixed(2)} transferido como receita em ${mes}/${ano}.`
            : `Débito de R$ ${Math.abs(result.saldo).toFixed(2)} transferido como despesa em ${mes}/${ano}.`

        sendSuccessResponse(res, result, msg, 201)
    } catch (error: unknown) {
        console.error('Erro ao aplicar carryover:', error)
        const apiError = error as { statusCode?: number; status?: number }
        const status = apiError?.statusCode || apiError?.status || 500
        sendErrorResponse(res, resolveUserMessage(error, 'Erro ao aplicar saldo anterior.'), status, error)
    }
}

/**
 * DELETE /api/balance/carryover?mes=X&ano=Y
 * Desfaz o carryover aplicado no mês informado.
 */
export const undoCarryover = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const mes = toNumber(req.query.mes as string)
        const ano = toNumber(req.query.ano as string)

        if (!mes || !ano) {
            sendErrorResponse(res, 'Parâmetros mes e ano são obrigatórios.', 400)
            return
        }

        await BalanceCarryoverService.undo(userId, mes, ano)
        sendSuccessResponse(res, null, 'Carryover removido com sucesso.')
    } catch (error: unknown) {
        console.error('Erro ao desfazer carryover:', error)
        const apiError = error as { statusCode?: number; status?: number }
        const status = apiError?.statusCode || apiError?.status || 500
        sendErrorResponse(res, resolveUserMessage(error, 'Erro ao remover saldo anterior.'), status, error)
    }
}

/**
 * GET /api/balance/carryover/history
 * Retorna o histórico de carryovers aplicados.
 */
export const getCarryoverHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const history = await BalanceCarryoverService.history(userId)
        sendSuccessResponse(res, history, 'Histórico de carryovers recuperado.')
    } catch (error) {
        console.error('Erro ao buscar histórico de carryover:', error)
        sendErrorResponse(res, 'Erro ao buscar histórico.', 500, error)
    }
}
