import {
    addInvestment,
    fetchInvestments,
    editInvestment,
    removeInvestment
} from '../services/investmentService.js'

import { fetchInvestmentsByDateRange } from '../services/investmentService.js'

export const createInvestment = async (req, res) => {
    const user_id = req.user.id
    try {
        const investment = await addInvestment({ ...req.body, user_id })
        res.status(201).json(investment)
    } catch (err) {
        console.error('Erro ao criar investimento:', err)
        res.status(500).json({ error: 'Erro ao criar investimento.' })
    }
}


export const getInvestments = async (req, res) => {
    const userId = req.user.id
    const { start_date, end_date } = req.query

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Parâmetros start_date e end_date são obrigatórios.' })
    }

    try {
        const result = await fetchInvestmentsByDateRange(userId, start_date, end_date)
        res.json(result)
    } catch (err) {
        console.error('Erro ao buscar investimentos:', err)
        res.status(500).json({ error: 'Erro ao buscar investimentos.' })
    }
}


export const updateInvestment = async (req, res) => {
    const user_id = req.user.id
    const id = req.params.id

    try {
        const updated = await editInvestment(id, req.body, user_id)
        if (!updated) return res.status(404).json({ error: 'Investimento não encontrado ou não pertence ao usuário.' })
        res.json(updated)
    } catch (err) {
        console.error('Erro ao atualizar investimento:', err)
        res.status(500).json({ error: 'Erro ao atualizar investimento.' })
    }
}

export const deleteInvestment = async (req, res) => {
    const user_id = req.user.id
    const id = req.params.id

    try {
        const deleted = await removeInvestment(id, user_id)
        if (!deleted) return res.status(404).json({ error: 'Investimento não encontrado ou não pertence ao usuário.' })
        res.json({ message: 'Investimento removido com sucesso.' })
    } catch (err) {
        console.error('Erro ao excluir investimento:', err)
        res.status(500).json({ error: 'Erro ao excluir investimento.' })
    }
}
