import { pool } from "../database/index.js";

export const addThreshold = async (threshold) => {
    const { user_id, category_id, valor } = threshold;

    const result = await pool.query(
        `INSERT INTO thresholds (
      user_id, category_id, valor
    ) VALUES ($1, $2, $3)
    ON CONFLICT (user_id, category_id)
    DO UPDATE SET valor = EXCLUDED.valor
    RETURNING *`,
        [user_id, category_id, valor]
    );

    return result.rows[0];
};

export const fetchThresholdsByUser = async (user_id) => {
    const result = await pool.query(
        `SELECT t.*,
            c.id AS categoria_id,
            c.nome AS categoria_nome,
            c.cor AS categoria_cor,
            c.tipo AS categoria_tipo
     FROM thresholds t
     JOIN categories c ON t.category_id = c.id
     WHERE t.user_id = $1
     ORDER BY t.category_id`,
        [user_id]
    );

    return result.rows.map((row) => ({
        id: row.id,
        category_id: row.category_id,
        valor: parseFloat(row.valor),
        categoria: {
            id: row.categoria_id,
            nome: row.categoria_nome,
            cor: row.categoria_cor,
            tipo: row.categoria_tipo,
        },
    }));
};

export const editThreshold = async (id, updatedData, user_id) => {
    const { category_id, valor } = updatedData;

    const result = await pool.query(
        `UPDATE thresholds SET
      category_id = $1,
      valor = $2
     WHERE id = $3 AND user_id = $4
     RETURNING *`,
        [category_id, valor, id, user_id]
    );

    return result.rows[0];
};

export const removeThreshold = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM thresholds WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user_id]
    );

    return result.rows[0];
};
