import { pool } from '../database/index'
import { QueryResult } from 'pg'
import { createErrorResponse, isPositiveNumber } from '../utils/helper'

interface Goal {
    id: number
    user_id: number
    nome: string
    valor_alvo: number
    mes: number
    ano: number
    created_at: Date
    updated_at: Date
}

interface CreateGoalRequest {
    nome: string
    valor_alvo: number
    mes: number
    ano: number
}

interface GoalWithProgress extends Goal {
    valor_atual: number
    progresso: number
}

export class GoalService {
    /**
     * Cria uma nova meta de receita mensal
     */
    static async createGoal(
        goalData: CreateGoalRequest,
        userId: number
    ): Promise<Goal> {
        const { nome, valor_alvo, mes, ano } = goalData

        // Validações
        if (!nome || !isPositiveNumber(valor_alvo) || !mes || !ano) {
            throw createErrorResponse("Nome, valor positivo, mês e ano são obrigatórios.", 400)
        }

        if (mes < 1 || mes > 12) {
            throw createErrorResponse("Mês deve estar entre 1 e 12.", 400)
        }

        // Verificar se já existe meta para este mês/ano
        const existingResult = await pool.query(
            `SELECT id FROM goals
             WHERE user_id = $1 AND mes = $2 AND ano = $3`,
            [userId, mes, ano]
        )

        if (existingResult.rowCount && existingResult.rowCount > 0) {
            throw createErrorResponse("Já existe uma meta para este mês/ano.", 409)
        }

        const result: QueryResult<Goal> = await pool.query(
            `INSERT INTO goals (user_id, nome, valor_alvo, mes, ano)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [userId, nome, valor_alvo, mes, ano]
        )

        return result.rows[0]
    }

    /**
     * Busca todas as metas do usuário com progresso calculado
     */
    static async getGoalsByUser(userId: number, mes?: number, ano?: number): Promise<GoalWithProgress[]> {
        // Buscar todas as metas do usuário
        let query = `SELECT
                g.*,
                COALESCE(
                    (
                        SELECT SUM(i.quantidade)
                        FROM incomes i
                        WHERE i.user_id = g.user_id
                        AND EXTRACT(MONTH FROM i.data) = g.mes
                        AND EXTRACT(YEAR FROM i.data) = g.ano
                    ), 0
                ) as valor_atual
            FROM goals g
            WHERE g.user_id = $1`

        const params: any[] = [userId]

        // Adicionar filtros apenas se fornecidos
        if (mes !== undefined) {
            params.push(mes)
            query += ` AND g.mes = $${params.length}`
        }
        if (ano !== undefined) {
            params.push(ano)
            query += ` AND g.ano = $${params.length}`
        }

        query += ` ORDER BY g.ano DESC, g.mes DESC`

        const result = await pool.query(query, params)

        return result.rows.map(row => {
            const valorAlvo = Number(row.valor_alvo)
            const valorAtual = Number(row.valor_atual)
            const progresso = valorAlvo > 0 ? (valorAtual / valorAlvo) * 100 : 0

            return {
                id: row.id,
                user_id: row.user_id,
                nome: row.nome,
                valor_alvo: valorAlvo,
                mes: row.mes,
                ano: row.ano,
                created_at: row.created_at,
                updated_at: row.updated_at,
                valor_atual: valorAtual,
                progresso: Math.round(progresso * 100) / 100
            }
        })
    }

    /**
     * Busca meta por ID
     */
    static async getGoalById(goalId: number, userId: number): Promise<Goal | null> {
        const result: QueryResult<Goal> = await pool.query(
            'SELECT * FROM goals WHERE id = $1 AND user_id = $2',
            [goalId, userId]
        )

        return result.rows[0] || null
    }

    /**
     * Atualiza uma meta
     */
    static async updateGoal(
        goalId: number,
        updateData: Partial<CreateGoalRequest>,
        userId: number
    ): Promise<Goal> {
        const { nome, valor_alvo, mes, ano } = updateData

        // Verificar se a meta existe
        const exists = await this.getGoalById(goalId, userId)
        if (!exists) {
            throw createErrorResponse("Meta não encontrada.", 404)
        }

        // Validações
        if (valor_alvo !== undefined && !isPositiveNumber(valor_alvo)) {
            throw createErrorResponse("Valor deve ser um número positivo.", 400)
        }

        if (mes !== undefined && (mes < 1 || mes > 12)) {
            throw createErrorResponse("Mês deve estar entre 1 e 12.", 400)
        }

        // Se mudando mes/ano, verificar se já existe meta para o novo período
        if ((mes !== undefined || ano !== undefined)) {
            const newMes = mes ?? exists.mes
            const newAno = ano ?? exists.ano

            const conflictResult = await pool.query(
                `SELECT id FROM goals
                 WHERE user_id = $1 AND mes = $2 AND ano = $3 AND id != $4`,
                [userId, newMes, newAno, goalId]
            )

            if (conflictResult.rowCount && conflictResult.rowCount > 0) {
                throw createErrorResponse("Já existe uma meta para este mês/ano.", 409)
            }
        }

        const result: QueryResult<Goal> = await pool.query(
            `UPDATE goals SET
                nome = COALESCE($1, nome),
                valor_alvo = COALESCE($2, valor_alvo),
                mes = COALESCE($3, mes),
                ano = COALESCE($4, ano),
                updated_at = NOW()
             WHERE id = $5 AND user_id = $6
             RETURNING *`,
            [nome, valor_alvo, mes, ano, goalId, userId]
        )

        return result.rows[0]
    }

    /**
     * Remove uma meta
     */
    static async deleteGoal(goalId: number, userId: number): Promise<{ message: string }> {
        const result: QueryResult<Goal> = await pool.query(
            'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING *',
            [goalId, userId]
        )

        if (result.rowCount === 0) {
            throw createErrorResponse("Meta não encontrada.", 404)
        }

        return { message: "Meta removida com sucesso." }
    }

    /**
     * Busca estatísticas das metas
     */
    static async getGoalStats(userId: number, mes?: number, ano?: number): Promise<{
        total_goals: number
        achieved_goals: number
        in_progress_goals: number
        total_target: number
        total_achieved: number
    }> {
        // Buscar metas com ou sem filtro de data
        const goals = await this.getGoalsByUser(userId, mes, ano)

        const stats = goals.reduce((acc, goal) => {
            acc.total_goals++
            acc.total_target += goal.valor_alvo
            acc.total_achieved += goal.valor_atual

            if (goal.progresso >= 100) {
                acc.achieved_goals++
            } else if (goal.progresso > 0) {
                acc.in_progress_goals++
            }

            return acc
        }, {
            total_goals: 0,
            achieved_goals: 0,
            in_progress_goals: 0,
            total_target: 0,
            total_achieved: 0
        })

        return stats
    }
}
