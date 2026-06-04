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

    const { torneioId, campeaoId, viceId, viceIds } = req.body;
    if (!torneioId || !campeaoId) return res.status(400).json({ error: 'Dados incompletos' });

    // Normaliza lista de vices: aceita viceIds (array) ou viceId (legado).
    let viceIdList = Array.isArray(viceIds) ? viceIds : (viceId ? [viceId] : []);
    viceIdList = [...new Set(viceIdList.map(Number))].filter(id => id && id !== Number(campeaoId));

    try {
        const { data: torneio } = await adminClient.from('torneios').select('*').eq('id', torneioId).single();
        const { data: campeao } = await adminClient.from('jogadores').select('*').eq('id', campeaoId).single();

        const vices = [];
        for (const vid of viceIdList) {
            const { data: v } = await adminClient.from('jogadores').select('*').eq('id', vid).single();
            if (v) vices.push(v);
        }

        const novaEdicao = (torneio.edicao_atual || 0) + 1;
        const placar = [campeao.nome, ...vices.map(v => v.nome)].join(' x ');

        // 1. Insere partida
        const { error: errP } = await adminClient.from('partidas').insert({
            torneio_id: torneioId,
            campeao_id: campeaoId,
            edicao: novaEdicao,
            placar_detalhado: placar,
            cancelada: false
        });
        if (errP) throw new Error('Partida: ' + errP.message);

        // 2. Incrementa edição do torneio
        const { error: errT } = await adminClient.from('torneios')
            .update({ edicao_atual: novaEdicao })
            .eq('id', torneioId);
        if (errT) throw new Error('Torneio: ' + errT.message);

        // 3. Campeão: +1 título, +1 final
        const { error: errC } = await adminClient.from('jogadores')
            .update({
                titulos_total: (campeao.titulos_total || 0) + 1,
                finais_total: (campeao.finais_total || 0) + 1
            })
            .eq('id', campeaoId);
        if (errC) throw new Error('Campeão: ' + errC.message);

        // 4. Cada vice: +1 final
        for (const v of vices) {
            const { error: errV } = await adminClient.from('jogadores')
                .update({ finais_total: (v.finais_total || 0) + 1 })
                .eq('id', v.id);
            if (errV) throw new Error('Vice: ' + errV.message);
        }

        // 5. Atualiza rivalidade do campeão com cada vice (não entre vices)
        for (const v of vices) {
            const { data: rival } = await adminClient.from('rivalidades')
                .select('*')
                .or(`and(jogador_1_id.eq.${campeaoId},jogador_2_id.eq.${v.id}),and(jogador_1_id.eq.${v.id},jogador_2_id.eq.${campeaoId})`)
                .maybeSingle();

            if (rival) {
                const upd = rival.jogador_1_id === Number(campeaoId)
                    ? { vitorias_1: (rival.vitorias_1 || 0) + 1 }
                    : { vitorias_2: (rival.vitorias_2 || 0) + 1 };
                await adminClient.from('rivalidades').update(upd).eq('id', rival.id);
            }
        }

        // 6. Atualiza maiores_campeoes
        const { data: histTorneio } = await adminClient.from('partidas')
            .select('campeao_id')
            .eq('torneio_id', torneioId)
            .eq('cancelada', false);

        if (histTorneio) {
            const contagem = {};
            histTorneio.filter(p => p.campeao_id != null)
                .forEach(p => { contagem[p.campeao_id] = (contagem[p.campeao_id] || 0) + 1; });
            const maxTitulos = Math.max(...Object.values(contagem));
            const liderIds = Object.keys(contagem).filter(k => contagem[k] === maxTitulos);
            if (liderIds.length === 1) {
                const { data: lider } = await adminClient.from('jogadores').select('nome').eq('id', liderIds[0]).single();
                if (lider) {
                    await adminClient.from('maiores_campeoes')
                        .update({ campeao: lider.nome, quantidade_titulos: maxTitulos })
                        .eq('torneio', torneio.nome);
                }
            }
        }

        // 7. Upsert titulos_detalhados
        const { data: tdExist } = await adminClient.from('titulos_detalhados')
            .select('id, quantidade')
            .eq('jogador_id', campeaoId)
            .eq('torneio_id', torneioId)
            .maybeSingle();

        if (tdExist) {
            await adminClient.from('titulos_detalhados')
                .update({ quantidade: tdExist.quantidade + 1 })
                .eq('id', tdExist.id);
        } else {
            await adminClient.from('titulos_detalhados')
                .insert({ jogador_id: campeaoId, torneio_id: torneioId, quantidade: 1 });
        }

        res.status(200).json({
            ok: true,
            message: `${campeao.nome} é campeão da ${novaEdicao}ª edição do(a) ${torneio.nome}!`
        });

    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
