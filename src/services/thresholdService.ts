import { pool } from '../database/index.js'
import { QueryResult } from 'pg'
import {
    Threshold,
    CreateThresholdRequest,
    ApiError,
    Category
} from '../types/index.js'
import {
    createErrorResponse,
    isPositiveNumber
} from '../utils/helper.js'
import { DatabaseUtils } from '../utils/database.js'

interface ThresholdWithCategory extends Threshold {
    categoria: {
        id: number
        nome: string
        cor: string
        tipo: 'despesa' | 'receita'
    }
}

interface ThresholdAlert {
    threshold_id: number
    category_name: string
    category_color: string
    limit_value: number
    current_spending: number
    percentage_used: number
    remaining: number
    is_exceeded: boolean
    alert_level: 'safe' | 'warning' | 'danger' | 'exceeded'
}

export class ThresholdService {
    /**
     * Cria ou atualiza um threshold
     */
    static async createOrUpdateThreshold(
        thresholdData: CreateThresholdRequest,
        userId: number
    ): Promise<Threshold> {
        const { category_id, valor } = thresholdData

        // Validações
        if (!category_id || !isPositiveNumber(valor)) {
            throw createErrorResponse("Category ID e valor positivo são obrigatórios.", 400)
        }

        // Verificar se a categoria existe e pertence ao usuário
        const categoryResult: QueryResult<Category> = await pool.query(
            'SELECT id, nome, tipo FROM categories WHERE id = $1 AND user_id = $2',
            [category_id, userId]
        )

        if (categoryResult.rowCount === 0) {
            throw createErrorResponse("Categoria não encontrada.", 404)
        }

        const category = categoryResult.rows[0]

        // Thresholds só fazem sentido para categorias de despesa
        if (category.tipo !== 'despesa') {
            throw createErrorResponse("Limites só podem ser definidos para categorias de despesa.", 400)
        }

        // Usar UPSERT (INSERT ... ON CONFLICT)
        const result: QueryResult<Threshold> = await pool.query(
            `INSERT INTO thresholds (user_id, category_id, valor)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, category_id)
       DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()
       RETURNING *`,
            [userId, category_id, valor]
        )

        return result.rows[0]
    }

    /**
     * Busca todos os thresholds do usuário
     */
    static async getThresholdsByUser(userId: number): Promise<ThresholdWithCategory[]> {
        const result: QueryResult<{
            id: number
            category_id: number
            valor: string
            created_at: Date
            updated_at: Date
            categoria_id: number
            categoria_nome: string
            categoria_cor: string
            categoria_tipo: 'despesa' | 'receita'
        }> = await pool.query(
            `SELECT 
        t.*,
        c.id AS categoria_id,
        c.nome AS categoria_nome,
        c.cor AS categoria_cor,
        c.tipo AS categoria_tipo
       FROM thresholds t
       JOIN categories c ON t.category_id = c.id
       WHERE t.user_id = $1
       ORDER BY t.category_id`,
            [userId]
        )

        return result.rows.map((row) => ({
            id: row.id,
            user_id: userId,
            category_id: row.category_id,
            valor: parseFloat(row.valor),
            created_at: row.created_at,
            updated_at: row.updated_at,
            categoria: {
                id: row.categoria_id,
                nome: row.categoria_nome,
                cor: row.categoria_cor,
                tipo: row.categoria_tipo,
            },
        }))
    }

    /**
     * Busca threshold por ID
     */
    static async getThresholdById(thresholdId: number, userId: number): Promise<Threshold | null> {
        const result: QueryResult<Threshold> = await pool.query(
            'SELECT * FROM thresholds WHERE id = $1 AND user_id = $2',
            [thresholdId, userId]
        )

        return result.rows[0] || null
    }

