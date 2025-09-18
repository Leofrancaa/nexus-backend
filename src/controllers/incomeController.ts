import { Request, Response, NextFunction } from 'express'
import { IncomeService } from '../services/incomeService.js'
import {
    AuthenticatedRequest,
    CreateIncomeRequest,
    ApiError
} from '../types/index.js'
import {
    sendErrorResponse,
    sendSuccessResponse,
    toNumber,
    isPositiveNumber
} from '../utils/helper.js'

/**
 * POST /api/incomes - Criar receita
 */
export const createIncome = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const incomeData: CreateIncomeRequest = req.body

        // Validações básicas
        if (!incomeData.tipo || !incomeData.quantidade) {
            sendErrorResponse(res, 'Tipo e quantidade são obrigatórios.', 400)
            return
        }

        if (!isPositiveNumber(incomeData.quantidade)) {
            sendErrorResponse(res, 'Quantidade deve ser um número positivo.', 400)
            return
        }

        const result = await IncomeService.createIncome(incomeData, userId)

        const message = Array.isArray(result)
            ? `${result.length} receitas criadas com sucesso (receita fixa replicada).`
            : 'Receita criada com sucesso.'

        sendSuccessResponse(res, result, message, 201)
    } catch (error) {
        console.error('Erro ao criar receita:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao criar receita.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/incomes - Buscar receitas por intervalo de datas
 */
export const getIncomes = async (
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

            const incomes = await IncomeService.getIncomesByMonthYear(userId, month, year)
            sendSuccessResponse(res, incomes, 'Receitas recuperadas com sucesso.')
            return
        }

        // Busca por intervalo de datas
        if (!start_date || !end_date) {
            sendErrorResponse(res, 'Parâmetros start_date e end_date são obrigatórios.', 400)
            return
        }

        const incomes = await IncomeService.getIncomesByDateRange(
            userId,
            start_date as string,
            end_date as string
        )

        sendSuccessResponse(res, incomes, 'Receitas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar receitas:', error)
        sendErrorResponse(res, 'Erro ao buscar receitas.', 500, error)
    }
}

/**
 * PUT /api/incomes/:id - Atualizar receita
 */
export const updateIncome = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const incomeId = toNumber(req.params.id)
        const updateData: Partial<CreateIncomeRequest> = req.body

        if (!incomeId) {
            sendErrorResponse(res, 'ID da receita inválido.', 400)
            return
        }

        // Validar quantidade se fornecida
        if (updateData.quantidade !== undefined && !isPositiveNumber(updateData.quantidade)) {
            sendErrorResponse(res, 'Quantidade deve ser um número positivo.', 400)
            return
        }

        const updatedIncome = await IncomeService.updateIncome(incomeId, updateData, userId)
        sendSuccessResponse(res, updatedIncome, 'Receita atualizada com sucesso.')
    } catch (error) {
        console.error('Erro ao atualizar receita:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao atualizar receita.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * DELETE /api/incomes/:id - Deletar receita
 */
export const deleteIncome = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const incomeId = toNumber(req.params.id)

        if (!incomeId) {
            sendErrorResponse(res, 'ID da receita inválido.', 400)
            return
        }

        const deletedIncome = await IncomeService.deleteIncome(incomeId, userId)

        const message = Array.isArray(deletedIncome)
            ? `${deletedIncome.length} receitas removidas com sucesso.`
            : 'Receita removida com sucesso.'

        sendSuccessResponse(res, deletedIncome, message)
    } catch (error) {
        console.error('Erro ao deletar receita:', error)

        const apiError = error as ApiError
        sendErrorResponse(
            res,
            apiError.message || 'Erro ao deletar receita.',
            apiError.status || 500,
            apiError
        )
    }
}

/**
 * GET /api/incomes/stats - Estatísticas de receitas
 */
export const getIncomeStats = async (
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
        const atual = await IncomeService.getIncomeStats(userId, mes, ano, catId)

        // Calcular mês anterior para comparação
        const mesAnterior: number = mes === 1 ? 12 : mes - 1
        const anoAnterior: number = mes === 1 ? (ano as number) - 1 : (ano as number)

        const anterior = await IncomeService.getIncomeStats(userId, mesAnterior, anoAnterior, catId)

        const stats = {
            total: Number(atual.total || 0),
            fixas: Number(atual.fixas || 0),
            transacoes: Number(atual.transacoes || 0),
            media: Number(atual.media || 0),
            anterior: Number(anterior.total || 0),
        }

        sendSuccessResponse(res, stats, 'Estatísticas de receitas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar estatísticas de receitas:', error)
        sendErrorResponse(res, 'Erro ao buscar estatísticas de receitas.', 500, error)
    }
}

/**
 * GET /api/incomes/monthly-total - Total mensal
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

        const total = await IncomeService.getMonthlyTotal(userId, month, year)
        sendSuccessResponse(res, { total }, 'Total mensal recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar total mensal de receitas:', error)
        sendErrorResponse(res, 'Erro ao buscar total mensal de receitas.', 500, error)
    }
}

/**
 * GET /api/incomes/total-by-category/:categoryId - Total por categoria
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

        const total = await IncomeService.getTotalByCategory(userId, categoryId, month, year)
        sendSuccessResponse(res, { total }, 'Total da categoria recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar total da categoria:', error)
        sendErrorResponse(res, 'Erro ao buscar total da categoria.', 500, error)
    }
}

/**
 * GET /api/incomes/by-month - Receitas agrupadas por mês
 */
export const getIncomesByMonth = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const result = await IncomeService.getIncomesGroupedByMonth(userId)
        sendSuccessResponse(res, result, 'Receitas por mês recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar receitas por mês:', error)
        sendErrorResponse(res, 'Erro ao buscar receitas por mês.', 500, error)
    }
}

/**
 * GET /api/incomes/category-resume - Resumo por categoria
 */
export const getCategoryResume = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id
        const { mes, ano } = req.query

        const month = toNumber(mes) || new Date().getMonth() + 1
        const year = toNumber(ano) || new Date().getFullYear()

        if (month < 1 || month > 12) {
            sendErrorResponse(res, 'Mês deve estar entre 1 e 12.', 400)
            return
        }

        const resume = await IncomeService.getCategoryResume(userId, month, year)
        sendSuccessResponse(res, resume, 'Resumo de categorias recuperado com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar resumo de categorias de receitas:', error)
        sendErrorResponse(res, 'Erro ao buscar resumo de categorias de receitas.', 500, error)
    }
}