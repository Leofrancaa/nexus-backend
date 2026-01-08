import { pool } from '../database/index'
import { QueryResult } from 'pg'
import {
    Card,
    CreateCardRequest,
} from '../types/index'
import {
    createErrorResponse,
    isPositiveNumber
} from '../utils/helper'

interface CardWithStats extends Card {
    gasto_total: number
    proximo_vencimento: string
}

export class CardService {
    /**
     * Cria um novo cartão
     */
    static async createCard(
        cardData: CreateCardRequest,
        userId: number
    ): Promise<Card> {
        const {
            nome,
            tipo,
            numero,
            cor,
            limite = 0,
            dia_vencimento,
            dias_fechamento_antes = 10
        } = cardData

        console.log('[CardService.createCard] Dados recebidos:', {
            nome,
            tipo,
            numero,
            limite,
            dia_vencimento,
            dias_fechamento_antes
        })

        // Validações
        if (!numero || numero.length !== 4) {
            throw createErrorResponse("O número do cartão deve conter exatamente 4 dígitos.", 400)
        }

        // Normalizar tipo (aceitar com ou sem acento)
        const isCredito = tipo === 'crédito' || tipo === 'credito'
        const isDebito = tipo === 'débito' || tipo === 'debito'

        console.log('[CardService.createCard] Tipo normalizado:', { tipo, isCredito, isDebito })

        // Validações específicas para cartões de crédito
        if (isCredito) {
            if (!dia_vencimento || dia_vencimento < 1 || dia_vencimento > 31) {
                throw createErrorResponse("O dia de vencimento deve estar entre 1 e 31 para cartões de crédito.", 400)
            }

            if (dias_fechamento_antes != null && (dias_fechamento_antes < 1 || dias_fechamento_antes > 31)) {
                throw createErrorResponse("Dias de fechamento antes deve estar entre 1 e 31.", 400)
            }

            if (!isPositiveNumber(limite)) {
                throw createErrorResponse("Limite deve ser um número positivo para cartões de crédito.", 400)
            }
        }

        // Para cartões de débito, garantir que os campos opcionais sejam null
        const diaVencimentoFinal = isDebito ? null : dia_vencimento
        const diasFechamentoAntesFinal = isDebito ? null : dias_fechamento_antes

        const result: QueryResult<Card> = await pool.query(
            `INSERT INTO cards (
        nome, tipo, numero, cor, limite, limite_disponivel,
        dia_vencimento, dias_fechamento_antes, user_id
     )
     VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8)
     RETURNING *`,
            [
                nome,
                tipo,
                numero,
                cor || '#6B7280',
                limite,
                diaVencimentoFinal,
                diasFechamentoAntesFinal,
                userId
            ]
        )

        return result.rows[0]
    }

    /**
     * Busca todos os cartões do usuário
     */
    static async getCardsByUser(userId: number): Promise<CardWithStats[]> {
        const currentMonth = new Date().getMonth() + 1
        const currentYear = new Date().getFullYear()

        console.log('[getCardsByUser] Buscando cartões para:', { userId, currentMonth, currentYear })

        const result: QueryResult<CardWithStats & { gasto_fixo: string }> = await pool.query(
            `SELECT
        c.*,
        COALESCE(SUM(e.quantidade), 0) AS gasto_total,
        COALESCE(SUM(CASE WHEN e.fixo = true THEN e.quantidade ELSE 0 END), 0) AS gasto_fixo,
        CASE
          WHEN CURRENT_DATE <= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, c.dia_vencimento)
          THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, c.dia_vencimento)
          ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int + 1, c.dia_vencimento)
        END AS proximo_vencimento
     FROM cards c
     LEFT JOIN expenses e ON e.card_id = c.id
       AND e.user_id = $1
       AND (e.competencia_mes = $2 AND e.competencia_ano = $3)
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.id DESC`,
            [userId, currentMonth, currentYear]
        )

        console.log('[getCardsByUser] Resultado:', result.rows.map(r => ({
            id: r.id,
            nome: r.nome,
            gasto_total: r.gasto_total,
            gasto_fixo: r.gasto_fixo,
            limite_disponivel_banco: r.limite_disponivel
        })))

        return result.rows.map(card => {
            const limite = Number(card.limite)
            const gastoTotal = Number(card.gasto_total)
            const gastoFixo = Number(card.gasto_fixo)
            const limiteDisponvelBanco = Number(card.limite_disponivel)

            // Limite disponível = limite do banco (já descontadas parceladas/únicas) - despesas fixas da competência atual
            const limiteDisponivel = limiteDisponvelBanco - gastoFixo

            console.log(`[getCardsByUser] Card ${card.nome}: limite=${limite}, limite_banco=${limiteDisponvelBanco}, gasto_fixo=${gastoFixo}, resultado=${limiteDisponivel}`)

            return {
                ...card,
                limite,
                limite_disponivel: limiteDisponivel,
                gasto_total: gastoTotal,
            }
        })
    }

