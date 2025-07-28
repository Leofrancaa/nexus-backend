import { pool } from '../../database/index.js'

export const getCartoesAVencer = async (user_id) => {
    const hoje = new Date()
    const diaHoje = hoje.getDate()

    // Gerar um array de 5 dias a partir de hoje (ex: 28, 29, 30, 1, 2)
    const dias = []
    for (let i = 0; i <= 5; i++) {
        const dataTemp = new Date(hoje)
        dataTemp.setDate(diaHoje + i)
        dias.push(dataTemp.getDate()) // pega só o dia do mês (1-31)
    }

    const result = await pool.query(
        `SELECT 
      id, nome, limite,
      (SELECT COALESCE(SUM(quantidade), 0) 
       FROM expenses 
       WHERE card_id = cards.id AND user_id = $1) AS total_gasto,
      dia_vencimento
     FROM cards
     WHERE user_id = $1 AND dia_vencimento = ANY($2::int[])`,
        [user_id, dias]
    )

    return result.rows
}
