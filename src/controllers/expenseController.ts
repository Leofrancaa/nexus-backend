// src/controllers/expenseController.ts
import { Request, Response, NextFunction } from 'express'
import { ExpenseService } from '../services/expenseService'
import { DatabaseUtils } from '../utils/database'
import {
    AuthenticatedRequest,
    CreateExpenseRequest,
    ApiError,
    ExpenseMonthlyResult
} from '../types/index'
import {
    sendErrorResponse,
    sendSuccessResponse,
    toNumber,
    isPositiveNumber
} from '../utils/helper'

/**
 * POST /api/expenses - Criar despesa
 */
export const createExpense = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const expenseData: CreateExpenseRequest = req.body

        // Validações básicas
        if (!expenseData.metodo_pagamento || !expenseData.tipo || !expenseData.quantidade) {
            sendErrorResponse(res, 'Método de pagamento, tipo e quantidade são obrigatórios.', 400)
            return
        }

        if (!isPositiveNumber(expenseData.quantidade)) {
            sendErrorResponse(res, 'Quantidade deve ser um número positivo.', 400)
            return
        }

        const result = await ExpenseService.createExpense(expenseData, userId)

        sendSuccessResponse(
            res,
            result,
            Array.isArray(result) ? 'Despesas criadas com sucesso.' : 'Despesa criada com sucesso.',
            201
        )
    } catch (error) {
        console.error('Erro ao criar despesa:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao criar despesa.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/expenses - Buscar despesas por intervalo de datas
 */
export const getExpenses = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const { start_date, end_date, mes, ano } = req.query

        // Se vier mês e ano, busca por período mensal
        if (mes && ano) {
            const month = toNumber(mes)
            const year = toNumber(ano)

            if (!month || !year || month < 1 || month > 12) {
                sendErrorResponse(res, 'Mês deve estar entre 1 e 12, e ano deve ser válido.', 400)
                return
            }

            const expenses = await ExpenseService.getExpensesByMonthYear(userId, month, year)
            sendSuccessResponse(res, expenses, 'Despesas recuperadas com sucesso.')
            return
        }

        // Busca por intervalo de datas
        if (!start_date || !end_date) {
            sendErrorResponse(res, 'Parâmetros start_date e end_date são obrigatórios.', 400)
            return
        }

        const expenses = await ExpenseService.getExpensesByDateRange(
            userId,
            start_date as string,
            end_date as string
        )

        sendSuccessResponse(res, expenses, 'Despesas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar despesas:', error)
        sendErrorResponse(res, 'Erro ao buscar despesas.', 500, error)
    }
}

/**
 * PUT /api/expenses/:id - Atualizar despesa
 */
export const updateExpense = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const expenseId = toNumber(req.params.id)
        const updateData: Partial<CreateExpenseRequest> = req.body

        if (!expenseId) {
            sendErrorResponse(res, 'ID da despesa inválido.', 400)
            return
        }

        // Validar quantidade se fornecida
        if (updateData.quantidade !== undefined && !isPositiveNumber(updateData.quantidade)) {
            sendErrorResponse(res, 'Quantidade deve ser um número positivo.', 400)
            return
        }

        const updatedExpense = await ExpenseService.updateExpense(expenseId, updateData, userId)
        sendSuccessResponse(res, updatedExpense, 'Despesa atualizada com sucesso.')
    } catch (error) {
        console.error('Erro ao atualizar despesa:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao atualizar despesa.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * DELETE /api/expenses/:id - Deletar despesa
 */
export const deleteExpense = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const expenseId = toNumber(req.params.id)

        if (!expenseId) {
            sendErrorResponse(res, 'ID da despesa inválido.', 400)
            return
        }

        const deletedExpense = await ExpenseService.deleteExpense(expenseId, userId)

        const message = Array.isArray(deletedExpense)
            ? `${deletedExpense.length} despesas removidas com sucesso.`
            : 'Despesa removida com sucesso.'

        sendSuccessResponse(res, deletedExpense, message)
    } catch (error) {
        console.error('Erro ao deletar despesa:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao deletar despesa.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/expenses/total-by-category/:categoryId - Total por categoria
 */
export const getTotalByCategory = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const categoryId = toNumber(req.params.categoryId)
        const { mes, ano } = req.query

        if (!categoryId) {
            sendErrorResponse(res, 'ID da categoria inválido.', 400)
            return
        }

        // Usar mês/ano atual se não fornecidos
        const month = mes ? toNumber(mes) : new Date().getMonth() + 1
        const year = ano ? toNumber(ano) : new Date().getFullYear()

        if (!month || !year) {
            sendErrorResponse(res, 'Mês e ano devem ser válidos.', 400)
            return
        }

        const total = await ExpenseService.getTotalByCategory(userId, categoryId, month, year)

        sendSuccessResponse(res, { total }, 'Total da categoria recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar total da categoria:', error)
        sendErrorResponse(res, 'Erro ao buscar total da categoria.', 500, error)
    }
}

/**
 * GET /api/expenses/monthly-total - Total mensal
 */
export const getMonthlyTotal = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const { mes, ano } = req.query

        const month = toNumber(mes)
        const year = toNumber(ano)

        if (!month || !year || month < 1 || month > 12) {
            sendErrorResponse(res, 'Parâmetros mes e ano são obrigatórios e devem ser válidos.', 400)
            return
        }

        const total = await ExpenseService.getMonthlyTotal(userId, month, year)
        sendSuccessResponse(res, { total }, 'Total mensal recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar total mensal:', error)
        sendErrorResponse(res, 'Erro ao buscar total mensal.', 500, error)
    }
}

