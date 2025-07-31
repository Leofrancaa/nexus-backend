import {
    addThreshold,
    fetchThresholdsByUser,
    editThreshold,
    removeThreshold
} from '../services/thresholdService.js';

// ✅ POST /api/thresholds
export const createThreshold = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await addThreshold({ ...req.body, user_id: userId });
        res.status(201).json(result);
    } catch (err) {
        console.error('Erro ao criar threshold:', err);
        res.status(500).json({ error: 'Erro ao criar threshold.' });
    }
};

// ✅ GET /api/thresholds
export const getThresholds = async (req, res) => {
    const userId = req.user.id;

    try {
        const result = await fetchThresholdsByUser(userId);
        res.json(result); // já vem formatado com categoria
    } catch (err) {
        console.error('Erro ao buscar thresholds:', err);
        res.status(500).json({ error: 'Erro ao buscar thresholds.' });
    }
};

// ✅ PUT /api/thresholds/:id
export const updateThreshold = async (req, res) => {
    const userId = req.user.id;
    const thresholdId = req.params.id;

    try {
        const updated = await editThreshold(thresholdId, req.body, userId);
        if (!updated)
            return res
                .status(404)
                .json({ error: 'Threshold não encontrado ou não pertence ao usuário.' });
        res.json(updated);
    } catch (err) {
        console.error('Erro ao atualizar threshold:', err);
        res.status(500).json({ error: 'Erro ao atualizar threshold.' });
    }
};

// ✅ DELETE /api/thresholds/:id
export const deleteThreshold = async (req, res) => {
    const userId = req.user.id;
    const thresholdId = req.params.id;

    try {
        const deleted = await removeThreshold(thresholdId, userId);
        if (!deleted)
            return res
                .status(404)
                .json({ error: 'Threshold não encontrado ou não pertence ao usuário.' });
        res.json({ message: 'Threshold removido com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir threshold:', err);
        res.status(500).json({ error: 'Erro ao excluir threshold.' });
    }
};
