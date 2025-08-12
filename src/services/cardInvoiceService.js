import { pool } from '../database/index.js';

function addMonthsSafe(date, n) {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + n);
    if (d.getDate() < day) d.setDate(0);
    return d;
}

export async function payCardInvoice({ user_id, card_id, mes, ano }) {
    // pega config do cartão
    const cr = await pool.query(
        `SELECT dia_vencimento, dias_fechamento_antes, limite_disponivel
       FROM cards
      WHERE id = $1 AND user_id = $2`,
        [card_id, user_id]
    );
    if (cr.rowCount === 0) {
        const e = new Error("Cartão não encontrado.");
        e.status = 404;
        throw e;
    }

    const dueDay = Number(cr.rows[0].dia_vencimento);
    const closeBefore = Number(cr.rows[0].dias_fechamento_antes ?? 10);

    // determinar competência "vigente" caso não venha explícita
    let competencia_mes = mes ? Number(mes) : null;
    let competencia_ano = ano ? Number(ano) : null;

    const now = new Date();
    if (!competencia_mes || !competencia_ano) {
        const thisMonthDue = new Date(now.getFullYear(), now.getMonth(), Math.min(dueDay, 28));
        const nextDue = (now <= thisMonthDue)
            ? thisMonthDue
            : new Date(now.getFullYear(), now.getMonth() + 1, Math.min(dueDay, 28));
        competencia_mes = nextDue.getMonth() + 1;
        competencia_ano = nextDue.getFullYear();
    }

    // data de vencimento e fechamento da competência escolhida
    const dueDate = new Date(competencia_ano, competencia_mes - 1, Math.min(dueDay, 28));
    const closeDate = new Date(dueDate);
    closeDate.setDate(closeDate.getDate() - closeBefore);

    // só pode pagar após o FECHAMENTO
    if (now < closeDate) {
        const e = new Error(
            `Fatura ${String(competencia_mes).padStart(2, "0")}/${competencia_ano} ainda não fechou. Fechamento em ${closeDate.toISOString().slice(0, 10)}.`
        );
        e.status = 400;
        throw e;
    }

    // não permitir pagar duas vezes
    const already = await pool.query(
        `SELECT 1 FROM card_invoices_payments
      WHERE user_id = $1 AND card_id = $2
        AND competencia_mes = $3 AND competencia_ano = $4`,
        [user_id, card_id, competencia_mes, competencia_ano]
    );
    if (already.rowCount > 0) {
        const e = new Error("Esta fatura já foi paga.");
        e.status = 400;
        throw e;
    }

    // soma despesas daquele ciclo (por competência)
    const sum = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS total
       FROM expenses
      WHERE user_id = $1 AND card_id = $2
        AND competencia_mes = $3 AND competencia_ano = $4`,
        [user_id, card_id, competencia_mes, competencia_ano]
    );
    const total = Number(sum.rows[0].total) || 0;

    // devolve limite
    await pool.query(
        `UPDATE cards
        SET limite_disponivel = limite_disponivel + $1
      WHERE id = $2 AND user_id = $3`,
        [total, card_id, user_id]
    );

    // registra pagamento (idempotência)
    await pool.query(
        `INSERT INTO card_invoices_payments
      (user_id, card_id, competencia_mes, competencia_ano, amount_paid)
     VALUES ($1,$2,$3,$4,$5)`,
        [user_id, card_id, competencia_mes, competencia_ano, total]
    );

    return { competencia_mes, competencia_ano, total_devolvido: total, fechamento_em: closeDate };
}
