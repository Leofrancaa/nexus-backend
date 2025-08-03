import {
    addExpense,
    fetchExpensesByDateRange,
    fetchExpensesByMonthYear,
    editExpense,
    removeExpense,
    getTotalPorCategoria,
    getTotalDespesasDoMes,
    getDespesasStats
} from '../services/expenseService.js';

import { pool } from '../database/index.js';

// Criar despesa
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

// Buscar despesas por intervalo de datas
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

// ✅ Buscar despesas do mês atual (novo)
export const getExpensesByMonth = async (req, res) => {
    const user_id = req.user.id;
    const mes = parseInt(req.query.mes);
    const ano = parseInt(req.query.ano);

    if (!mes || !ano) {
        return res.status(400).json({ error: "Parâmetros 'mes' e 'ano' são obrigatórios." });
    }

    try {
        const result = await fetchExpensesByMonthYear(user_id, mes, ano);
        res.json(result); // ✅ retorna array direto
    } catch (err) {
        console.error("Erro ao buscar despesas do mês:", err);
        res.status(500).json({ error: "Erro ao buscar despesas." });
    }
};

// Atualizar despesa
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

// Deletar despesa
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

// Histórico de alterações
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

// Total por categoria no mês atual
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

// ✅ Total de despesas do mês (para sumário)
export const getTotalExpensesMonth = async (req, res) => {
    const user_id = req.user.id;
    const mes = parseInt(req.query.mes);
    const ano = parseInt(req.query.ano);

    if (!mes || !ano) {
        return res.status(400).json({ error: "Parâmetros 'mes' e 'ano' são obrigatórios." });
    }

    try {
        const total = await getTotalDespesasDoMes(user_id, mes, ano);
        res.json({ total });
    } catch (error) {
        console.error('Erro ao buscar total mensal de despesas:', error);
        res.status(500).json({ error: "Erro ao buscar total mensal de despesas" });
    }
};


export const getExpenseStats = async (req, res) => {
    const user_id = req.user.id;
    const mes = parseInt(req.query.month);
    const ano = parseInt(req.query.year);
    const categoriaId = req.query.categoryId ? parseInt(req.query.categoryId) : null;

    if (!mes || !ano) {
        return res.status(400).json({ error: "Parâmetros 'mes' e 'ano' são obrigatórios." });
    }

    try {
        const stats = await getDespesasStats(user_id, mes, ano, categoriaId);
        res.json(stats);
    } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
        res.status(500).json({ error: "Erro ao buscar estatísticas de despesas." });
    }
};

export const getResumoCategorias = async (req, res) => {
    const { mes, ano } = req.query;
    const user_id = req.user.id;


    const { rows } = await pool.query(
        `
    SELECT 
      c.nome,
      c.cor,
      COUNT(e.id) as quantidade,
      SUM(e.quantidade) as total
    FROM expenses e
    JOIN categories c ON c.id = e.category_id
    WHERE e.user_id = $1 AND EXTRACT(MONTH FROM e.data) = $2 AND EXTRACT(YEAR FROM e.data) = $3
    GROUP BY c.nome, c.cor
    `,
        [user_id, mes, ano]
    );

    const totalGeral = rows.reduce((acc, r) => acc + Number(r.total), 0);

    const dados = rows.map((r) => ({
        nome: r.nome,
        cor: r.cor,
        quantidade: Number(r.quantidade),
        total: Number(r.total),
        percentual: (Number(r.total) / totalGeral) * 100,
    }));

    res.json(dados);
};
