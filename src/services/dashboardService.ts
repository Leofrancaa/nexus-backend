import { pool } from '../database/index'
import { DashboardData } from '../types/index'

export class DashboardService {
    /**
     * Busca todos os dados do dashboard
     */
    static async getDashboardData(userId: number): Promise<DashboardData> {
        const now = new Date()
        const mes = now.getMonth() + 1
        const ano = now.getFullYear()

        // Executar todas as queries em paralelo para melhor performance
        const [
            saldo,
            saldoFuturo,
            totaisMensais,
            resumoAnual,
            comparativo,
            gastosPorCategoria,
            topCategorias,
            gastosPorCartao,
            parcelasPendentes,
            cartoesEstourados,
            cartoesAVencer
        ] = await Promise.all([
            this.getSaldoAtual(userId),
            this.getSaldoFuturo(userId),
            this.getTotaisMensais(userId, ano),
            this.getResumoAnual(userId, ano),
            this.getComparativoMensal(userId, mes, ano),
            this.getGastosPorCategoria(userId, mes, ano),
            this.getTopCategoriasGasto(userId, mes, ano),
            this.getGastosPorCartao(userId, mes, ano),
            this.getParcelasPendentes(userId),
            this.getCartoesEstourados(userId),
            this.getCartoesAVencer(userId)
        ])

        return {
            saldo,
            saldoFuturo,
            totaisMensais,
            resumoAnual,
            comparativo,
            gastosPorCategoria,
            topCategorias,
            gastosPorCartao,
            parcelasPendentes,
            cartoesEstourados,
            cartoesAVencer
        }
    }

    /**
     * Calcula saldo atual (receitas - despesas)
     */
    private static async getSaldoAtual(userId: number): Promise<number> {
        const result = await pool.query(
            `SELECT 
        COALESCE(
          (SELECT SUM(quantidade) FROM incomes WHERE user_id = $1), 0
        ) - 
        COALESCE(
          (SELECT SUM(quantidade) FROM expenses WHERE user_id = $1), 0
        ) AS saldo`,
            [userId]
        )

        return Number(result.rows[0].saldo || 0)
    }

    /**
     * Calcula saldo futuro considerando parcelas pendentes
     */
    private static async getSaldoFuturo(userId: number): Promise<number> {
        const today = new Date().toISOString().split('T')[0]

        const result = await pool.query(
            `SELECT 
        COALESCE(
          (SELECT SUM(quantidade) FROM incomes WHERE user_id = $1), 0
        ) - 
        COALESCE(
          (SELECT SUM(quantidade) FROM expenses WHERE user_id = $1 AND data >= $2), 0
        ) AS saldo_futuro`,
            [userId, today]
        )

        return Number(result.rows[0].saldo_futuro || 0)
    }

    /**
     * Busca totais mensais do ano
     */
    private static async getTotaisMensais(userId: number, ano: number): Promise<Array<{
        mes: number
        receitas: number
        despesas: number
    }>> {
        const receitas = await pool.query(
            `SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
       FROM incomes
       WHERE user_id = $1 AND EXTRACT(YEAR FROM data) = $2
       GROUP BY mes ORDER BY mes`,
            [userId, ano]
        )

        const despesas = await pool.query(
            `SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
       FROM expenses
       WHERE user_id = $1 AND EXTRACT(YEAR FROM data) = $2
       GROUP BY mes ORDER BY mes`,
            [userId, ano]
        )

        // Criar array de 12 meses
        const result = Array.from({ length: 12 }, (_, i) => {
            const mes = i + 1
            const receitaMes = receitas.rows.find(r => Number(r.mes) === mes)
            const despesaMes = despesas.rows.find(d => Number(d.mes) === mes)

            return {
                mes,
                receitas: Number(receitaMes?.total || 0),
                despesas: Number(despesaMes?.total || 0)
            }
        })

        return result
    }

