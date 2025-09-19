// src/services/expenseService.ts
import { pool } from '../database/index'
import { QueryResult } from 'pg'
import {
    Expense,
    CreateExpenseRequest,
} from '../types/index'
import {
    normalize,
    addMonthsSafe,
    formatDate,
    calculateCompetencia,
    createErrorResponse
} from '../utils/helper'

interface ExpenseWithCategory extends Expense {
    categoria_nome?: string
    cor_categoria?: string
}

export class ExpenseService {
    /**
     * Cria uma nova despesa
     */
    static async createExpense(
        expenseData: CreateExpenseRequest,
        userId: number
    ): Promise<Expense | Expense[]> {
        const {
            metodo_pagamento,
            tipo,
            quantidade,
            fixo = false,
            data,
            parcelas,
            frequencia,
            card_id,
            category_id,
            observacoes,
        } = expenseData

        const baseDate = data ? new Date(`${data}T00:00:00`) : new Date()
        const formattedBaseDate = formatDate(baseDate)

        const metodoNorm = normalize(metodo_pagamento)
        const isCreditCard = metodoNorm.includes("credito") && card_id && !isNaN(Number(card_id))

        /* ==================== CARTÃO DE CRÉDITO ==================== */
        if (isCreditCard) {
            return await this.handleCreditCardExpense({
                ...expenseData,
                data: formattedBaseDate
            }, userId, baseDate)
        }

        /* ===================== DESPESA COMUM ===================== */
        const result: QueryResult<Expense> = await pool.query(
            `INSERT INTO expenses (
                metodo_pagamento, tipo, quantidade, fixo, data,
                parcelas, frequencia, user_id, card_id, category_id, observacoes
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
             RETURNING *`,
            [
                metodo_pagamento,
                tipo,
                quantidade,
                fixo,
                formattedBaseDate,
                parcelas,
                frequencia,
                userId,
                card_id,
                category_id,
                observacoes || null,
            ]
        )

        const baseExpense = result.rows[0]

        // Replicar despesa fixa até dezembro
        if (fixo) {
            await this.replicateFixedExpense(baseExpense, baseDate, userId)
        }

        return baseExpense
    }

