import {
    addIncome,
    fetchIncomesByDateRange,
    fetchIncomesByMonthYear,
    editIncome,
    removeIncome,
    getIncomesStats,
    getTotalReceitasDoMes,
    getTotalReceitaPorCategoria,
} from "../services/incomeService.js";
import { pool } from "../database/index.js";

// Criar receita
export const createIncome = async (req, res) => {
    const userId = req.user.id;

    try {
        const created = await addIncome({ ...req.body, user_id: userId });

        // ✅ Se não for fixa, retorna só ela
        if (!created.fixo) {
            return res.status(201).json(created);
        }

        // 🔁 Replicar até dezembro
        // 🔁 Replicar receitas fixas até dezembro
        const originalDate = new Date(created.data);
        const ano = originalDate.getFullYear();
        const diaOriginal = originalDate.getDate();
        const mesOriginal = originalDate.getMonth(); // 0-based
        const replicadas = [];

        for (let m = mesOriginal + 1; m < 12; m++) {
            const ultimoDiaDoMes = new Date(ano, m + 1, 0).getDate(); // último dia do mês
            const diaAjustado = Math.min(diaOriginal, ultimoDiaDoMes); // evita dia 31 em meses que não tem

            const novaData = new Date(ano, m, diaAjustado);
            const copia = {
                tipo: created.tipo,
                quantidade: created.quantidade,
                nota: created.nota,
                data: novaData.toISOString().split("T")[0],
                fonte: created.fonte,
                fixo: true,
                user_id: userId,
                category_id: created.category_id,
            };

            const nova = await addIncome(copia);
            replicadas.push(nova);
        }

        return res.status(201).json([created, ...replicadas]);
    } catch (err) {
        console.error("Erro ao criar receita:", err);
        res.status(500).json({ error: "Erro ao criar receita." });
    }
};

// Buscar receitas por intervalo
export const getIncomes = async (req, res) => {
    const userId = req.user.id;
    const { start_date, end_date } = req.query;

    if (!start_date || !end_date) {
        return res.status(400).json({
            error: "Parâmetros start_date e end_date são obrigatórios.",
        });
    }

    try {
        const result = await fetchIncomesByDateRange(userId, start_date, end_date);
        res.json(result);
    } catch (err) {
        console.error("Erro ao buscar receitas:", err);
        res.status(500).json({ error: "Erro ao buscar receitas." });
    }
};

// Buscar receitas por mês/ano
export const getIncomesByMonth = async (req, res) => {
    const user_id = req.user.id;
    const mes = parseInt(req.query.mes);
    const ano = parseInt(req.query.ano);

    if (!mes || !ano) {
        return res.status(400).json({
            error: "Parâmetros 'mes' e 'ano' são obrigatórios.",
        });
    }

    try {
        const result = await fetchIncomesByMonthYear(user_id, mes, ano);
        res.json(result);
    } catch (err) {
        console.error("Erro ao buscar receitas do mês:", err);
        res.status(500).json({ error: "Erro ao buscar receitas do mês." });
    }
};

// Atualizar receita
export const updateIncome = async (req, res) => {
    const userId = req.user.id;
    const incomeId = req.params.id;

    try {
        const updated = await editIncome(incomeId, req.body, userId);
        if (!updated)
            return res.status(404).json({
                error: "Receita não encontrada ou não pertence ao usuário.",
            });
        res.json(updated);
    } catch (err) {
        console.error("Erro ao atualizar receita:", err);
        res.status(500).json({ error: "Erro ao atualizar receita." });
    }
};

// Deletar receita
export const deleteIncome = async (req, res) => {
    const userId = req.user.id;
    const incomeId = req.params.id;

    try {
        const deleted = await removeIncome(incomeId, userId);
        if (!deleted)
            return res.status(404).json({
                error: "Receita não encontrada ou não pertence ao usuário.",
            });
        res.json({ message: "Receita removida com sucesso." });
    } catch (err) {
        console.error("Erro ao excluir receita:", err);
        res.status(500).json({ error: "Erro ao excluir receita." });
    }
};

// Estatísticas mensais
export const getIncomeStats = async (req, res) => {
    const user_id = req.user.id;
    const mes = parseInt(req.query.month);
    const ano = parseInt(req.query.year);
    const categoriaId = req.query.categoryId
        ? parseInt(req.query.categoryId)
        : null;

    if (!mes || !ano) {
        return res
            .status(400)
            .json({ error: "Parâmetros 'mes' e 'ano' são obrigatórios." });
    }

    try {
        const stats = await getIncomesStats(user_id, mes, ano, categoriaId);
        res.json(stats);
    } catch (error) {
        console.error("Erro ao buscar estatísticas de receitas:", error);
        res
            .status(500)
            .json({ error: "Erro ao buscar estatísticas de receitas." });
    }
};

// Total mensal para sumário
export const getTotalIncomesMonth = async (req, res) => {
    const user_id = req.user.id;
    const mes = parseInt(req.query.mes);
    const ano = parseInt(req.query.ano);

    if (!mes || !ano) {
        return res
            .status(400)
            .json({ error: "Parâmetros 'mes' e 'ano' são obrigatórios." });
    }

    try {
        const total = await getTotalReceitasDoMes(user_id, mes, ano);
        res.json({ total });
    } catch (error) {
        console.error("Erro ao buscar total mensal de receitas:", error);
        res
            .status(500)
            .json({ error: "Erro ao buscar total mensal de receitas." });
    }
};

// Total da categoria no mês
export const getTotalByCategoria = async (req, res) => {
    const user_id = req.user.id;
    const category_id = parseInt(req.params.categoryId);
    const mes = new Date().getMonth() + 1;
    const ano = new Date().getFullYear();

    try {
        const total = await getTotalReceitaPorCategoria(
            user_id,
            category_id,
            mes,
            ano
        );
        res.json({ total });
    } catch (error) {
        console.error("Erro ao calcular total da categoria:", error);
        res.status(500).json({ error: "Erro ao calcular total da categoria" });
    }
};

// Resumo por categoria (painel lateral)
export const getResumoCategorias = async (req, res) => {
    const { mes, ano } = req.query;
    const user_id = req.user.id;

    try {
        const { rows } = await pool.query(
            `
      SELECT 
        c.nome,
        c.cor,
        COUNT(i.id) as quantidade,
        SUM(i.quantidade) as total
      FROM incomes i
      JOIN categories c ON c.id = i.category_id
      WHERE i.user_id = $1 
        AND EXTRACT(MONTH FROM i.data) = $2 
        AND EXTRACT(YEAR FROM i.data) = $3
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
    } catch (err) {
        console.error("Erro ao buscar resumo de categorias de receitas:", err);
        res
            .status(500)
            .json({ error: "Erro ao buscar resumo de categorias de receitas." });
    }
};
