import { pool } from '../database/index.js'

export const addCategory = async ({ nome, cor, tipo, parent_id, user_id }) => {
    const result = await pool.query(
        `INSERT INTO categories (nome, cor, tipo, parent_id, user_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [nome, cor, tipo, parent_id, user_id]
    )
    return result.rows[0]
}

export const fetchCategories = async (user_id, tipo) => {
    let query = `
        SELECT * FROM categories
        WHERE user_id = $1
    `;
    const params = [user_id];

    if (tipo === 'despesa' || tipo === 'receita') {
        query += ` AND tipo = $2`;
        params.push(tipo);
    }

    query += ` ORDER BY parent_id NULLS FIRST, nome`;

    const result = await pool.query(query, params);
    return result.rows;
};

export const editCategory = async (id, { nome, cor, tipo, parent_id }, user_id) => {
    const result = await pool.query(
        `UPDATE categories SET
      nome = $1,
      cor = $2,
      tipo = $3,
      parent_id = $4
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
        [nome, cor, tipo, parent_id, id, user_id]
    )
    return result.rows[0]
}

export const removeCategory = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM categories
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
        [id, user_id]
    )
    return result.rows[0]
}
