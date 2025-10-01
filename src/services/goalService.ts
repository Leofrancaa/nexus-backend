import { pool } from '../database/index'
import { QueryResult } from 'pg'
import { createErrorResponse, isPositiveNumber } from '../utils/helper'

interface Goal {
    id: number
    user_id: number
    category_id: number | null
    tipo: 'receita' | 'despesa'
    nome: string
    valor_alvo: number
    mes: number
    ano: number
    created_at: Date
    updated_at: Date
}

interface CreateGoalRequest {
    category_id?: number
    tipo: 'receita' | 'despesa'
    nome: string
    valor_alvo: number
    mes: number
    ano: number
}

interface GoalWithProgress extends Goal {
    valor_atual: number
    progresso: number
    categoria?: {
        id: number
        nome: string
        cor: string
    }
}

export class GoalService {
    /**
     * Cria uma nova meta
     */
    static async createGoal(
        goalData: CreateGoalRequest,
        userId: number
    ): Promise<Goal> {
        const { category_id, tipo, nome, valor_alvo, mes, ano } = goalData

        // Validações
        if (!nome || !tipo || !isPositiveNumber(valor_alvo) || !mes || !ano) {
            throw createErrorResponse("Nome, tipo, valor positivo, mês e ano são obrigatórios.", 400)
        }

        if (mes < 1 || mes > 12) {
            throw createErrorResponse("Mês deve estar entre 1 e 12.", 400)
        }

        if (tipo !== 'receita' && tipo !== 'despesa') {
            throw createErrorResponse("Tipo deve ser 'receita' ou 'despesa'.", 400)
        }

        // Se category_id for fornecido, verificar se existe e é do tipo correto
        if (category_id) {
            const categoryResult = await pool.query(
                'SELECT id, tipo FROM categories WHERE id = $1 AND user_id = $2',
                [category_id, userId]
            )

            if (categoryResult.rowCount === 0) {
                throw createErrorResponse("Categoria não encontrada.", 404)
            }

            if (categoryResult.rows[0].tipo !== tipo) {
                throw createErrorResponse(`Categoria deve ser do tipo ${tipo}.`, 400)
            }
        }

        // Verificar se já existe meta para essa combinação
        const existingResult = await pool.query(
            `SELECT id FROM goals
             WHERE user_id = $1 AND category_id IS NOT DISTINCT FROM $2
             AND tipo = $3 AND mes = $4 AND ano = $5`,
            [userId, category_id || null, tipo, mes, ano]
        )

        if (existingResult.rowCount && existingResult.rowCount > 0) {
            throw createErrorResponse("Já existe uma meta para esta categoria/tipo neste período.", 409)
        }

        const result: QueryResult<Goal> = await pool.query(
            `INSERT INTO goals (user_id, category_id, tipo, nome, valor_alvo, mes, ano)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [userId, category_id || null, tipo, nome, valor_alvo, mes, ano]
        )

        return result.rows[0]
    }

    /**
     * Busca todas as metas do usuário com progresso calculado
     */
    static async getGoalsByUser(userId: number, mes?: number, ano?: number): Promise<GoalWithProgress[]> {
        const now = new Date()
        const targetMonth = mes || (now.getMonth() + 1)
        const targetYear = ano || now.getFullYear()

        const result = await pool.query(
            `SELECT
                g.*,
                c.nome as categoria_nome,
                c.cor as categoria_cor,
                COALESCE(
                    CASE
                        WHEN g.tipo = 'despesa' THEN (
                            SELECT SUM(e.quantidade)
                            FROM expenses e
                            WHERE e.user_id = g.user_id
                            AND (g.category_id IS NULL OR e.category_id = g.category_id)
                            AND EXTRACT(MONTH FROM e.data) = g.mes
                            AND EXTRACT(YEAR FROM e.data) = g.ano
                        )
                        WHEN g.tipo = 'receita' THEN (
                            SELECT SUM(i.quantidade)
                            FROM incomes i
                            WHERE i.user_id = g.user_id
                            AND (g.category_id IS NULL OR i.category_id = g.category_id)
                            AND EXTRACT(MONTH FROM i.data) = g.mes
                            AND EXTRACT(YEAR FROM i.data) = g.ano
                        )
                    END, 0
                ) as valor_atual
            FROM goals g
            LEFT JOIN categories c ON g.category_id = c.id
            WHERE g.user_id = $1 AND g.mes = $2 AND g.ano = $3
            ORDER BY g.created_at DESC`,
            [userId, targetMonth, targetYear]
        )

        return result.rows.map(row => {
            const valorAlvo = Number(row.valor_alvo)
            const valorAtual = Number(row.valor_atual)
            const progresso = valorAlvo > 0 ? (valorAtual / valorAlvo) * 100 : 0

            return {
                id: row.id,
                user_id: row.user_id,
                category_id: row.category_id,
                tipo: row.tipo,
                nome: row.nome,
                valor_alvo: valorAlvo,
                mes: row.mes,
                ano: row.ano,
                created_at: row.created_at,
                updated_at: row.updated_at,
                valor_atual: valorAtual,
                progresso: Math.round(progresso * 100) / 100,
                categoria: row.categoria_nome ? {
                    id: row.category_id,
                    nome: row.categoria_nome,
                    cor: row.categoria_cor
                } : undefined
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
        const { category_id, tipo, nome, valor_alvo, mes, ano } = updateData

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

        if (tipo !== undefined && tipo !== 'receita' && tipo !== 'despesa') {
            throw createErrorResponse("Tipo deve ser 'receita' ou 'despesa'.", 400)
        }

        const result: QueryResult<Goal> = await pool.query(
            `UPDATE goals SET
                category_id = COALESCE($1, category_id),
                tipo = COALESCE($2, tipo),
                nome = COALESCE($3, nome),
                valor_alvo = COALESCE($4, valor_alvo),
                mes = COALESCE($5, mes),
                ano = COALESCE($6, ano),
                updated_at = NOW()
             WHERE id = $7 AND user_id = $8
             RETURNING *`,
            [category_id, tipo, nome, valor_alvo, mes, ano, goalId, userId]
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
        const now = new Date()
        const targetMonth = mes || (now.getMonth() + 1)
        const targetYear = ano || now.getFullYear()

        const goals = await this.getGoalsByUser(userId, targetMonth, targetYear)

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
