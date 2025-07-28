import { pool } from '../../database/index.js'

export const getComparativoMensal = async (user_id, mesAtual, anoAtual) => {
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
    const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual

    const receitaAtual = await pool.query(
        'SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
        [user_id, mesAtual, anoAtual]
    )

    const receitaAnterior = await pool.query(
        'SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
        [user_id, mesAnterior, anoAnterior]
    )

    const despesaAtual = await pool.query(
        'SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
        [user_id, mesAtual, anoAtual]
    )

    const despesaAnterior = await pool.query(
        'SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
        [user_id, mesAnterior, anoAnterior]
    )

    return {
        receitas: {
            atual: receitaAtual.rows[0].total,
            anterior: receitaAnterior.rows[0].total
        },
        despesas: {
            atual: despesaAtual.rows[0].total,
            anterior: despesaAnterior.rows[0].total
        }
    }
}