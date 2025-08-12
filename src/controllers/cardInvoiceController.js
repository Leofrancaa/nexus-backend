import { payCardInvoice } from '../services/cardInvoiceService.js';

export const payInvoice = async (req, res) => {
    const user_id = req.user.id;
    const card_id = Number(req.params.id);
    const mes = req.body?.mes ? Number(req.body.mes) : null;
    const ano = req.body?.ano ? Number(req.body.ano) : null;

    try {
        const result = await payCardInvoice({ user_id, card_id, mes, ano });
        return res.json({
            message: "Fatura paga e limite atualizado.",
            ...result,
        });
    } catch (err) {
        console.error("Erro ao pagar fatura:", err);
        return res
            .status(err.status || 500)
            .json({ error: err.message || "Erro ao pagar fatura." });
    }
};
