import {
    addCard,
    fetchCards,
    editCard,
    removeCard
} from '../services/cardService.js'

export const createCard = async (req, res) => {
    const user_id = req.user.id
    const { nome, tipo, numero, cor } = req.body

    if (numero.length !== 4) {
        return res.status(400).json({ error: 'O número do cartão deve conter exatamente 4 dígitos.' })
    }

    try {
        const newCard = await addCard({ nome, tipo, numero, cor, user_id })
        res.status(201).json(newCard)
    } catch (err) {
        console.error('Erro ao criar cartão:', err)
        res.status(500).json({ error: 'Erro ao criar cartão.' })
    }
}



export const getCards = async (req, res) => {
    try {
        const cards = await fetchCards(req.user.id)
        res.json(cards)
    } catch (err) {
        console.error('Erro ao buscar cartões:', err)
        res.status(500).json({ error: 'Erro ao buscar cartões.' })
    }
}
export const updateCard = async (req, res) => {
    const user_id = req.user.id
    const id = req.params.id
    const { nome, tipo, numero, cor } = req.body

    if (numero.length !== 4) {
        return res.status(400).json({ error: 'O número do cartão deve conter exatamente 4 dígitos.' })
    }


    try {
        const updatedCard = await editCard(id, { nome, tipo, numero, cor }, user_id)
        if (!updatedCard) return res.status(404).json({ error: 'Cartão não encontrado ou não pertence ao usuário.' })
        res.json(updatedCard)
    } catch (err) {
        console.error('Erro ao atualizar cartão:', err)
        res.status(500).json({ error: 'Erro ao atualizar cartão.' })
    }
}

export const deleteCard = async (req, res) => {
    const user_id = req.user.id
    const card_id = req.params.id

    try {
        const deleted = await removeCard(card_id, user_id)
        if (!deleted) return res.status(404).json({ error: 'Cartão não encontrado ou não pertence ao usuário.' })
        res.json({ message: 'Cartão removido com sucesso.' })
    } catch (err) {
        console.error('Erro ao excluir cartão:', err)
        res.status(500).json({ error: 'Erro ao excluir cartão.' })
    }
}
