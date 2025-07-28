import { updateUserCurrency, getUserCurrency } from '../services/userService.js'

// PUT /api/user/currency
export const updateCurrency = async (req, res) => {
    const userId = req.user.id
    const { currency } = req.body

    const allowed = ['BRL', 'USD', 'EUR', 'GBP']
    if (!allowed.includes(currency)) {
        return res.status(400).json({ message: 'Moeda inválida' })
    }

    try {
        await updateUserCurrency(userId, currency)
        res.status(200).json({ message: 'Moeda atualizada com sucesso' })
    } catch (error) {
        res.status(500).json({ message: 'Erro ao atualizar moeda' })
    }
}

// GET /api/user/currency
export const getCurrency = async (req, res) => {
    const userId = req.user.id

    try {
        const currency = await getUserCurrency(userId)
        res.status(200).json({ currency })
    } catch (error) {
        res.status(500).json({ message: 'Erro ao obter moeda' })
    }
}
