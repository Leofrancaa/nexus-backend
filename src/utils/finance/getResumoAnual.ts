// src/utils/finance/getResumoAnual.ts
import { DatabaseUtils } from '../database'

interface ResumoAnualQueryResult {
    mes: number
    total_receitas?: string
    total_despesas?: string
}

export interface ResumoAnualResult {
    mes: string
    total_receitas: number
    total_despesas: number
}

export const getResumoAnual = async (user_id: number, ano: number): Promise<ResumoAnualResult[]> => {
    const [receitasQuery, despesasQuery] = await Promise.all([
        DatabaseUtils.findMany<ResumoAnualQueryResult>(
            `SELECT 
                EXTRACT(MONTH FROM data) AS mes,
                SUM(quantidade) AS total_receitas
             FROM incomes
             WHERE user_id = $1 AND EXTRACT(YEAR FROM data) = $2
             GROUP BY mes
             ORDER BY mes`,
            [user_id, ano]
        ),
        DatabaseUtils.findMany<ResumoAnualQueryResult>(
            `SELECT 
                EXTRACT(MONTH FROM data) AS mes,
                SUM(quantidade) AS total_despesas
             FROM expenses
             WHERE user_id = $1 AND EXTRACT(YEAR FROM data) = $2
             GROUP BY mes
             ORDER BY mes`,
            [user_id, ano]
        )
    ])

    // Mapeia os resultados em objetos indexados por mês
    const receitasMap = new Map<number, number>()
    const despesasMap = new Map<number, number>()

    receitasQuery.forEach(r => {
        receitasMap.set(Number(r.mes), parseFloat(r.total_receitas || '0'))
    })

    despesasQuery.forEach(d => {
        despesasMap.set(Number(d.mes), parseFloat(d.total_despesas || '0'))
    })

    // Meses de 1 a 12
    const resumo: ResumoAnualResult[] = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        return {
            mes: mes.toString(),
            total_receitas: receitasMap.get(mes) || 0,
            total_despesas: despesasMap.get(mes) || 0
        }
    })

    return resumo
}