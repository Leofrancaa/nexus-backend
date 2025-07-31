import {
    addExpense,
    fetchExpensesByDateRange,
    editExpense,
    removeExpense,
    getTotalPorCategoria
} from '../services/expenseService.js';

import { pool } from '../database/index.js';

// ✅ Criar despesa
export const createExpense = async (req, res) => {
    try {
        const userId = req.user.id;
        const result = await addExpense({ ...req.body, user_id: userId });
        res.status(201).json(result);
    } catch (err) {
        console.error('Erro ao criar despesa:', err);

        if (err.status && err.message) {
            return res.status(err.status).json({ error: err.message });
        }

        res.status(500).json({ error: 'Erro ao criar despesa.' });
    }
};

// ✅ Buscar despesas por intervalo de datas
export const getExpenses = async (req, res) => {
    const userId = req.user.id;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({ error: 'Parâmetros start_date e end_date são obrigatórios.' });
    }

    try {
        const result = await fetchExpensesByDateRange(userId, start_date, end_date);
        res.json(result);
    } catch (err) {
        console.error('Erro ao buscar despesas:', err);
        res.status(500).json({ error: 'Erro ao buscar despesas.' });
    }
};

// ✅ Atualizar despesa
export const updateExpense = async (req, res) => {
    const userId = req.user.id;
    const expenseId = req.params.id;

    try {
        const updated = await editExpense(expenseId, req.body, userId);
        if (!updated) {
            return res.status(404).json({ error: 'Despesa não encontrada ou não pertence ao usuário.' });
        }
        res.json(updated);
    } catch (err) {
        console.error('Erro ao atualizar despesa:', err);
        res.status(500).json({ error: 'Erro ao atualizar despesa.' });
    }
};

// ✅ Deletar despesa
export const deleteExpense = async (req, res) => {
    const userId = req.user.id;
    const expenseId = req.params.id;

    try {
        const deleted = await removeExpense(expenseId, userId);
        if (!deleted) {
            return res.status(404).json({ error: 'Despesa não encontrada ou não pertence ao usuário.' });
        }
        res.json({ message: 'Despesa removida com sucesso.' });
    } catch (err) {
        console.error('Erro ao excluir despesa:', err);
        res.status(500).json({ error: 'Erro ao excluir despesa.' });
    }
};

// ✅ Histórico de alterações de uma despesa
export const getExpenseHistory = async (req, res) => {
    const { expenseId } = req.params;
    const user_id = req.user.id;

    try {
        const result = await pool.query(
            `SELECT * FROM expense_history 
             WHERE expense_id = $1 AND user_id = $2
             ORDER BY data_alteracao DESC`,
            [expenseId, user_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar histórico de despesa:', err);
        res.status(500).json({ error: 'Erro ao buscar histórico.' });
    }
};

// ✅ Total da categoria no mês atual
export const getTotalByCategoria = async (req, res) => {
    const user_id = req.user.id;
    const category_id = parseInt(req.params.categoryId);
    const mes = new Date().getMonth() + 1;
    const ano = new Date().getFullYear();

    try {
        const total = await getTotalPorCategoria(user_id, category_id, mes, ano);
        res.json({ total });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Erro ao calcular total da categoria" });
    }
};
