// src/utils/finance/getDespesasDoMes.ts
import { DatabaseUtils } from '../database'

interface DespesasDoMesQueryResult {
    id: number
    metodo_pagamento: string
    tipo: string
    quantidade: string
    fixo: boolean
    data: string
    parcelas?: number
    frequencia?: string
    user_id: number
    card_id?: number
    category_id?: number
    observacoes?: string
    created_at: Date
    updated_at: Date
}

export interface DespesasDoMesResult {
    id: number
    metodo_pagamento: string
    tipo: string
    quantidade: number
    fixo: boolean
    data: string
    parcelas?: number
    frequencia?: string
    user_id: number
    card_id?: number
    category_id?: number
    observacoes?: string
    created_at: Date
    updated_at: Date
}

export const getDespesasDoMes = async (
    user_id: number,
    mes: number,
    ano: number
): Promise<DespesasDoMesResult[]> => {
    const result = await DatabaseUtils.findMany<DespesasDoMesQueryResult>(
        'SELECT * FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
        [user_id, mes, ano]
    )

    return result.map(row => ({
        ...row,
        quantidade: parseFloat(row.quantidade)
    }))
}