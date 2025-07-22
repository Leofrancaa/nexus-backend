import { pool } from '../database/index.js'

export const addCard = async ({ nome, tipo, numero, cor, user_id }) => {
    const result = await pool.query(
        `INSERT INTO cards (nome, tipo, numero, cor, user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [nome, tipo, numero, cor, user_id]
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

export const editCard = async (id, { nome, tipo, numero, cor }, user_id) => {
    const result = await pool.query(
        `UPDATE cards SET
      nome = $1,
      tipo = $2,
      numero = $3,
      cor = $4
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
        [nome, tipo, numero, cor, id, user_id]
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
