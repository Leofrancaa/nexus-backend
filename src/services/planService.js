import { pool } from "../database/index.js";

// Criar plano
export const createPlan = async ({ user_id, nome, descricao, meta, prazo }) => {
    const result = await pool.query(
        `INSERT INTO plans (user_id, nome, descricao, meta, prazo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
        [user_id, nome, descricao, meta, prazo]
    );
    return result.rows[0];
};

// Listar planos do usuário
export const getPlansByUser = async (user_id) => {
    const result = await pool.query(
        `SELECT * FROM plans WHERE user_id = $1 ORDER BY created_at DESC`,
        [user_id]
    );
    return result.rows;
};

// Atualizar plano
export const updatePlan = async ({ plan_id, user_id, nome, descricao, meta, prazo }) => {
    const result = await pool.query(
        `UPDATE plans
     SET nome = $1, descricao = $2, meta = $3, prazo = $4, updated_at = NOW()
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
        [nome, descricao, meta, prazo, plan_id, user_id]
    );
    return result.rows[0];
};

// Deletar plano
export const deletePlan = async (plan_id, user_id) => {
    const result = await pool.query(
        `DELETE FROM plans WHERE id = $1 AND user_id = $2 RETURNING *`,
        [plan_id, user_id]
    );
    return result.rows[0];
};


// Adicionar contribuição
export const addContribution = async ({ plan_id, user_id, valor }) => {
    const client = await pool.connect();

    try {
        await client.query("BEGIN");

        // 1. Inserir contribuição
        await client.query(
            `INSERT INTO plan_contributions (plan_id, user_id, valor)
       VALUES ($1, $2, $3)`,
            [plan_id, user_id, valor]
        );

        // 2. Atualizar total_contribuido do plano
        const totalResult = await client.query(
            `UPDATE plans
       SET total_contribuido = total_contribuido + $1
       WHERE id = $2 AND user_id = $3
       RETURNING meta, total_contribuido`,
            [valor, plan_id, user_id]
        );

        const { meta, total_contribuido } = totalResult.rows[0];
        const progresso = (total_contribuido / meta) * 100;

        // 3. Atualizar status com base no progresso
        let status = "Iniciando";
        if (progresso >= 100) status = "Concluído";
        else if (progresso >= 80) status = "Quase lá";
        else if (progresso > 0) status = "Em progresso";

        await client.query(
            `UPDATE plans SET status = $1 WHERE id = $2`,
            [status, plan_id]
        );

        await client.query("COMMIT");

        return { progresso, total_contribuido, status };
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
};
