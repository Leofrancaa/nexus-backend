// src/utils/finance/getSaldoAtual.ts
import { DatabaseUtils } from '../database'

interface SaldoQueryResult {
    total: string
}

export const getSaldoAtual = async (user_id: number): Promise<number> => {
    const receitas = await DatabaseUtils.findOne<SaldoQueryResult>(
        `SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = $1`,
        [user_id]
    )

    const despesas = await DatabaseUtils.findOne<SaldoQueryResult>(
        `SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = $1`,
        [user_id]
    )

    const totalReceitas = parseFloat(receitas?.total || '0')
    const totalDespesas = parseFloat(despesas?.total || '0')

    return totalReceitas - totalDespesas
}