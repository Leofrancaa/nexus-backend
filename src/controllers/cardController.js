import {
    addCard, fetchCards, editCard, removeCard,
    getGastoTotalDoCartao, hasCurrentMonthExpenses, hasPastExpenses,
    deleteCardAndExpenses, getSaldoEmAbertoDoCartao
} from "../services/cardService.js";

/* criar cartão */
export const createCard = async (req, res) => {
    const user_id = req.user.id;
    const { nome, tipo, numero, cor, limite, dia_vencimento, dias_fechamento_antes } = req.body;

    if (!numero || numero.length !== 4) {
        return res.status(400).json({ error: "O número do cartão deve conter exatamente 4 dígitos." });
    }
    if (dia_vencimento && (dia_vencimento < 1 || dia_vencimento > 31)) {
        return res.status(400).json({ error: "O dia de vencimento deve estar entre 1 e 31." });
    }
    if (dias_fechamento_antes != null && (dias_fechamento_antes < 1 || dias_fechamento_antes > 31)) {
        return res.status(400).json({ error: "dias_fechamento_antes deve estar entre 1 e 31." });
    }

    try {
        const newCard = await addCard({
            nome, tipo, numero, cor, limite,
            dia_vencimento,
            dias_fechamento_antes: dias_fechamento_antes ?? 10,
            user_id,
        });
        res.status(201).json(newCard);
    } catch (err) {
        console.error("Erro ao criar cartão:", err);
        res.status(500).json({ error: "Erro ao criar cartão." });
    }
};

/* atualizar cartão */
export const updateCard = async (req, res) => {
    const user_id = req.user.id;
    const id = req.params.id;
    const { nome, tipo, numero, cor, limite, dia_vencimento, dias_fechamento_antes } = req.body;

    if (!numero || numero.length !== 4) {
        return res.status(400).json({ error: "O número do cartão deve conter exatamente 4 dígitos." });
    }
    if (dia_vencimento && (dia_vencimento < 1 || dia_vencimento > 31)) {
        return res.status(400).json({ error: "O dia de vencimento deve estar entre 1 e 31." });
    }
    if (dias_fechamento_antes != null && (dias_fechamento_antes < 1 || dias_fechamento_antes > 31)) {
        return res.status(400).json({ error: "dias_fechamento_antes deve estar entre 1 e 31." });
    }

    try {
        // ✅ valida com SALDO EM ABERTO (não com gasto total histórico)
        const saldoEmAberto = await getSaldoEmAbertoDoCartao(id, user_id);
        if (Number(limite) < Number(saldoEmAberto)) {
            return res.status(400).json({
                error: `O novo limite não pode ser menor que o saldo em aberto (faturas não pagas): R$ ${saldoEmAberto.toFixed(2)}`,
            });
        }

        const updatedCard = await editCard(
            id,
            { nome, tipo, numero, cor, limite, dia_vencimento, dias_fechamento_antes },
            user_id
        );
        if (!updatedCard) {
            return res.status(404).json({ error: "Cartão não encontrado ou não pertence ao usuário." });
        }
        res.json(updatedCard);
    } catch (err) {
        console.error("Erro ao atualizar cartão:", err);
        res.status(500).json({ error: "Erro ao atualizar cartão." });
    }
};

export const getCards = async (req, res) => {
    try {
        const cards = await fetchCards(req.user.id);
        res.json(cards);
    } catch (err) {
        console.error("Erro ao buscar cartões:", err);
        res.status(500).json({ error: "Erro ao buscar cartões." });
    }
};

export const deleteCard = async (req, res) => {
    const user_id = req.user.id;
    const card_id = req.params.id;

    try {
        const temDespesaAtual = await hasCurrentMonthExpenses(card_id, user_id);
        const temDespesaPassada = await hasPastExpenses(card_id, user_id);

        if (temDespesaAtual) {
            return res.status(400).json({
                error: "Este cartão possui despesas vinculadas no mês atual e não pode ser excluído."
            });
        }

        if (temDespesaPassada) {
            const deleted = await deleteCardAndExpenses(card_id, user_id);
            if (!deleted) {
                return res.status(404).json({ error: "Cartão não encontrado." });
            }

            return res.json({
                message: "Cartão e todas as despesas anteriores vinculadas a ele foram excluídos com sucesso."
            });
        }

        const deleted = await removeCard(card_id, user_id);
        if (!deleted) {
            return res.status(404).json({ error: "Cartão não encontrado." });
        }

        return res.json({ message: "Cartão removido com sucesso." });
    } catch (err) {
        console.error("Erro ao excluir cartão:", err);
        return res.status(500).json({ error: "Erro ao excluir cartão." });
    }
};