/**
 * GET /api/expenses/stats - Estatísticas de despesas (CORRIGIDO)
 */
export const getExpenseStats = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const { month, year, categoryId } = req.query

        const mesRaw = toNumber(month)
        const anoRaw = toNumber(year)
        const catIdRaw = categoryId ? toNumber(categoryId) : undefined

        // Garantir que mes, ano e catId sejam number ou undefined, nunca null
        const mes: number | undefined = typeof mesRaw === 'number' && !isNaN(mesRaw) ? mesRaw : undefined
        const ano: number | undefined = typeof anoRaw === 'number' && !isNaN(anoRaw) ? anoRaw : undefined
        const catId: number | undefined = typeof catIdRaw === 'number' && !isNaN(catIdRaw) ? catIdRaw : undefined

        if (!mes || !ano || mes < 1 || mes > 12) {
            sendErrorResponse(res, 'Parâmetros month e year são obrigatórios e devem ser válidos.', 400)
            return
        }

        // Buscar estatísticas do mês atual
        const atual = await ExpenseService.getExpenseStats(userId, mes, ano, catId)

        // Calcular mês anterior para comparação
        const mesAnterior: number = mes === 1 ? 12 : mes - 1
        const anoAnterior: number = mes === 1 ? (ano as number) - 1 : (ano as number)

        const anterior = await ExpenseService.getExpenseStats(userId, mesAnterior, anoAnterior, catId)

        const stats = {
            total: Number(atual.total || 0),
            fixas: Number(atual.fixas || 0),
            transacoes: Number(atual.transacoes || 0),
            media: Number(atual.media || 0),
            anterior: Number(anterior.total || 0),
        }

        sendSuccessResponse(res, stats, 'Estatísticas de despesas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar estatísticas de despesas:', error)
        sendErrorResponse(res, 'Erro ao buscar estatísticas de despesas.', 500, error)
    }
}

/**
 * GET /api/expenses/by-month - Despesas agrupadas por mês
 */
export const getExpensesByMonth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        // Query para buscar despesas agrupadas por mês usando DatabaseUtils
        const result = await DatabaseUtils.query<ExpenseMonthlyResult>(
            `SELECT 
                EXTRACT(MONTH FROM data) AS numero_mes,
                SUM(quantidade) AS total
             FROM expenses
             WHERE user_id = $1
             GROUP BY numero_mes
             ORDER BY numero_mes`,
            [userId]
        )

        const meses = [
            "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
            "Jul", "Ago", "Set", "Out", "Nov", "Dez"
        ]

        const dados = meses.map((mes, index) => {
            const encontrado = result.rows.find((r: ExpenseMonthlyResult) =>
                Number(r.numero_mes) === index + 1
            )
            return {
                mes,
                total: encontrado ? Number(encontrado.total) : 0,
            }
        })

        sendSuccessResponse(res, dados, 'Despesas por mês recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar despesas por mês:', error)
        sendErrorResponse(res, 'Erro ao buscar despesas por mês.', 500, error)
    }
}

/**
 * GET /api/expenses/resumo-categorias - Resumo de despesas por categoria
 */
export const getResumoCategorias = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const { mes, ano } = req.query

        const month = toNumber(mes)
        const year = toNumber(ano)

        if (!month || !year || month < 1 || month > 12) {
            sendErrorResponse(res, 'Parâmetros mes e ano são obrigatórios e devem ser válidos.', 400)
            return
        }

        const resumo = await ExpenseService.getExpensesByCategory(userId, month, year)
        sendSuccessResponse(res, resumo, 'Resumo por categorias recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar resumo por categorias:', error)
        sendErrorResponse(res, 'Erro ao buscar resumo por categorias.', 500, error)
    }
}