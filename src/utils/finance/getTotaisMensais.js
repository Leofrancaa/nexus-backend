import { pool } from '../../database/index.js'

export const getTotaisMensais = async (user_id) => {
    const receitas = await pool.query(`
    SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
    FROM incomes
    WHERE user_id = $1
    GROUP BY mes ORDER BY mes`, [user_id])

    const despesas = await pool.query(`
    SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
    FROM expenses
    WHERE user_id = $1
    GROUP BY mes ORDER BY mes`, [user_id])

    return {
        receitas: receitas.rows,
        despesas: despesas.rows
    }
}