    /**
     * Busca resumo anual detalhado
     */
    private static async getResumoAnual(userId: number, ano: number): Promise<Array<{
        mes: string
        total_receitas: number
        total_despesas: number
    }>> {
        const receitasQuery = await pool.query(
            `SELECT 
        EXTRACT(MONTH FROM data) AS mes,
        SUM(quantidade) AS total_receitas
       FROM incomes
       WHERE user_id = $1 AND EXTRACT(YEAR FROM data) = $2
       GROUP BY mes
       ORDER BY mes`,
            [userId, ano]
        )

        const despesasQuery = await pool.query(
            `SELECT 
        EXTRACT(MONTH FROM data) AS mes,
        SUM(quantidade) AS total_despesas
       FROM expenses
       WHERE user_id = $1 AND EXTRACT(YEAR FROM data) = $2
       GROUP BY mes
       ORDER BY mes`,
            [userId, ano]
        )

        // Mapear os resultados em objetos indexados por mês
        const receitasMap = Object.fromEntries(
            receitasQuery.rows.map(r => [r.mes, parseFloat(r.total_receitas)])
        )
        const despesasMap = Object.fromEntries(
            despesasQuery.rows.map(d => [d.mes, parseFloat(d.total_despesas)])
        )

        // Meses de 1 a 12
        const mesesNomes = [
            "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
            "Jul", "Ago", "Set", "Out", "Nov", "Dez"
        ]

        return Array.from({ length: 12 }, (_, i) => {
            const mes = i + 1
            return {
                mes: mesesNomes[i],
                total_receitas: receitasMap[mes] || 0,
                total_despesas: despesasMap[mes] || 0
            }
        })
    }

    /**
     * Comparativo mensal (atual vs anterior)
     */
    private static async getComparativoMensal(
        userId: number,
        mesAtual: number,
        anoAtual: number
    ): Promise<{
        receitas: { atual: number; anterior: number }
        despesas: { atual: number; anterior: number }
    }> {
        const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
        const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual

        const [receitaAtual, receitaAnterior, despesaAtual, despesaAnterior] = await Promise.all([
            pool.query(
                'SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
                [userId, mesAtual, anoAtual]
            ),
            pool.query(
                'SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
                [userId, mesAnterior, anoAnterior]
            ),
            pool.query(
                'SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
                [userId, mesAtual, anoAtual]
            ),
            pool.query(
                'SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
                [userId, mesAnterior, anoAnterior]
            )
        ])

        return {
            receitas: {
                atual: Number(receitaAtual.rows[0].total),
                anterior: Number(receitaAnterior.rows[0].total)
            },
            despesas: {
                atual: Number(despesaAtual.rows[0].total),
                anterior: Number(despesaAnterior.rows[0].total)
            }
        }
    }

    /**
     * Gastos por categoria no mês
     */
    private static async getGastosPorCategoria(
        userId: number,
        mes: number,
        ano: number
    ): Promise<Array<{ id: number; nome: string; total: number }>> {
        const result = await pool.query(
            `SELECT c.id, c.nome, SUM(e.quantidade) as total
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE e.user_id = $1
         AND EXTRACT(MONTH FROM e.data) = $2
         AND EXTRACT(YEAR FROM e.data) = $3
       GROUP BY c.id, c.nome
       ORDER BY total DESC`,
            [userId, mes, ano]
        )

        return result.rows.map(row => ({
            id: row.id,
            nome: row.nome,
            total: Number(row.total)
        }))
    }

    /**
     * Top 5 categorias com maior gasto
     */
    private static async getTopCategoriasGasto(
        userId: number,
        mes: number,
        ano: number
    ): Promise<Array<{ nome: string; total: number }>> {
        const result = await pool.query(
            `SELECT c.nome, SUM(e.quantidade) AS total
       FROM expenses e
       JOIN categories c ON e.category_id = c.id
       WHERE e.user_id = $1
         AND EXTRACT(MONTH FROM e.data) = $2
         AND EXTRACT(YEAR FROM e.data) = $3
       GROUP BY c.nome
       ORDER BY total DESC
       LIMIT 5`,
            [userId, mes, ano]
        )

        return result.rows.map(row => ({
            nome: row.nome,
            total: Number(row.total)
        }))
    }

