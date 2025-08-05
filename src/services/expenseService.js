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
        observacoes, // ✅ novo campo
    } = expenseData;

    const baseDate = data
        ? new Date(`${data}T00:00:00`)
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

    // 🔁 Parcelada
    if (metodo_pagamento === 'cartao de credito' && parcelas > 1 && card_id) {
        const valorParcela = quantidade / parcelas;

        for (let i = 0; i < parcelas; i++) {
            const parcelaDate = new Date(baseDate);
            parcelaDate.setMonth(parcelaDate.getMonth() + i);

            await pool.query(
                `INSERT INTO expenses (
          metodo_pagamento, tipo, quantidade, fixo, data,
          parcelas, frequencia, user_id, card_id, category_id, observacoes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
                    observacoes || null,
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

    // 🔁 Despesa comum
    const result = await pool.query(
        `INSERT INTO expenses (
      metodo_pagamento, tipo, quantidade, fixo, data,
      parcelas, frequencia, user_id, card_id, category_id, observacoes
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
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
            observacoes || null,
        ]
    );

    const baseExpense = result.rows[0];

    if (metodo_pagamento === 'cartao de credito' && card_id) {
        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel - $1 WHERE id = $2`,
            [quantidade, card_id]
        );
    }

    // 🔁 Despesa fixa replicada até dezembro
    if (fixo) {
        const diaOriginal = baseDate.getDate();
        const mesOriginal = baseDate.getMonth(); // 0-11
        const ano = baseDate.getFullYear();

        const diasNoMesOriginal = new Date(ano, mesOriginal + 1, 0).getDate();
        const ehUltimoDiaMes = diaOriginal === diasNoMesOriginal;

        for (let mes = mesOriginal + 1; mes <= 11; mes++) {
            const diasNoMesAlvo = new Date(ano, mes + 1, 0).getDate();

            const diaParaInserir = ehUltimoDiaMes
                ? diasNoMesAlvo
                : diaOriginal > diasNoMesAlvo
                    ? null
                    : diaOriginal;

            if (!diaParaInserir) continue;

            const data = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaParaInserir).padStart(2, "0")}`;

            await pool.query(
                `INSERT INTO expenses (
          metodo_pagamento, tipo, quantidade, fixo, data,
          parcelas, frequencia, user_id, card_id, category_id, observacoes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
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
                    observacoes || null,
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
        `SELECT * FROM expenses WHERE id = $1 AND user_id = $2`,
        [id, user_id]
    );

    if (current.rowCount === 0) return null;

    const original = current.rows[0];

    // 🔒 Bloqueio de edição para despesas no cartão
    if (original.metodo_pagamento === "cartao de credito") {
        throw {
            status: 400,
            message: "Despesas no cartão de crédito não podem ser editadas.",
        };
    }

    await saveExpenseHistory({
        expense_id: id,
        user_id,
        tipo: original.tipo,
        alteracao: original,
    });

    const novaData = new Date(data.data);
    const ano = novaData.getFullYear();

    // Atualiza a despesa atual
    const updatedMain = await pool.query(
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
            data.parcelas || null,
            data.fixo || false,
            data.frequencia || null,
            data.card_id || null,
            data.category_id || null,
            id,
            user_id,
        ]
    );

    // Atualiza subsequentes se for fixa
    if (original.fixo) {
        const result = await pool.query(
            `UPDATE expenses
       SET tipo = $1,
           quantidade = $2,
           metodo_pagamento = $3,
           parcelas = $4,
           frequencia = $5,
           card_id = $6,
           category_id = $7
       WHERE user_id = $8
         AND tipo = $9
         AND fixo = true
         AND EXTRACT(YEAR FROM data) = $10
         AND DATE(data) > DATE($11)
       RETURNING *`,
            [
                data.tipo,
                data.quantidade,
                data.metodo_pagamento,
                data.parcelas || null,
                data.frequencia || null,
                data.card_id || null,
                data.category_id || null,
                user_id,
                original.tipo,
                ano,
                data.data,
            ]
        );

        console.log("Atualizadas subsequentes:", result.rowCount);
    }

    return updatedMain.rows[0];
};
export const removeExpense = async (id, user_id) => {
    const result = await pool.query(
        `SELECT * FROM expenses WHERE id = $1 AND user_id = $2`,
        [id, user_id]
    );

    if (result.rowCount === 0) return null;

    const expense = result.rows[0];

    const {
        tipo,
        fixo,
        metodo_pagamento,
        card_id,
        quantidade,
        parcelas,
    } = expense;

    // 🔒 Se for parcelada no cartão de crédito, exclui todas da mesma série
    if (metodo_pagamento === "cartao de credito" && parcelas > 1 && card_id) {
        const parcelasToRemove = await pool.query(
            `DELETE FROM expenses
       WHERE user_id = $1 AND tipo LIKE $2 AND card_id = $3 AND parcelas = $4
       RETURNING *`,
            [user_id, `${tipo.split(" (")[0]}%`, card_id, parcelas]
        );

        const total = parcelasToRemove.rows.reduce((sum, e) => sum + Number(e.quantidade), 0);

        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel + $1
       WHERE id = $2 AND user_id = $3`,
            [total, card_id, user_id]
        );

        return parcelasToRemove.rows;
    }

    // 🔁 Se for despesa fixa (de qualquer tipo)
    if (fixo) {
        const removidas = await pool.query(
            `DELETE FROM expenses WHERE user_id = $1 AND tipo = $2 AND fixo = true RETURNING *`,
            [user_id, tipo]
        );

        // Se for cartão de crédito, devolver total removido
        if (metodo_pagamento === "cartao de credito" && card_id) {
            const total = removidas.rows.reduce((sum, e) => sum + Number(e.quantidade), 0);

            await pool.query(
                `UPDATE cards SET limite_disponivel = limite_disponivel + $1
         WHERE id = $2 AND user_id = $3`,
                [total, card_id, user_id]
            );
        }

        return removidas.rows;
    }

    // 🔁 Caso comum (não parcelada e não fixa)
    const deleted = await pool.query(
        `DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING *`,
        [id, user_id]
    );

    const item = deleted.rows[0];

    if (
        item &&
        item.metodo_pagamento === "cartao de credito" &&
        item.card_id
    ) {
        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel + $1
       WHERE id = $2 AND user_id = $3`,
            [item.quantidade, item.card_id, user_id]
        );
    }

    return item;
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


export const getDespesasStats = async (user_id, mes, ano, categoriaId) => {
    let query = `
    SELECT 
      COALESCE(SUM(quantidade), 0) AS total,
      COUNT(*) FILTER (WHERE fixo = true) AS fixas,
      COUNT(*) AS transacoes,
      COALESCE(AVG(quantidade), 0) AS media
    FROM expenses
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

export const getExpensesGroupedByMonth = async (user_id) => {
    const result = await pool.query(
        `SELECT 
      EXTRACT(MONTH FROM data) AS numero_mes,
      SUM(quantidade) AS total
     FROM expenses
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
