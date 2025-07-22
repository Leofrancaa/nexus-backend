import { pool } from '../database/index.js'

export const addInvestment = async ({ tipo, nome, quantidade, descricao, data, user_id }) => {
    const result = await pool.query(
        `INSERT INTO investments (tipo, nome, quantidade, descricao, data, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
        [tipo, nome, quantidade, descricao, data, user_id]
    )
    return result.rows[0]
}

export const fetchInvestments = async (user_id, mes, ano) => {
    const result = await pool.query(
        `SELECT * FROM investments
     WHERE user_id = $1
     AND EXTRACT(MONTH FROM data) = $2
     AND EXTRACT(YEAR FROM data) = $3
     ORDER BY data DESC`,
        [user_id, mes, ano]
    )
    return result.rows
}

export const editInvestment = async (id, { tipo, nome, quantidade, descricao, data }, user_id) => {
    const result = await pool.query(
        `UPDATE investments SET
      tipo = $1,
      nome = $2,
      quantidade = $3,
      descricao = $4,
      data = $5
     WHERE id = $6 AND user_id = $7
     RETURNING *`,
        [tipo, nome, quantidade, descricao, data, id, user_id]
    )
    return result.rows[0]
}

export const removeInvestment = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM investments WHERE id = $1 AND user_id = $2
     RETURNING *`,
        [id, user_id]
    )
    return result.rows[0]
}
