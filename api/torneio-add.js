const { createClient } = require('@supabase/supabase-js');

const adminClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

function regraValida(s) {
    if (!s) return false;
    if (s === 'padrao') return true;
    if (/^fixo:\d+$/.test(s)) return true;
    if (/^(inc|dec):\d+\s*-\s*\d+$/.test(s)) return true;
    if (/^lista:\d+(\s*,\s*\d+)*$/.test(s)) return true;
    return false;
}

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

    const token = req.headers['authorization']?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Não autorizado' });

    const body = req.body || {};
    const nome = (body.nome || '').trim();
    if (!nome) return res.status(400).json({ error: 'Nome do torneio é obrigatório' });

    const semDoc = !!body.sem_documentacao;

    const insertRow = {
        nome,
        edicao_atual: 0,
        regras_extras: body.regras_extras || null,
        sem_documentacao: semDoc
    };

    if (!semDoc) {
        const fases = parseInt(body.fases);
        if (fases !== 1 && fases !== 2) return res.status(400).json({ error: 'fases deve ser 1 ou 2' });

        if (!regraValida(body.cartas_fase1)) {
            return res.status(400).json({ error: 'cartas_fase1 inválida' });
        }
        if (fases === 2 && !regraValida(body.cartas_fase2)) {
            return res.status(400).json({ error: 'cartas_fase2 inválida' });
        }

        insertRow.fases = fases;
        insertRow.cartas_fase1 = body.cartas_fase1;
        insertRow.cartas_fase2 = fases === 2 ? body.cartas_fase2 : null;
        insertRow.min_jogadores = parseInt(body.min_jogadores) || 2;
        insertRow.max_jogadores = body.max_jogadores ? parseInt(body.max_jogadores) : null;
        if (fases === 1) {
            insertRow.vidas_iniciais = parseInt(body.vidas_iniciais) || 5;
            insertRow.vidas_qualificatoria = null;
        } else {
            insertRow.vidas_qualificatoria = parseInt(body.vidas_qualificatoria) || 5;
            insertRow.vidas_iniciais = null;
        }
    }

    try {
        const { data: existing } = await adminClient.from('torneios')
            .select('id')
            .ilike('nome', nome)
            .maybeSingle();
        if (existing) return res.status(400).json({ error: `Torneio "${nome}" já existe.` });

        const { data: novo, error: errIns } = await adminClient.from('torneios')
            .insert(insertRow)
            .select()
            .single();
        if (errIns) throw new Error(errIns.message);

        try {
            await adminClient.from('maiores_campeoes')
                .insert({ torneio: nome, campeao: '—', quantidade_titulos: 0 });
        } catch (_) { /* opcional — não bloqueia a criação do torneio */ }

        res.status(200).json({ ok: true, torneio: novo });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
