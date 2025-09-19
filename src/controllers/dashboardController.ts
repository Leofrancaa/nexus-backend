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