    /**
     * Gastos por cartão no mês
     */
    private static async getGastosPorCartao(
        userId: number,
        mes: number,
        ano: number
    ): Promise<Array<{ cartao: string; total: number }>> {
        const result = await pool.query(
            `SELECT c.nome AS cartao, SUM(e.quantidade) AS total
       FROM expenses e
       JOIN cards c ON e.card_id = c.id
       WHERE e.user_id = $1
         AND EXTRACT(MONTH FROM e.data) = $2
         AND EXTRACT(YEAR FROM e.data) = $3
       GROUP BY c.nome
       ORDER BY total DESC`,
            [userId, mes, ano]
        )

        return result.rows.map(row => ({
            cartao: row.cartao,
            total: Number(row.total)
        }))
    }

    /**
     * Parcelas pendentes (despesas futuras parceladas)
     */
    private static async getParcelasPendentes(userId: number): Promise<Array<{
        id: number
        tipo: string
        quantidade: number
        data: string
        parcelas: number
    }>> {
        const today = new Date().toISOString().split('T')[0]

        const result = await pool.query(
            `SELECT * FROM expenses
       WHERE user_id = $1
         AND parcelas IS NOT NULL
         AND data >= $2
       ORDER BY data ASC`,
            [userId, today]
        )

        return result.rows.map(row => ({
            id: row.id,
            tipo: row.tipo,
            quantidade: Number(row.quantidade),
            data: row.data.toISOString().split('T')[0],
            parcelas: row.parcelas
        }))
    }

    /**
     * Cartões com limite baixo (estourados)
     */
    private static async getCartoesEstourados(userId: number): Promise<Array<{
        id: number
        nome: string
        limite: number
    }>> {
        const result = await pool.query(
            `SELECT 
          c.id, 
          c.nome, 
          c.limite 
         FROM cards c
         WHERE c.user_id = $1 AND c.limite_disponivel <= (c.limite * 0.1)
         ORDER BY c.limite_disponivel ASC`,
            [userId]
        )

        return result.rows.map(row => ({
            id: row.id,
            nome: row.nome,
            limite: Number(row.limite)
        }))
    }

    /**
     * Cartões com vencimento próximo (próximos 7 dias)
     */
    private static async getCartoesAVencer(userId: number): Promise<Array<{
        id: number
        nome: string
        limite: number
        total_gasto: number
        dia_vencimento: number
    }>> {
        const hoje = new Date()
        const diaHoje = hoje.getDate()

        // Gerar array dos próximos 7 dias
        const dias = []
        for (let i = 0; i <= 7; i++) {
            const dataTemp = new Date(hoje)
            dataTemp.setDate(diaHoje + i)
            dias.push(dataTemp.getDate())
        }

        const result = await pool.query(
            `SELECT 
        c.id, 
        c.nome, 
        c.limite,
        (SELECT COALESCE(SUM(quantidade), 0) 
         FROM expenses 
         WHERE card_id = c.id AND user_id = $1) AS total_gasto,
        c.dia_vencimento
       FROM cards c
       WHERE c.user_id = $1 AND c.dia_vencimento = ANY($2::int[])`,
            [userId, dias]
        )

        return result.rows.map(row => ({
            id: row.id,
            nome: row.nome,
            limite: Number(row.limite),
            total_gasto: Number(row.total_gasto),
            dia_vencimento: row.dia_vencimento
        }))
    }

