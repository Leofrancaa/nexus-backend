// src/utils/finance/getReceitasDoMes.ts
import { DatabaseUtils } from '../database'

interface ReceitasDoMesQueryResult {
    id: number
    tipo: string
    quantidade: string
    nota?: string
    data: string
    fonte?: string
    user_id: number
    category_id?: number
    created_at: Date
    updated_at: Date
}

export interface ReceitasDoMesResult {
    id: number
    tipo: string
    quantidade: number
    nota?: string
    data: string
    fonte?: string
    user_id: number
    category_id?: number
    created_at: Date
    updated_at: Date
}

export const getReceitasDoMes = async (
    user_id: number,
    mes: number,
    ano: number
): Promise<ReceitasDoMesResult[]> => {
    const result = await DatabaseUtils.findMany<ReceitasDoMesQueryResult>(
        'SELECT * FROM incomes WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
        [user_id, mes, ano]
    )

    return result.map(row => ({
        ...row,
        quantidade: parseFloat(row.quantidade)
    }))
}