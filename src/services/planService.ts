// src/services/planService.ts
import { pool } from '../database/index'
import { QueryResult } from 'pg'
import {
    Plan,
    CreatePlanRequest,
    ContributionRequest,
} from '../types/index'
import {
    createErrorResponse,
    isPositiveNumber,
    isValidDateString,
    sanitizeString
} from '../utils/helper'

interface PlanWithProgress extends Plan {
    progresso: number
    dias_restantes: number
    is_completed: boolean
    is_overdue: boolean
    contributions_count: number
    average_contribution: number
    last_contribution_date: Date | null
}

interface PlanContribution {
    id: number
    plan_id: number
    user_id: number
    valor: number
    created_at: Date
}

export class PlanService {
    /**
     * Cria um novo plano
     */
    static async createPlan(
        planData: CreatePlanRequest,
        userId: number
    ): Promise<Plan> {
        const { nome, descricao, meta, prazo } = planData

        // Validações
        if (!nome || !meta || !prazo) {
            throw createErrorResponse("Nome, meta e prazo são obrigatórios.", 400)
        }

        if (!isPositiveNumber(meta)) {
            throw createErrorResponse("Meta deve ser um número positivo.", 400)
        }

        if (!isValidDateString(prazo)) {
            throw createErrorResponse("Prazo deve estar no formato YYYY-MM-DD.", 400)
        }

        // Verificar se o prazo não é no passado
        const prazoDate = new Date(`${prazo}T23:59:59`)
        const now = new Date()
        if (prazoDate <= now) {
            throw createErrorResponse("Prazo deve ser uma data futura.", 400)
        }

        // Verificar se não existe plano com o mesmo nome
        const existsResult = await pool.query(
            'SELECT id FROM plans WHERE nome = $1 AND user_id = $2',
            [nome.trim(), userId]
        )

        if (existsResult.rowCount && existsResult.rowCount > 0) {
            throw createErrorResponse("Já existe um plano com este nome.", 409)
        }

        const result: QueryResult<Plan> = await pool.query(
            `INSERT INTO plans (user_id, nome, descricao, meta, prazo, status, total_contribuido)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                userId,
                sanitizeString(nome.trim()),
                descricao ? sanitizeString(descricao.trim()) : null,
                meta,
                prazo,
                'Iniciando',
                0
            ]
        )

        return result.rows[0]
    }

    /**
     * Busca planos do usuário
     */
    static async getPlansByUser(userId: number): Promise<PlanWithProgress[]> {
        try {
            console.log('[getPlansByUser] Buscando planos para userId:', userId)

            const result: QueryResult<Plan> = await pool.query(
                'SELECT * FROM plans WHERE user_id = $1 ORDER BY created_at DESC',
                [userId]
            )

            console.log('[getPlansByUser] Planos encontrados no banco:', result.rows.length)

            // Se não há planos, retornar array vazio
            if (result.rows.length === 0) {
                return []
            }

            // Calcular progresso e estatísticas para cada plano
            const plansWithProgress = await Promise.all(
                result.rows.map(async (plan) => {
                    try {
                        console.log('[getPlansByUser] Calculando progresso para plano:', plan.id)
                        const progress = await this.calculatePlanProgress(plan)
                        return progress
                    } catch (error) {
                        console.error(`Erro ao calcular progresso do plano ${plan.id}:`, error)
                        // Retornar plano com valores padrão em caso de erro
                        return {
                            ...plan,
                            meta: Number(plan.meta),
                            total_contribuido: Number(plan.total_contribuido),
                            progresso: 0,
                            dias_restantes: 0,
                            is_completed: false,
                            is_overdue: false,
                            contributions_count: 0,
                            average_contribution: 0,
                            last_contribution_date: null
                        }
                    }
                })
            )

            console.log('[getPlansByUser] Retornando planos processados:', plansWithProgress.length)
            return plansWithProgress
        } catch (error) {
            console.error('Erro em getPlansByUser:', error)
            throw createErrorResponse('Erro ao buscar planos do usuário.', 500)
        }
    }

    /**
     * Busca plano por ID
     */
    static async getPlanById(planId: number, userId: number): Promise<PlanWithProgress | null> {
        try {
            const result: QueryResult<Plan> = await pool.query(
                'SELECT * FROM plans WHERE id = $1 AND user_id = $2',
                [planId, userId]
            )

            if (result.rows.length === 0) {
                return null
            }

            return await this.calculatePlanProgress(result.rows[0])
        } catch (error) {
            console.error('Erro em getPlanById:', error)
            throw error
        }
    }

    /**
     * Atualiza um plano
     */
    static async updatePlan(
        planId: number,
        updateData: Partial<CreatePlanRequest>,
        userId: number
    ): Promise<Plan> {
        const { nome, descricao, meta, prazo } = updateData

        // Verificar se o plano existe
        const existsResult = await pool.query(
            'SELECT * FROM plans WHERE id = $1 AND user_id = $2',
            [planId, userId]
        )

        if (existsResult.rowCount === 0) {
            throw createErrorResponse("Plano não encontrado.", 404)
        }

        const currentPlan = existsResult.rows[0]

        // Validações se os campos foram fornecidos
        if (meta !== undefined && !isPositiveNumber(meta)) {
            throw createErrorResponse("Meta deve ser um número positivo.", 400)
        }

        if (prazo && !isValidDateString(prazo)) {
            throw createErrorResponse("Prazo deve estar no formato YYYY-MM-DD.", 400)
        }

        if (prazo) {
            const prazoDate = new Date(`${prazo}T23:59:59`)
            const now = new Date()
            if (prazoDate <= now) {
                throw createErrorResponse("Prazo deve ser uma data futura.", 400)
            }
        }

        // Verificar nome único se fornecido
        if (nome) {
            const duplicateResult = await pool.query(
                'SELECT id FROM plans WHERE nome = $1 AND user_id = $2 AND id != $3',
                [nome.trim(), userId, planId]
            )

            if (duplicateResult.rowCount && duplicateResult.rowCount > 0) {
                throw createErrorResponse("Já existe um plano com este nome.", 409)
            }
        }

        // Se a meta mudou, recalcular o status
        let newStatus = currentPlan.status
        if (meta !== undefined && meta !== Number(currentPlan.meta)) {
            const progresso = (Number(currentPlan.total_contribuido) / Number(meta)) * 100

            if (progresso >= 100) {
                newStatus = "Concluído"
            } else if (progresso >= 80) {
                newStatus = "Quase lá"
            } else if (progresso > 0) {
                newStatus = "Em progresso"
            } else {
                newStatus = "Iniciando"
            }
        }

        const result: QueryResult<Plan> = await pool.query(
            `UPDATE plans SET
                nome = COALESCE($1, nome),
                descricao = COALESCE($2, descricao),
                meta = COALESCE($3, meta),
                prazo = COALESCE($4, prazo),
                status = $5,
                updated_at = NOW()
             WHERE id = $6 AND user_id = $7
             RETURNING *`,
            [
                nome ? sanitizeString(nome.trim()) : null,
                descricao ? sanitizeString(descricao.trim()) : null,
                meta,
                prazo,
                newStatus,
                planId,
                userId
            ]
        )

        return result.rows[0]
    }

    /**
     * Remove um plano
     */
    static async deletePlan(planId: number, userId: number): Promise<{ message: string }> {
        const client = await pool.connect()

        try {
            await client.query('BEGIN')

            // Verificar se o plano existe
            const planResult = await client.query(
                'SELECT * FROM plans WHERE id = $1 AND user_id = $2',
                [planId, userId]
            )

            if (planResult.rowCount === 0) {
                throw createErrorResponse("Plano não encontrado.", 404)
            }

            // Deletar todas as contribuições do plano
            await client.query(
                'DELETE FROM plan_contributions WHERE plan_id = $1 AND user_id = $2',
                [planId, userId]
            )

            // Deletar o plano
            await client.query(
                'DELETE FROM plans WHERE id = $1 AND user_id = $2',
                [planId, userId]
            )

            await client.query('COMMIT')

            return { message: "Plano e todas suas contribuições foram removidos com sucesso." }

        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * Adiciona uma contribuição ao plano
     */
    static async addContribution(
        planId: number,
        contributionData: ContributionRequest,
        userId: number
    ): Promise<{
        contribution: PlanContribution
        new_total: number
        progress_percentage: number
        status: string
    }> {
        const { valor } = contributionData

        if (!isPositiveNumber(valor)) {
            throw createErrorResponse("Valor da contribuição deve ser positivo.", 400)
        }

        const client = await pool.connect()

        try {
            await client.query('BEGIN')

            // Verificar se o plano existe
            const planResult = await client.query(
                'SELECT * FROM plans WHERE id = $1 AND user_id = $2',
                [planId, userId]
            )

            if (planResult.rowCount === 0) {
                throw createErrorResponse("Plano não encontrado.", 404)
            }

            const plan = planResult.rows[0]

            // Verificar se o plano não está já concluído
            if (plan.status === 'Concluído') {
                throw createErrorResponse("Não é possível contribuir para um plano já concluído.", 400)
            }

            // Inserir contribuição
            const contributionResult: QueryResult<PlanContribution> = await client.query(
                `INSERT INTO plan_contributions (plan_id, user_id, valor)
                 VALUES ($1, $2, $3)
                 RETURNING *`,
                [planId, userId, valor]
            )

            const contribution = contributionResult.rows[0]

            // Atualizar total contribuído do plano
            const newTotal = Number(plan.total_contribuido) + Number(valor)
            const meta = Number(plan.meta)
            const progresso = (newTotal / meta) * 100

            // Determinar novo status
            let newStatus = "Iniciando"
            if (progresso >= 100) {
                newStatus = "Concluído"
            } else if (progresso >= 80) {
                newStatus = "Quase lá"
            } else if (progresso > 0) {
                newStatus = "Em progresso"
            }

            // Atualizar plano
            await client.query(
                `UPDATE plans SET 
                    total_contribuido = $1,
                    status = $2,
                    updated_at = NOW()
                 WHERE id = $3 AND user_id = $4`,
                [newTotal, newStatus, planId, userId]
            )

            await client.query('COMMIT')

            return {
                contribution,
                new_total: newTotal,
                progress_percentage: Math.round(progresso * 100) / 100,
                status: newStatus
            }

        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * Busca contribuições de um plano
     */
    static async getPlanContributions(
        planId: number,
        userId: number,
        limit: number = 20
    ): Promise<PlanContribution[]> {
        try {
            // Verificar se o plano pertence ao usuário
            const planExists = await pool.query(
                'SELECT 1 FROM plans WHERE id = $1 AND user_id = $2',
                [planId, userId]
            )

            if (planExists.rowCount === 0) {
                throw createErrorResponse("Plano não encontrado.", 404)
            }

            const result: QueryResult<PlanContribution> = await pool.query(
                `SELECT 
                    id, 
                    plan_id, 
                    user_id, 
                    valor, 
                    created_at
                 FROM plan_contributions
                 WHERE plan_id = $1 AND user_id = $2
                 ORDER BY created_at DESC
                 LIMIT $3`,
                [planId, userId, limit]
            )

            return result.rows
        } catch (error) {
            console.error('Erro em getPlanContributions:', error)
            throw error
        }
    }

    /**
     * Remove uma contribuição
     */
    static async removeContribution(
        contributionId: number,
        userId: number
    ): Promise<{ message: string; updated_plan: Plan }> {
        const client = await pool.connect()

        try {
            await client.query('BEGIN')

            // Buscar a contribuição
            const contributionResult = await client.query(
                'SELECT * FROM plan_contributions WHERE id = $1 AND user_id = $2',
                [contributionId, userId]
            )

            if (contributionResult.rowCount === 0) {
                throw createErrorResponse("Contribuição não encontrada.", 404)
            }

            const contribution = contributionResult.rows[0]
            const planId = contribution.plan_id
            const valor = Number(contribution.valor)

            // Buscar o plano
            const planResult = await client.query(
                'SELECT * FROM plans WHERE id = $1 AND user_id = $2',
                [planId, userId]
            )

            const plan = planResult.rows[0]
            const newTotal = Math.max(0, Number(plan.total_contribuido) - valor)
            const meta = Number(plan.meta)
            const progresso = newTotal > 0 ? (newTotal / meta) * 100 : 0

            // Determinar novo status
            let newStatus = "Iniciando"
            if (progresso >= 100) {
                newStatus = "Concluído"
            } else if (progresso >= 80) {
                newStatus = "Quase lá"
            } else if (progresso > 0) {
                newStatus = "Em progresso"
            }

            // Remover contribuição
            await client.query(
                'DELETE FROM plan_contributions WHERE id = $1 AND user_id = $2',
                [contributionId, userId]
            )

            // Atualizar plano
            const updatedPlanResult: QueryResult<Plan> = await client.query(
                `UPDATE plans SET 
                    total_contribuido = $1,
                    status = $2,
                    updated_at = NOW()
                 WHERE id = $3 AND user_id = $4
                 RETURNING *`,
                [newTotal, newStatus, planId, userId]
            )

            await client.query('COMMIT')

            return {
                message: "Contribuição removida com sucesso.",
                updated_plan: updatedPlanResult.rows[0]
            }

        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }

    /**
     * Calcula o progresso e estatísticas de um plano
     */
    private static async calculatePlanProgress(plan: Plan): Promise<PlanWithProgress> {
        try {
            console.log('[calculatePlanProgress] Calculando progresso para plano:', plan.id)

            const meta = Number(plan.meta)
            const totalContribuido = Number(plan.total_contribuido)
            const progresso = meta > 0 ? (totalContribuido / meta) * 100 : 0

            // Calcular dias restantes
            const prazoDate = new Date(`${plan.prazo}T23:59:59`)
            const now = new Date()
            const diasRestantes = Math.ceil((prazoDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

            // Buscar estatísticas de contribuições
            const statsResult = await pool.query(
                `SELECT 
                    COUNT(*) as contributions_count,
                    COALESCE(AVG(valor), 0) as average_contribution,
                    MAX(created_at) as last_contribution_date
                 FROM plan_contributions
                 WHERE plan_id = $1`,
                [plan.id]
            )

            const stats = statsResult.rows[0]

            const result = {
                ...plan,
                meta: meta,
                total_contribuido: totalContribuido,
                progresso: Math.round(progresso * 100) / 100,
                dias_restantes: Math.max(0, diasRestantes),
                is_completed: progresso >= 100,
                is_overdue: diasRestantes < 0 && progresso < 100,
                contributions_count: Number(stats.contributions_count || 0),
                average_contribution: Number(stats.average_contribution || 0),
                last_contribution_date: stats.last_contribution_date || null
            }

            console.log('[calculatePlanProgress] Progresso calculado:', {
                planId: plan.id,
                progresso: result.progresso,
                diasRestantes: result.dias_restantes
            })

            return result
        } catch (error) {
            console.error('[calculatePlanProgress] Erro ao calcular progresso:', error)
            // Em caso de erro, retornar valores padrão
            return {
                ...plan,
                meta: Number(plan.meta),
                total_contribuido: Number(plan.total_contribuido),
                progresso: 0,
                dias_restantes: 0,
                is_completed: false,
                is_overdue: false,
                contributions_count: 0,
                average_contribution: 0,
                last_contribution_date: null
            }
        }
    }

    /**
     * Busca estatísticas gerais dos planos do usuário
     */
    static async getPlanStats(userId: number): Promise<{
        total_plans: number
        completed_plans: number
        in_progress_plans: number
        overdue_plans: number
        total_saved: number
        total_goals: number
        completion_rate: number
    }> {
        try {
            const result = await pool.query(
                `SELECT 
                    COUNT(*) as total_plans,
                    COUNT(CASE WHEN status = 'Concluído' THEN 1 END) as completed_plans,
                    COUNT(CASE WHEN status IN ('Em progresso', 'Quase lá') THEN 1 END) as in_progress_plans,
                    COUNT(CASE WHEN prazo < CURRENT_DATE AND status != 'Concluído' THEN 1 END) as overdue_plans,
                    COALESCE(SUM(total_contribuido), 0) as total_saved,
                    COALESCE(SUM(meta), 0) as total_goals
                 FROM plans
                 WHERE user_id = $1`,
                [userId]
            )

            const stats = result.rows[0]
            const totalPlans = Number(stats.total_plans || 0)
            const completedPlans = Number(stats.completed_plans || 0)
            const completionRate = totalPlans > 0 ? Math.round((completedPlans / totalPlans) * 100) : 0

            return {
                total_plans: totalPlans,
                completed_plans: completedPlans,
                in_progress_plans: Number(stats.in_progress_plans || 0),
                overdue_plans: Number(stats.overdue_plans || 0),
                total_saved: Number(stats.total_saved || 0),
                total_goals: Number(stats.total_goals || 0),
                completion_rate: completionRate
            }
        } catch (error) {
            console.error('Erro em getPlanStats:', error)
            // Retornar valores padrão em caso de erro
            return {
                total_plans: 0,
                completed_plans: 0,
                in_progress_plans: 0,
                overdue_plans: 0,
                total_saved: 0,
                total_goals: 0,
                completion_rate: 0
            }
        }
    }
}