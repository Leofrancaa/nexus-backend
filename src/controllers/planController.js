import {
    createPlan,
    getPlansByUser,
    updatePlan,
    deletePlan,
    addContribution,
} from "../services/planService.js";

// POST /plans
export const handleCreatePlan = async (req, res) => {
    try {
        const { nome, descricao, meta, prazo } = req.body;
        const user_id = req.user.id;

        if (!nome || !meta || !prazo) {
            return res.status(400).json({ message: "Campos obrigatórios faltando" });
        }

        const plan = await createPlan({ user_id, nome, descricao, meta, prazo });
        res.status(201).json(plan);
    } catch (err) {
        res.status(500).json({ message: "Erro ao criar plano" });
    }
};

// GET /plans
export const handleGetPlans = async (req, res) => {
    try {
        const user_id = req.user.id;
        const plans = await getPlansByUser(user_id);
        res.json(plans);
    } catch (err) {
        res.status(500).json({ message: "Erro ao buscar planos" });
    }
};

// PUT /plans/:id
export const handleUpdatePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const { nome, descricao, meta, prazo } = req.body;

        const plan = await updatePlan({ plan_id: id, user_id, nome, descricao, meta, prazo });

        if (!plan) return res.status(404).json({ message: "Plano não encontrado" });

        res.json(plan);
    } catch (err) {
        res.status(500).json({ message: "Erro ao atualizar plano" });
    }
};

// DELETE /plans/:id
export const handleDeletePlan = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;

        const plan = await deletePlan(id, user_id);
        if (!plan) return res.status(404).json({ message: "Plano não encontrado" });

        res.json({ message: "Plano deletado com sucesso" });
    } catch (err) {
        res.status(500).json({ message: "Erro ao deletar plano" });
    }
};


// POST /plans/:id/contribute
export const handleAddContribution = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user.id;
        const { valor } = req.body;

        if (!valor || valor <= 0) {
            return res.status(400).json({ message: "Valor inválido" });
        }

        const result = await addContribution({ plan_id: id, user_id, valor });
        res.status(201).json(result);
    } catch (err) {
        console.error("Erro ao contribuir para plano:", err);
        res.status(500).json({ message: "Erro ao contribuir para plano" });
    }
};