import { addInvestment, fetchInvestmentsFiltered, fetchInvestmentStats } from '../services/investmentService.js';
import yahooFinance from 'yahoo-finance2';

export const createInvestment = async (req, res) => {
    const user_id = req.user.id;
    try {
        const investment = await addInvestment({ ...req.body, user_id });
        res.status(201).json(investment);
    } catch (err) {
        console.error('Erro ao criar investimento:', err);
        res.status(500).json({ error: 'Erro ao criar investimento.' });
    }
};

export const getInvestments = async (req, res) => {
    const user_id = req.user.id;
    const { start_date, end_date, month, year, asset } = req.query;

    let startDate = start_date;
    let endDate = end_date;

    // se mês e ano vierem, calcula o range
    if (month && year) {
        const pad = (n) => String(n).padStart(2, '0');
        const mes = parseInt(month);
        const ano = parseInt(year);
        startDate = `${ano}-${pad(mes)}-01`;
        endDate = new Date(ano, mes, 0).toISOString().split('T')[0];
    }

    if (!startDate || !endDate) {
        return res.status(400).json({
            error: 'É necessário fornecer start_date e end_date ou month e year.',
        });
    }

    try {
        const data = await fetchInvestmentsFiltered({ user_id, startDate, endDate, asset });
        res.json(data);
    } catch (err) {
        console.error('Erro ao buscar investimentos:', err);
        res.status(500).json({ error: 'Erro ao buscar investimentos.' });
    }
};



export const getInvestmentStats = async (req, res) => {
    const user_id = req.user.id;
    const { month, year, asset } = req.query;

    if (!month || !year) {
        return res.status(400).json({ error: 'Informe month e year.' });
    }

    const pad = (n) => String(n).padStart(2, '0');
    const mes = parseInt(month);
    const ano = parseInt(year);
    const startDate = `${ano}-${pad(mes)}-01`;
    const endDate = new Date(ano, mes, 0).toISOString().split('T')[0];

    const mesAnterior = mes === 1 ? 12 : mes - 1;
    const anoAnterior = mes === 1 ? ano - 1 : ano;
    const startAnterior = `${anoAnterior}-${pad(mesAnterior)}-01`;
    const endAnterior = new Date(anoAnterior, mesAnterior, 0).toISOString().split("T")[0];

    try {
        const atualStats = await fetchInvestmentStats({ user_id, startDate, endDate, asset });
        const anteriorStats = await fetchInvestmentStats({ user_id, startDate: startAnterior, endDate: endAnterior, asset });

        // Calcula valor atual da carteira
        let precoAtual = 0;
        if (asset && asset !== 'todos') {
            const quote = await yahooFinance.quote(asset);
            precoAtual = quote?.regularMarketPrice || 0;
        }

        const totalAtual = precoAtual * parseFloat(atualStats.total_quantidade || 0);
        const totalAnterior = precoAtual * parseFloat(anteriorStats.total_quantidade || 0);

        res.json({
            totalInvestido: Number(atualStats.total_investido || 0),
            anterior: Number(anteriorStats.total_investido || 0),
            valorAtual: Number(totalAtual.toFixed(2)),
            rentabilidadeMedia:
                atualStats.total_investido > 0
                    ? Number((((totalAtual - atualStats.total_investido) / atualStats.total_investido) * 100).toFixed(2))
                    : 0,
        });
    } catch (err) {
        console.error('Erro ao calcular estatísticas de investimentos:', err);
        res.status(500).json({ error: 'Erro ao calcular estatísticas.' });
    }
};