    /**
     * Atualiza um threshold
     */
    static async updateThreshold(
        thresholdId: number,
        updateData: Partial<CreateThresholdRequest>,
        userId: number
    ): Promise<Threshold> {
        const { category_id, valor } = updateData

        // Verificar se o threshold existe
        const exists = await this.getThresholdById(thresholdId, userId)
        if (!exists) {
            throw createErrorResponse("Threshold não encontrado.", 404)
        }

        // Validações se os campos foram fornecidos
        if (valor !== undefined && !isPositiveNumber(valor)) {
            throw createErrorResponse("Valor deve ser um número positivo.", 400)
        }

        if (category_id) {
            // Verificar se a nova categoria existe e é de despesa
            const categoryResult: QueryResult<Category> = await pool.query(
                'SELECT id, nome, tipo FROM categories WHERE id = $1 AND user_id = $2',
                [category_id, userId]
            )

            if (categoryResult.rowCount === 0) {
                throw createErrorResponse("Categoria não encontrada.", 404)
            }

            if (categoryResult.rows[0].tipo !== 'despesa') {
                throw createErrorResponse("Limites só podem ser definidos para categorias de despesa.", 400)
            }

            // Verificar se não existe outro threshold para essa categoria
            const existingResult = await pool.query(
                'SELECT id FROM thresholds WHERE category_id = $1 AND user_id = $2 AND id != $3',
                [category_id, userId, thresholdId]
            )

            if (existingResult.rowCount && existingResult.rowCount > 0) {
                throw createErrorResponse("Já existe um limite definido para esta categoria.", 409)
            }
        }

        const result: QueryResult<Threshold> = await pool.query(
            `UPDATE thresholds SET
        category_id = COALESCE($1, category_id),
        valor = COALESCE($2, valor),
        updated_at = NOW()
       WHERE id = $3 AND user_id = $4
       RETURNING *`,
            [category_id, valor, thresholdId, userId]
        )

        return result.rows[0]
    }

    /**
     * Remove um threshold
     */
    static async deleteThreshold(thresholdId: number, userId: number): Promise<{ message: string }> {
        const result: QueryResult<Threshold> = await pool.query(
            'DELETE FROM thresholds WHERE id = $1 AND user_id = $2 RETURNING *',
            [thresholdId, userId]
        )

        if (result.rowCount === 0) {
            throw createErrorResponse("Threshold não encontrado.", 404)
        }

        return { message: "Limite removido com sucesso." }
    }

    /**
     * Calcula alertas de thresholds para o mês atual
     */
    static async getThresholdAlerts(userId: number, month?: number, year?: number): Promise<ThresholdAlert[]> {
        const now = new Date()
        const targetMonth = month || (now.getMonth() + 1)
        const targetYear = year || now.getFullYear()

        const result = await pool.query(
            `SELECT 
        t.id as threshold_id,
        t.valor as limit_value,
        c.nome as category_name,
        c.cor as category_color,
        COALESCE(SUM(e.quantidade), 0) as current_spending
      FROM thresholds t
      JOIN categories c ON t.category_id = c.id
      LEFT JOIN expenses e ON e.category_id = t.category_id 
        AND e.user_id = t.user_id
        AND EXTRACT(MONTH FROM e.data) = $2
        AND EXTRACT(YEAR FROM e.data) = $3
      WHERE t.user_id = $1
      GROUP BY t.id, t.valor, c.nome, c.cor
      ORDER BY c.nome`,
            [userId, targetMonth, targetYear]
        )

        return result.rows.map(row => {
            const limitValue = Number(row.limit_value)
            const currentSpending = Number(row.current_spending)
            const percentageUsed = limitValue > 0 ? (currentSpending / limitValue) * 100 : 0
            const remaining = Math.max(0, limitValue - currentSpending)
            const isExceeded = currentSpending > limitValue

            let alertLevel: ThresholdAlert['alert_level'] = 'safe'
            if (isExceeded) {
                alertLevel = 'exceeded'
            } else if (percentageUsed >= 90) {
                alertLevel = 'danger'
            } else if (percentageUsed >= 75) {
                alertLevel = 'warning'
            }

            return {
                threshold_id: row.threshold_id,
                category_name: row.category_name,
                category_color: row.category_color,
                limit_value: limitValue,
                current_spending: currentSpending,
                percentage_used: Math.round(percentageUsed * 100) / 100,
                remaining,
                is_exceeded: isExceeded,
                alert_level: alertLevel
            }
        })
    }

