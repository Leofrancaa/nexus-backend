// Script para gerar hash da senha do admin
// Execute: node generate-admin-hash.js

const bcrypt = require('bcrypt');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('\n=== GERADOR DE HASH PARA SENHA ADMIN ===\n');

rl.question('Digite a senha que deseja para o admin: ', async (senha) => {
    if (!senha || senha.length < 6) {
        console.log('\n❌ Erro: A senha deve ter pelo menos 6 caracteres.');
        rl.close();
        return;
    }

    console.log('\n⏳ Gerando hash (bcrypt com salt 12)...\n');

    const hash = await bcrypt.hash(senha, 12);

    console.log('✅ Hash gerado com sucesso!\n');
    console.log('--- COPIE O SQL ABAIXO E EXECUTE NO SEU BANCO ---\n');
    console.log(`INSERT INTO users (nome, email, senha, currency, accepted_terms, accepted_terms_at, created_at, updated_at)
VALUES (
    'Administrador Nexus',
    'nexusfintool1962@gmail.com',
    '${hash}',
    'BRL',
    true,
    NOW(),
    NOW(),
    NOW()
);`);
    console.log('\n--------------------------------------------------\n');

    rl.close();
});
