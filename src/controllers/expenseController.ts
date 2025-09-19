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
 * GET /api/expenses/stats - Estatísticas de despesas
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

        const mes = toNumber(month)
        const ano = toNumber(year)
        const catId = categoryId ? toNumber(categoryId) : null

        if (!mes || !ano || mes < 1 || mes > 12) {
            sendErrorResponse(res, 'Parâmetros month e year são obrigatórios e devem ser válidos.', 400)
            return
        }

        // Calcular mês anterior para comparação
        const mesAnterior = mes === 1 ? 12 : mes - 1
        const anoAnterior = mes === 1 ? ano - 1 : ano

        // Buscar estatísticas do mês atual e anterior
        const [atualTotal, anteriorTotal] = await Promise.all([
            ExpenseService.getMonthlyTotal(userId, mes, ano),
            ExpenseService.getMonthlyTotal(userId, mesAnterior, anoAnterior)
        ])

        // Se há filtro por categoria, buscar dados específicos
        let categoriaAtual = 0
        let categoriaAnterior = 0

        if (catId) {
            [categoriaAtual, categoriaAnterior] = await Promise.all([
                ExpenseService.getTotalByCategory(userId, catId, mes, ano),
                ExpenseService.getTotalByCategory(userId, catId, mesAnterior, anoAnterior)
            ])
        }

        const stats = {
            total: catId ? categoriaAtual : atualTotal,
            anterior: catId ? categoriaAnterior : anteriorTotal,
            variacao: 0
        }

        // Calcular variação percentual
        if (stats.anterior > 0) {
            stats.variacao = ((stats.total - stats.anterior) / stats.anterior) * 100
        }

        sendSuccessResponse(res, stats, 'Estatísticas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error)
        sendErrorResponse(res, 'Erro ao buscar estatísticas.', 500, error)
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

        const result = await DatabaseUtils.query(
            `SELECT 
        c.nome,
        c.cor,
        COUNT(e.id) as quantidade,
        SUM(e.quantidade) as total
      FROM expenses e
      JOIN categories c ON c.id = e.category_id
      WHERE e.user_id = $1 
        AND EXTRACT(MONTH FROM e.data) = $2 
        AND EXTRACT(YEAR FROM e.data) = $3
      GROUP BY c.nome, c.cor
      ORDER BY total DESC`,
            [userId, month, year]
        )

        const totalGeral = result.rows.reduce((acc: number, r: any) => acc + Number(r.total), 0)

        const dados = result.rows.map((r: any) => ({
            nome: r.nome,
            cor: r.cor,
            quantidade: Number(r.quantidade),
            total: Number(r.total),
            percentual: totalGeral > 0 ? (Number(r.total) / totalGeral) * 100 : 0,
        }))

        sendSuccessResponse(res, dados, 'Resumo de categorias recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar resumo de categorias:', error)
        sendErrorResponse(res, 'Erro ao buscar resumo de categorias.', 500, error)
    }
}