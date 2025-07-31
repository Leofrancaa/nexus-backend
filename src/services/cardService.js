import { pool } from '../database/index.js';

export const addCard = async ({ nome, tipo, numero, cor, limite, dia_vencimento, user_id }) => {
    const result = await pool.query(
        `INSERT INTO cards (nome, tipo, numero, cor, limite, limite_disponivel, dia_vencimento, user_id)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7)
         RETURNING *`,
        [nome, tipo, numero, cor, limite, dia_vencimento, user_id]
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

export const editCard = async (id, { nome, tipo, numero, cor, limite, dia_vencimento }, user_id) => {
    const gastoTotal = await getGastoTotalDoCartao(id, user_id);
    const limiteDisponivel = limite - gastoTotal;

    const result = await pool.query(
        `UPDATE cards SET
            nome = $1,
            tipo = $2,
            numero = $3,
            cor = $4,
            limite = $5,
            limite_disponivel = $6,
            dia_vencimento = $7
         WHERE id = $8 AND user_id = $9
         RETURNING *`,
        [nome, tipo, numero, cor, limite, limiteDisponivel, dia_vencimento, id, user_id]
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

export const getGastoTotalDoCartao = async (card_id, user_id) => {
    const result = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS total
         FROM expenses
         WHERE card_id = $1 AND user_id = $2`,
        [card_id, user_id]
    );
    return Number(result.rows[0].total);
};
