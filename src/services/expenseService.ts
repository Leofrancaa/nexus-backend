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

        const { limite_disponivel, dia_vencimento, dias_fechamento_antes } = cardResult.rows[0]

        // Calcular competência
        const { competencia_mes, competencia_ano } = calculateCompetencia(
            baseDate,
            dia_vencimento,
            dias_fechamento_antes || 10
        )

        // Verificar se a fatura já foi paga
        await this.checkIfInvoicePaid(userId, card_id!, competencia_mes, competencia_ano)

        // Verificar limite
        if (Number(quantidade) > Number(limite_disponivel)) {
            throw createErrorResponse(
                `Valor da despesa (R$${quantidade}) excede o limite disponível do cartão (R$${limite_disponivel}).`,
                400
            )
        }

        // Despesa parcelada
        if (parcelas && parcelas > 1) {
            return await this.handleInstallmentExpense(
                expenseData,
                userId,
                baseDate,
                dia_vencimento,
                dias_fechamento_antes || 10
            )
        }

        // Despesa à vista no cartão
        const inserted: QueryResult<Expense> = await pool.query(
            `INSERT INTO expenses (
        metodo_pagamento, tipo, quantidade, fixo, data,
        parcelas, frequencia, user_id, card_id, category_id, observacoes,
        competencia_mes, competencia_ano
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
            [
                expenseData.metodo_pagamento,
                tipo,
                quantidade,
                false,
                expenseData.data,
                null,
                expenseData.frequencia,
                userId,
                card_id,
                expenseData.category_id,
                expenseData.observacoes || null,
                competencia_mes,
                competencia_ano,
            ]
        )

        // Atualizar limite do cartão
        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel - $1 WHERE id = $2`,
            [quantidade, card_id]
        )

        return inserted.rows[0]
    }

    /**
     * Verifica se a fatura já foi paga
     */
    private static async checkIfInvoicePaid(
        userId: number,
        cardId: number,
        competenciaMes: number,
        competenciaAno: number
    ): Promise<void> {
        const paidResult = await pool.query(
            `SELECT 1 FROM card_invoices_payments
       WHERE user_id = $1 AND card_id = $2
         AND competencia_mes = $3 AND competencia_ano = $4`,
            [userId, cardId, competenciaMes, competenciaAno]
        )

        if ((paidResult.rowCount ?? 0) > 0) {
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

        // Salvar histórico (implementar se necessário)
        // await this.saveExpenseHistory(expenseId, userId, original)

        // Atualizar despesa
        const updatedResult: QueryResult<Expense> = await pool.query(
            `UPDATE expenses SET 
        tipo = COALESCE($1, tipo),
        quantidade = COALESCE($2, quantidade),
        data = COALESCE($3, data),
        metodo_pagamento = COALESCE($4, metodo_pagamento),
        parcelas = COALESCE($5, parcelas),
        fixo = COALESCE($6, fixo),
        frequencia = COALESCE($7, frequencia),
        card_id = COALESCE($8, card_id),
        category_id = COALESCE($9, category_id),
        observacoes = COALESCE($10, observacoes),
        updated_at = NOW()
       WHERE id = $11 AND user_id = $12
       RETURNING *`,
            [
                updateData.tipo,
                updateData.quantidade,
                updateData.data,
                updateData.metodo_pagamento,
                updateData.parcelas,
                updateData.fixo,
                updateData.frequencia,
                updateData.card_id,
                updateData.category_id,
                updateData.observacoes,
                expenseId,
                userId,
            ]
        )

        return updatedResult.rows[0]
    }

    /**
     * Remove uma despesa
     */
    static async deleteExpense(expenseId: number, userId: number): Promise<Expense | Expense[]> {
        const result: QueryResult<Expense> = await pool.query(
            `SELECT * FROM expenses WHERE id = $1 AND user_id = $2`,
            [expenseId, userId]
        )

        if (result.rows.length === 0) {
            throw createErrorResponse("Despesa não encontrada.", 404)
        }

        const expense = result.rows[0]
        const { tipo, fixo, metodo_pagamento, card_id, quantidade, parcelas } = expense
        const metodoNorm = normalize(metodo_pagamento)

        // Despesa parcelada no cartão de crédito
        if (metodoNorm.includes("credito") && parcelas && parcelas > 1 && card_id) {
            return await this.deleteInstallmentExpenses(tipo, card_id, parcelas, userId)
        }

        // Despesa fixa
        if (fixo) {
            return await this.deleteFixedExpenses(tipo, userId, metodoNorm, card_id ?? null, quantidade)
        }

        // Despesa comum
        const deleted: QueryResult<Expense> = await pool.query(
            `DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING *`,
            [expenseId, userId]
        )

        const deletedExpense = deleted.rows[0]

        // Devolver limite se for cartão de crédito
        if (metodoNorm.includes("credito") && card_id) {
            await pool.query(
                `UPDATE cards SET limite_disponivel = limite_disponivel + $1
         WHERE id = $2 AND user_id = $3`,
                [quantidade, card_id, userId]
            )
        }

        return deletedExpense
    }

    /**
     * Remove despesas parceladas
     */
    private static async deleteInstallmentExpenses(
        tipo: string,
        cardId: number,
        parcelas: number,
        userId: number
    ): Promise<Expense[]> {
        const deletedResult: QueryResult<Expense> = await pool.query(
            `DELETE FROM expenses
       WHERE user_id = $1 AND tipo LIKE $2 AND card_id = $3 AND parcelas = $4
       RETURNING *`,
            [userId, `${tipo.split(" (")[0]}%`, cardId, parcelas]
        )

        const deletedExpenses = deletedResult.rows
        const total = deletedExpenses.reduce((sum, e) => sum + Number(e.quantidade), 0)

        // Devolver limite
        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel + $1
       WHERE id = $2 AND user_id = $3`,
            [total, cardId, userId]
        )

        return deletedExpenses
    }

    /**
     * Remove despesas fixas
     */
    private static async deleteFixedExpenses(
        tipo: string,
        userId: number,
        metodoNorm: string,
        cardId: number | null,
        quantidade: number
    ): Promise<Expense[]> {
        const removedResult: QueryResult<Expense> = await pool.query(
            `DELETE FROM expenses WHERE user_id = $1 AND tipo = $2 AND fixo = true RETURNING *`,
            [userId, tipo]
        )

        const removedExpenses = removedResult.rows

        // Devolver limite se for cartão de crédito
        if (metodoNorm.includes("credito") && cardId) {
            const total = removedExpenses.reduce((sum, e) => sum + Number(e.quantidade), 0)
            await pool.query(
                `UPDATE cards SET limite_disponivel = limite_disponivel + $1
         WHERE id = $2 AND user_id = $3`,
                [total, cardId, userId]
            )
        }

        return removedExpenses
    }

    /**
     * Busca total de despesas por categoria
     */
    static async getTotalByCategory(
        userId: number,
        categoryId: number,
        month: number,
        year: number
    ): Promise<number> {
        const result: QueryResult<{ total: string }> = await pool.query(
            `SELECT COALESCE(SUM(quantidade), 0) AS total
       FROM expenses
       WHERE user_id = $1
         AND category_id = $2
         AND EXTRACT(MONTH FROM data) = $3
         AND EXTRACT(YEAR FROM data) = $4`,
            [userId, categoryId, month, year]
        )

        return parseFloat(result.rows[0].total)
    }

    /**
     * Busca total de despesas do mês
     */
    static async getMonthlyTotal(
        userId: number,
        month: number,
        year: number
    ): Promise<number> {
        const result: QueryResult<{ total: string }> = await pool.query(
            `SELECT COALESCE(SUM(quantidade), 0) AS total
       FROM expenses
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM data) = $2
         AND EXTRACT(YEAR FROM data) = $3`,
            [userId, month, year]
        )

        return parseFloat(result.rows[0].total)
    }
}