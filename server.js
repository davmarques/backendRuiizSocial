import express from "express";
import pool from "./db.js";
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));

app.get("/empresas", async (req, res) => {
    console.log("server.js: Requisição GET recebida em /empresas");
    const { estado, especialidade, valor, genero, atendimento } = req.query;

    let query = `SELECT * FROM empresas WHERE TRUE`;
    const params = [];
    let paramIndex = 1;

    const removerAcentos = (str) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    if (estado && estado !== "") {
        query += ` AND LOWER(unaccent(estado)) = LOWER(unaccent($${paramIndex}))`;
        params.push(estado);
        paramIndex++;
    }

    if (especialidade && especialidade !== "") {
        query += ` AND LOWER(unaccent(especialidade)) = LOWER(unaccent($${paramIndex}))`;
        params.push(especialidade);
        paramIndex++;
    }

    if (valor && valor !== "") {
        query += ` AND valor = $${paramIndex}`;
        params.push(valor);
        paramIndex++;
    }

    if (genero && genero !== "") {
        query += ` AND LOWER(unaccent(genero)) = LOWER(unaccent($${paramIndex}))`;
        params.push(genero);
        paramIndex++;
    }

    if (atendimento && atendimento !== "") {
        if (atendimento === "ambos") {
        } else if (atendimento === "presencial") {
            query += ` AND (LOWER(unaccent(atendimento)) = LOWER(unaccent($${paramIndex})) OR LOWER(unaccent(atendimento)) = LOWER(unaccent('ambos')))`;
            params.push(atendimento);
            paramIndex++;
        } else if (atendimento === "remoto") {
            query += ` AND (LOWER(unaccent(atendimento)) = LOWER(unaccent($${paramIndex})) OR LOWER(unaccent(atendimento)) = LOWER(unaccent('ambos')))`;
            params.push(atendimento);
            paramIndex++;
        } else {
            query += ` AND LOWER(unaccent(atendimento)) = LOWER(unaccent($${paramIndex}))`;
            params.push(atendimento);
            paramIndex++;
        }
    }

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao buscar empresas");
    }
});


app.get("/profissional", async (req, res) => {
    console.log("server.js: Requisição GET recebida em /profissional");
    const { especialidade, valor, genero, atendimento, estado, cep } = req.query; // Alterado de cepProximo para cep

    console.log("server.js: Filtros Recebidos:", req.query);

    let query = `SELECT * FROM profissional WHERE TRUE`;
    const params = [];
    let paramIndex = 1;

    const removerAcentos = (str) => {
        return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    };

    if (genero && genero !== "") {
        query += ` AND LOWER(unaccent(genero)) = LOWER(unaccent($${paramIndex}))`;
        params.push(genero);
        paramIndex++;
    }

    if (especialidade && especialidade !== "") {
        query += ` AND LOWER(unaccent(especialidade)) = LOWER(unaccent($${paramIndex}))`;
        params.push(especialidade);
        paramIndex++;
    }

    if (valor && valor !== "") {
        const [minStr, maxStr] = valor.split('-');
        const min = parseInt(minStr);
        const max = maxStr === 'infinity' ? Infinity : parseInt(maxStr);

        if (!isNaN(min)) {
            query += ` AND valor >= $${paramIndex}`;
            params.push(min);
            paramIndex++;
        }
        if (!isNaN(max) && max !== Infinity) {
            query += ` AND valor <= $${paramIndex}`;
            params.push(max);
            paramIndex++;
        }
    }

    if (atendimento && atendimento !== "") {
        query += ` AND LOWER(unaccent(atendimento)) = LOWER(unaccent($${paramIndex}))`;
        params.push(atendimento);
        paramIndex++;
    }

    if (estado && estado !== "") {
        query += ` AND LOWER(unaccent(estado)) = LOWER(unaccent($${paramIndex}))`;
        params.push(estado);
        paramIndex++;
    }

    if (cep && cep !== "") {
        const cepPrefix = cep.slice(0, 3);
        query += ` AND cep LIKE $${paramIndex}`;
        params.push(`${cepPrefix}%`);
        paramIndex++;
    }

    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao buscar profissionais");
    }
});

app.post("/empresas", upload.single('foto'), async (req, res) => {
    console.log("server.js: Requisição POST recebida em /profissional");
    try {
        const { empresa, tipo, email, telefone, cidade, estado, cep, servico } = req.body;
        const fotoPath = req.file ? req.file.path : null;

        const result = await pool.query(
            "INSERT INTO empresas (empresa, tipo, email, telefone, foto, cidade, estado, cep, servico) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, foto",
            [empresa, tipo, email, telefone, fotoPath, cidade, estado, cep, servico]
        );
        res.json(result.rows[0]);
        console.log("server.js: Formulário de empresa enviado com sucesso!");
    } catch (error) {
        console.error(error);
        res.status(500).send("Erro ao adicionar empresa");
    }
});

app.post("/profissional", upload.single('foto'), async (req, res) => {
    try {
        console.log("server.js: Recebidos dados para cadastro de profissional:", req.body);

        const {
            nome, sobrenome, email, telefone,
            especialidade, cr, genero, valor: valorStr,
            atendimento, cidade, estado, cep,
            foto, servico, consultaSocial
        } = req.body;


        let valorNum = null;
        if (consultaSocial === "sim") {
            valorNum = valorStr ? parseFloat(valorStr) : 0;
        }


        // Verifica se a imagem foi enviada
        const fotoPath = req.file ? req.file.path : null;
        console.log("server.js: Caminho da foto:", fotoPath);

        // Validação básica
        if (!nome || !sobrenome || !email || !especialidade) {
            return res.status(400).send("Campos obrigatórios faltando");
        }


        const query = `
        INSERT INTO profissional (
            nome, sobrenome, email, telefone,
            especialidade, cr, genero, valor,
            atendimento, cidade, estado, cep,
            foto, servico
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14)
        RETURNING id, foto
        `;

        const values = [
            nome, sobrenome, email, telefone,
            especialidade, cr, genero, valorNum,
            atendimento, cidade, estado, cep,
            fotoPath, servico
        ];

        console.log("server.js: Valores a serem inseridos:", values);

        const result = await pool.query(query, values);
        res.json(result.rows[0]);
        console.log("server.js: Cadastro de profissional realizado com sucesso.");
    } catch (error) {
        console.error("server.js: Erro ao adicionar profissional:", error);
        res.status(500).json({ error: "Erro ao adicionar profissional", detalhes: error.message });
    }
});