    /**
     * Manipula despesas no cartão de crédito
     */
    private static async handleCreditCardExpense(
        expenseData: CreateExpenseRequest & { data: string },
        userId: number,
        baseDate: Date
    ): Promise<Expense | Expense[]> {
        const { card_id, quantidade, parcelas, tipo } = expenseData

        // Buscar dados do cartão
        const cardResult: QueryResult<{
            limite_disponivel: number
            dia_vencimento: number
            dias_fechamento_antes: number
        }> = await pool.query(
            `SELECT limite_disponivel, dia_vencimento, dias_fechamento_antes
             FROM cards WHERE id = $1 AND user_id = $2`,
            [card_id, userId]
        )

        if (cardResult.rows.length === 0) {
            throw createErrorResponse("Cartão não encontrado.", 404)
        }

        const card = cardResult.rows[0]

        // Verificar limite disponível
        if (Number(quantidade) > card.limite_disponivel) {
            throw createErrorResponse(
                `Limite insuficiente. Disponível: R$ ${card.limite_disponivel.toFixed(2)}`,
                400
            )
        }

        // Se é parcelado, criar parcelas
        if (parcelas && parcelas > 1) {
            return await this.handleInstallmentExpense(
                expenseData,
                userId,
                baseDate,
                card.dia_vencimento,
                card.dias_fechamento_antes
            )
        }

        // Despesa única no cartão
        const comp = calculateCompetencia(baseDate, card.dia_vencimento, card.dias_fechamento_antes)

        // Verificar se a competência já foi paga
        await this.checkIfInvoicePaid(userId, card_id!, comp.competencia_mes, comp.competencia_ano)

        const result: QueryResult<Expense> = await pool.query(
            `INSERT INTO expenses (
                metodo_pagamento, tipo, quantidade, fixo, data,
                parcelas, frequencia, user_id, card_id, category_id, observacoes,
                competencia_mes, competencia_ano
             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
             RETURNING *`,
            [
                expenseData.metodo_pagamento,
                tipo,
                quantidade,
                false,
                expenseData.data,
                parcelas,
                expenseData.frequencia,
                userId,
                card_id,
                expenseData.category_id,
                expenseData.observacoes || null,
                comp.competencia_mes,
                comp.competencia_ano,
            ]
        )

        // Reduzir limite disponível
        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel - $1 WHERE id = $2`,
            [quantidade, card_id]
        )

        return result.rows[0]
    }

    /**
     * Verifica se a fatura do cartão já foi paga
     */
    private static async checkIfInvoicePaid(
        userId: number,
        cardId: number,
        mes: number,
        ano: number
    ): Promise<void> {
        const result = await pool.query(
            `SELECT COUNT(*) as count FROM card_invoices_payments 
             WHERE user_id = $1 AND card_id = $2 
             AND competencia_mes = $3 AND competencia_ano = $4`,
            [userId, cardId, mes, ano]
        )

        if (Number(result.rows[0]?.count || 0) > 0) {
            throw createErrorResponse(
                "Esta fatura já foi paga. Não é possível lançar despesas nessa competência.",
                400
            )
        }
    }

    /**
     * Manipula despesas parceladas no cartão
     */
    private static async handleInstallmentExpense(
        expenseData: CreateExpenseRequest & { data: string },
        userId: number,
        baseDate: Date,
        dueDay: number,
        closeDaysBefore: number
    ): Promise<Expense[]> {
        const { parcelas, quantidade, tipo, card_id } = expenseData
        const valorParcela = Number(quantidade) / Number(parcelas!)

        const expenses: Expense[] = []

        for (let i = 0; i < parcelas!; i++) {
            const parcelaPurchaseDate = addMonthsSafe(baseDate, i)
            const comp = calculateCompetencia(parcelaPurchaseDate, dueDay, closeDaysBefore)

            // Verificar se a competência da parcela já foi paga
            await this.checkIfInvoicePaid(userId, card_id!, comp.competencia_mes, comp.competencia_ano)

            const result: QueryResult<Expense> = await pool.query(
                `INSERT INTO expenses (
                    metodo_pagamento, tipo, quantidade, fixo, data,
                    parcelas, frequencia, user_id, card_id, category_id, observacoes,
                    competencia_mes, competencia_ano
                 ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
                 RETURNING *`,
                [
                    expenseData.metodo_pagamento,
                    `${tipo} (${i + 1}/${parcelas})`,
                    valorParcela,
                    false,
                    formatDate(parcelaPurchaseDate),
                    parcelas,
                    expenseData.frequencia,
                    userId,
                    card_id,
                    expenseData.category_id,
                    expenseData.observacoes || null,
                    comp.competencia_mes,
                    comp.competencia_ano,
                ]
            )

            expenses.push(result.rows[0])
        }

        // Reduzir limite do cartão pelo total da compra
        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel - $1 WHERE id = $2`,
            [quantidade, card_id]
        )

        return expenses
    }

