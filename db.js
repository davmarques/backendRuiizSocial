import pkg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

pool.connect()
    .then(() => console.log('Banco de dados PostgreSQL conectado com sucesso!'))
    .catch(err => console.error('Erro ao conectar ao banco de dados:', err));

export default pool;
