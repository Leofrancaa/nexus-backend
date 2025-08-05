import { pool } from '../database/index.js';

// 📥 Adicionar receita
export const addIncome = async ({
    tipo,
    quantidade,
    nota,
    data,
    fonte,
    user_id,
    category_id,
    fixo = false, // ✅ novo campo
}) => {
    const result = await pool.query(
        `INSERT INTO incomes (
      tipo, quantidade, nota, data, fonte, user_id, category_id, fixo
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *`,
        [tipo, quantidade, nota, data, fonte, user_id, category_id, fixo]
    );
    return result.rows[0];
};


// 📤 Editar receita
export const editIncome = async (id, updatedData, user_id) => {
    const { tipo, quantidade, nota, data, fonte, category_id } = updatedData;

    const result = await pool.query(
        `UPDATE incomes SET
      tipo = $1,
      quantidade = $2,
      nota = $3,
      data = $4,
      fonte = $5,
      category_id = $6
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
        [tipo, quantidade, nota, data, fonte, category_id, id, user_id]
    );

    return result.rows[0];
};

// ❌ Remover receita
export const removeIncome = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM incomes WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user_id]
    );
    return result.rows[0];
};

// 📅 Buscar receitas por mês e ano
export const fetchIncomesByMonthYear = async (user_id, mes, ano) => {
    const result = await pool.query(
        `SELECT 
      i.*, 
      c.nome AS categoria_nome, 
      c.cor AS cor_categoria
     FROM incomes i
     LEFT JOIN categories c ON i.category_id = c.id
     WHERE i.user_id = $1
     AND EXTRACT(MONTH FROM i.data) = $2
     AND EXTRACT(YEAR FROM i.data) = $3
     ORDER BY i.data DESC`,
        [user_id, mes, ano]
    );
    return result.rows;
};

// 📆 Buscar receitas por faixa de datas
export const fetchIncomesByDateRange = async (user_id, startDate, endDate) => {
    const result = await pool.query(
        `SELECT 
      i.*,
      c.nome AS categoria_nome,
      c.cor AS cor_categoria
     FROM incomes i
     LEFT JOIN categories c ON i.category_id = c.id
     WHERE i.user_id = $1
       AND i.data BETWEEN $2 AND $3
     ORDER BY i.data DESC`,
        [user_id, startDate, endDate]
    );
    return result.rows;
};

// 📊 Estatísticas gerais de receitas
export const getIncomesStats = async (user_id, mes, ano, categoriaId) => {
    let query = `
    SELECT 
      COALESCE(SUM(quantidade), 0) AS total,
      COUNT(*) AS transacoes,
      COALESCE(AVG(quantidade), 0) AS media
    FROM incomes
    WHERE user_id = $1
      AND EXTRACT(MONTH FROM data) = $2
      AND EXTRACT(YEAR FROM data) = $3
  `;
    const params = [user_id, mes, ano];

    if (categoriaId) {
        query += ` AND category_id = $4`;
        params.push(categoriaId);
    }

    const result = await pool.query(query, params);
    return result.rows[0];
};

// 📈 Total de receitas do mês
export const getTotalReceitasDoMes = async (user_id, mes, ano) => {
    const result = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS total
     FROM incomes
     WHERE user_id = $1
       AND EXTRACT(MONTH FROM data) = $2
       AND EXTRACT(YEAR FROM data) = $3`,
        [user_id, mes, ano]
    );

    return parseFloat(result.rows[0].total);
};

// 📊 Total de receitas por categoria no mês
export const getTotalReceitaPorCategoria = async (user_id, category_id, mes, ano) => {
    const result = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS total
     FROM incomes
     WHERE user_id = $1
       AND category_id = $2
       AND EXTRACT(MONTH FROM data) = $3
       AND EXTRACT(YEAR FROM data) = $4`,
        [user_id, category_id, mes, ano]
    );

    return parseFloat(result.rows[0].total);
};

export const getIncomesGroupedByMonth = async (user_id) => {
    const result = await pool.query(
        `SELECT 
      EXTRACT(MONTH FROM data) AS numero_mes,
      SUM(quantidade) AS total
     FROM incomes
     WHERE user_id = $1
     GROUP BY numero_mes
     ORDER BY numero_mes`,
        [user_id]
    );

    const meses = [
        "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
        "Jul", "Ago", "Set", "Out", "Nov", "Dez"
    ];

    const retorno = meses.map((mes, index) => {
        const encontrado = result.rows.find(r => Number(r.numero_mes) === index + 1);
        return {
            mes,
            total: encontrado ? Number(encontrado.total) : 0,
        };
    });

    return retorno;
};
