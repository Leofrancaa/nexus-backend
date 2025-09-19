// src/utils/finance/getGastosPorCartao.ts
import { DatabaseUtils } from '../database'

interface GastosPorCartaoQueryResult {
    cartao: string
    total: string
}

export interface GastosPorCartaoResult {
    cartao: string
    total: number
}

export const getGastosPorCartao = async (
    user_id: number,
    mes: number,
    ano: number
): Promise<GastosPorCartaoResult[]> => {
    const result = await DatabaseUtils.findMany<GastosPorCartaoQueryResult>(
        `SELECT c.nome AS cartao, SUM(e.quantidade) AS total
         FROM expenses e
         JOIN cards c ON e.card_id = c.id
         WHERE e.user_id = $1
         AND EXTRACT(MONTH FROM e.data) = $2
         AND EXTRACT(YEAR FROM e.data) = $3
         GROUP BY c.nome
         ORDER BY total DESC`,
        [user_id, mes, ano]
    )

    return result.map(row => ({
        cartao: row.cartao,
        total: parseFloat(row.total)
    }))
}