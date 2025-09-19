// src/utils/finance/getTotaisMensais.ts
import { DatabaseUtils } from '../database.js'

interface MensalQueryResult {
    mes: number
    total: string
}

interface TotaisMensaisResult {
    receitas: Array<{ mes: number; total: number }>
    despesas: Array<{ mes: number; total: number }>
}

export const getTotaisMensais = async (user_id: number): Promise<TotaisMensaisResult> => {
    const receitas = await DatabaseUtils.findMany<MensalQueryResult>(`
        SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
        FROM incomes
        WHERE user_id = $1
        GROUP BY mes ORDER BY mes`,
        [user_id]
    )

    const despesas = await DatabaseUtils.findMany<MensalQueryResult>(`
        SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
        FROM expenses
        WHERE user_id = $1
        GROUP BY mes ORDER BY mes`,
        [user_id]
    )

    return {
        receitas: receitas.map(r => ({
            mes: Number(r.mes),
            total: parseFloat(r.total)
        })),
        despesas: despesas.map(d => ({
            mes: Number(d.mes),
            total: parseFloat(d.total)
        }))
    }
}