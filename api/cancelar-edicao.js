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

    const { torneioId } = req.body;
    if (!torneioId) return res.status(400).json({ error: 'Dados incompletos' });

    try {
        const { data: torneio } = await adminClient.from('torneios').select('*').eq('id', torneioId).single();
        if (!torneio) return res.status(404).json({ error: 'Torneio não encontrado' });

        const novaEdicao = (torneio.edicao_atual || 0) + 1;

        // 1. Insere partida cancelada (sem campeão, não credita títulos/finais/rivalidades)
        const { error: errP } = await adminClient.from('partidas').insert({
            torneio_id: torneioId,
            campeao_id: null,
            edicao: novaEdicao,
            placar_detalhado: '🚫 Edição cancelada',
            cancelada: true
        });
        if (errP) throw new Error('Partida: ' + errP.message);

        // 2. Incrementa edição do torneio (ainda conta como edição disputada)
        const { error: errT } = await adminClient.from('torneios')
            .update({ edicao_atual: novaEdicao })
            .eq('id', torneioId);
        if (errT) throw new Error('Torneio: ' + errT.message);

        res.status(200).json({
            ok: true,
            message: `${novaEdicao}ª edição do(a) ${torneio.nome} registrada como CANCELADA.`
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
