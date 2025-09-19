// src/utils/finance/getTopCategoriasGasto.ts
import { DatabaseUtils } from '../database.js'

interface TopCategoriasQueryResult {
    nome: string
    total: string
}

export interface TopCategoriasResult {
    nome: string
    total: number
}

export const getTopCategoriasGasto = async (
    user_id: number,
    mes: number,
    ano: number
): Promise<TopCategoriasResult[]> => {
    const result = await DatabaseUtils.findMany<TopCategoriasQueryResult>(
        `SELECT c.nome, SUM(e.quantidade) AS total
         FROM expenses e
         JOIN categories c ON e.category_id = c.id
         WHERE e.user_id = $1
         AND EXTRACT(MONTH FROM e.data) = $2
         AND EXTRACT(YEAR FROM e.data) = $3
         GROUP BY c.nome
         ORDER BY total DESC
         LIMIT 5`,
        [user_id, mes, ano]
    )

    return result.map(row => ({
        nome: row.nome,
        total: parseFloat(row.total)
    }))
}