
import {
    addIncome,
    fetchIncomesByMonthYear,
    editIncome,
    removeIncome
} from '../services/incomeService.js'
import { fetchIncomesByDateRange } from '../services/incomeService.js'

export const createIncome = async (req, res) => {
    try {
        const userId = req.user.id
        const result = await addIncome({ ...req.body, user_id: userId })
        res.status(201).json(result)
    } catch (err) {
        console.error('Erro ao criar receita:', err)
        res.status(500).json({ error: 'Erro ao criar receita.' })
    }
}


export const getIncomes = async (req, res) => {
    const userId = req.user.id
    const { start_date, end_date } = req.query

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Parâmetros start_date e end_date são obrigatórios.' })
    }

    try {
        const result = await fetchIncomesByDateRange(userId, start_date, end_date)
        res.json(result)
    } catch (err) {
        console.error('Erro ao buscar receitas:', err)
        res.status(500).json({ error: 'Erro ao buscar receitas.' })
    }
}



export const updateIncome = async (req, res) => {
    const userId = req.user.id
    const incomeId = req.params.id

    try {
        const updated = await editIncome(incomeId, req.body, userId)
        if (!updated) return res.status(404).json({ error: 'Receita não encontrada ou não pertence ao usuário.' })
        res.json(updated)
    } catch (err) {
        console.error('Erro ao atualizar receita:', err)
        res.status(500).json({ error: 'Erro ao atualizar receita.' })
    }
}


export const deleteIncome = async (req, res) => {
    const userId = req.user.id
    const incomeId = req.params.id

    try {
        const deleted = await removeIncome(incomeId, userId)
        if (!deleted) return res.status(404).json({ error: 'Receita não encontrada ou não pertence ao usuário.' })
        res.json({ message: 'Receita removida com sucesso.' })
    } catch (err) {
        console.error('Erro ao excluir receita:', err)
        res.status(500).json({ error: 'Erro ao excluir receita.' })
    }
}
