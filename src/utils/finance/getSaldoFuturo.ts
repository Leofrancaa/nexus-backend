// src/utils/finance/getSaldoFuturo.ts
import { DatabaseUtils } from '../database'

interface TotalQueryResult {
    total: string
}

export const getSaldoFuturo = async (user_id: number): Promise<number> => {
    const resultReceitas = await DatabaseUtils.findOne<TotalQueryResult>(
        'SELECT SUM(quantidade) AS total FROM incomes WHERE user_id = $1',
        [user_id]
    )

    const resultDespesas = await DatabaseUtils.findOne<TotalQueryResult>(
        'SELECT SUM(quantidade) AS total FROM expenses WHERE user_id = $1',
        [user_id]
    )

    const receitas = parseFloat(resultReceitas?.total || '0')
    const despesas = parseFloat(resultDespesas?.total || '0')

    return receitas - despesas
}