import { Request, Response, NextFunction } from 'express'
import { DashboardService } from '../services/dashboardService.js'
import { AuthenticatedRequest } from '../types/index.js'
import {
    sendErrorResponse,
    sendSuccessResponse
} from '../utils/helper.js'

/**
 * GET /api/dashboard - Buscar dados completos do dashboard
 */
export const getDashboardData = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const dashboardData = await DashboardService.getDashboardData(userId)
        sendSuccessResponse(res, dashboardData, 'Dados do dashboard recuperados com sucesso.')
    } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error)
        sendErrorResponse(res, 'Erro ao carregar dados do dashboard.', 500, error)
    }
}

/**
 * GET /api/dashboard/quick-stats - Estatísticas rápidas
 */
export const getQuickStats = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const stats = await DashboardService.getQuickStats(userId)
        sendSuccessResponse(res, stats, 'Estatísticas rápidas recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar estatísticas rápidas:', error)
        sendErrorResponse(res, 'Erro ao buscar estatísticas rápidas.', 500, error)
    }
}

/**
 * GET /api/dashboard/trends - Tendências dos últimos 6 meses
 */
export const getTendencias = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {
    try {
        const authReq = req as AuthenticatedRequest
        const userId = authReq.user.id

        const tendencias = await DashboardService.getTendencias(userId)
        sendSuccessResponse(res, tendencias, 'Tendências recuperadas com sucesso.')
    } catch (error) {
        console.error('Erro ao buscar tendências:', error)
        sendErrorResponse(res, 'Erro ao buscar tendências.', 500, error)
    }
}