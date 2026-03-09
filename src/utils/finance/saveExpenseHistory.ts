// src/utils/finance/saveExpenseHistory.ts
import prisma from '../../database/prisma'

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
    alteracao,
}: SaveExpenseHistoryParams): Promise<void> => {
    await prisma.$executeRaw`
        INSERT INTO expense_history (expense_id, user_id, tipo, alteracao)
        VALUES (${expense_id}, ${user_id}, ${tipo}, ${JSON.stringify(alteracao)}::jsonb)
    `
}
