import { pool } from '../database/index'
import { QueryResult } from 'pg'
import {
    Category,
    CreateCategoryRequest,
} from '../types/index'
import {
    createErrorResponse,
    isValidHexColor,
    sanitizeString
} from '../utils/helper'

export class CategoryService {
    /**
     * Cria uma nova categoria
     */
    static async createCategory(
        categoryData: CreateCategoryRequest,
        userId: number
    ): Promise<Category> {
        const { nome, cor, tipo, parent_id } = categoryData

        // Validações
        if (!nome || !tipo) {
            throw createErrorResponse("Nome e tipo são obrigatórios.", 400)
        }

        if (tipo !== 'despesa' && tipo !== 'receita') {
            throw createErrorResponse("Tipo deve ser 'despesa' ou 'receita'.", 400)
        }

        if (cor && !isValidHexColor(cor)) {
            throw createErrorResponse("Cor deve estar no formato hexadecimal válido.", 400)
        }

        // Verificar se já existe categoria com o mesmo nome para o usuário
        const existsResult: QueryResult<{ id: number }> = await pool.query(
            'SELECT id FROM categories WHERE nome = $1 AND user_id = $2 AND tipo = $3',
            [nome.trim(), userId, tipo]
        )

        if (existsResult.rowCount && existsResult.rowCount > 0) {
            throw createErrorResponse(`Já existe uma categoria ${tipo} com este nome.`, 409)
        }

        // Verificar se já existe categoria com a mesma cor e tipo para o usuário
        if (cor) {
            const colorExistsResult: QueryResult<{ nome: string }> = await pool.query(
                'SELECT nome FROM categories WHERE cor = $1 AND user_id = $2 AND tipo = $3',
                [cor, userId, tipo]
            )

            if (colorExistsResult.rowCount && colorExistsResult.rowCount > 0) {
                const existingCategory = colorExistsResult.rows[0].nome
                throw createErrorResponse(
                    `A cor selecionada já está sendo usada pela categoria "${existingCategory}" do tipo ${tipo}.`,
                    409
                )
            }
        }

        // Verificar se parent_id existe e pertence ao usuário (se fornecido)
        if (parent_id) {
            const parentResult = await pool.query(
                'SELECT id, tipo FROM categories WHERE id = $1 AND user_id = $2',
                [parent_id, userId]
            )

            if (parentResult.rowCount === 0) {
                throw createErrorResponse("Categoria pai não encontrada.", 404)
            }

            // Verificar se a categoria pai é do mesmo tipo
            if (parentResult.rows[0].tipo !== tipo) {
                throw createErrorResponse("Categoria pai deve ser do mesmo tipo.", 400)
            }
        }

        const result: QueryResult<Category> = await pool.query(
            `INSERT INTO categories (nome, cor, tipo, parent_id, user_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
            [
                sanitizeString(nome.trim()),
                cor || '#6B7280',
                tipo,
                parent_id || null,
                userId
            ]
        )

        return result.rows[0]
    }

    /**
     * Busca categorias do usuário
     */
    static async getCategoriesByUser(
        userId: number,
        tipo?: 'despesa' | 'receita'
    ): Promise<Category[]> {
        let query = `
      SELECT * FROM categories
      WHERE user_id = $1`

        const params: (number | string)[] = [userId]

        if (tipo === 'despesa' || tipo === 'receita') {
            query += ` AND tipo = $2`
            params.push(tipo)
        }

        query += ` ORDER BY parent_id NULLS FIRST, nome`

        const result: QueryResult<Category> = await pool.query(query, params)
        return result.rows
    }

    /**
     * Busca categoria por ID
     */
    static async getCategoryById(categoryId: number, userId: number): Promise<Category | null> {
        const result: QueryResult<Category> = await pool.query(
            `SELECT * FROM categories WHERE id = $1 AND user_id = $2`,
            [categoryId, userId]
        )

        return result.rows[0] || null
    }

    /**
     * Atualiza uma categoria
     */
    static async updateCategory(
        categoryId: number,
        updateData: Partial<CreateCategoryRequest>,
        userId: number
    ): Promise<Category> {
        const { nome, cor, tipo, parent_id } = updateData

        // Verificar se a categoria existe
        const existsResult = await this.getCategoryById(categoryId, userId)
        if (!existsResult) {
            throw createErrorResponse("Categoria não encontrada.", 404)
        }

        // Validações se os campos foram fornecidos
        if (tipo && tipo !== 'despesa' && tipo !== 'receita') {
            throw createErrorResponse("Tipo deve ser 'despesa' ou 'receita'.", 400)
        }

        if (cor && !isValidHexColor(cor)) {
            throw createErrorResponse("Cor deve estar no formato hexadecimal válido.", 400)
        }

        // Verificar se não está tentando definir ela mesma como pai
        if (parent_id && parent_id === categoryId) {
            throw createErrorResponse("Uma categoria não pode ser pai de si mesma.", 400)
        }

        // Verificar se parent_id existe e é do mesmo tipo (se fornecido)
        if (parent_id) {
            const parentResult = await pool.query(
                'SELECT id, tipo FROM categories WHERE id = $1 AND user_id = $2',
                [parent_id, userId]
            )

            if (parentResult.rowCount === 0) {
                throw createErrorResponse("Categoria pai não encontrada.", 404)
            }

            const parentTipo = parentResult.rows[0].tipo
            const currentTipo = tipo || existsResult.tipo

            if (parentTipo !== currentTipo) {
                throw createErrorResponse("Categoria pai deve ser do mesmo tipo.", 400)
            }
        }

        // Verificar nome único (se fornecido)
        if (nome) {
            const duplicateResult = await pool.query(
                'SELECT id FROM categories WHERE nome = $1 AND user_id = $2 AND tipo = $3 AND id != $4',
                [nome.trim(), userId, tipo || existsResult.tipo, categoryId]
            )

            if (duplicateResult.rowCount && duplicateResult.rowCount > 0) {
                throw createErrorResponse(`Já existe uma categoria com este nome.`, 409)
            }
        }

        const result: QueryResult<Category> = await pool.query(
            `UPDATE categories SET
        nome = COALESCE($1, nome),
        cor = COALESCE($2, cor),
        tipo = COALESCE($3, tipo),
        parent_id = COALESCE($4, parent_id),
        updated_at = NOW()
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
            [
                nome ? sanitizeString(nome.trim()) : null,
                cor,
                tipo,
                parent_id,
                categoryId,
                userId
            ]
        )

        return result.rows[0]
    }

