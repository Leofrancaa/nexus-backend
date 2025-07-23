import { pool } from '../database/index.js'

export const addThreshold = async (threshold) => {
    const { user_id, category_id, valor } = threshold

    const result = await pool.query(
        `INSERT INTO thresholds (
      user_id, category_id, valor
    ) VALUES ($1, $2, $3)
    ON CONFLICT (user_id, category_id)
    DO UPDATE SET valor = EXCLUDED.valor
    RETURNING *`,
        [user_id, category_id, valor]
    )

    return result.rows[0]
}

export const fetchThresholdsByUser = async (user_id) => {
    const result = await pool.query(
        `SELECT * FROM thresholds
     WHERE user_id = $1
     ORDER BY category_id`,
        [user_id]
    )

    return result.rows
}

export const editThreshold = async (id, updatedData, user_id) => {
    const { category_id, valor } = updatedData

    const result = await pool.query(
        `UPDATE thresholds SET
      category_id = $1,
      valor = $2
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
        [category_id, valor, id, user_id]
    )

    return result.rows[0]
}

export const removeThreshold = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM thresholds WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user_id]
    )

    return result.rows[0]
}
