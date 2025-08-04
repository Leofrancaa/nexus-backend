import { pool } from '../database/index.js';

export const addInvestment = async ({ ativo, descricao, quantidade, valor_investido, data, observacoes, user_id }) => {
    const result = await pool.query(
        `INSERT INTO investments (ativo, descricao, quantidade, valor_investido, data, observacoes, user_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
        [ativo, descricao, quantidade, valor_investido, data, observacoes, user_id]
    );
    return result.rows[0];
};

export const fetchInvestmentsFiltered = async ({ user_id, startDate, endDate, asset }) => {
    const params = [user_id, startDate, endDate];
    let query = `
    SELECT * FROM investments
    WHERE user_id = $1
    AND data BETWEEN $2 AND $3
  `;

    if (asset && asset !== 'todos') {
        query += ` AND ativo = $4`;
        params.push(asset);
    }

    query += ` ORDER BY data DESC`;

    const result = await pool.query(query, params);
    return result.rows;
};

export const fetchInvestmentStats = async ({ user_id, startDate, endDate, asset }) => {
    const params = [user_id, startDate, endDate];
    let query = `
    SELECT
      COUNT(*) AS total_simulacoes,
      SUM(valor_investido) AS total_investido,
      SUM(quantidade) AS total_quantidade,
      MAX(data) AS ultima_data
    FROM investments
    WHERE user_id = $1
    AND data BETWEEN $2 AND $3
  `;

    if (asset && asset !== 'todos') {
        query += ` AND ativo = $4`;
        params.push(asset);
    }

    const result = await pool.query(query, params);
    return result.rows[0];
};
