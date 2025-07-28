import { pool } from '../../database/index.js'

export const saveExpenseHistory = async ({ expense_id, user_id, tipo, alteracao }) => {
    await pool.query(
        `INSERT INTO expense_history (expense_id, user_id, tipo, alteracao)
     VALUES ($1, $2, $3, $4)`,
        [expense_id, user_id, tipo, alteracao]
    )
}
