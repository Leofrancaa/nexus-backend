import { pool } from '../database/index'
import { QueryResult } from 'pg'
import {
    ApiError
} from '../types/index'
import {
    addMonthsSafe,
    createErrorResponse
} from '../utils/helper'

interface PayInvoiceParams {
    user_id: number
    card_id: number
    mes?: number
    ano?: number
}

interface PayInvoiceResult {
    competencia_mes: number
    competencia_ano: number
    total_devolvido: number
    fechamento_em: Date
}

interface CardConfigResult {
    dia_vencimento: number
    dias_fechamento_antes: number
    limite_disponivel: number
}

export class CardInvoiceService {
    /**
     * Paga a fatura de um cartão de crédito
     */
    static async payCardInvoice(params: PayInvoiceParams): Promise<PayInvoiceResult> {
        const { user_id, card_id, mes, ano } = params

        // Buscar configuração do cartão
        const cardResult: QueryResult<CardConfigResult> = await pool.query(
            `SELECT dia_vencimento, dias_fechamento_antes, limite_disponivel
       FROM cards
      WHERE id = $1 AND user_id = $2`,
            [card_id, user_id]
        )

        if (cardResult.rowCount === 0) {
            throw createErrorResponse("Cartão não encontrado.", 404)
        }

        const { dia_vencimento, dias_fechamento_antes, limite_disponivel } = cardResult.rows[0]
        const dueDay = Number(dia_vencimento)
        const closeBefore = Number(dias_fechamento_antes ?? 10)

        // Determinar competência vigente caso não venha explícita
        let competencia_mes = mes ? Number(mes) : null
        let competencia_ano = ano ? Number(ano) : null

        const now = new Date()
        if (!competencia_mes || !competencia_ano) {
            const thisMonthDue = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, 28))
            const nextDue = (now <= thisMonthDue)
                ? thisMonthDue
                : new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dueDay, 28))

            competencia_mes = nextDue.getMonth() + 1
            competencia_ano = nextDue.getFullYear()
        }

        // Data de vencimento e fechamento da competência escolhida
        const dueDate = new Date(competencia_ano, competencia_mes - 1, Math.min(dueDay, 28))
        const closeDate = new Date(dueDate)
        closeDate.setDate(closeDate.getDate() - closeBefore)

        // Só pode pagar após o fechamento
        if (now < closeDate) {
            throw createErrorResponse(
                `Fatura ${String(competencia_mes).padStart(2, "0")}/${competencia_ano} ainda não fechou. Fechamento em ${closeDate.toISOString().slice(0, 10)}.`,
                400
            )
        }

        // Verificar se já foi paga
        const alreadyPaid = await pool.query(
            `SELECT 1 FROM card_invoices_payments
      WHERE user_id = $1 AND card_id = $2
        AND competencia_mes = $3 AND competencia_ano = $4`,
            [user_id, card_id, competencia_mes, competencia_ano]
        )

        if ((alreadyPaid.rowCount ?? 0) > 0) {
            throw createErrorResponse("Esta fatura já foi paga.", 400)
        }

        // Calcular total das despesas da competência
        const totalResult = await pool.query(
            `SELECT COALESCE(SUM(quantidade), 0) AS total
       FROM expenses
      WHERE user_id = $1 AND card_id = $2
        AND competencia_mes = $3 AND competencia_ano = $4`,
            [user_id, card_id, competencia_mes, competencia_ano]
        )

        const total = Number(totalResult.rows[0].total) || 0

        // Usar transação para garantir consistência
        const client = await pool.connect()

        try {
            await client.query('BEGIN')

            // Devolver limite
            await client.query(
                `UPDATE cards
          SET limite_disponivel = limite_disponivel + $1
        WHERE id = $2 AND user_id = $3`,
                [total, card_id, user_id]
            )

            // Registrar pagamento
            await client.query(
                `INSERT INTO card_invoices_payments
        (user_id, card_id, competencia_mes, competencia_ano, amount_paid)
       VALUES ($1, $2, $3, $4, $5)`,
                [user_id, card_id, competencia_mes, competencia_ano, total]
            )

            await client.query('COMMIT')

            return {
                competencia_mes,
                competencia_ano,
                total_devolvido: total,
                fechamento_em: closeDate
            }

        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * Lista faturas disponíveis para pagamento
     */
    static async getAvailableInvoices(user_id: number, card_id: number): Promise<Array<{
        competencia_mes: number
        competencia_ano: number
        total_fatura: number
        data_vencimento: string
        data_fechamento: string
        pode_pagar: boolean
    }>> {
        // Buscar configuração do cartão
        const cardResult: QueryResult<CardConfigResult> = await pool.query(
            `SELECT dia_vencimento, dias_fechamento_antes
       FROM cards
      WHERE id = $1 AND user_id = $2`,
            [card_id, user_id]
        )

        if (cardResult.rowCount === 0) {
            throw createErrorResponse("Cartão não encontrado.", 404)
        }

        const { dia_vencimento, dias_fechamento_antes } = cardResult.rows[0]
        const dueDay = Number(dia_vencimento)
        const closeBefore = Number(dias_fechamento_antes ?? 10)

        // Buscar despesas agrupadas por competência que ainda não foram pagas
        const expensesResult = await pool.query(
            `SELECT 
        e.competencia_mes,
        e.competencia_ano,
        SUM(e.quantidade) as total_fatura
      FROM expenses e
      LEFT JOIN card_invoices_payments p
        ON p.user_id = e.user_id
       AND p.card_id = e.card_id
       AND p.competencia_mes = e.competencia_mes
       AND p.competencia_ano = e.competencia_ano
      WHERE e.user_id = $1 AND e.card_id = $2 AND p.id IS NULL
        AND e.competencia_mes IS NOT NULL
        AND e.competencia_ano IS NOT NULL
      GROUP BY e.competencia_mes, e.competencia_ano
      ORDER BY e.competencia_ano, e.competencia_mes`,
            [user_id, card_id]
        )

        const now = new Date()

        return expensesResult.rows.map(row => {
            const mes = Number(row.competencia_mes)
            const ano = Number(row.competencia_ano)

            const dueDate = new Date(ano, mes - 1, Math.min(dueDay, 28))
            const closeDate = new Date(dueDate)
            closeDate.setDate(closeDate.getDate() - closeBefore)

            return {
                competencia_mes: mes,
                competencia_ano: ano,
                total_fatura: Number(row.total_fatura),
                data_vencimento: dueDate.toISOString().split('T')[0],
                data_fechamento: closeDate.toISOString().split('T')[0],
                pode_pagar: now >= closeDate
            }
        })
    }

    /**
     * Busca histórico de pagamentos de faturas
     */
    static async getPaymentHistory(
        user_id: number,
        card_id: number,
        limit: number = 10
    ): Promise<Array<{
        competencia_mes: number
        competencia_ano: number
        amount_paid: number
        paid_at: Date
    }>> {
        const result = await pool.query(
            `SELECT 
        competencia_mes,
        competencia_ano,
        amount_paid,
        created_at as paid_at
      FROM card_invoices_payments
      WHERE user_id = $1 AND card_id = $2
      ORDER BY competencia_ano DESC, competencia_mes DESC
      LIMIT $3`,
            [user_id, card_id, limit]
        )

        return result.rows.map(row => ({
            competencia_mes: Number(row.competencia_mes),
            competencia_ano: Number(row.competencia_ano),
            amount_paid: Number(row.amount_paid),
            paid_at: row.paid_at
        }))
    }

    /**
     * Cancela o pagamento de uma fatura (reverter)
     */
    static async cancelInvoicePayment(
        user_id: number,
        card_id: number,
        competencia_mes: number,
        competencia_ano: number
    ): Promise<{ message: string; amount_reverted: number }> {
        // Buscar o pagamento
        const paymentResult = await pool.query(
            `SELECT amount_paid FROM card_invoices_payments
      WHERE user_id = $1 AND card_id = $2
        AND competencia_mes = $3 AND competencia_ano = $4`,
            [user_id, card_id, competencia_mes, competencia_ano]
        )

        if (paymentResult.rowCount === 0) {
            throw createErrorResponse("Pagamento não encontrado.", 404)
        }

        const amountPaid = Number(paymentResult.rows[0].amount_paid)

        // Usar transação para reverter
        const client = await pool.connect()

        try {
            await client.query('BEGIN')

            // Reduzir limite disponível (desfazer a devolução)
            await client.query(
                `UPDATE cards
          SET limite_disponivel = limite_disponivel - $1
        WHERE id = $2 AND user_id = $3`,
                [amountPaid, card_id, user_id]
            )

            // Remover registro de pagamento
            await client.query(
                `DELETE FROM card_invoices_payments
        WHERE user_id = $1 AND card_id = $2
          AND competencia_mes = $3 AND competencia_ano = $4`,
                [user_id, card_id, competencia_mes, competencia_ano]
            )

            await client.query('COMMIT')

            return {
                message: `Pagamento da fatura ${competencia_mes}/${competencia_ano} cancelado com sucesso.`,
                amount_reverted: amountPaid
            }

        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * Calcula próxima data de vencimento
     */
    static calculateNextDueDate(dueDay: number): Date {
        const now = new Date()
        const thisMonthDue = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, 28))

        if (now <= thisMonthDue) {
            return thisMonthDue
        } else {
            return new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dueDay, 28))
        }
    }

    /**
     * Verifica se uma fatura pode ser paga
     */
    static async canPayInvoice(
        user_id: number,
        card_id: number,
        competencia_mes: number,
        competencia_ano: number
    ): Promise<{ can_pay: boolean; reason?: string; close_date?: string }> {
        // Buscar configuração do cartão
        const cardResult: QueryResult<{ dia_vencimento: number; dias_fechamento_antes: number }> = await pool.query(
            `SELECT dia_vencimento, dias_fechamento_antes
       FROM cards
      WHERE id = $1 AND user_id = $2`,
            [card_id, user_id]
        )

        if (cardResult.rowCount === 0) {
            return { can_pay: false, reason: "Cartão não encontrado." }
        }

        const { dia_vencimento, dias_fechamento_antes } = cardResult.rows[0]
        const dueDay = Number(dia_vencimento)
        const closeBefore = Number(dias_fechamento_antes ?? 10)

        // Verificar se já foi paga
        const alreadyPaid = await pool.query(
            `SELECT 1 FROM card_invoices_payments
      WHERE user_id = $1 AND card_id = $2
        AND competencia_mes = $3 AND competencia_ano = $4`,
            [user_id, card_id, competencia_mes, competencia_ano]
        )

        if ((alreadyPaid.rowCount ?? 0) > 0) {
            return { can_pay: false, reason: "Esta fatura já foi paga." }
        }

        // Calcular data de fechamento
        const dueDate = new Date(competencia_ano, competencia_mes - 1, Math.min(dueDay, 28))
        const closeDate = new Date(dueDate)
        closeDate.setDate(closeDate.getDate() - closeBefore)

        const now = new Date()
        if (now < closeDate) {
            return {
                can_pay: false,
                reason: `Fatura ainda não fechou. Fechamento em ${closeDate.toISOString().slice(0, 10)}.`,
                close_date: closeDate.toISOString().split('T')[0]
            }
        }

        return { can_pay: true }
    }
}