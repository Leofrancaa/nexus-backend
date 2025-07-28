import { pool } from '../../database/index.js'

export const getResumoAnual = async (user_id, ano) => {
    const receitasQuery = await pool.query(
        `SELECT 
      EXTRACT(MONTH FROM data) AS mes,
      SUM(quantidade) AS total_receitas
     FROM incomes
     WHERE user_id = $1 AND EXTRACT(YEAR FROM data) = $2
     GROUP BY mes
     ORDER BY mes`,
        [user_id, ano]
    )

    const despesasQuery = await pool.query(
        `SELECT 
      EXTRACT(MONTH FROM data) AS mes,
      SUM(quantidade) AS total_despesas
     FROM expenses
     WHERE user_id = $1 AND EXTRACT(YEAR FROM data) = $2
     GROUP BY mes
     ORDER BY mes`,
        [user_id, ano]
    )

    // Mapeia os resultados em objetos indexados por mês
    const receitasMap = Object.fromEntries(receitasQuery.rows.map(r => [r.mes, parseFloat(r.total_receitas)]))
    const despesasMap = Object.fromEntries(despesasQuery.rows.map(d => [d.mes, parseFloat(d.total_despesas)]))

    // Meses de 1 a 12
    const resumo = Array.from({ length: 12 }, (_, i) => {
        const mes = i + 1
        return {
            mes: mes.toString(),
            total_receitas: receitasMap[mes] || 0,
            total_despesas: despesasMap[mes] || 0
        }
    })

    return resumo
}
