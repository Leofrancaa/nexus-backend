import { pool } from '../../database/index.js'

export const getParcelasPendentes = async (user_id) => {
    const today = new Date().toISOString().split('T')[0]

    const result = await pool.query(
        `SELECT * FROM expenses
     WHERE user_id = $1
     AND parcelas IS NOT NULL
     AND data >= $2
     ORDER BY data ASC`,
        [user_id, today]
    )

    return result.rows
}