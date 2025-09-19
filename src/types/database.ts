// Tipos específicos para queries do banco de dados
import { QueryResultRow } from 'pg'

// Tipo base para queries genéricas
export interface BaseQueryResult extends QueryResultRow {
    [key: string]: any
}

export interface ExpenseMonthlyResult extends QueryResultRow {
    numero_mes: number
    total: string
}

export interface ExpenseStatsResult extends QueryResultRow {
    total: string
    fixas: string
    transacoes: string
    media: string
}

export interface CategoryExpenseResult extends QueryResultRow {
    id: number
    nome: string
    total: string
}

export interface CardResult extends QueryResultRow {
    limite_disponivel: number
    dia_vencimento: number
    dias_fechamento_antes: number
}

export interface UserResult extends QueryResultRow {
    id: number
    nome: string
    email: string
    senha?: string
    currency?: string
    created_at: Date
    updated_at: Date
}

export interface InvoicePaymentResult extends QueryResultRow {
    id: number
    user_id: number
    card_id: number
    competencia_mes: number
    competencia_ano: number
    amount_paid: number
    created_at: Date
}

export interface ExpenseHistoryResult extends QueryResultRow {
    id: number
    expense_id: number
    user_id: number
    tipo: string
    alteracao: Record<string, any>
    data_alteracao: Date
}

export interface MonthlyComparisonResult extends QueryResultRow {
    receitas_atual: string
    receitas_anterior: string
    despesas_atual: string
    despesas_anterior: string
}

export interface DashboardStatsResult extends QueryResultRow {
    saldo_atual: string
    saldo_futuro: string
    total_receitas_mes: string
    total_despesas_mes: string
}

// Tipos para agregações e estatísticas
export interface AggregationResult extends QueryResultRow {
    count: string
    sum: string
    avg: string
    min: string
    max: string
}

// Tipos para queries de data/tempo
export interface DateRangeQuery {
    start_date: string
    end_date: string
}

export interface MonthYearQuery {
    month: number
    year: number
}

// Tipos para paginação
export interface PaginationQuery {
    page: number
    limit: number
    offset: number
}

// Tipos para ordenação
export interface SortQuery {
    sort_by: string
    sort_order: 'ASC' | 'DESC'
}

// Tipos básicos para queries simples
export interface CountResult extends QueryResultRow {
    count: string
}

export interface ExistsResult extends QueryResultRow {
    exists: boolean
}

export interface IdResult extends QueryResultRow {
    id: number
}