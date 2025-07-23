import { pool } from '../database/index.js'

export const addIncome = async (income) => {
    const {
        tipo,
        quantidade,
        nota,
        data,
        fonte,
        user_id,
        category_id
    } = income

    const result = await pool.query(
        `INSERT INTO incomes (
      tipo, quantidade, nota, data, fonte, user_id, category_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *`,
        [tipo, quantidade, nota, data, fonte, user_id, category_id]
    )

    return result.rows[0]
}

export const fetchIncomesByMonthYear = async (user_id, mes, ano) => {
    const result = await pool.query(
        `SELECT * FROM incomes
     WHERE user_id = $1
     AND EXTRACT(MONTH FROM data) = $2
     AND EXTRACT(YEAR FROM data) = $3
     ORDER BY data DESC`,
        [user_id, mes, ano]
    )

    return result.rows
}

export const editIncome = async (id, updatedData, user_id) => {
    const {
        tipo,
        quantidade,
        nota,
        data,
        fonte,
        category_id
    } = updatedData

    const result = await pool.query(
        `UPDATE incomes SET
      tipo = $1,
      quantidade = $2,
      nota = $3,
      data = $4,
      fonte = $5,
      category_id = $6
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
        [tipo, quantidade, nota, data, fonte, category_id, id, user_id]
    )

    return result.rows[0]
}

export const removeIncome = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM incomes WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user_id]
    )

    return result.rows[0]
}

export const fetchIncomesByDateRange = async (user_id, startDate, endDate) => {
    const result = await pool.query(
        `SELECT * FROM incomes
     WHERE user_id = $1
     AND data BETWEEN $2 AND $3
     ORDER BY data DESC`,
        [user_id, startDate, endDate]
    )

    return result.rows
}

