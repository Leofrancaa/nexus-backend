import { pool } from '../database/index.js'

export const addExpense = async (expenseData) => {
    const {
        metodo_pagamento,
        tipo,
        quantidade,
        fixo = false,
        data,
        parcelas,
        frequencia,
        user_id,
        card_id,
        category_id
    } = expenseData

    const result = await pool.query(
        `INSERT INTO expenses (
      metodo_pagamento, tipo, quantidade, fixo, data,
      parcelas, frequencia, user_id, card_id, category_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
        [
            metodo_pagamento,
            tipo,
            quantidade,
            fixo,
            data,
            parcelas,
            frequencia,
            user_id,
            card_id,
            category_id
        ]
    )

    return result.rows[0]
}

export const fetchExpensesByMonthYear = async (userId, mes, ano) => {
    const result = await pool.query(
        `SELECT * FROM expenses
     WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3
     ORDER BY data DESC`,
        [userId, mes, ano]
    )

    return result.rows
}

export const editExpense = async (id, updatedData, user_id) => {
    const {
        metodo_pagamento,
        tipo,
        quantidade,
        fixo,
        data,
        parcelas,
        frequencia,
        card_id,
        category_id
    } = updatedData

    const result = await pool.query(
        `UPDATE expenses SET
      metodo_pagamento = $1,
      tipo = $2,
      quantidade = $3,
      fixo = $4,
      data = $5,
      parcelas = $6,
      frequencia = $7,
      card_id = $8,
      category_id = $9
     WHERE id = $10 AND user_id = $11
     RETURNING *`,
        [
            metodo_pagamento,
            tipo,
            quantidade,
            fixo,
            data,
            parcelas,
            frequencia,
            card_id,
            category_id,
            id,
            user_id
        ]
    )

    return result.rows[0]
}

export const removeExpense = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user_id]
    )

    return result.rows[0]
}

export const fetchExpensesByDateRange = async (user_id, startDate, endDate) => {
    const result = await pool.query(
        `SELECT * FROM expenses
     WHERE user_id = $1
     AND data BETWEEN $2 AND $3
     ORDER BY data DESC`,
        [user_id, startDate, endDate]
    )

    return result.rows
}
