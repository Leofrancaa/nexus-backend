// src/utils/finance/getComparativoMensal.ts
import { DatabaseUtils } from '../database'

interface TotalQueryResult {
    total: string
}

interface ComparativoMensalResult {
    receitas: {
        atual: number
        anterior: number
    }
    despesas: {
        atual: number
        anterior: number
    }
}

export const getComparativoMensal = async (
    user_id: number,
    mesAtual: number,
    anoAtual: number
): Promise<ComparativoMensalResult> => {
    const mesAnterior = mesAtual === 1 ? 12 : mesAtual - 1
    const anoAnterior = mesAtual === 1 ? anoAtual - 1 : anoAtual

    const [receitaAtual, receitaAnterior, despesaAtual, despesaAnterior] = await Promise.all([
        DatabaseUtils.findOne<TotalQueryResult>(
            'SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
            [user_id, mesAtual, anoAtual]
        ),
        DatabaseUtils.findOne<TotalQueryResult>(
            'SELECT COALESCE(SUM(quantidade), 0) as total FROM incomes WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
            [user_id, mesAnterior, anoAnterior]
        ),
        DatabaseUtils.findOne<TotalQueryResult>(
            'SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
            [user_id, mesAtual, anoAtual]
        ),
        DatabaseUtils.findOne<TotalQueryResult>(
            'SELECT COALESCE(SUM(quantidade), 0) as total FROM expenses WHERE user_id = $1 AND EXTRACT(MONTH FROM data) = $2 AND EXTRACT(YEAR FROM data) = $3',
            [user_id, mesAnterior, anoAnterior]
        )
    ])

    return {
        receitas: {
            atual: parseFloat(receitaAtual?.total || '0'),
            anterior: parseFloat(receitaAnterior?.total || '0')
        },
        despesas: {
            atual: parseFloat(despesaAtual?.total || '0'),
            anterior: parseFloat(despesaAnterior?.total || '0')
        }
    }
}