    /**
     * Replica despesa fixa até dezembro
     */
    private static async replicateFixedExpense(
        baseExpense: Expense,
        baseDate: Date,
        userId: number
    ): Promise<void> {
        const diaOriginal = baseDate.getDate()
        const mesOriginal = baseDate.getMonth()
        const ano = baseDate.getFullYear()
        const diasNoMesOriginal = new Date(ano, mesOriginal + 1, 0).getDate()
        const ehUltimoDiaMes = diaOriginal === diasNoMesOriginal

        for (let mes = mesOriginal + 1; mes <= 11; mes++) {
            const diasNoMesAlvo = new Date(ano, mes + 1, 0).getDate()

            let diaParaInserir: number
            if (ehUltimoDiaMes) {
                diaParaInserir = diasNoMesAlvo
            } else {
                diaParaInserir = Math.min(diaOriginal, diasNoMesAlvo)
            }

            const dataRep = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaParaInserir).padStart(2, "0")}`

            await pool.query(
                `INSERT INTO expenses (
                    metodo_pagamento, tipo, quantidade, fixo, data,
                    parcelas, frequencia, user_id, card_id, category_id, observacoes
                 ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
                [
                    baseExpense.metodo_pagamento,
                    baseExpense.tipo,
                    baseExpense.quantidade,
                    true,
                    dataRep,
                    baseExpense.parcelas,
                    baseExpense.frequencia,
                    userId,
                    baseExpense.card_id,
                    baseExpense.category_id,
                    baseExpense.observacoes,
                ]
            )
        }
    }

    /**
     * Busca despesas por mês e ano
     */
    static async getExpensesByMonthYear(
        userId: number,
        month: number,
        year: number
    ): Promise<ExpenseWithCategory[]> {
        const result: QueryResult<ExpenseWithCategory> = await pool.query(
            `SELECT 
                e.*, 
                c.nome AS categoria_nome, 
                c.cor AS cor_categoria
             FROM expenses e
             LEFT JOIN categories c ON e.category_id = c.id
             WHERE e.user_id = $1
               AND EXTRACT(MONTH FROM e.data) = $2
               AND EXTRACT(YEAR FROM e.data) = $3
             ORDER BY e.data DESC`,
            [userId, month, year]
        )

        return result.rows
    }

    /**
     * Busca despesas por intervalo de datas
     */
    static async getExpensesByDateRange(
        userId: number,
        startDate: string,
        endDate: string
    ): Promise<ExpenseWithCategory[]> {
        const result: QueryResult<ExpenseWithCategory> = await pool.query(
            `SELECT 
                e.*, 
                c.id AS category_id,
                c.nome AS categoria_nome, 
                c.cor AS cor_categoria
             FROM expenses e
             LEFT JOIN categories c ON e.category_id = c.id
             WHERE e.user_id = $1
               AND e.data BETWEEN $2 AND $3
             ORDER BY e.data DESC`,
            [userId, startDate, endDate]
        )

        return result.rows
    }

    /**
     * Busca total mensal de despesas
     */
    static async getMonthlyTotal(
        userId: number,
        month: number,
        year: number
    ): Promise<number> {
        const result = await pool.query(
            `SELECT COALESCE(SUM(quantidade), 0) as total
             FROM expenses
             WHERE user_id = $1 
               AND EXTRACT(MONTH FROM data) = $2 
               AND EXTRACT(YEAR FROM data) = $3`,
            [userId, month, year]
        )

        return Number(result.rows[0]?.total || 0)
    }

    /**
     * Busca total por categoria
     */
    static async getTotalByCategory(
        userId: number,
        categoryId: number,
        month: number,
        year: number
    ): Promise<number> {
        const result = await pool.query(
            `SELECT COALESCE(SUM(quantidade), 0) as total
             FROM expenses
             WHERE user_id = $1 
               AND category_id = $2
               AND EXTRACT(MONTH FROM data) = $3 
               AND EXTRACT(YEAR FROM data) = $4`,
            [userId, categoryId, month, year]
        )

        return Number(result.rows[0]?.total || 0)
    }

    /**
     * Busca estatísticas de despesas para um período específico (NOVO MÉTODO)
     */
    static async getExpenseStats(
        userId: number,
        month: number,
        year: number,
        categoryId?: number
    ): Promise<{
        total: number
        fixas: number
        transacoes: number
        media: number
    }> {
        try {
            let whereClause = 'WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3'
            let params: any[] = [userId, month, year]

            // Adicionar filtro por categoria se fornecido
            if (categoryId) {
                whereClause += ' AND category_id = $4'
                params.push(categoryId)
            }

            const result = await pool.query(
                `SELECT 
                    COALESCE(SUM(quantidade), 0) as total,
                    COALESCE(SUM(CASE WHEN fixo = true THEN quantidade END), 0) as fixas,
                    COUNT(*) as transacoes,
                    CASE 
                        WHEN COUNT(*) > 0 THEN COALESCE(AVG(quantidade), 0)
                        ELSE 0 
                    END as media
                 FROM expenses
                 ${whereClause}`,
                params
            )

            const stats = result.rows[0]

            return {
                total: Number(stats.total || 0),
                fixas: Number(stats.fixas || 0),
                transacoes: Number(stats.transacoes || 0),
                media: Number(stats.media || 0)
            }
        } catch (error) {
            console.error('Erro em getExpenseStats:', error)
            return {
                total: 0,
                fixas: 0,
                transacoes: 0,
                media: 0
            }
        }
    }

    /**
     * Busca despesas agrupadas por categoria
     */
    static async getExpensesByCategory(
        userId: number,
        month: number,
        year: number
    ): Promise<Array<{ id: number; nome: string; total: number; cor: string }>> {
        const result = await pool.query(
            `SELECT 
                c.id,
                c.nome,
                c.cor,
                COALESCE(SUM(e.quantidade), 0) as total
             FROM categories c
             LEFT JOIN expenses e ON c.id = e.category_id
               AND e.user_id = $1
               AND EXTRACT(MONTH FROM e.data) = $2
               AND EXTRACT(YEAR FROM e.data) = $3
             WHERE c.user_id = $1 AND c.tipo = 'despesa'
             GROUP BY c.id, c.nome, c.cor
             HAVING COALESCE(SUM(e.quantidade), 0) > 0
             ORDER BY total DESC`,
            [userId, month, year]
        )

        return result.rows.map(row => ({
            id: row.id,
            nome: row.nome,
            total: Number(row.total),
            cor: row.cor
        }))
    }

    /**
     * Atualiza uma despesa
     */
    static async updateExpense(
        expenseId: number,
        updateData: Partial<CreateExpenseRequest>,
        userId: number
    ): Promise<Expense> {
        // Buscar despesa atual
        const currentResult: QueryResult<Expense> = await pool.query(
            `SELECT * FROM expenses WHERE id = $1 AND user_id = $2`,
            [expenseId, userId]
        )

        if (currentResult.rows.length === 0) {
            throw createErrorResponse("Despesa não encontrada.", 404)
        }

        const original = currentResult.rows[0]

        // Bloquear edição de despesas no cartão de crédito
        const metodoOrigNorm = normalize(original.metodo_pagamento)
        if (metodoOrigNorm.includes("credito")) {
            throw createErrorResponse(
                "Despesas no cartão de crédito não podem ser editadas.",
                400
            )
        }

        // Construir query dinâmica apenas com campos fornecidos
        const updates: string[] = []
        const values: any[] = []
        let paramIndex = 1

        if (updateData.metodo_pagamento !== undefined) {
            updates.push(`metodo_pagamento = ${paramIndex}`)
            values.push(updateData.metodo_pagamento)
            paramIndex++
        }

        if (updateData.tipo !== undefined) {
            updates.push(`tipo = ${paramIndex}`)
            values.push(updateData.tipo)
            paramIndex++
        }

        if (updateData.quantidade !== undefined) {
            updates.push(`quantidade = ${paramIndex}`)
            values.push(updateData.quantidade)
            paramIndex++
        }

        if (updateData.data !== undefined) {
            updates.push(`data = ${paramIndex}`)
            values.push(updateData.data)
            paramIndex++
        }

        if (updateData.fixo !== undefined) {
            updates.push(`fixo = ${paramIndex}`)
            values.push(updateData.fixo)
            paramIndex++
        }

        if (updateData.category_id !== undefined) {
            updates.push(`category_id = ${paramIndex}`)
            values.push(updateData.category_id)
            paramIndex++
        }

        if (updateData.observacoes !== undefined) {
            updates.push(`observacoes = ${paramIndex}`)
            values.push(updateData.observacoes)
            paramIndex++
        }

        if (updates.length === 0) {
            return original // Nada para atualizar
        }

        // Adicionar updated_at
        updates.push(`updated_at = NOW()`)

        // Adicionar WHERE clause
        values.push(expenseId, userId)

        const result: QueryResult<Expense> = await pool.query(
            `UPDATE expenses SET ${updates.join(', ')} 
             WHERE id = ${paramIndex} AND user_id = ${paramIndex + 1}
             RETURNING *`,
            values
        )

        return result.rows[0]
    }

    /**
     * Remove uma despesa
     */
    static async deleteExpense(
        expenseId: number,
        userId: number
    ): Promise<Expense | Expense[]> {
        // Buscar a despesa
        const expenseResult: QueryResult<Expense> = await pool.query(
            `SELECT * FROM expenses WHERE id = $1 AND user_id = $2`,
            [expenseId, userId]
        )

        if (expenseResult.rows.length === 0) {
            throw createErrorResponse("Despesa não encontrada.", 404)
        }

        const expense = expenseResult.rows[0]

        // Se for despesa fixa, deletar todas as replicações futuras
        if (expense.fixo) {
            const deletedExpenses: QueryResult<Expense> = await pool.query(
                `DELETE FROM expenses 
                 WHERE user_id = $1 
                   AND tipo = $2 
                   AND quantidade = $3 
                   AND fixo = true 
                   AND data >= $4
                 RETURNING *`,
                [userId, expense.tipo, expense.quantidade, expense.data]
            )

            return deletedExpenses.rows
        }

        // Se for despesa no cartão, restaurar limite
        const metodoNorm = normalize(expense.metodo_pagamento)
        if (metodoNorm.includes("credito") && expense.card_id) {
            await pool.query(
                `UPDATE cards SET limite_disponivel = limite_disponivel + $1 WHERE id = $2`,
                [expense.quantidade, expense.card_id]
            )
        }

        // Deletar despesa única
        const deletedExpense: QueryResult<Expense> = await pool.query(
            `DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING *`,
            [expenseId, userId]
        )

        return deletedExpense.rows[0]
    }
}