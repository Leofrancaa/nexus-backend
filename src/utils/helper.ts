import { Response } from 'express'
import { ApiError, ApiResponse } from '../types/index'

/**
 * Normaliza string removendo acentos e convertendo para lowercase
 */
export const normalize = (str: string = ""): string => {
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim()
}

/**
 * Adiciona meses a uma data de forma segura (lida com diferentes números de dias no mês)
 */
export const addMonthsSafe = (date: Date, months: number): Date => {
    const newDate = new Date(date)
    const day = newDate.getDate()

    newDate.setMonth(newDate.getMonth() + months)

    // Se o dia mudou (ex: 31 de Jan + 1 mês = 3 de Mar), ajusta para o último dia do mês
    if (newDate.getDate() < day) {
        newDate.setDate(0) // Último dia do mês anterior
    }

    return newDate
}

/**
 * Formata data para string YYYY-MM-DD
 */
export const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0]
}

/**
 * Valida se uma string é um email válido
 */
export const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
}

/**
 * Valida se um número é positivo
 */
export const isPositiveNumber = (value: any): boolean => {
    return typeof value === 'number' && value > 0
}

/**
 * Converte string para número, retorna null se inválido
 */
export const toNumber = (value: any): number | null => {
    if (typeof value === 'number') return value
    if (typeof value === 'string') {
        const num = parseFloat(value)
        return isNaN(num) ? null : num
    }
    return null
}

/**
 * Valida se uma cor está no formato hexadecimal
 */
export const isValidHexColor = (color: string): boolean => {
    return /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)
}

/**
 * Gera uma resposta de erro padronizada
 */
export const createErrorResponse = (
    message: string,
    status: number = 500,
    details?: any
): ApiError => {
    const error = new Error(message) as ApiError
    error.status = status
    if (details) error.code = details
    return error
}

/**
 * Gera uma resposta de sucesso padronizada
 */
export const createSuccessResponse = <T>(
    data: T,
    message?: string
): ApiResponse<T> => {
    return {
        success: true,
        data,
        message: message ?? ''
    }
}

/**
 * Envia resposta de erro HTTP
 */
export const sendErrorResponse = (
    res: Response,
    error: string,
    status: number = 500,
    details?: any
): void => {
    res.status(status).json({
        success: false,
        error,
        details: process.env.NODE_ENV === 'development' ? details : undefined,
        timestamp: new Date().toISOString()
    })
}

/**
 * Envia resposta de sucesso HTTP
 */
export const sendSuccessResponse = <T>(
    res: Response,
    data: T,
    message?: string,
    status: number = 200
): void => {
    res.status(status).json({
        success: true,
        data,
        message,
        timestamp: new Date().toISOString()
    })
}

/**
 * Calcula a competência da fatura baseada na data de compra
 */
export const calculateCompetencia = (
    purchaseDate: Date,
    dueDay: number,
    closeDaysBefore: number = 10
): { competencia_mes: number; competencia_ano: number } => {
    const year = purchaseDate.getFullYear()
    const month = purchaseDate.getMonth()

    // Data de vencimento do mês atual
    const thisMonthDue = new Date(year, month, Math.min(dueDay, 28))

    // Próxima data de vencimento
    const nextDue = purchaseDate <= thisMonthDue
        ? thisMonthDue
        : new Date(year, month + 1, Math.min(dueDay, 28))

    // Data de fechamento da fatura
    const closeDate = new Date(nextDue)
    closeDate.setDate(closeDate.getDate() - closeDaysBefore)

    // Determina a competência baseada na data de fechamento
    const competenciaDate = purchaseDate >= closeDate
        ? nextDue
        : addMonthsSafe(nextDue, -1)

    return {
        competencia_mes: competenciaDate.getMonth() + 1,
        competencia_ano: competenciaDate.getFullYear()
    }
}

/**
 * Valida se uma data está no formato YYYY-MM-DD
 */
export const isValidDateString = (dateString: string): boolean => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return false

    const date = new Date(dateString + 'T00:00:00')
    return date instanceof Date && !isNaN(date.getTime())
}

/**
 * Retorna o último dia do mês para uma data específica
 */
export const getLastDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Formata valor monetário para exibição
 */
export const formatCurrency = (value: number, currency: string = 'BRL'): string => {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: currency
    }).format(value)
}

/**
 * Sanitiza string removendo caracteres especiais perigosos
 */
export const sanitizeString = (str: string): string => {
    return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>]/g, '')
        .trim()
}

/**
 * Gera ID único simples (para uso em desenvolvimento/testes)
 */
export const generateId = (): string => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2)
}

/**
 * Delay assíncrono (útil para testes e rate limiting)
 */
export const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Verifica se o ambiente é de desenvolvimento
 */
export const isDevelopment = (): boolean => {
    return process.env.NODE_ENV === 'development'
}

/**
 * Verifica se o ambiente é de produção
 */
export const isProduction = (): boolean => {
    return process.env.NODE_ENV === 'production'
}

/**
 * Log seguro que não exibe informações sensíveis em produção
 */
export const safeLog = (message: string, data?: any): void => {
    if (isDevelopment()) {
        console.log(`[${new Date().toISOString()}] ${message}`, data || '')
    }
}