import { pool } from '../database/index.js'
import { saveExpenseHistory } from '../utils/finance/saveExpenseHistory.js'

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

    const baseDate = data ? new Date(data) : new Date()
    const formattedBaseDate = baseDate.toISOString().split('T')[0]

    // 🛡️ Verifica limite do cartão (para qualquer despesa com cartão)
    if (metodo_pagamento === 'cartao de credito' && card_id) {
        const cardResult = await pool.query(
            `SELECT limite FROM cards WHERE id = $1`,
            [card_id]
        )

        if (cardResult.rows.length === 0) {
            throw new Error('Cartão não encontrado.')
        }

        const limiteAtual = parseFloat(cardResult.rows[0].limite)

        if (quantidade > limiteAtual) {
            throw {
                status: 400,
                message: `Valor da despesa (R$${quantidade}) excede o limite disponível do cartão (R$${limiteAtual}).`
            }
        }
    }

    // 🔁 Se for parcelada no cartão
    if (metodo_pagamento === 'cartao de credito' && parcelas > 1 && card_id) {
        const valorParcela = quantidade / parcelas

        for (let i = 0; i < parcelas; i++) {
            const parcelaDate = new Date(baseDate)
            parcelaDate.setMonth(parcelaDate.getMonth() + i)

            await pool.query(
                `INSERT INTO expenses (
                    metodo_pagamento, tipo, quantidade, fixo, data,
                    parcelas, frequencia, user_id, card_id, category_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    metodo_pagamento,
                    `${tipo} (${i + 1}/${parcelas})`,
                    valorParcela,
                    false,
                    parcelaDate.toISOString().split("T")[0],
                    parcelas,
                    frequencia,
                    user_id,
                    card_id,
                    category_id
                ]
            )
        }

        // Reduz valor total do limite do cartão
        await pool.query(
            `UPDATE cards SET limite = limite - $1 WHERE id = $2`,
            [quantidade, card_id]
        )

        return {
            message: `Despesa parcelada adicionada (${parcelas}x de R$${valorParcela.toFixed(2)})`,
            valor_total: quantidade,
            limite_reduzido: quantidade
        }
    }

    // 🧾 Inserção padrão (única ou fixa)
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
            formattedBaseDate,
            parcelas,
            frequencia,
            user_id,
            card_id,
            category_id
        ]
    )

    const baseExpense = result.rows[0]

    // 🔁 Se for fixa, replica até dezembro
    if (fixo) {
        const currentMonth = baseDate.getMonth()
        const year = baseDate.getFullYear()
        const day = baseDate.getDate()

        for (let month = currentMonth + 1; month < 12; month++) {
            const newDate = new Date(year, month, day)

            await pool.query(
                `INSERT INTO expenses (
                    metodo_pagamento, tipo, quantidade, fixo, data,
                    parcelas, frequencia, user_id, card_id, category_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    metodo_pagamento,
                    tipo,
                    quantidade,
                    true,
                    newDate.toISOString().split("T")[0],
                    parcelas,
                    frequencia,
                    user_id,
                    card_id,
                    category_id
                ]
            )
        }
    }

    return baseExpense
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


export const editExpense = async (id, data, user_id) => {
    // Busca a despesa atual antes de atualizar
    const current = await pool.query(
        'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
        [id, user_id]
    )

    if (current.rowCount === 0) return null

    // Salva o histórico da versão atual
    await saveExpenseHistory({
        expense_id: id,
        user_id,
        tipo: current.rows[0].tipo,
        alteracao: current.rows[0]
    })

    // Atualiza a despesa
    const updated = await pool.query(
        `UPDATE expenses SET 
      tipo = $1, 
      quantidade = $2, 
      data = $3,
      metodo_pagamento = $4,
      parcelas = $5,
      fixo = $6,
      frequencia = $7,
      card_id = $8,
      category_id = $9
     WHERE id = $10 AND user_id = $11
     RETURNING *`,
        [
            data.tipo,
            data.quantidade,
            data.data,
            data.metodo_pagamento,
            data.parcelas,
            data.fixo,
            data.frequencia,
            data.card_id,
            data.category_id,
            id,
            user_id
        ]
    )

    return updated.rows[0]
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
