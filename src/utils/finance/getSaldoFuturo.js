import { pool } from '../../database/index.js'

export const getSaldoFuturo = async (user_id) => {
    const resultReceitas = await pool.query(
        'SELECT SUM(quantidade) AS total FROM incomes WHERE user_id = $1',
        [user_id]
    )

    const resultDespesas = await pool.query(
        'SELECT SUM(quantidade) AS total FROM expenses WHERE user_id = $1',
        [user_id]
    )

    const receitas = parseFloat(resultReceitas.rows[0].total || 0)
    const despesas = parseFloat(resultDespesas.rows[0].total || 0)

    return receitas - despesas
}