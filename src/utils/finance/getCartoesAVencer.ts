// src/utils/finance/getCartoesAVencer.ts
import { DatabaseUtils } from '../database.js'

interface CartoesAVencerQueryResult {
    id: number
    nome: string
    limite: string
    total_gasto: string
    dia_vencimento: number
}

export interface CartoesAVencerResult {
    id: number
    nome: string
    limite: number
    total_gasto: number
    dia_vencimento: number
}

export const getCartoesAVencer = async (user_id: number): Promise<CartoesAVencerResult[]> => {
    const hoje = new Date()
    const diaHoje = hoje.getDate()

    // Gerar um array de 5 dias a partir de hoje (ex: 28, 29, 30, 1, 2)
    const dias: number[] = []
    for (let i = 0; i <= 5; i++) {
        const dataTemp = new Date(hoje)
        dataTemp.setDate(diaHoje + i)
        dias.push(dataTemp.getDate()) // pega só o dia do mês (1-31)
    }

    const result = await DatabaseUtils.findMany<CartoesAVencerQueryResult>(
        `SELECT 
            id, nome, limite,
            (SELECT COALESCE(SUM(quantidade), 0) 
             FROM expenses 
             WHERE card_id = cards.id AND user_id = $1) AS total_gasto,
            dia_vencimento
         FROM cards
         WHERE user_id = $1 AND dia_vencimento = ANY($2::int[])`,
        [user_id, dias]
    )

    return result.map(row => ({
        id: row.id,
        nome: row.nome,
        limite: parseFloat(row.limite),
        total_gasto: parseFloat(row.total_gasto),
        dia_vencimento: row.dia_vencimento
    }))
}