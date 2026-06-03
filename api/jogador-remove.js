const { createClient } = require('@supabase/supabase-js');

const adminClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports = async function handler(req, res) {
    if (req.method !== 'DELETE') return res.status(405).json({ error: 'Método não permitido' });

    const token = req.headers['authorization']?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Não autorizado' });

    const jogadorId = req.body?.jogadorId;
    if (!jogadorId) return res.status(400).json({ error: 'ID inválido' });

    try {
        await adminClient.from('titulos_detalhados').delete().eq('jogador_id', jogadorId);
        await adminClient.from('rivalidades').delete()
            .or(`jogador_1_id.eq.${jogadorId},jogador_2_id.eq.${jogadorId}`);

        const { error } = await adminClient.from('jogadores').delete().eq('id', jogadorId);
        if (error) throw new Error(error.message);

        res.status(200).json({ ok: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
