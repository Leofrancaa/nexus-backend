import {
    addCategory,
    fetchCategories,
    editCategory,
    removeCategory
} from '../services/categoryService.js'

export const createCategory = async (req, res) => {
    const user_id = req.user.id
    try {
        const category = await addCategory({ ...req.body, user_id })
        res.status(201).json(category)
    } catch (err) {
        console.error('Erro ao criar categoria:', err)
        res.status(500).json({ error: 'Erro ao criar categoria.' })
    }
}

export const getCategories = async (req, res) => {
    try {
        const user_id = req.user.id;
        const { tipo } = req.query; // 👈 pega o tipo da query

        const categories = await fetchCategories(user_id, tipo); // 👈 envia o tipo para o service
        res.json(categories);
    } catch (err) {
        console.error('Erro ao buscar categorias:', err);
        res.status(500).json({ error: 'Erro ao buscar categorias.' });
    }
};


export const updateCategory = async (req, res) => {
    const user_id = req.user.id
    const id = req.params.id

    try {
        const updated = await editCategory(id, req.body, user_id)
        if (!updated) return res.status(404).json({ error: 'Categoria não encontrada ou não pertence ao usuário.' })
        res.json(updated)
    } catch (err) {
        console.error('Erro ao atualizar categoria:', err)
        res.status(500).json({ error: 'Erro ao atualizar categoria.' })
    }
}

export const deleteCategory = async (req, res) => {
    const user_id = req.user.id
    const id = req.params.id

    try {
        const deleted = await removeCategory(id, user_id)
        if (!deleted) return res.status(404).json({ error: 'Categoria não encontrada ou não pertence ao usuário.' })
        res.json({ message: 'Categoria removida com sucesso.' })
    } catch (err) {
        console.error('Erro ao excluir categoria:', err)
        res.status(500).json({ error: 'Erro ao excluir categoria.' })
    }
}
