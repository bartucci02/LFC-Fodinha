const { createClient } = require('@supabase/supabase-js');

const adminClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const token = req.headers['authorization']?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Não autorizado' });

    const nome = req.body?.nome?.trim();
    if (!nome) return res.status(400).json({ error: 'Nome inválido' });

    const { data: existing } = await adminClient.from('jogadores')
        .select('id')
        .ilike('nome', nome)
        .maybeSingle();

    if (existing) return res.status(400).json({ error: `"${nome}" já existe no banco!` });

    const { error } = await adminClient.from('jogadores')
        .insert({ nome, titulos_total: 0, finais_total: 0 });

    if (error) return res.status(500).json({ error: error.message });

    res.status(200).json({ ok: true });
};
