import { pool } from '../database/index'
import { QueryResult } from 'pg'
import {
    Income,
    CreateIncomeRequest,
} from '../types/index'
import {
    formatDate,
    getLastDayOfMonth,
    createErrorResponse
} from '../utils/helper'

interface IncomeWithCategory extends Income {
    categoria_nome?: string
    cor_categoria?: string
}

interface IncomeStatsResult {
    total: string
    fixas: string
    transacoes: string
    media: string
}

export class IncomeService {
    /**
     * Cria uma nova receita
     */
    static async createIncome(
        incomeData: CreateIncomeRequest,
        userId: number
    ): Promise<Income | Income[]> {
        const {
            tipo,
            quantidade,
            nota,
            data,
            fonte,
            fixo = false,
            category_id
        } = incomeData

        // Usar a data diretamente sem conversão de timezone
        const formattedBaseDate = data || formatDate(new Date())

        // Criar receita base
        const result: QueryResult<Income> = await pool.query(
            `INSERT INTO incomes (
        tipo, quantidade, nota, data, fonte, fixo, user_id, category_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
            [
                tipo,
                quantidade,
                nota || null,
                formattedBaseDate,
                fonte || null,
                fixo,
                userId,
                category_id || null
            ]
        )

        const baseIncome = result.rows[0]

        // Se é receita fixa, replicar até dezembro
        if (fixo) {
            const replicatedIncomes = await this.replicateFixedIncome(
                baseIncome,
                formattedBaseDate,
                userId
            )
            return [baseIncome, ...replicatedIncomes]
        }

        return baseIncome
    }

    /**
     * Replica receita fixa até dezembro
     */
    private static async replicateFixedIncome(
        baseIncome: Income,
        baseDateString: string,
        userId: number
    ): Promise<Income[]> {
        // Criar Date object usando meio-dia para evitar timezone issues
        const baseDate = new Date(`${baseDateString}T12:00:00`)
        const diaOriginal = baseDate.getDate()
        const mesOriginal = baseDate.getMonth()
        const ano = baseDate.getFullYear()
        // Só considera "último dia do mês" se for dia 31, para evitar que dia 30 replique para 31
        const ehUltimoDiaMes = diaOriginal === 31

        const replicatedIncomes: Income[] = []

        for (let mes = mesOriginal + 1; mes <= 11; mes++) {
            const novaData = new Date(ano, mes, 1)
            const ultimoDiaDoMes = getLastDayOfMonth(novaData)

            let diaAjustado: number
            if (ehUltimoDiaMes) {
                diaAjustado = ultimoDiaDoMes
            } else {
                diaAjustado = Math.min(diaOriginal, ultimoDiaDoMes)
            }

            const dataRep = formatDate(new Date(ano, mes, diaAjustado))

            const result: QueryResult<Income> = await pool.query(
                `INSERT INTO incomes (
          tipo, quantidade, nota, data, fonte, fixo, user_id, category_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`,
                [
                    baseIncome.tipo,
                    baseIncome.quantidade,
                    baseIncome.nota,
                    dataRep,
                    baseIncome.fonte,
                    true,
                    userId,
                    baseIncome.category_id
                ]
            )

            replicatedIncomes.push(result.rows[0])
        }

        return replicatedIncomes
    }

    /**
     * Busca receitas por intervalo de datas
     */
    static async getIncomesByDateRange(
        userId: number,
        startDate: string,
        endDate: string
    ): Promise<IncomeWithCategory[]> {
        const result: QueryResult<IncomeWithCategory> = await pool.query(
            `SELECT 
        i.*, 
        c.nome AS categoria_nome, 
        c.cor AS cor_categoria
       FROM incomes i
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE i.user_id = $1
         AND i.data BETWEEN $2 AND $3
       ORDER BY i.data DESC`,
            [userId, startDate, endDate]
        )

        return result.rows
    }

    /**
     * Busca receitas por mês e ano
     */
    static async getIncomesByMonthYear(
        userId: number,
        month: number,
        year: number
    ): Promise<IncomeWithCategory[]> {
        const result: QueryResult<IncomeWithCategory> = await pool.query(
            `SELECT 
        i.*, 
        c.nome AS categoria_nome, 
        c.cor AS cor_categoria
       FROM incomes i
       LEFT JOIN categories c ON i.category_id = c.id
       WHERE i.user_id = $1
         AND EXTRACT(MONTH FROM i.data) = $2
         AND EXTRACT(YEAR FROM i.data) = $3
       ORDER BY i.data DESC`,
            [userId, month, year]
        )

        return result.rows
    }

    /**
     * Atualiza uma receita
     */
    static async updateIncome(
        incomeId: number,
        updateData: Partial<CreateIncomeRequest>,
        userId: number
    ): Promise<Income> {
        // Verificar se a receita existe
        const existsResult: QueryResult<Income> = await pool.query(
            `SELECT * FROM incomes WHERE id = $1 AND user_id = $2`,
            [incomeId, userId]
        )

        if (existsResult.rows.length === 0) {
            throw createErrorResponse("Receita não encontrada.", 404)
        }

        const result: QueryResult<Income> = await pool.query(
            `UPDATE incomes SET
        tipo = COALESCE($1, tipo),
        quantidade = COALESCE($2, quantidade),
        nota = COALESCE($3, nota),
        data = COALESCE($4, data),
        fonte = COALESCE($5, fonte),
        category_id = COALESCE($6, category_id),
        updated_at = NOW()
       WHERE id = $7 AND user_id = $8
       RETURNING *`,
            [
                updateData.tipo,
                updateData.quantidade,
                updateData.nota,
                updateData.data,
                updateData.fonte,
                updateData.category_id,
                incomeId,
                userId
            ]
        )

        return result.rows[0]
    }

    /**
     * Remove uma receita
     */
    static async deleteIncome(incomeId: number, userId: number): Promise<Income | Income[]> {
        const result: QueryResult<Income> = await pool.query(
            `SELECT * FROM incomes WHERE id = $1 AND user_id = $2`,
            [incomeId, userId]
        )

        if (result.rows.length === 0) {
            throw createErrorResponse("Receita não encontrada.", 404)
        }

        const income = result.rows[0]

        // Se é receita fixa, remover todas as replicações
        if (income.fixo) {
            const deletedResult: QueryResult<Income> = await pool.query(
                `DELETE FROM incomes 
         WHERE user_id = $1 AND tipo = $2 AND fixo = true 
         RETURNING *`,
                [userId, income.tipo]
            )

            return deletedResult.rows
        }

        // Receita única
        const deleted: QueryResult<Income> = await pool.query(
            `DELETE FROM incomes WHERE id = $1 AND user_id = $2 RETURNING *`,
            [incomeId, userId]
        )

        return deleted.rows[0]
    }

    /**
     * Busca estatísticas de receitas
     */
    static async getIncomeStats(
        userId: number,
        month: number,
        year: number,
        categoryId?: number | undefined
    ): Promise<IncomeStatsResult> {
        let query = `
      SELECT 
        COALESCE(SUM(quantidade), 0) AS total,
        COALESCE(SUM(CASE WHEN fixo = true THEN quantidade ELSE 0 END), 0) AS fixas,
        COUNT(*) AS transacoes,
        COALESCE(AVG(quantidade), 0) AS media
      FROM incomes
      WHERE user_id = $1
        AND EXTRACT(MONTH FROM data) = $2
        AND EXTRACT(YEAR FROM data) = $3`

        const params = [userId, month, year]

        if (categoryId) {
            query += ` AND category_id = $4`
            params.push(categoryId)
        }

        const result: QueryResult<IncomeStatsResult> = await pool.query(query, params)
        return result.rows[0]
    }

    /**
     * Busca total de receitas do mês
     */
    static async getMonthlyTotal(
        userId: number,
        month: number,
        year: number
    ): Promise<number> {
        const result: QueryResult<{ total: string }> = await pool.query(
            `SELECT COALESCE(SUM(quantidade), 0) AS total
       FROM incomes
       WHERE user_id = $1
         AND EXTRACT(MONTH FROM data) = $2
         AND EXTRACT(YEAR FROM data) = $3`,
            [userId, month, year]
        )

        return parseFloat(result.rows[0].total)
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
        const result: QueryResult<{ total: string }> = await pool.query(
            `SELECT COALESCE(SUM(quantidade), 0) AS total
       FROM incomes
       WHERE user_id = $1
         AND category_id = $2
         AND EXTRACT(MONTH FROM data) = $3
         AND EXTRACT(YEAR FROM data) = $4`,
            [userId, categoryId, month, year]
        )

        return parseFloat(result.rows[0].total)
    }

    /**
     * Busca receitas agrupadas por mês para gráficos
     */
    static async getIncomesGroupedByMonth(userId: number): Promise<Array<{ mes: string; total: number }>> {
        const result: QueryResult<{ numero_mes: number; total: string }> = await pool.query(
            `SELECT 
        EXTRACT(MONTH FROM data) AS numero_mes,
        SUM(quantidade) AS total
       FROM incomes
       WHERE user_id = $1
       GROUP BY numero_mes
       ORDER BY numero_mes`,
            [userId]
        )

        const meses = [
            "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
            "Jul", "Ago", "Set", "Out", "Nov", "Dez"
        ]

        return meses.map((mes, index) => {
            const encontrado = result.rows.find(r => Number(r.numero_mes) === index + 1)
            return {
                mes,
                total: encontrado ? Number(encontrado.total) : 0,
            }
        })
    }

    /**
     * Busca resumo de receitas por categoria
     */
    static async getCategoryResume(
        userId: number,
        month: number,
        year: number
    ): Promise<Array<{
        nome: string
        cor: string
        quantidade: number
        total: number
        percentual: number
    }>> {
        const result: QueryResult<{
            nome: string
            cor: string
            quantidade: string
            total: string
        }> = await pool.query(
            `SELECT 
        c.nome,
        c.cor,
        COUNT(i.id) as quantidade,
        SUM(i.quantidade) as total
      FROM incomes i
      JOIN categories c ON c.id = i.category_id
      WHERE i.user_id = $1 
        AND EXTRACT(MONTH FROM i.data) = $2 
        AND EXTRACT(YEAR FROM i.data) = $3
      GROUP BY c.nome, c.cor`,
            [userId, month, year]
        )

        const totalGeral = result.rows.reduce((acc, r) => acc + Number(r.total), 0)

        return result.rows.map((r) => ({
            nome: r.nome,
            cor: r.cor,
            quantidade: Number(r.quantidade),
            total: Number(r.total),
            percentual: totalGeral > 0 ? (Number(r.total) / totalGeral) * 100 : 0,
        }))
    }
}