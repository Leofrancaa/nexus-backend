// src/controllers/dashboardController.ts
import { Request, Response } from 'express'
import { AuthenticatedRequest, DashboardData } from '../types/index'
import { sendSuccessResponse, sendErrorResponse } from '../utils/helper'
import {
    getSaldoAtual,
    getSaldoFuturo,
    getTotaisMensais,
    getComparativoMensal,
    getGastosPorCategoria,
    getGastosPorCartao,
    getTopCategoriasGasto,
    getCartoesEstourados,
    getCartoesAVencer,
    getParcelasPendentes,
    getResumoAnual,
    type GastosPorCategoriaResult,
    type GastosPorCartaoResult,
    type TopCategoriasResult,
    type CartoesEstouradosResult,
    type CartoesAVencerResult,
    type ParcelasPendentesResult,
    type ResumoAnualResult
} from '../utils/finance/index'
import prisma from '../database/prisma'

export const getHealthScore = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const now = new Date()
        const mes = now.getMonth() + 1
        const ano = now.getFullYear()

        const [comparativo, cartoesEstourados, thresholds, planos, faturasPendentes] = await Promise.all([
            getComparativoMensal(userId, mes, ano),
            getCartoesEstourados(userId),
            prisma.threshold.findMany({ where: { user_id: userId } }),
            prisma.plan.findMany({ where: { user_id: userId, status: { not: 'Concluído' } } }),
            prisma.$queryRaw<Array<{ count: bigint }>>`
                SELECT COUNT(*) as count
                FROM expenses e
                LEFT JOIN card_invoices_payments p
                    ON p.user_id = e.user_id AND p.card_id = e.card_id
                    AND p.competencia_mes = e.competencia_mes AND p.competencia_ano = e.competencia_ano
                WHERE e.user_id = ${userId}
                  AND e.card_id IS NOT NULL
                  AND e.competencia_mes IS NOT NULL
                  AND e.competencia_ano IS NOT NULL
                  AND (e.competencia_ano < ${ano} OR (e.competencia_ano = ${ano} AND e.competencia_mes < ${mes}))
                  AND p.id IS NULL
            `
        ])

        const scores: Record<string, { pontos: number; descricao: string }> = {}

        // Critério 1: receitas > despesas no mês atual
        const receitas = Number(comparativo.receitas_atual || 0)
        const despesas = Number(comparativo.despesas_atual || 0)
        scores.balanco = {
            pontos: receitas > despesas ? 20 : 0,
            descricao: receitas > despesas
                ? 'Receitas maiores que despesas este mês'
                : 'Despesas maiores que receitas este mês'
        }

        // Critério 2: nenhum cartão estourado (limite <= 10%)
        scores.limites = {
            pontos: cartoesEstourados.length === 0 ? 20 : 0,
            descricao: cartoesEstourados.length === 0
                ? 'Todos os cartões com limite saudável'
                : `${cartoesEstourados.length} cartão(ões) com limite crítico`
        }

        // Critério 3: nenhum threshold excedido (usamos a contagem de thresholds vs cartoesEstourados como proxy)
        // Simplificado: sem thresholds configurados = 10pts, com thresholds e sem violações = 20pts
        scores.thresholds = {
            pontos: thresholds.length > 0 ? 20 : 10,
            descricao: thresholds.length > 0
                ? 'Limites de gastos configurados'
                : 'Nenhum limite de gastos configurado'
        }

        // Critério 4: ao menos 1 plano ativo com progresso
        const planosComProgresso = planos.filter(p => Number(p.total_contribuido) > 0)
        scores.planos = {
            pontos: planosComProgresso.length > 0 ? 20 : (planos.length > 0 ? 10 : 0),
            descricao: planosComProgresso.length > 0
                ? `${planosComProgresso.length} plano(s) em andamento`
                : planos.length > 0
                ? 'Planos criados mas sem contribuições'
                : 'Nenhum plano de poupança ativo'
        }

        // Critério 5: nenhuma fatura em atraso
        const faturasPendentesCount = Number((faturasPendentes[0] as { count: bigint }).count)
        scores.faturas = {
            pontos: faturasPendentesCount === 0 ? 20 : 0,
            descricao: faturasPendentesCount === 0
                ? 'Nenhuma fatura em atraso'
                : `${faturasPendentesCount} fatura(s) de meses anteriores não pagas`
        }

        const total = Object.values(scores).reduce((sum, s) => sum + s.pontos, 0)
        const nivel = total >= 80 ? 'Excelente' : total >= 60 ? 'Bom' : total >= 40 ? 'Regular' : 'Atenção'

        sendSuccessResponse(res, { score: total, nivel, criterios: scores }, 'Score de saúde financeira calculado.')
    } catch (error) {
        console.error('Erro ao calcular health score:', error)
        sendErrorResponse(res, 'Erro ao calcular score de saúde financeira.', 500, error)
    }
}

export const getDashboardData = async (req: Request, res: Response): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const user_id = authReq.user.id

        const now = new Date()
        const mes = now.getMonth() + 1
        const ano = now.getFullYear()

        // Executar todas as consultas em paralelo para melhor performance
        const [
            saldo,
            saldoFuturo,
            totaisMensais,
            comparativo,
            porCategoria,
            porCartao,
            topCategorias,
            cartoesEstourados,
            cartoesAVencer,
            parcelasPendentes,
            resumoAnual
        ] = await Promise.all([
            getSaldoAtual(user_id),
            getSaldoFuturo(user_id),
            getTotaisMensais(user_id),
            getComparativoMensal(user_id, mes, ano),
            getGastosPorCategoria(user_id, mes, ano),
            getGastosPorCartao(user_id, mes, ano),
            getTopCategoriasGasto(user_id, mes, ano),
            getCartoesEstourados(user_id),
            getCartoesAVencer(user_id),
            getParcelasPendentes(user_id),
            getResumoAnual(user_id, ano)
        ])

        const dashboardData: DashboardData = {
            saldo,
            saldoFuturo,
            totaisMensais: totaisMensais.receitas.map((receita, index) => ({
                mes: receita.mes,
                receitas: receita.total,
                despesas: totaisMensais.despesas[index]?.total || 0
            })),
            resumoAnual,
            comparativo,
            gastosPorCategoria: porCategoria,
            topCategorias,
            gastosPorCartao: porCartao,
            parcelasPendentes,
            cartoesEstourados,
            cartoesAVencer
        }

        sendSuccessResponse(res, dashboardData, 'Dados do dashboard carregados com sucesso')
    } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error)
        sendErrorResponse(res, 'Erro ao carregar dados do dashboard.', 500, error)
    }
}