    /**
     * Busca cartão por ID
     */
    static async getCardById(cardId: number, userId: number): Promise<Card | null> {
        const result: QueryResult<Card> = await pool.query(
            `SELECT * FROM cards WHERE id = $1 AND user_id = $2`,
            [cardId, userId]
        )

        return result.rows[0] || null
    }

    /**
     * Atualiza um cartão
     */
    static async updateCard(
        cardId: number,
        updateData: Partial<CreateCardRequest>,
        userId: number
    ): Promise<Card> {
        const {
            nome,
            tipo,
            numero,
            cor,
            limite,
            dia_vencimento,
            dias_fechamento_antes
        } = updateData

        // Validações se os campos foram fornecidos
        if (numero && numero.length !== 4) {
            throw createErrorResponse("O número do cartão deve conter exatamente 4 dígitos.", 400)
        }

        if (dia_vencimento && (dia_vencimento < 1 || dia_vencimento > 31)) {
            throw createErrorResponse("O dia de vencimento deve estar entre 1 e 31.", 400)
        }

        if (dias_fechamento_antes != null && (dias_fechamento_antes < 1 || dias_fechamento_antes > 31)) {
            throw createErrorResponse("Dias de fechamento antes deve estar entre 1 e 31.", 400)
        }

        if (limite !== undefined) {
            if (!isPositiveNumber(limite)) {
                throw createErrorResponse("Limite deve ser um número positivo.", 400)
            }

            // Verificar se o novo limite não é menor que o saldo em aberto
            const saldoEmAberto = await this.getSaldoEmAberto(cardId, userId)
            if (Number(limite) < Number(saldoEmAberto)) {
                throw createErrorResponse(
                    `O novo limite não pode ser menor que o saldo em aberto (faturas não pagas): R$ ${saldoEmAberto.toFixed(2)}`,
                    400
                )
            }

            // Recalcular limite disponível
            const novoLimiteDisponivel = Math.max(Number(limite) - Number(saldoEmAberto), 0)

            const result: QueryResult<Card> = await pool.query(
                `UPDATE cards SET
            nome = COALESCE($1, nome),
            tipo = COALESCE($2, tipo),
            numero = COALESCE($3, numero),
            cor = COALESCE($4, cor),
            limite = $5,
            limite_disponivel = $6,
            dia_vencimento = COALESCE($7, dia_vencimento),
            dias_fechamento_antes = COALESCE($8, dias_fechamento_antes),
            updated_at = NOW()
         WHERE id = $9 AND user_id = $10
         RETURNING *`,
                [
                    nome,
                    tipo,
                    numero,
                    cor,
                    limite,
                    novoLimiteDisponivel,
                    dia_vencimento,
                    dias_fechamento_antes,
                    cardId,
                    userId
                ]
            )

            if (result.rows.length === 0) {
                throw createErrorResponse("Cartão não encontrado.", 404)
            }

            return result.rows[0]
        }

        // Atualização sem alteração de limite
        const result: QueryResult<Card> = await pool.query(
            `UPDATE cards SET
        nome = COALESCE($1, nome),
        tipo = COALESCE($2, tipo),
        numero = COALESCE($3, numero),
        cor = COALESCE($4, cor),
        dia_vencimento = COALESCE($5, dia_vencimento),
        dias_fechamento_antes = COALESCE($6, dias_fechamento_antes),
        updated_at = NOW()
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
            [
                nome,
                tipo,
                numero,
                cor,
                dia_vencimento,
                dias_fechamento_antes,
                cardId,
                userId
            ]
        )

        if (result.rows.length === 0) {
            throw createErrorResponse("Cartão não encontrado.", 404)
        }

        return result.rows[0]
    }

    /**
     * Remove um cartão
     */
    static async deleteCard(cardId: number, userId: number): Promise<{ message: string }> {
        // Verificar se tem despesas no mês atual
        const hasCurrentExpenses = await this.hasCurrentMonthExpenses(cardId, userId)
        if (hasCurrentExpenses) {
            throw createErrorResponse(
                "Este cartão possui despesas vinculadas no mês atual e não pode ser excluído.",
                400
            )
        }

        // Verificar se tem despesas passadas
        const hasPastExpenses = await this.hasPastExpenses(cardId, userId)
        if (hasPastExpenses) {
            // Deletar cartão e todas as despesas vinculadas
            await this.deleteCardAndExpenses(cardId, userId)
            return {
                message: "Cartão e todas as despesas anteriores vinculadas a ele foram excluídos com sucesso."
            }
        }

        // Deletar apenas o cartão
        const result: QueryResult<Card> = await pool.query(
            `DELETE FROM cards WHERE id = $1 AND user_id = $2 RETURNING *`,
            [cardId, userId]
        )

        if (result.rows.length === 0) {
            throw createErrorResponse("Cartão não encontrado.", 404)
        }

        return { message: "Cartão removido com sucesso." }
    }

    /**
     * Calcula saldo em aberto do cartão (faturas não pagas)
     */
    static async getSaldoEmAberto(cardId: number, userId: number): Promise<number> {
        const result: QueryResult<{ aberto: string }> = await pool.query(
            `
      SELECT COALESCE(SUM(e.quantidade), 0) AS aberto
        FROM expenses e
        LEFT JOIN card_invoices_payments p
          ON p.user_id = e.user_id
         AND p.card_id = e.card_id
         AND p.competencia_mes = e.competencia_mes
         AND p.competencia_ano = e.competencia_ano
       WHERE e.user_id = $1
         AND e.card_id = $2
         AND p.id IS NULL
      `,
            [userId, cardId]
        )

        return Number(result.rows[0].aberto)
    }

    /**
     * Verifica se tem despesas no mês atual
     */
    static async hasCurrentMonthExpenses(cardId: number, userId: number): Promise<boolean> {
        const result: QueryResult<{ count: string }> = await pool.query(
            `SELECT COUNT(*) as count FROM expenses
        WHERE card_id = $1 AND user_id = $2
          AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)`,
            [cardId, userId]
        )

        return Number(result.rows[0].count) > 0
    }

    /**
     * Verifica se tem despesas passadas
     */
    static async hasPastExpenses(cardId: number, userId: number): Promise<boolean> {
        const result: QueryResult<{ count: string }> = await pool.query(
            `SELECT COUNT(*) as count FROM expenses
        WHERE card_id = $1 AND user_id = $2
          AND (EXTRACT(MONTH FROM data) != EXTRACT(MONTH FROM CURRENT_DATE)
            OR EXTRACT(YEAR FROM data) != EXTRACT(YEAR FROM CURRENT_DATE))`,
            [cardId, userId]
        )

        return Number(result.rows[0].count) > 0
    }

    /**
     * Deleta cartão e todas as despesas vinculadas
     */
    static async deleteCardAndExpenses(cardId: number, userId: number): Promise<void> {
        const client = await pool.connect()

        try {
            await client.query('BEGIN')

            // Excluir todas as despesas vinculadas ao cartão
            await client.query(
                `DELETE FROM expenses WHERE card_id = $1 AND user_id = $2`,
                [cardId, userId]
            )

            // Excluir pagamentos de faturas
            await client.query(
                `DELETE FROM card_invoices_payments WHERE card_id = $1 AND user_id = $2`,
                [cardId, userId]
            )

            // Excluir o cartão
            const result = await client.query(
                `DELETE FROM cards WHERE id = $1 AND user_id = $2 RETURNING *`,
                [cardId, userId]
            )

            if (result.rows.length === 0) {
                throw createErrorResponse("Cartão não encontrado.", 404)
            }

            await client.query('COMMIT')
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * Calcula o gasto total histórico do cartão
     */
    static async getGastoTotal(cardId: number, userId: number): Promise<number> {
        const result: QueryResult<{ total: string }> = await pool.query(
            `SELECT COALESCE(SUM(quantidade), 0) AS total
       FROM expenses
      WHERE card_id = $1 AND user_id = $2`,
            [cardId, userId]
        )

        return Number(result.rows[0].total)
    }
}