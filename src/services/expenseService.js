import { pool } from '../database/index.js';
import { saveExpenseHistory } from '../utils/finance/saveExpenseHistory.js';

export const addExpense = async (expenseData) => {
    const {
        metodo_pagamento,
        tipo,
        quantidade,
        fixo = false,
        data,
        parcelas,
        frequencia,
        user_id,
        card_id,
        category_id,
    } = expenseData;

    const baseDate = data
        ? new Date(`${data}T00:00:00`)  // força dia correto sem risco de fuso
        : new Date();

    const formattedBaseDate = baseDate.toISOString().split('T')[0];

    if (metodo_pagamento === 'cartao de credito' && card_id) {
        const cardResult = await pool.query(
            `SELECT limite_disponivel FROM cards WHERE id = $1`,
            [card_id]
        );

        if (cardResult.rows.length === 0) {
            throw new Error('Cartão não encontrado.');
        }

        const limiteDisponivel = parseFloat(cardResult.rows[0].limite_disponivel);

        if (quantidade > limiteDisponivel) {
            throw {
                status: 400,
                message: `Valor da despesa (R$${quantidade}) excede o limite disponível do cartão (R$${limiteDisponivel}).`,
            };
        }
    }

    // Parcelada
    if (metodo_pagamento === 'cartao de credito' && parcelas > 1 && card_id) {
        const valorParcela = quantidade / parcelas;

        for (let i = 0; i < parcelas; i++) {
            const parcelaDate = new Date(baseDate);
            parcelaDate.setMonth(parcelaDate.getMonth() + i);

            await pool.query(
                `INSERT INTO expenses (
          metodo_pagamento, tipo, quantidade, fixo, data,
          parcelas, frequencia, user_id, card_id, category_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    metodo_pagamento,
                    `${tipo} (${i + 1}/${parcelas})`,
                    valorParcela,
                    false,
                    parcelaDate.toISOString().split("T")[0],
                    parcelas,
                    frequencia,
                    user_id,
                    card_id,
                    category_id,
                ]
            );
        }

        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel - $1 WHERE id = $2`,
            [quantidade, card_id]
        );

        return {
            message: `Despesa parcelada adicionada (${parcelas}x de R$${valorParcela.toFixed(2)})`,
            valor_total: quantidade,
        };
    }

    const result = await pool.query(
        `INSERT INTO expenses (
      metodo_pagamento, tipo, quantidade, fixo, data,
      parcelas, frequencia, user_id, card_id, category_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *`,
        [
            metodo_pagamento,
            tipo,
            quantidade,
            fixo,
            formattedBaseDate,
            parcelas,
            frequencia,
            user_id,
            card_id,
            category_id,
        ]
    );

    const baseExpense = result.rows[0];

    if (metodo_pagamento === 'cartao de credito' && card_id) {
        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel - $1 WHERE id = $2`,
            [quantidade, card_id]
        );
    }

    console.log("=== DESPESA FIXA ===");
    console.log("Data base:", baseDate.toISOString());
    console.log("Dia:", baseDate.getDate());
    console.log("Mês:", baseDate.getMonth());
    console.log("Ano:", baseDate.getFullYear());


    if (fixo) {
        const diaOriginal = baseDate.getDate();
        const mesOriginal = baseDate.getMonth(); // 0-11
        const ano = baseDate.getFullYear();

        const diasNoMesOriginal = new Date(ano, mesOriginal + 1, 0).getDate();
        const ehUltimoDiaMes = diaOriginal === diasNoMesOriginal;

        for (let mes = mesOriginal + 1; mes <= 11; mes++) {
            const diasNoMesAlvo = new Date(ano, mes + 1, 0).getDate();

            const diaParaInserir = ehUltimoDiaMes
                ? diasNoMesAlvo // se for último dia do mês original, replicar no último
                : diaOriginal > diasNoMesAlvo
                    ? null // se o mês não tem esse dia, pula
                    : diaOriginal;

            if (!diaParaInserir) continue;

            const data = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaParaInserir).padStart(2, "0")}`;

            await pool.query(
                `INSERT INTO expenses (
        metodo_pagamento, tipo, quantidade, fixo, data,
        parcelas, frequencia, user_id, card_id, category_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
                [
                    metodo_pagamento,
                    tipo,
                    quantidade,
                    true,
                    data,
                    parcelas,
                    frequencia,
                    user_id,
                    card_id,
                    category_id,
                ]
            );
        }
    }






    return baseExpense;
};

export const fetchExpensesByMonthYear = async (userId, mes, ano) => {
    const result = await pool.query(
        `SELECT 
        e.*, 
        c.nome AS categoria_nome, 
        c.cor AS cor_categoria
     FROM expenses e
     LEFT JOIN categories c ON e.category_id = c.id
     WHERE e.user_id = $1
       AND EXTRACT(MONTH FROM e.data) = $2
       AND EXTRACT(YEAR FROM e.data) = $3
     ORDER BY e.data DESC`,
        [userId, mes, ano]
    );

    return result.rows;
};


export const fetchExpensesByDateRange = async (user_id, startDate, endDate) => {
    const result = await pool.query(
        `SELECT 
  e.*, 
  c.id AS category_id,
  c.nome AS categoria_nome, 
  c.cor AS cor_categoria
FROM expenses e
LEFT JOIN categories c ON e.category_id = c.id
WHERE e.user_id = $1
  AND e.data BETWEEN $2 AND $3
ORDER BY e.data DESC
`,
        [user_id, startDate, endDate]
    );

    return result.rows;
};

export const editExpense = async (id, data, user_id) => {
    const current = await pool.query(
        'SELECT * FROM expenses WHERE id = $1 AND user_id = $2',
        [id, user_id]
    );

    if (current.rowCount === 0) return null;

    await saveExpenseHistory({
        expense_id: id,
        user_id,
        tipo: current.rows[0].tipo,
        alteracao: current.rows[0]
    });

    const updated = await pool.query(
        `UPDATE expenses SET 
      tipo = $1, 
      quantidade = $2, 
      data = $3,
      metodo_pagamento = $4,
      parcelas = $5,
      fixo = $6,
      frequencia = $7,
      card_id = $8,
      category_id = $9
     WHERE id = $10 AND user_id = $11
     RETURNING *`,
        [
            data.tipo,
            data.quantidade,
            data.data,
            data.metodo_pagamento,
            data.parcelas,
            data.fixo,
            data.frequencia,
            data.card_id,
            data.category_id,
            id,
            user_id
        ]
    );

    return updated.rows[0];
};

export const removeExpense = async (id, user_id) => {
    const result = await pool.query(
        `DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user_id]
    );

    return result.rows[0];
};

export const getTotalPorCategoria = async (user_id, category_id, mes, ano) => {
    const result = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS total
     FROM expenses
     WHERE user_id = $1
       AND category_id = $2
       AND EXTRACT(MONTH FROM data) = $3
       AND EXTRACT(YEAR FROM data) = $4`,
        [user_id, category_id, mes, ano]
    );

    return parseFloat(result.rows[0].total);
};

export const getTotalDespesasDoMes = async (user_id, mes, ano) => {
    const result = await pool.query(
        `SELECT COALESCE(SUM(quantidade), 0) AS total
         FROM expenses
         WHERE user_id = $1
         AND EXTRACT(MONTH FROM data) = $2
         AND EXTRACT(YEAR FROM data) = $3`,
        [user_id, mes, ano]
    );

    return parseFloat(result.rows[0].total);
};


export const getDespesasStats = async (user_id, mes, ano) => {
    const result = await pool.query(
        `SELECT 
            COALESCE(SUM(quantidade), 0) AS total,
            COUNT(*) FILTER (WHERE fixo = true) AS fixas,
            COUNT(*) AS transacoes,
            COALESCE(AVG(quantidade), 0) AS media
        FROM expenses
        WHERE user_id = $1
          AND EXTRACT(MONTH FROM data) = $2
          AND EXTRACT(YEAR FROM data) = $3`,
        [user_id, mes, ano]
    );

    return result.rows[0];
};
