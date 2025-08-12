import { pool } from '../database/index.js';

/**
 * Total histórico gasto no cartão (todas as despesas).
 * Mantido para compat, mas NÃO deve ser usado para recalcular limite.
 */
export const getGastoTotalDoCartao = async (card_id, user_id) => {
    const result = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS total
       FROM expenses
      WHERE card_id = $1 AND user_id = $2`,
        [card_id, user_id]
    );
    return Number(result.rows[0].total);
};

/**
 * Saldo em aberto do cartão:
 * soma apenas despesas de competências QUE NÃO foram pagas
 * (não existe registro correspondente em card_invoices_payments).
 */
export const getSaldoEmAbertoDoCartao = async (card_id, user_id) => {
    const result = await pool.query(
        `
    SELECT COALESCE(SUM(e.quantidade), 0) AS aberto
      FROM expenses e
      LEFT JOIN card_invoices_payments p
        ON p.user_id = e.user_id
       AND p.card_id = e.card_id
       AND p.competencia_mes = e.competencia_mes
       AND p.competencia_ano = e.competencia_ano
     WHERE e.user_id = $1
       AND e.card_id = $2
       AND p.id IS NULL
    `,
        [user_id, card_id]
    );
    return Number(result.rows[0].aberto);
};

export const addCard = async ({
    nome, tipo, numero, cor, limite, dia_vencimento, dias_fechamento_antes, user_id
}) => {
    const result = await pool.query(
        `INSERT INTO cards (
        nome, tipo, numero, cor, limite, limite_disponivel,
        dia_vencimento, dias_fechamento_antes, user_id
     )
     VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8)
     RETURNING *`,
        [nome, tipo, numero, cor, limite, dia_vencimento, dias_fechamento_antes ?? 10, user_id]
    );
    return result.rows[0];
};

export const fetchCards = async (user_id) => {
    const result = await pool.query(
        `SELECT 
        c.*,
        COALESCE(SUM(e.quantidade), 0) AS gasto_total,
        CASE
          WHEN CURRENT_DATE <= make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, c.dia_vencimento)
          THEN make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int, c.dia_vencimento)
          ELSE make_date(EXTRACT(YEAR FROM CURRENT_DATE)::int, EXTRACT(MONTH FROM CURRENT_DATE)::int + 1, c.dia_vencimento)
        END AS proximo_vencimento
     FROM cards c
     LEFT JOIN expenses e ON e.card_id = c.id AND e.user_id = $1
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.id DESC`,
        [user_id]
    );

    return result.rows.map(card => ({
        ...card,
        limite: Number(card.limite),
        limite_disponivel: Number(card.limite_disponivel),
        gasto_total: Number(card.gasto_total),
    }));
};

/**
 * Edita apenas: nome, tipo, numero, cor, limite e limite_disponivel.
 * NÃO altera dia_vencimento nem dias_fechamento_antes.
 */
export const editCard = async (id, {
    nome, tipo, numero, cor, limite, dia_vencimento, dias_fechamento_antes // <- mantidos na assinatura, mas ignorados
}, user_id) => {
    // recalcula com base apenas no SALDO EM ABERTO (competências não pagas)
    const saldoEmAberto = await getSaldoEmAbertoDoCartao(id, user_id);
    const novoLimiteDisponivel = Math.max(Number(limite) - Number(saldoEmAberto), 0);

    const result = await pool.query(
        `UPDATE cards SET
        nome = $1,
        tipo = $2,
        numero = $3,
        cor = $4,
        limite = $5,
        limite_disponivel = $6
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
        [nome, tipo, numero, cor, limite, novoLimiteDisponivel, id, user_id]
    );
    return result.rows[0];
};

export const removeCard = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM cards WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user_id]
    );
    return result.rows[0];
};

export const hasCurrentMonthExpenses = async (card_id, user_id) => {
    const result = await pool.query(
        `SELECT COUNT(*) FROM expenses
      WHERE card_id = $1 AND user_id = $2
        AND EXTRACT(MONTH FROM data) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(YEAR FROM data) = EXTRACT(YEAR FROM CURRENT_DATE)`,
        [card_id, user_id]
    );
    return Number(result.rows[0].count) > 0;
};

export const hasPastExpenses = async (card_id, user_id) => {
    const result = await pool.query(
        `SELECT COUNT(*) FROM expenses
      WHERE card_id = $1 AND user_id = $2
        AND (EXTRACT(MONTH FROM data) != EXTRACT(MONTH FROM CURRENT_DATE)
          OR EXTRACT(YEAR FROM data) != EXTRACT(YEAR FROM CURRENT_DATE))`,
        [card_id, user_id]
    );
    return Number(result.rows[0].count) > 0;
};

export const deleteCardAndExpenses = async (card_id, user_id) => {
    // Exclui todas as despesas vinculadas ao cartão
    await pool.query(
        `DELETE FROM expenses WHERE card_id = $1 AND user_id = $2`,
        [card_id, user_id]
    );

    // Exclui o cartão
    const result = await pool.query(
        `DELETE FROM cards WHERE id = $1 AND user_id = $2 RETURNING *`,
        [card_id, user_id]
    );

    return result.rows[0];
};
