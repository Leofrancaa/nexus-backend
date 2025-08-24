import { pool } from '../database/index.js';
import { saveExpenseHistory } from '../utils/finance/saveExpenseHistory.js';

/* ======================== helpers ======================== */
function normalize(str = "") {
    return String(str)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function addMonthsSafe(date, n) {
    const d = new Date(date);
    const day = d.getDate();
    d.setMonth(d.getMonth() + n);
    if (d.getDate() < day) d.setDate(0);
    return d;
}

/**
 * Calcula a competência da fatura da compra com base na data da compra,
 * dia de vencimento e quantidade de dias antes do vencimento que a fatura fecha.
 * Ex.: vence dia 15, fecha 10 dias antes => fecha dia 5.
 */
function computeCompetencia({ purchaseDate, dueDay, closeDaysBefore }) {
    const year = purchaseDate.getFullYear();
    const month = purchaseDate.getMonth();

    const thisMonthDue = new Date(year, month, Math.min(Number(dueDay), 28));
    const nextDue =
        purchaseDate <= thisMonthDue
            ? thisMonthDue
            : new Date(year, month + 1, Math.min(Number(dueDay), 28));

    const closeDate = new Date(nextDue);
    closeDate.setDate(closeDate.getDate() - Number(closeDaysBefore));

    // Se a compra foi em/apos o fechamento, cai para a competência do "nextDue".
    // Se foi antes do fechamento, cai na competência anterior.
    const competenciaDate = purchaseDate >= closeDate ? nextDue : addMonthsSafe(nextDue, -1);

    return {
        competencia_mes: competenciaDate.getMonth() + 1,
        competencia_ano: competenciaDate.getFullYear(),
    };
}
/* ====================== fim helpers ====================== */

// ================================
// CORREÇÃO 1: DESPESAS FIXAS NO CARTÃO
// arquivo: src/services/expenseService.js
// ================================

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
        observacoes,
    } = expenseData;

    const baseDate = data ? new Date(`${data}T00:00:00`) : new Date();
    const formattedBaseDate = baseDate.toISOString().split("T")[0];

    const metodoNorm = normalize(metodo_pagamento);
    const isCreditCard = metodoNorm.includes("credito") && card_id && !isNaN(Number(card_id));

    /* ==================== CARTÃO DE CRÉDITO ==================== */
    if (isCreditCard) {
        const cardResult = await pool.query(
            `SELECT limite_disponivel, dia_vencimento, dias_fechamento_antes
         FROM cards
        WHERE id = $1`,
            [card_id]
        );
        if (cardResult.rows.length === 0) {
            throw new Error("Cartão não encontrado.");
        }

        const { limite_disponivel, dia_vencimento, dias_fechamento_antes } = cardResult.rows[0];

        const dataDespesa = new Date(`${(data ?? formattedBaseDate)}T00:00:00`);

        // ✅ calcula competência com base NA DATA DA COMPRA
        const { competencia_mes, competencia_ano } = computeCompetencia({
            purchaseDate: dataDespesa,
            dueDay: Number(dia_vencimento),
            closeDaysBefore: Number(dias_fechamento_antes ?? 10),
        });

        // 🔒 impedir lançamento em competência já paga
        const pago = await pool.query(
            `SELECT 1 FROM card_invoices_payments
        WHERE user_id = $1 AND card_id = $2
          AND competencia_mes = $3 AND competencia_ano = $4`,
            [user_id, card_id, competencia_mes, competencia_ano]
        );
        if (pago.rowCount > 0) {
            throw {
                status: 400,
                message:
                    "Esta fatura já foi paga. Não é possível lançar despesas nessa competência.",
            };
        }

        // 🔒 valida limite no momento do lançamento
        if (Number(quantidade) > Number(limite_disponivel)) {
            throw {
                status: 400,
                message: `Valor da despesa (R$${quantidade}) excede o limite disponível do cartão (R$${limite_disponivel}).`,
            };
        }

        // -------- PARCELADA NO CARTÃO --------
        if (parcelas > 1) {
            const valorParcela = Number(quantidade) / Number(parcelas);

            for (let i = 0; i < parcelas; i++) {
                const parcelaPurchaseDate = addMonthsSafe(dataDespesa, i);
                const comp = computeCompetencia({
                    purchaseDate: parcelaPurchaseDate,
                    dueDay: Number(dia_vencimento),
                    closeDaysBefore: Number(dias_fechamento_antes ?? 10),
                });

                // impedir parcela em competência já paga
                const pagoParcela = await pool.query(
                    `SELECT 1 FROM card_invoices_payments
            WHERE user_id = $1 AND card_id = $2
              AND competencia_mes = $3 AND competencia_ano = $4`,
                    [user_id, card_id, comp.competencia_mes, comp.competencia_ano]
                );
                if (pagoParcela.rowCount > 0) {
                    throw {
                        status: 400,
                        message: `A competência ${String(comp.competencia_mes).padStart(2, "0")}/${comp.competencia_ano} já foi paga. Ajuste a data/parcelas.`,
                    };
                }

                await pool.query(
                    `INSERT INTO expenses (
            metodo_pagamento, tipo, quantidade, fixo, data,
            parcelas, frequencia, user_id, card_id, category_id, observacoes,
            competencia_mes, competencia_ano
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                    [
                        metodo_pagamento,
                        `${tipo} (${i + 1}/${parcelas})`,
                        valorParcela,
                        false,
                        parcelaPurchaseDate.toISOString().split("T")[0],
                        parcelas,
                        frequencia,
                        user_id,
                        card_id,
                        category_id,
                        observacoes || null,
                        comp.competencia_mes,
                        comp.competencia_ano,
                    ]
                );
            }

            // reduz o limite pelo total da compra
            await pool.query(
                `UPDATE cards SET limite_disponivel = limite_disponivel - $1 WHERE id = $2`,
                [quantidade, card_id]
            );

            return {
                message: `Despesa parcelada adicionada (${parcelas}x de R$${(
                    Number(quantidade) / Number(parcelas)
                ).toFixed(2)})`,
                valor_total: Number(quantidade),
            };
        }

        // -------- DESPESA FIXA NO CARTÃO (CORREÇÃO 1) --------
        if (fixo) {
            // Para despesas fixas no cartão, forçar parcelas = 1 (uma parcela por mês)
            const parcelas_fixa = 1;

            // Inserir a despesa do mês atual
            const inserted = await pool.query(
                `INSERT INTO expenses (
            metodo_pagamento, tipo, quantidade, fixo, data,
            parcelas, frequencia, user_id, card_id, category_id, observacoes,
            competencia_mes, competencia_ano
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
          RETURNING *`,
                [
                    metodo_pagamento,
                    tipo,
                    quantidade,
                    true, // 🔥 IMPORTANTE: manter fixo = true
                    formattedBaseDate,
                    parcelas_fixa,
                    frequencia,
                    user_id,
                    card_id,
                    category_id,
                    observacoes || null,
                    competencia_mes,
                    competencia_ano,
                ]
            );

            // 🔁 REPLICAR DESPESA FIXA ATÉ DEZEMBRO (CORREÇÃO 1)
            const diaOriginal = baseDate.getDate();
            const mesOriginal = baseDate.getMonth();
            const ano = baseDate.getFullYear();

            // Função melhorada para ajustar datas (CORREÇÃO 3)
            const ajustarDiaDoMes = (diaOriginal, targetMes, targetAno) => {
                const ultimoDiaTargetMes = new Date(targetAno, targetMes + 1, 0).getDate();

                // Se o dia original é maior que o último dia do mês de destino, 
                // usar o último dia do mês de destino
                return Math.min(diaOriginal, ultimoDiaTargetMes);
            };

            for (let mes = mesOriginal + 1; mes <= 11; mes++) {
                const diaAjustado = ajustarDiaDoMes(diaOriginal, mes, ano);
                const dataReplicada = new Date(ano, mes, diaAjustado);

                // Calcular competência para cada mês
                const compReplicada = computeCompetencia({
                    purchaseDate: dataReplicada,
                    dueDay: Number(dia_vencimento),
                    closeDaysBefore: Number(dias_fechamento_antes ?? 10),
                });

                // Verificar se a competência não está paga
                const pagoReplicada = await pool.query(
                    `SELECT 1 FROM card_invoices_payments
                WHERE user_id = $1 AND card_id = $2
                  AND competencia_mes = $3 AND competencia_ano = $4`,
                    [user_id, card_id, compReplicada.competencia_mes, compReplicada.competencia_ano]
                );

                // Se não estiver paga, inserir
                if (pagoReplicada.rowCount === 0) {
                    await pool.query(
                        `INSERT INTO expenses (
                    metodo_pagamento, tipo, quantidade, fixo, data,
                    parcelas, frequencia, user_id, card_id, category_id, observacoes,
                    competencia_mes, competencia_ano
                  ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
                        [
                            metodo_pagamento,
                            tipo,
                            quantidade,
                            true, // 🔥 IMPORTANTE: manter fixo = true
                            dataReplicada.toISOString().split("T")[0],
                            parcelas_fixa,
                            frequencia,
                            user_id,
                            card_id,
                            category_id,
                            observacoes || null,
                            compReplicada.competencia_mes,
                            compReplicada.competencia_ano,
                        ]
                    );
                }
            }

            // Reduzir limite disponível apenas pelo valor do mês atual
            // As futuras competências serão descontadas quando chegarem
            await pool.query(
                `UPDATE cards SET limite_disponivel = limite_disponivel - $1 WHERE id = $2`,
                [quantidade, card_id]
            );

            return inserted.rows[0];
        }

        // -------- À VISTA NO CARTÃO --------
        const inserted = await pool.query(
            `INSERT INTO expenses (
        metodo_pagamento, tipo, quantidade, fixo, data,
        parcelas, frequencia, user_id, card_id, category_id, observacoes,
        competencia_mes, competencia_ano
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
            [
                metodo_pagamento,
                tipo,
                quantidade,
                false,
                formattedBaseDate,
                null,
                frequencia,
                user_id,
                card_id,
                category_id,
                observacoes || null,
                competencia_mes,
                competencia_ano,
            ]
        );

        await pool.query(
            `UPDATE cards SET limite_disponivel = limite_disponivel - $1 WHERE id = $2`,
            [quantidade, card_id]
        );

        return inserted.rows[0];
    }
    /* ================== FIM CARTÃO DE CRÉDITO ================== */

    /* ===================== DESPESA COMUM ===================== */
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

    // 🔁 Despesa fixa replicada até dezembro (CORRIGIDA - CORREÇÃO 3)
    if (fixo) {
        const diaOriginal = baseDate.getDate();
        const mesOriginal = baseDate.getMonth();
        const ano = baseDate.getFullYear();

        // Função melhorada para ajustar datas
        const ajustarDiaDoMes = (diaOriginal, targetMes, targetAno) => {
            const ultimoDiaTargetMes = new Date(targetAno, targetMes + 1, 0).getDate();
            return Math.min(diaOriginal, ultimoDiaTargetMes);
        };

        for (let mes = mesOriginal + 1; mes <= 11; mes++) {
            const diaAjustado = ajustarDiaDoMes(diaOriginal, mes, ano);
            const dataReplicada = `${ano}-${String(mes + 1).padStart(2, "0")}-${String(diaAjustado).padStart(2, "0")}`;

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
                    dataReplicada,
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

    // 🔒 Bloqueio de edição para despesas no cartão de crédito
    const metodoOrigNorm = normalize(original.metodo_pagamento);
    if (metodoOrigNorm.includes("credito")) {
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

    const metodoNorm = normalize(metodo_pagamento);

    // 🔒 Se for parcelada no cartão de crédito, exclui todas da mesma série
    if (metodoNorm.includes("credito") && parcelas > 1 && card_id) {
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
        if (metodoNorm.includes("credito") && card_id) {
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

    if (item && normalize(item.metodo_pagamento).includes("credito") && item.card_id) {
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