    /**
     * Estatísticas rápidas do dashboard
     */
    static async getQuickStats(userId: number): Promise<{
        saldo_atual: number
        receitas_mes: number
        despesas_mes: number
        economia_mes: number
        cartoes_ativos: number
        categorias_ativas: number
        transacoes_mes: number
    }> {
        const now = new Date()
        const mes = now.getMonth() + 1
        const ano = now.getFullYear()

        const result = await pool.query(
            `SELECT 
        -- Saldo atual
        COALESCE(
          (SELECT SUM(quantidade) FROM incomes WHERE user_id = $1), 0
        ) - 
        COALESCE(
          (SELECT SUM(quantidade) FROM expenses WHERE user_id = $1), 0
        ) AS saldo_atual,
        
        -- Receitas do mês
        COALESCE(
          (SELECT SUM(quantidade) FROM incomes 
           WHERE user_id = $1 
             AND EXTRACT(MONTH FROM data) = $2 
             AND EXTRACT(YEAR FROM data) = $3), 0
        ) AS receitas_mes,
        
        -- Despesas do mês
        COALESCE(
          (SELECT SUM(quantidade) FROM expenses 
           WHERE user_id = $1 
             AND EXTRACT(MONTH FROM data) = $2 
             AND EXTRACT(YEAR FROM data) = $3), 0
        ) AS despesas_mes,
        
        -- Cartões ativos
        COALESCE(
          (SELECT COUNT(*) FROM cards WHERE user_id = $1), 0
        ) AS cartoes_ativos,
        
        -- Categorias ativas
        COALESCE(
          (SELECT COUNT(*) FROM categories WHERE user_id = $1), 0
        ) AS categorias_ativas,
        
        -- Transações do mês
        COALESCE(
          (SELECT COUNT(*) FROM expenses 
           WHERE user_id = $1 
             AND EXTRACT(MONTH FROM data) = $2 
             AND EXTRACT(YEAR FROM data) = $3), 0
        ) + 
        COALESCE(
          (SELECT COUNT(*) FROM incomes 
           WHERE user_id = $1 
             AND EXTRACT(MONTH FROM data) = $2 
             AND EXTRACT(YEAR FROM data) = $3), 0
        ) AS transacoes_mes`,
            [userId, mes, ano]
        )

        const stats = result.rows[0]
        const receitasMes = Number(stats.receitas_mes)
        const despesasMes = Number(stats.despesas_mes)

        return {
            saldo_atual: Number(stats.saldo_atual),
            receitas_mes: receitasMes,
            despesas_mes: despesasMes,
            economia_mes: receitasMes - despesasMes,
            cartoes_ativos: Number(stats.cartoes_ativos),
            categorias_ativas: Number(stats.categorias_ativas),
            transacoes_mes: Number(stats.transacoes_mes)
        }
    }

    /**
     * Tendências dos últimos 6 meses
     */
    static async getTendencias(userId: number): Promise<Array<{
        mes: string
        receitas: number
        despesas: number
        saldo: number
    }>> {
        const now = new Date()
        const meses = []

        // Gerar últimos 6 meses
        for (let i = 5; i >= 0; i--) {
            const data = new Date(now.getFullYear(), now.getMonth() - i, 1)
            meses.push({
                mes: data.getMonth() + 1,
                ano: data.getFullYear(),
                nome: data.toLocaleDateString('pt-BR', { month: 'short' })
            })
        }

        const tendencias = await Promise.all(
            meses.map(async ({ mes, ano, nome }) => {
                const result = await pool.query(
                    `SELECT 
            COALESCE(
              (SELECT SUM(quantidade) FROM incomes 
               WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3), 0
            ) AS receitas,
            COALESCE(
              (SELECT SUM(quantidade) FROM expenses 
               WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3), 0
            ) AS despesas`,
                    [userId, mes, ano]
                )

                const receitas = Number(result.rows[0].receitas)
                const despesas = Number(result.rows[0].despesas)

                return {
                    mes: nome,
                    receitas,
                    despesas,
                    saldo: receitas - despesas
                }
            })
        )

        return tendencias
    }
}