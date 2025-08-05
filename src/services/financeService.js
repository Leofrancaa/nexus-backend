import fs from "fs/promises";
import path from "path";
import yahooFinance from "yahoo-finance2";

const CACHE_FILE = path.resolve("src/cache/marketCache.json");
const CACHE_DURATION_HOURS = 24;

const getSelicFromBCB = async () => {
    try {
        const url =
            "https://api.bcb.gov.br/dados/serie/bcdata.sgs.4189/dados/ultimos/1?formato=json";
        const response = await fetch(url);
        const data = await response.json();
        const selic = parseFloat(data[0]?.valor.replace(",", "."));

        return {
            nome: "Taxa Selic",
            preco: selic,
            variacao: null,
            moeda: "%",
        };
    } catch (err) {
        console.warn("Erro ao buscar Selic:", err.message);
        return {
            nome: "Taxa Selic",
            preco: null,
            variacao: null,
            moeda: "%",
            erro: true,
        };
    }
};

export const getFinanceData = async () => {
    // 1. Verifica se já tem cache válido
    try {
        const cacheRaw = await fs.readFile(CACHE_FILE, "utf-8");
        const cache = JSON.parse(cacheRaw);
        const lastUpdated = new Date(cache.lastUpdated);
        const diff = Date.now() - lastUpdated.getTime();

        if (diff < CACHE_DURATION_HOURS * 60 * 60 * 1000) {
            return cache.data;
        }
    } catch {
        // cache inexistente ou inválido, segue adiante
    }

    // 2. Se não tem cache, busca dados do Yahoo + Selic
    try {
        const symbols = {
            dolar: "USDBRL=X",
            euro: "EURBRL=X",
            bitcoin: "BTC-USD",
            ethereum: "ETH-USD",
            solana: "SOL-USD",
            ibovespa: "^BVSP",
            bradesco: "BBDC4.SA",
            petrobras: "PETR4.SA",
            vale: "VALE3.SA",
        };

        const results = {};

        for (const [key, symbol] of Object.entries(symbols)) {
            try {
                const quote = await yahooFinance.quote(symbol);
                results[key] = {
                    nome: quote?.shortName || symbol,
                    preco: quote?.regularMarketPrice ?? null,
                    variacao: quote?.regularMarketChangePercent ?? null,
                    moeda: quote?.currency ?? "BRL",
                };
            } catch (err) {
                console.warn(`Erro ao buscar ${symbol}:`, err.message);
                results[key] = {
                    nome: symbol,
                    preco: null,
                    variacao: null,
                    moeda: null,
                    erro: true,
                };
            }
        }

        const selicData = await getSelicFromBCB();
        results["selic"] = selicData;

        // 3. Salva cache
        await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
        await fs.writeFile(
            CACHE_FILE,
            JSON.stringify(
                { lastUpdated: new Date().toISOString(), data: results },
                null,
                2
            )
        );

        return results;
    } catch (error) {
        console.error("Erro ao buscar dados financeiros:", error);
        throw error;
    }
};
