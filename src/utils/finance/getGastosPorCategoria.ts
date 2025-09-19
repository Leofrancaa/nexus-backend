// src/utils/finance/getGastosPorCategoria.ts
import { DatabaseUtils } from '../database.js'

interface GastosPorCategoriaQueryResult {
  id: number
  nome: string
  total: string
}

export interface GastosPorCategoriaResult {
  id: number
  nome: string
  total: number
}

export const getGastosPorCategoria = async (
  user_id: number,
  mes: number,
  ano: number
): Promise<GastosPorCategoriaResult[]> => {
  const result = await DatabaseUtils.findMany<GastosPorCategoriaQueryResult>(
    `SELECT c.id, c.nome, SUM(e.quantidade) as total
         FROM expenses e
         JOIN categories c ON e.category_id = c.id
         WHERE e.user_id = $1
           AND EXTRACT(MONTH FROM e.data) = $2
           AND EXTRACT(YEAR FROM e.data) = $3
         GROUP BY c.id, c.nome
         ORDER BY total DESC`,
    [user_id, mes, ano]
  )

  return result.map(row => ({
    id: row.id,
    nome: row.nome,
    total: parseFloat(row.total)
  }))
}