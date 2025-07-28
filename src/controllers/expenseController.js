import {
    addExpense,
    fetchExpensesByMonthYear,
    editExpense,
    removeExpense,
    fetchExpensesByDateRange
} from '../services/expenseService.js'

export const createExpense = async (req, res) => {
    try {
        const userId = req.user.id
        const result = await addExpense({ ...req.body, user_id: userId })
        res.status(201).json(result)
    } catch (err) {
        console.error('Erro ao criar despesa:', err)

        // Verifica se o erro é customizado com status e message
        if (err.status && err.message) {
            return res.status(err.status).json({ error: err.message })
        }

        // Erro genérico
        res.status(500).json({ error: 'Erro ao criar despesa.' })
    }
}

export const getExpenses = async (req, res) => {
    const userId = req.user.id
    const { start_date, end_date } = req.query

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Parâmetros start_date e end_date são obrigatórios.' })
    }

    try {
        const result = await fetchExpensesByDateRange(userId, start_date, end_date)
        res.json(result)
    } catch (err) {
        console.error('Erro ao buscar despesas:', err)
        res.status(500).json({ error: 'Erro ao buscar despesas.' })
    }
}

export const updateExpense = async (req, res) => {
    const userId = req.user.id
    const expenseId = req.params.id

    try {
        const updated = await editExpense(expenseId, req.body, userId)
        if (!updated) {
            return res.status(404).json({ error: 'Despesa não encontrada ou não pertence ao usuário.' })
        }
        res.json(updated)
    } catch (err) {
        console.error('Erro ao atualizar despesa:', err)
        res.status(500).json({ error: 'Erro ao atualizar despesa.' })
    }
}

export const deleteExpense = async (req, res) => {
    const userId = req.user.id
    const expenseId = req.params.id

    try {
        const deleted = await removeExpense(expenseId, userId)
        if (!deleted) {
            return res.status(404).json({ error: 'Despesa não encontrada ou não pertence ao usuário.' })
        }
        res.json({ message: 'Despesa removida com sucesso.' })
    } catch (err) {
        console.error('Erro ao excluir despesa:', err)
        res.status(500).json({ error: 'Erro ao excluir despesa.' })
    }
}
