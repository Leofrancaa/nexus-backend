import { pool } from '../database/index.js'

export const updateUserCurrency = async (userId, currency) => {
    await pool.query(
        `UPDATE users SET currency = $1 WHERE id = $2`,
        [currency, userId]
    )
}

export const getUserCurrency = async (userId) => {
    const result = await pool.query(
        `SELECT currency FROM users WHERE id = $1`,
        [userId]
    )
    return result.rows[0]?.currency || 'BRL'
}
