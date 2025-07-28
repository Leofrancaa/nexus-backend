import { pool } from '../../database/index.js'

export const getCartoesEstourados = async (user_id) => {
    const result = await pool.query(
        `SELECT c.id, c.nome, c.limite, COALESCE(SUM(e.quantidade), 0) AS total_gasto
     FROM cards c
     LEFT JOIN expenses e ON c.id = e.card_id AND e.user_id = $1
     WHERE c.user_id = $1
     GROUP BY c.id
     HAVING COALESCE(SUM(e.quantidade), 0) > c.limite`,
        [user_id]
    )
    return result.rows
}