import { pool } from '../../database/index.js'

export const getGastosPorCategoria = async (user_id, mes, ano) => {
    const result = await pool.query(
        `SELECT c.nome, SUM(e.quantidade) as total
     FROM expenses e
     JOIN categories c ON e.category_id = c.id
     WHERE e.user_id = $1 AND EXTRACT(MONTH FROM e.data) = $2 AND EXTRACT(YEAR FROM e.data) = $3
     GROUP BY c.nome
     ORDER BY total DESC`,
        [user_id, mes, ano]
    )
    return result.rows
}