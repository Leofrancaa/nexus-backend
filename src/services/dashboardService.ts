import prisma from '../database/prisma'
import { DashboardData } from '../types/index'

export class DashboardService {
    static async getDashboardData(userId: number): Promise<DashboardData> {
        const now = new Date()
        const mes = now.getMonth() + 1
        const ano = now.getFullYear()

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

    private static async getSaldoAtual(userId: number): Promise<number> {
        const result = await prisma.$queryRaw<Array<{ saldo: string }>>`
            SELECT
                COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = ${userId}), 0) -
                COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = ${userId}), 0) AS saldo
        `

        return Number(result[0].saldo || 0)
    }

    private static async getSaldoFuturo(userId: number): Promise<number> {
        const today = new Date().toISOString().split('T')[0]

        const result = await prisma.$queryRaw<Array<{ saldo_futuro: string }>>`
            SELECT
                COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = ${userId}), 0) -
                COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = ${userId} AND data >= ${new Date(today)}), 0) AS saldo_futuro
        `

        return Number(result[0].saldo_futuro || 0)
    }

    private static async getTotaisMensais(userId: number, ano: number): Promise<Array<{
        mes: number
        receitas: number
        despesas: number
    }>> {
        const [receitas, despesas] = await Promise.all([
            prisma.$queryRaw<Array<{ mes: number; total: string }>>`
                SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
                FROM incomes
                WHERE user_id = ${userId} AND EXTRACT(YEAR FROM data) = ${ano}
                GROUP BY mes ORDER BY mes
            `,
            prisma.$queryRaw<Array<{ mes: number; total: string }>>`
                SELECT EXTRACT(MONTH FROM data) as mes, SUM(quantidade) as total
                FROM expenses
                WHERE user_id = ${userId} AND EXTRACT(YEAR FROM data) = ${ano}
                GROUP BY mes ORDER BY mes
            `,
        ])

        return Array.from({ length: 12 }, (_, i) => {
            const mes = i + 1
            const receitaMes = receitas.find(r => Number(r.mes) === mes)
            const despesaMes = despesas.find(d => Number(d.mes) === mes)

            return {
                mes,
                receitas: Number(receitaMes?.total || 0),
                despesas: Number(despesaMes?.total || 0)
            }
        })
    }

    private static async getResumoAnual(userId: number, ano: number): Promise<Array<{
        mes: string
        total_receitas: number
        total_despesas: number
    }>> {
        const [receitasQuery, despesasQuery] = await Promise.all([
            prisma.$queryRaw<Array<{ mes: number; total_receitas: string }>>`
                SELECT EXTRACT(MONTH FROM data) AS mes, SUM(quantidade) AS total_receitas
                FROM incomes
                WHERE user_id = ${userId} AND EXTRACT(YEAR FROM data) = ${ano}
                GROUP BY mes ORDER BY mes
            `,
            prisma.$queryRaw<Array<{ mes: number; total_despesas: string }>>`
                SELECT EXTRACT(MONTH FROM data) AS mes, SUM(quantidade) AS total_despesas
                FROM expenses
                WHERE user_id = ${userId} AND EXTRACT(YEAR FROM data) = ${ano}
                GROUP BY mes ORDER BY mes
            `,
        ])

        const receitasMap = Object.fromEntries(receitasQuery.map(r => [r.mes, parseFloat(r.total_receitas)]))
        const despesasMap = Object.fromEntries(despesasQuery.map(d => [d.mes, parseFloat(d.total_despesas)]))

        const mesesNomes = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

        return Array.from({ length: 12 }, (_, i) => ({
            mes: mesesNomes[i],
            total_receitas: receitasMap[i + 1] || 0,
            total_despesas: despesasMap[i + 1] || 0
        }))
    }

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
            prisma.$queryRaw<Array<{ total: string }>>`SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mesAtual} AND EXTRACT(YEAR FROM data) = ${anoAtual}`,
            prisma.$queryRaw<Array<{ total: string }>>`SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mesAnterior} AND EXTRACT(YEAR FROM data) = ${anoAnterior}`,
            prisma.$queryRaw<Array<{ total: string }>>`SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mesAtual} AND EXTRACT(YEAR FROM data) = ${anoAtual}`,
            prisma.$queryRaw<Array<{ total: string }>>`SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mesAnterior} AND EXTRACT(YEAR FROM data) = ${anoAnterior}`,
        ])

        return {
            receitas: { atual: Number(receitaAtual[0].total), anterior: Number(receitaAnterior[0].total) },
            despesas: { atual: Number(despesaAtual[0].total), anterior: Number(despesaAnterior[0].total) }
        }
    }

    private static async getGastosPorCategoria(
        userId: number,
        mes: number,
        ano: number
    ): Promise<Array<{ id: number; nome: string; total: number }>> {
        const result = await prisma.$queryRaw<Array<{ id: number; nome: string; total: string }>>`
            SELECT c.id, c.nome, SUM(e.quantidade) as total
            FROM expenses e
            JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = ${userId}
              AND EXTRACT(MONTH FROM e.data) = ${mes}
              AND EXTRACT(YEAR FROM e.data) = ${ano}
            GROUP BY c.id, c.nome
            ORDER BY total DESC
        `

        return result.map(row => ({ id: row.id, nome: row.nome, total: Number(row.total) }))
    }

    private static async getTopCategoriasGasto(
        userId: number,
        mes: number,
        ano: number
    ): Promise<Array<{ nome: string; total: number }>> {
        const result = await prisma.$queryRaw<Array<{ nome: string; total: string }>>`
            SELECT c.nome, SUM(e.quantidade) AS total
            FROM expenses e
            JOIN categories c ON e.category_id = c.id
            WHERE e.user_id = ${userId}
              AND EXTRACT(MONTH FROM e.data) = ${mes}
              AND EXTRACT(YEAR FROM e.data) = ${ano}
            GROUP BY c.nome
            ORDER BY total DESC
            LIMIT 5
        `

        return result.map(row => ({ nome: row.nome, total: Number(row.total) }))
    }

    private static async getGastosPorCartao(
        userId: number,
        mes: number,
        ano: number
    ): Promise<Array<{ cartao: string; total: number }>> {
        const result = await prisma.$queryRaw<Array<{ cartao: string; total: string }>>`
            SELECT c.nome AS cartao, SUM(e.quantidade) AS total
            FROM expenses e
            JOIN cards c ON e.card_id = c.id
            WHERE e.user_id = ${userId}
              AND EXTRACT(MONTH FROM e.data) = ${mes}
              AND EXTRACT(YEAR FROM e.data) = ${ano}
            GROUP BY c.nome
            ORDER BY total DESC
        `

        return result.map(row => ({ cartao: row.cartao, total: Number(row.total) }))
    }

    private static async getParcelasPendentes(userId: number): Promise<Array<{
        id: number
        tipo: string
        quantidade: number
        data: string
        parcelas: number
    }>> {
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const expenses = await prisma.expense.findMany({
            where: {
                user_id: userId,
                parcelas: { not: null },
                data: { gte: today }
            },
            orderBy: { data: 'asc' }
        })

        return expenses.map(row => ({
            id: row.id,
            tipo: row.tipo,
            quantidade: Number(row.quantidade),
            data: row.data instanceof Date ? row.data.toISOString().split('T')[0] : String(row.data),
            parcelas: row.parcelas!
        }))
    }

    private static async getCartoesEstourados(userId: number): Promise<Array<{
        id: number
        nome: string
        limite: number
    }>> {
        const result = await prisma.$queryRaw<Array<{ id: number; nome: string; limite: string }>>`
            SELECT c.id, c.nome, c.limite
            FROM cards c
            WHERE c.user_id = ${userId} AND c.limite_disponivel <= (c.limite * 0.1)
            ORDER BY c.limite_disponivel ASC
        `

        return result.map(row => ({ id: row.id, nome: row.nome, limite: Number(row.limite) }))
    }

    private static async getCartoesAVencer(userId: number): Promise<Array<{
        id: number
        nome: string
        limite: number
        total_gasto: number
        dia_vencimento: number
    }>> {
        const hoje = new Date()
        const diaHoje = hoje.getDate()

        const dias: number[] = []
        for (let i = 0; i <= 7; i++) {
            const dataTemp = new Date(hoje)
            dataTemp.setDate(diaHoje + i)
            dias.push(dataTemp.getDate())
        }

        const result = await prisma.$queryRaw<Array<{
            id: number
            nome: string
            limite: string
            total_gasto: string
            dia_vencimento: number
        }>>`
            SELECT
                c.id,
                c.nome,
                c.limite,
                (SELECT COALESCE(SUM(quantidade), 0) FROM expenses WHERE card_id = c.id AND user_id = ${userId}) AS total_gasto,
                c.dia_vencimento
            FROM cards c
            WHERE c.user_id = ${userId} AND c.dia_vencimento = ANY(${dias}::int[])
        `

        return result.map(row => ({
            id: row.id,
            nome: row.nome,
            limite: Number(row.limite),
            total_gasto: Number(row.total_gasto),
            dia_vencimento: row.dia_vencimento
        }))
    }

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

        const result = await prisma.$queryRaw<Array<{
            saldo_atual: string
            receitas_mes: string
            despesas_mes: string
            cartoes_ativos: bigint
            categorias_ativas: bigint
            transacoes_mes: bigint
        }>>`
            SELECT
                COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = ${userId}), 0) -
                COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = ${userId}), 0) AS saldo_atual,
                COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mes} AND EXTRACT(YEAR FROM data) = ${ano}), 0) AS receitas_mes,
                COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mes} AND EXTRACT(YEAR FROM data) = ${ano}), 0) AS despesas_mes,
                COALESCE((SELECT COUNT(*) FROM cards WHERE user_id = ${userId}), 0) AS cartoes_ativos,
                COALESCE((SELECT COUNT(*) FROM categories WHERE user_id = ${userId}), 0) AS categorias_ativas,
                COALESCE((SELECT COUNT(*) FROM expenses WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mes} AND EXTRACT(YEAR FROM data) = ${ano}), 0) +
                COALESCE((SELECT COUNT(*) FROM incomes WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mes} AND EXTRACT(YEAR FROM data) = ${ano}), 0) AS transacoes_mes
        `

        const stats = result[0]
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

    static async getTendencias(userId: number): Promise<Array<{
        mes: string
        receitas: number
        despesas: number
        saldo: number
    }>> {
        const now = new Date()
        const meses: Array<{ mes: number; ano: number; nome: string }> = []

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
                const result = await prisma.$queryRaw<Array<{ receitas: string; despesas: string }>>`
                    SELECT
                        COALESCE((SELECT SUM(quantidade) FROM incomes WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mes} AND EXTRACT(YEAR FROM data) = ${ano}), 0) AS receitas,
                        COALESCE((SELECT SUM(quantidade) FROM expenses WHERE user_id = ${userId} AND EXTRACT(MONTH FROM data) = ${mes} AND EXTRACT(YEAR FROM data) = ${ano}), 0) AS despesas
                `

                const receitas = Number(result[0].receitas)
                const despesas = Number(result[0].despesas)

                return { mes: nome, receitas, despesas, saldo: receitas - despesas }
            })
        )

        return tendencias
    }
}
