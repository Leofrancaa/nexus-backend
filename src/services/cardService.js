import { pool } from '../database/index.js'

export const addCard = async ({ nome, tipo, numero, cor, limite, dia_vencimento, user_id }) => {
    const result = await pool.query(
        `INSERT INTO cards (nome, tipo, numero, cor, limite, dia_vencimento, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [nome, tipo, numero, cor, limite, dia_vencimento, user_id]
    )
    return result.rows[0]
}

export const fetchCards = async (user_id) => {
    const result = await pool.query(
        `SELECT * FROM cards WHERE user_id = $1 ORDER BY id DESC`,
        [user_id]
    )
    return result.rows
}

export const editCard = async (id, { nome, tipo, numero, cor, limite, dia_vencimento }, user_id) => {
    const result = await pool.query(
        `UPDATE cards SET
         nome = $1,
         tipo = $2,
         numero = $3,
         cor = $4,
         limite = $5,
         dia_vencimento = $6
         WHERE id = $7 AND user_id = $8
         RETURNING *`,
        [nome, tipo, numero, cor, limite, dia_vencimento, id, user_id]
    )
    return result.rows[0]
}

export const removeCard = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM cards WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user_id]
    )
    return result.rows[0]
}