    /**
     * Verifica se um gasto violaria algum threshold
     */
    static async checkThresholdViolation(
        userId: number,
        categoryId: number,
        amount: number,
        month?: number,
        year?: number
    ): Promise<{
        would_violate: boolean
        threshold_value?: number
        current_spending?: number
        new_total?: number
        remaining?: number
    }> {
        const now = new Date()
        const targetMonth = month || (now.getMonth() + 1)
        const targetYear = year || now.getFullYear()

        // Buscar threshold para a categoria
        const thresholdResult = await pool.query(
            'SELECT valor FROM thresholds WHERE category_id = $1 AND user_id = $2',
            [categoryId, userId]
        )

        if (thresholdResult.rowCount === 0) {
            return { would_violate: false }
        }

        const thresholdValue = Number(thresholdResult.rows[0].valor)

        // Calcular gasto atual na categoria no mês
        const spendingResult = await pool.query(
            `SELECT COALESCE(SUM(quantidade), 0) as current_spending
       FROM expenses
       WHERE user_id = $1 AND category_id = $2
         AND EXTRACT(MONTH FROM data) = $3
         AND EXTRACT(YEAR FROM data) = $4`,
            [userId, categoryId, targetMonth, targetYear]
        )

        const currentSpending = Number(spendingResult.rows[0].current_spending)
        const newTotal = currentSpending + amount
        const remaining = Math.max(0, thresholdValue - currentSpending)

        return {
            would_violate: newTotal > thresholdValue,
            threshold_value: thresholdValue,
            current_spending: currentSpending,
            new_total: newTotal,
            remaining
        }
    }

    /**
     * Busca estatísticas gerais dos thresholds
     */
    static async getThresholdStats(userId: number): Promise<{
        total_thresholds: number
        categories_with_limits: number
        exceeded_this_month: number
        near_limit_count: number
        total_budget: number
        total_spent_this_month: number
    }> {
        const now = new Date()
        const currentMonth = now.getMonth() + 1
        const currentYear = now.getFullYear()

        // Buscar estatísticas básicas
        const statsResult = await pool.query(
            `SELECT 
        COUNT(*) as total_thresholds,
        SUM(valor) as total_budget
      FROM thresholds
      WHERE user_id = $1`,
            [userId]
        )

        const alertsResult = await pool.query(
            `SELECT 
        COUNT(CASE WHEN current_spending > limit_value THEN 1 END) as exceeded_count,
        COUNT(CASE WHEN current_spending >= limit_value * 0.75 AND current_spending <= limit_value THEN 1 END) as near_limit_count,
        COALESCE(SUM(current_spending), 0) as total_spent
      FROM (
        SELECT 
          t.valor as limit_value,
          COALESCE(SUM(e.quantidade), 0) as current_spending
        FROM thresholds t
        LEFT JOIN expenses e ON e.category_id = t.category_id 
          AND e.user_id = t.user_id
          AND EXTRACT(MONTH FROM e.data) = $2
          AND EXTRACT(YEAR FROM e.data) = $3
        WHERE t.user_id = $1
        GROUP BY t.id, t.valor
      ) threshold_analysis`,
            [userId, currentMonth, currentYear]
        )

        const stats = statsResult.rows[0]
        const alerts = alertsResult.rows[0]

        return {
            total_thresholds: Number(stats.total_thresholds),
            categories_with_limits: Number(stats.total_thresholds), // Same as total for now
            exceeded_this_month: Number(alerts.exceeded_count || 0),
            near_limit_count: Number(alerts.near_limit_count || 0),
            total_budget: Number(stats.total_budget || 0),
            total_spent_this_month: Number(alerts.total_spent || 0)
        }
    }
}