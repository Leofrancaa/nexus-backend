import { pool } from '../../database/index.js'

export const getReceitasDoMes = async (user_id, mes, ano) => {
    const result = await pool.query(
        'SELECT * FROM incomes WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
        [user_id, mes, ano]
    )
    return result.rows
}