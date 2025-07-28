import { pool } from '../../database/index.js'

export const getSaldoAtual = async (user_id) => {
    const receitas = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = $1`,
        [user_id]
    )

    const despesas = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = $1`,
        [user_id]
    )

    return receitas.rows[0].total - despesas.rows[0].total
}
