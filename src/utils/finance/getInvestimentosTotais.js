import { pool } from '../../database/index.js'

export const getInvestimentosTotais = async (user_id) => {
    const result = await pool.query(
        'SELECT COALESCE(SUM(quantidade), 0) as total FROM investments WHERE user_id = $1',
        [user_id]
    )
    return result.rows[0].total
}