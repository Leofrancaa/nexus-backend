import { getFinanceData } from '../services/financeService.js';

export const getMarketData = async (req, res) => {
    try {
        const data = await getFinanceData();
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar dados do mercado' });
    }
};
