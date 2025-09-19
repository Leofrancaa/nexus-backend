// src/utils/finance/getCartoesEstourados.ts
import { DatabaseUtils } from '../database'

interface CartoesEstouradosQueryResult {
    id: number
    nome: string
    limite: string
}

export interface CartoesEstouradosResult {
    id: number
    nome: string
    limite: number
}

export const getCartoesEstourados = async (user_id: number): Promise<CartoesEstouradosResult[]> => {
    const result = await DatabaseUtils.findMany<CartoesEstouradosQueryResult>(
        `SELECT 
            c.id, 
            c.nome, 
            c.limite 
         FROM cards c
         LEFT JOIN expenses e 
           ON c.id = e.card_id AND e.user_id = $1
         WHERE c.user_id = $1 AND c.limite::numeric <= 200
         GROUP BY c.id, c.nome, c.limite`,
        [user_id]
    )

    return result.map(row => ({
        id: row.id,
        nome: row.nome,
        limite: parseFloat(row.limite)
    }))
}