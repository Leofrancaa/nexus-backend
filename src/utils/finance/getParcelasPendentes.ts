// src/utils/finance/getParcelasPendentes.ts
import { DatabaseUtils } from '../database'
import { formatDate } from '../helper'

interface ParcelasPendentesQueryResult {
    id: number
    metodo_pagamento: string
    tipo: string
    quantidade: string
    data: string
    parcelas: number
}

export interface ParcelasPendentesResult {
    id: number
    metodo_pagamento: string
    tipo: string
    quantidade: number
    data: string
    parcelas: number
}

export const getParcelasPendentes = async (user_id: number): Promise<ParcelasPendentesResult[]> => {
    const today = formatDate(new Date())

    const result = await DatabaseUtils.findMany<ParcelasPendentesQueryResult>(
        `SELECT * FROM expenses
         WHERE user_id = $1
         AND parcelas IS NOT NULL
         AND data >= $2
         ORDER BY data ASC`,
        [user_id, today]
    )

    return result.map(row => ({
        id: row.id,
        metodo_pagamento: row.metodo_pagamento,
        tipo: row.tipo,
        quantidade: parseFloat(row.quantidade),
        data: row.data,
        parcelas: row.parcelas
    }))
}