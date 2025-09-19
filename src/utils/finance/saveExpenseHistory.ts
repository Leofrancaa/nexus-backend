// src/utils/finance/saveExpenseHistory.ts
import { DatabaseUtils } from '../database'

interface SaveExpenseHistoryParams {
    expense_id: number
    user_id: number
    tipo: string
    alteracao: Record<string, any>
}

export const saveExpenseHistory = async ({
    expense_id,
    user_id,
    tipo,
    alteracao
}: SaveExpenseHistoryParams): Promise<void> => {
    await DatabaseUtils.query(
        `INSERT INTO expense_history (expense_id, user_id, tipo, alteracao)
         VALUES ($1, $2, $3, $4)`,
        [expense_id, user_id, tipo, alteracao]
    )
}