    /**
     * Remove uma categoria
     */
    static async deleteCategory(categoryId: number, userId: number): Promise<{ message: string }> {
        // Verificar se a categoria existe
        const category = await this.getCategoryById(categoryId, userId)
        if (!category) {
            throw createErrorResponse("Categoria não encontrada.", 404)
        }

        // Verificar se tem subcategorias
        const hasChildren = await pool.query(
            'SELECT COUNT(*) as count FROM categories WHERE parent_id = $1 AND user_id = $2',
            [categoryId, userId]
        )

        if (Number(hasChildren.rows[0].count) > 0) {
            throw createErrorResponse(
                "Não é possível excluir uma categoria que possui subcategorias. Exclua as subcategorias primeiro.",
                400
            )
        }

        // Verificar se tem despesas/receitas vinculadas
        const hasExpenses = await pool.query(
            'SELECT COUNT(*) as count FROM expenses WHERE category_id = $1 AND user_id = $2',
            [categoryId, userId]
        )

        const hasIncomes = await pool.query(
            'SELECT COUNT(*) as count FROM incomes WHERE category_id = $1 AND user_id = $2',
            [categoryId, userId]
        )

        const totalTransactions = Number(hasExpenses.rows[0].count) + Number(hasIncomes.rows[0].count)

        if (totalTransactions > 0) {
            throw createErrorResponse(
                `Não é possível excluir uma categoria que possui ${totalTransactions} transação(ões) vinculada(s).`,
                400
            )
        }

        // Remover thresholds vinculados à categoria
        await pool.query(
            'DELETE FROM thresholds WHERE category_id = $1 AND user_id = $2',
            [categoryId, userId]
        )

        // Deletar a categoria
        await pool.query(
            'DELETE FROM categories WHERE id = $1 AND user_id = $2',
            [categoryId, userId]
        )

        return { message: "Categoria removida com sucesso." }
    }

    /**
     * Busca estatísticas de uso de categorias
     */
    static async getCategoryStats(userId: number): Promise<Array<{
        id: number
        nome: string
        tipo: 'despesa' | 'receita'
        total_transacoes: number
        valor_total: number
        ultima_utilizacao: Date | null
    }>> {
        const result = await pool.query(
            `SELECT 
        c.id,
        c.nome,
        c.tipo,
        COALESCE(expense_stats.total_transacoes, 0) + COALESCE(income_stats.total_transacoes, 0) as total_transacoes,
        COALESCE(expense_stats.valor_total, 0) + COALESCE(income_stats.valor_total, 0) as valor_total,
        GREATEST(expense_stats.ultima_utilizacao, income_stats.ultima_utilizacao) as ultima_utilizacao
      FROM categories c
      LEFT JOIN (
        SELECT 
          category_id,
          COUNT(*) as total_transacoes,
          SUM(quantidade) as valor_total,
          MAX(data) as ultima_utilizacao
        FROM expenses 
        WHERE user_id = $1
        GROUP BY category_id
      ) expense_stats ON c.id = expense_stats.category_id
      LEFT JOIN (
        SELECT 
          category_id,
          COUNT(*) as total_transacoes,
          SUM(quantidade) as valor_total,
          MAX(data) as ultima_utilizacao
        FROM incomes 
        WHERE user_id = $1
        GROUP BY category_id
      ) income_stats ON c.id = income_stats.category_id
      WHERE c.user_id = $1
      ORDER BY total_transacoes DESC`,
            [userId]
        )

        return result.rows.map(row => ({
            id: row.id,
            nome: row.nome,
            tipo: row.tipo,
            total_transacoes: Number(row.total_transacoes),
            valor_total: Number(row.valor_total),
            ultima_utilizacao: row.ultima_utilizacao
        }))
    }

    /**
     * Busca árvore hierárquica de categorias
     */
    static async getCategoryTree(
        userId: number,
        tipo?: 'despesa' | 'receita'
    ): Promise<Array<Category & { children?: Category[] }>> {
        const categories = await this.getCategoriesByUser(userId, tipo)

        // Organizar em árvore
        const categoryMap = new Map<number, Category & { children?: Category[] }>()
        const rootCategories: Array<Category & { children?: Category[] }> = []

        // Primeiro, criar map de todas as categorias
        categories.forEach(cat => {
            categoryMap.set(cat.id, { ...cat, children: [] })
        })

        // Depois, organizar hierarquia
        categories.forEach(cat => {
            const categoryWithChildren = categoryMap.get(cat.id)!

            if (cat.parent_id) {
                const parent = categoryMap.get(cat.parent_id)
                if (parent) {
                    parent.children = parent.children || []
                    parent.children.push(categoryWithChildren)
                }
            } else {
                rootCategories.push(categoryWithChildren)
            }
        })

        return rootCategories
    }
}