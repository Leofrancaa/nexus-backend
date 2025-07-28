import { pool } from '../../database/index.js'

export const getCartoesEstourados = async (user_id) => {
    const result = await pool.query(
        `SELECT 
            c.id, 
            c.nome, 
            c.limite 
         FROM cards c
         LEFT JOIN expenses e 
           ON c.id = e.card_id AND e.user_id = $1
         WHERE c.user_id = $1 AND c.limite::numeric <= 200
         GROUP BY c.id, c.nome, c.limite`,
        [user_id]
    )
    return result.rows
}
