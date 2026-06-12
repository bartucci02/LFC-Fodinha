const supabaseUrl = 'https://tcaawvgryjacfkzyplce.supabase.co';
const supabaseKey = 'sb_publishable_woiFZ6BailldN-0rdtZD_w_r1mvZQcD';
const dbClient = supabase.createClient(supabaseUrl, supabaseKey);

let dbJogadores = [];
let dbTorneios = [];
let dbRivalidades = [];
let atualCampeaoName = "";
let usuarioLogado = null;

// ── AUTENTICAÇÃO ──────────────────────────────────────────────

dbClient.auth.onAuthStateChange((_evento, sessao) => {
    usuarioLogado = sessao?.user ?? null;
    atualizarUI();
});

async function iniciarAuth() {
    const { data } = await dbClient.auth.getSession();
    usuarioLogado = data.session?.user ?? null;
    atualizarUI();
}

function atualizarUI() {
    const btn = document.getElementById('authBtn');
    const bloqueado = document.getElementById('registroBloqueado');

    if (usuarioLogado) {
        document.body.classList.add('autenticado');
        btn.textContent = '🔓 Sair';
        btn.classList.add('logged');
        if (bloqueado) bloqueado.style.display = 'none';
    } else {
        document.body.classList.remove('autenticado');
        btn.textContent = '🔒 Admin';
        btn.classList.remove('logged');
        if (bloqueado) bloqueado.style.display = 'block';
    }
    if (typeof renderControles === 'function') renderControles();
}

function clicouAuth() {
    if (usuarioLogado) {
        if (confirm('Deseja sair da conta admin?')) fazerLogout();
    } else {
        abrirModal();
    }
}

function abrirModal() {
    document.getElementById('modalLogin').classList.add('show');
    setTimeout(() => document.getElementById('loginEmail').focus(), 100);
}

function fecharModal() {
    document.getElementById('modalLogin').classList.remove('show');
    document.getElementById('loginErro').classList.remove('show');
    document.getElementById('loginEmail').value = '';
    document.getElementById('loginSenha').value = '';
}

async function fazerLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;
    const btn = document.getElementById('btnLogin');
    const erro = document.getElementById('loginErro');

    if (!email || !senha) {
        erro.textContent = 'Preencha email e senha.';
        erro.classList.add('show');
        return;
    }

    btn.textContent = 'Entrando...';
    btn.disabled = true;
    erro.classList.remove('show');

    const { error } = await dbClient.auth.signInWithPassword({ email, password: senha });

    btn.textContent = 'Entrar';
    btn.disabled = false;

    if (error) {
        erro.textContent = 'Email ou senha incorretos.';
        erro.classList.add('show');
    } else {
        fecharModal();
    }
}

async function fazerLogout() {
    await dbClient.auth.signOut();
}

// Fecha modal ao clicar fora dele
document.getElementById('modalLogin').addEventListener('click', function(e) {
    if (e.target === this) fecharModal();
});

// ── JOGO LOCAL ────────────────────────────────────────────────

let players = JSON.parse(localStorage.getItem('lfc_players') || '[]');
let gameState = JSON.parse(localStorage.getItem('lfc_gamestate') || '{"torneioId":null,"fase":1,"rodada":1}');

function save(){
  localStorage.setItem('lfc_players', JSON.stringify(players));
  localStorage.setItem('lfc_gamestate', JSON.stringify(gameState));
}

function getTorneioRegra(){
  if(!gameState.torneioId) return null;
  return dbTorneios.find(t => t.id === gameState.torneioId) || null;
}

function isQualifying(){
  const t = getTorneioRegra();
  return !!(t && t.fases === 2 && gameState.fase === 1);
}

function aplicarVidasIniciais(){
  const t = getTorneioRegra();
  if(!t){
    players.forEach(p => { p.lives = p.max || 5; });
    return;
  }
  if(t.fases === 2){
    const limite = t.vidas_qualificatoria || 5;
    players.forEach(p => { p.lives = 0; p.max = limite; });
  } else {
    const v = t.vidas_iniciais || 5;
    players.forEach(p => { p.lives = v; p.max = v; });
  }
}

function mudarTorneio(idStr){
  const novoId = idStr ? parseInt(idStr) : null;
  if(novoId === gameState.torneioId) return;

  if(players.length > 0 && novoId !== null){
    if(!confirm('Aplicar regras deste torneio aos jogadores atuais? As vidas serão redefinidas.')){
      const sel = document.getElementById('selectTorneioJogo');
      if(sel) sel.value = gameState.torneioId || '';
      return;
    }
  }

  gameState.torneioId = novoId;
  gameState.fase = 1;
  gameState.rodada = 1;
  if(novoId !== null) aplicarVidasIniciais();
  save(); render();
}

function addPlayer(){
  const n = document.getElementById('pname').value.trim();
  if(!n) return;

  const t = getTorneioRegra();
  let lives, max;
  if(t){
    if(t.fases === 2){
      lives = 0;
      max = t.vidas_qualificatoria || 5;
    } else {
      lives = t.vidas_iniciais || 5;
      max = lives;
    }
  } else {
    lives = parseInt(document.getElementById('plives').value);
    if(isNaN(lives) || lives < 1) lives = 5;
    max = lives;
  }

  players.push({name:n, lives, max});
  document.getElementById('pname').value = '';
  document.getElementById('pname').focus();
  save(); render();
}

function chgLives(i, d){
  if(isQualifying()){
    alert('Na fase qualificatória, use o botão "Confirmar Rodada" para distribuir vidas.');
    return;
  }
  players[i].lives = Math.max(0, players[i].lives + d);
  save(); render();
}

function rmPlayer(i){ players.splice(i,1); save(); render(); }

function resetGame(){
  if(players.length && !confirm('Iniciar novo jogo? (O torneio selecionado será mantido)')) return;
  players = [];
  gameState.fase = 1;
  gameState.rodada = 1;
  save(); render();
}

function setAll(){
  const v = prompt('Quantas vidas para todos?','5');
  if(!v) return;
  const n = parseInt(v);
  if(isNaN(n)||n<1) return;
  players.forEach(p=>{ p.lives=n; p.max=n; });
  save(); render();
}

function proximaRodada(){
  gameState.rodada += 1;
  save(); render();
}

function rodadaAnterior(){
  if(gameState.rodada <= 1) return;
  gameState.rodada -= 1;
  save(); render();
}

function proximaRodadaQualificatoria(){
  const checks = document.querySelectorAll('#qualifyingPanel input.penalizado-check:checked');
  if(!checks.length){
    alert('Selecione ao menos um jogador penalizado nesta rodada.');
    return;
  }
  const penalizados = new Set();
  checks.forEach(c => {
    const i = parseInt(c.value);
    if(!isNaN(i) && players[i]) penalizados.add(i);
  });
  if(penalizados.size === players.length){
    alert('Pelo menos um jogador precisa ficar de fora dos penalizados.');
    return;
  }

  players.forEach((p, i) => { if(!penalizados.has(i)) p.lives += 1; });

  const t = getTorneioRegra();
  const limite = t.vidas_qualificatoria || 5;
  const fimQualif = players.some(p => p.lives >= limite);

  if(fimQualif){
    gameState.fase = 2;
    gameState.rodada = 1;
    players.forEach(p => { p.max = Math.max(p.lives, 1); });
    save(); render();
    setTimeout(() => alert('🎯 Fim da fase qualificatória! Iniciou a fase padrão — agora as vidas só caem.'), 50);
    return;
  }

  gameState.rodada += 1;
  save(); render();
}

function render(){
  renderTorneioPanel();
  renderQualifyingPanel();
  renderControles();

  const list = document.getElementById('playerList');
  const banner = document.getElementById('winBanner');
  if(!players.length){
    list.innerHTML='<div class="empty"><div class="ei">🃏</div><p>Adicione jogadores para começar!</p></div>';
    banner.classList.remove('show'); return;
  }

  const t = getTorneioRegra();
  const semVencedorAutomatico = isQualifying();
  const alive = players.filter(p=>p.lives>0);
  const winner = !semVencedorAutomatico && alive.length===1 && players.length>1 ? alive[0] : null;
  banner.classList.toggle('show',!!winner);

  if(winner) {
    document.getElementById('winName').textContent = winner.name.toUpperCase();
    atualCampeaoName = winner.name;
    popularSelectVice();
    if(t){
      const selT = document.getElementById('selectTorneio');
      if(selT) selT.value = String(t.id);
    }
  }

  // Ordem de exibição fixa (inserção). Medalhas seguem ranking por vidas.
  const medalRank = {};
  players.map((p,i)=>({i, lives:p.lives}))
    .sort((a,b)=>b.lives - a.lives)
    .forEach((r, di)=>{ medalRank[r.i] = di; });

  const medals=['🥇','🥈','🥉'];
  list.innerHTML = players.map((p, i)=>{
    const dead = !semVencedorAutomatico && p.lives===0;
    const champ = winner && p.name===winner.name;
    const di = medalRank[i];
    const icon = champ?'🏆':dead?'💀':(di<3?medals[di]:'');
    const heartCount = Math.max(p.max || 0, p.lives || 0, 1);
    const hearts = Array.from({length:heartCount},(_,k)=>`<span class="heart">${k<p.lives?'❤️':'🖤'}</span>`).join('');
    return `<div class="pcard ${dead?'dead':''} ${champ?'champ':''}">
      <span class="prank">${icon}</span>
      <div class="pinfo">
        <div class="pname">${esc(p.name)}</div>
        <div class="hearts">${hearts}</div>
      </div>
      <div class="plives">
        <button class="lbtn m" onclick="chgLives(${i},-1)" ${dead?'disabled':''}>−</button>
        <span class="lnum ${dead?'zero':''}">${p.lives}</span>
        <button class="lbtn p" onclick="chgLives(${i},+1)">+</button>
      </div>
      <button class="pdel" onclick="rmPlayer(${i})" title="Remover">✕</button>
    </div>`;
  }).join('');
}

function renderTorneioPanel(){
  const panel = document.getElementById('torneioPanel');
  if(!panel) return;

  const t = getTorneioRegra();
  if(!t){
    panel.innerHTML = '';
    const inputLives = document.getElementById('plives');
    if(inputLives){ inputLives.disabled = false; }
    return;
  }

  const inputLives = document.getElementById('plives');
  if(inputLives){
    inputLives.disabled = true;
    inputLives.value = t.fases === 2 ? 0 : (t.vidas_iniciais || 5);
  }

  const faseNome = t.fases === 2
    ? (gameState.fase === 1 ? '⚡ Fase Qualificatória' : '🎯 Fase Padrão')
    : '🎮 Fase Única';
  const limiteInfo = t.fases === 2 && gameState.fase === 1
    ? `Limite: ${t.vidas_qualificatoria} vidas`
    : '';
  const regra = (gameState.fase === 2 && t.cartas_fase2) ? t.cartas_fase2 : t.cartas_fase1;
  const regraTxt = t.sem_documentacao ? '' : `Cartas: ${descreverContagemCartas(regra)}`;

  panel.innerHTML = `
    <div class="torneio-info">
      <div class="torneio-info-row">
        <span class="torneio-info-label">${faseNome}</span>
        <span class="torneio-info-rodada">Rodada ${gameState.rodada}</span>
      </div>
      ${regraTxt ? `<div class="torneio-info-sub">${regraTxt}</div>` : ''}
      ${limiteInfo ? `<div class="torneio-info-sub">${limiteInfo}</div>` : ''}
      ${t.regras_extras ? `<div class="torneio-info-extras">⚠️ ${esc(t.regras_extras)}</div>` : ''}
    </div>
  `;
}

function renderQualifyingPanel(){
  const div = document.getElementById('qualifyingPanel');
  if(!div) return;

  if(!isQualifying() || players.length < 2){
    div.style.display = 'none';
    div.innerHTML = '';
    return;
  }

  div.style.display = 'block';
  div.innerHTML = `
    <div class="card-title">⚡ Avançar Rodada Qualificatória</div>
    <p style="color:var(--muted);font-size:.8rem;margin-bottom:10px">Marque quem foi penalizado — pode ser mais de um. Todos os outros recebem +1 vida.</p>
    <div class="penalizado-list" style="margin-bottom:10px">
      ${players.map((p, i) => `
        <label class="penalizado-item">
          <input type="checkbox" class="penalizado-check" value="${i}">
          <span>${esc(p.name)}</span>
        </label>
      `).join('')}
    </div>
    <button class="btn btn-r" style="width:100%" onclick="proximaRodadaQualificatoria()">➡️ Confirmar e Avançar Rodada</button>
  `;
}

function renderControles(){
  const t = getTorneioRegra();
  const btnSet = document.getElementById('btnSetAll');
  const btnProx = document.getElementById('btnProxRodada');
  const btnAnt = document.getElementById('btnRodadaAnt');
  const btnCancel = document.getElementById('btnCancelarEd');
  if(!btnSet || !btnProx || !btnAnt) return;

  const qualif = isQualifying();
  btnSet.style.display = qualif ? 'none' : '';
  btnProx.style.display = (t && !qualif) ? '' : 'none';
  btnAnt.style.display = (t && !qualif && gameState.rodada > 1) ? '' : 'none';
  if(btnCancel) btnCancel.style.display = (usuarioLogado && t && players.length > 0) ? '' : 'none';
}

function popularSelectTorneioJogo(){
  const sel = document.getElementById('selectTorneioJogo');
  if(!sel) return;
  const opts = ['<option value="">Modo livre — sem regras</option>']
    .concat([...dbTorneios].sort((a,b)=>a.nome.localeCompare(b.nome))
      .map(t => `<option value="${t.id}">${t.nome}</option>`));
  sel.innerHTML = opts.join('');
  if(gameState.torneioId) sel.value = String(gameState.torneioId);
}

function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── SUPABASE: LEITURA ─────────────────────────────────────────

async function fetchDatabase() {
    const resHegemonias = await dbClient.from('hegemonias').select('*');
    if (resHegemonias.data) {
        const hList = document.getElementById('hegemoniasList');
        if(hList) {
            hList.innerHTML = resHegemonias.data.map(h => `
                <div class="tag-item">
                    <span class="tag-val">${h.campeao}</span>
                    <span class="tag-label" style="font-weight:bold">${h.torneio}</span>
                    <span class="tag-label" style="color:var(--muted); font-size:0.7rem">${h.quantidade_titulos} seguidos (${h.edicoes})</span>
                </div>
            `).join('');
        }
    }

    const resCampeoes = await dbClient.from('maiores_campeoes').select('*');
    if (resCampeoes.data) {
        const cList = document.getElementById('campeoesList');
        if(cList) {
            cList.innerHTML = resCampeoes.data.map(c => `
                <div class="tag-item">
                    <span class="tag-val">${c.campeao}</span>
                    <span class="tag-label" style="font-weight:bold">${c.torneio}</span>
                    <span class="tag-label" style="color:var(--muted); font-size:0.7rem">${c.quantidade_titulos} Títulos</span>
                </div>
            `).join('');
        }
    }

    const resRivalidades = await dbClient.from('rivalidades').select('*, j1:jogador_1_id(nome), j2:jogador_2_id(nome)');
    if (resRivalidades.data) { dbRivalidades = resRivalidades.data; renderRivalidades(); }

    const resJogadores = await dbClient.from('jogadores').select('*');
    if (!resJogadores.error) {
        dbJogadores = resJogadores.data;
        popularSelectRemover();
    }

    const resTorneios = await dbClient.from('torneios').select('*');
    if (!resTorneios.error) {
        dbTorneios = resTorneios.data;
        const selectT = document.getElementById('selectTorneio');
        if(selectT && dbTorneios.length > 0) {
            selectT.innerHTML = '<option value="">Selecione o Torneio...</option>' +
            dbTorneios.map(t => `<option value="${t.id}">${t.nome} (Ed. ${(t.edicao_atual || 0) + 1})</option>`).join('');
        }
        popularSelectTorneioJogo();
        if(gameState.torneioId && !dbTorneios.find(t => t.id === gameState.torneioId)){
            gameState.torneioId = null;
            gameState.fase = 1;
            gameState.rodada = 1;
            save();
        }
        renderRegrasTorneios();
        render();
    }

    renderStatsGraficos();
    renderTitulosDetalhados();
}

function descreverContagemCartas(regra){
    if(!regra) return 'padrão';
    if(regra === 'padrao') return 'padrão (1 → 5)';
    if(regra.startsWith('fixo:')) return `sempre ${regra.slice(5)} carta${regra.slice(5)==='1'?'':'s'}`;
    if(regra.startsWith('inc:')){
        const m = regra.slice(4).match(/(\d+)\s*-\s*(\d+)/);
        return m ? `incremental ${m[1]} → ${m[2]}` : regra;
    }
    if(regra.startsWith('dec:')){
        const m = regra.slice(4).match(/(\d+)\s*-\s*(\d+)/);
        return m ? `decremental ${m[1]} → ${m[2]}` : regra;
    }
    if(regra.startsWith('lista:')) return `apenas ${regra.slice(6)}`;
    return regra;
}

function renderRegrasTorneios(){
    const div = document.getElementById('regrasList');
    if(!div) return;
    if(!dbTorneios || dbTorneios.length === 0){
        div.innerHTML = '<p style="color:var(--muted);text-align:center;padding:16px">Nenhum torneio cadastrado.</p>';
        return;
    }
    const ordenados = [...dbTorneios].sort((a,b)=>a.nome.localeCompare(b.nome));
    div.innerHTML = ordenados.map(t => {
        if(t.sem_documentacao){
            return `<div class="regra-card">
                <h4>${esc(t.nome)} <span class="regra-fases">sem doc.</span></h4>
                <div class="regra-semdoc">Este torneio não possui documentação de regras.</div>
                ${t.regras_extras ? `<div class="regra-extras">${esc(t.regras_extras)}</div>` : ''}
            </div>`;
        }
        const fases = t.fases || 1;
        const minTxt = t.min_jogadores ? `${t.min_jogadores}+ jog.` : null;
        const maxTxt = t.max_jogadores ? `máx. ${t.max_jogadores}` : null;
        const minMax = [minTxt, maxTxt].filter(Boolean).join(' / ');
        const vidasInfo = fases === 2
            ? `Qualif.: <b>até ${t.vidas_qualificatoria || '?'}</b> vidas`
            : `Vidas iniciais: <b>${t.vidas_iniciais || '?'}</b>`;
        const cartas1 = `Cartas: <b>${descreverContagemCartas(t.cartas_fase1)}</b>`;
        const cartas2 = fases === 2 && t.cartas_fase2 ? `Fase 2: <b>${descreverContagemCartas(t.cartas_fase2)}</b>` : null;
        const badges = [
            vidasInfo,
            cartas1,
            cartas2,
            minMax ? `Jogadores: <b>${minMax}</b>` : null
        ].filter(Boolean).map(b => `<span class="regra-badge">${b}</span>`).join('');
        return `<div class="regra-card">
            <h4>${esc(t.nome)} <span class="regra-fases ${fases===2?'fase2':''}">${fases===2?'2 fases':'1 fase'}</span></h4>
            <div class="regra-list">${badges}</div>
            ${t.regras_extras ? `<div class="regra-extras">⚠️ ${esc(t.regras_extras)}</div>` : ''}
        </div>`;
    }).join('');
}

function popularSelectRemover() {
    const sel = document.getElementById('selectRemoverJogador');
    if (!sel) return;
    sel.innerHTML = '<option value="">Selecione um jogador...</option>' +
        [...dbJogadores].sort((a,b) => a.nome.localeCompare(b.nome))
            .map(j => `<option value="${j.id}">${j.nome}</option>`).join('');
}

// ── SUPABASE: ESCRITA (via API backend) ───────────────────────

async function apiCall(url, method, body) {
    let { data: { session } } = await dbClient.auth.getSession();
    if (!session) { abrirModal(); return null; }

    const enviar = (token) => fetch(url, {
        method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    let res = await enviar(session.access_token);

    // Token expirado → tenta renovar 1x e reenvia
    if (res.status === 401) {
        const { data, error } = await dbClient.auth.refreshSession();
        if (error || !data.session) {
            await dbClient.auth.signOut();
            usuarioLogado = null;
            atualizarUI();
            alert('Sessão expirada. Faça login novamente.');
            abrirModal();
            return null;
        }
        res = await enviar(data.session.access_token);
    }

    return res.json();
}

async function adicionarJogadorNoBanco() {
    if (!usuarioLogado) { abrirModal(); return; }

    const input = document.getElementById('novoJogadorNome');
    const nome = input.value.trim();
    if (!nome) { alert('Digite o nome do jogador!'); return; }

    const data = await apiCall('/api/jogador-add', 'POST', { nome });
    if (!data) return;
    if (data.error) { alert('❌ ' + data.error); return; }

    alert(`✅ "${nome}" adicionado ao banco de dados.`);
    input.value = '';
    await fetchDatabase();
}

function atualizarFormTorneio(){
    const fases = parseInt(document.getElementById('ntFases').value);
    document.getElementById('ntCampoVidas').style.display = fases === 1 ? 'block' : 'none';
    document.getElementById('ntCampoQualif').style.display = fases === 2 ? 'block' : 'none';
    document.getElementById('ntCampoCartas2').style.display = fases === 2 ? 'block' : 'none';
}

function validarRegraCartas(s){
    if(!s) return false;
    if(s === 'padrao') return true;
    if(/^fixo:\d+$/.test(s)) return true;
    if(/^(inc|dec):\d+\s*-\s*\d+$/.test(s)) return true;
    if(/^lista:\d+(\s*,\s*\d+)*$/.test(s)) return true;
    return false;
}

async function criarTorneioNoBanco(){
    if(!usuarioLogado){ abrirModal(); return; }

    const nome = document.getElementById('ntNome').value.trim();
    const fases = parseInt(document.getElementById('ntFases').value);
    const semDoc = document.getElementById('ntSemDoc').checked;
    const extras = document.getElementById('ntExtras').value.trim() || null;

    if(!nome){ alert('Digite o nome do torneio.'); return; }

    let body = { nome, regras_extras: extras, sem_documentacao: semDoc };

    if(!semDoc){
        const cartas1 = document.getElementById('ntCartas1').value.trim();
        const cartas2 = document.getElementById('ntCartas2').value.trim();
        const min = parseInt(document.getElementById('ntMin').value) || 2;
        const maxRaw = document.getElementById('ntMax').value.trim();
        const max = maxRaw ? parseInt(maxRaw) : null;

        if(!validarRegraCartas(cartas1)){
            alert('Formato inválido em "Contagem de cartas — Fase 1".\nUse: padrao | fixo:N | inc:A-B | dec:A-B | lista:1,3,5');
            return;
        }
        if(fases === 2 && !validarRegraCartas(cartas2)){
            alert('Formato inválido em "Contagem de cartas — Fase 2".');
            return;
        }
        body.fases = fases;
        body.cartas_fase1 = cartas1;
        body.cartas_fase2 = fases === 2 ? cartas2 : null;
        body.min_jogadores = min;
        body.max_jogadores = max;
        if(fases === 1){
            body.vidas_iniciais = parseInt(document.getElementById('ntVidasIniciais').value) || 5;
            body.vidas_qualificatoria = null;
        } else {
            body.vidas_qualificatoria = parseInt(document.getElementById('ntVidasQualif').value) || 5;
            body.vidas_iniciais = null;
        }
    }

    const data = await apiCall('/api/torneio-add', 'POST', body);
    if(!data) return;
    if(data.error){ alert('❌ ' + data.error); return; }

    alert(`✅ Torneio "${nome}" cadastrado.`);
    document.getElementById('ntNome').value = '';
    document.getElementById('ntExtras').value = '';
    document.getElementById('ntSemDoc').checked = false;
    await fetchDatabase();
}

async function removerJogadorDoBanco() {
    if (!usuarioLogado) { abrirModal(); return; }

    const sel = document.getElementById('selectRemoverJogador');
    const jogadorId = parseInt(sel.value);
    if (!jogadorId) { alert('Selecione um jogador para remover!'); return; }

    const jogador = dbJogadores.find(j => j.id === jogadorId);
    if (!jogador) return;

    if (!confirm(`Tem certeza que deseja remover "${jogador.nome}" do banco?\n\nEsta ação não pode ser desfeita.`)) return;

    const data = await apiCall('/api/jogador-remove', 'DELETE', { jogadorId });
    if (!data) return;
    if (data.error) { alert('❌ Erro ao remover: ' + data.error); return; }

    alert(`✅ "${jogador.nome}" foi removido do banco de dados.`);
    await fetchDatabase();
}

function popularSelectVice() {
    const div = document.getElementById('viceList');
    if(!div) return;
    const vices = players.filter(p => p.name !== atualCampeaoName);
    if(!vices.length){
        div.innerHTML = '<p style="color:rgba(255,255,255,.5);font-size:.8rem">Sem outros jogadores para vice.</p>';
        return;
    }
    div.innerHTML = vices.map(v => `
        <label class="penalizado-item">
            <input type="checkbox" class="vice-check" value="${esc(v.name)}">
            <span>${esc(v.name)}</span>
        </label>`).join('');
}

async function registrarNoBanco() {
    if (!usuarioLogado) { abrirModal(); return; }

    const torneioId = parseInt(document.getElementById('selectTorneio').value);
    const viceNomes = Array.from(document.querySelectorAll('#viceList input.vice-check:checked')).map(c => c.value);
    const btnSalvar = document.querySelector('.registro-banco .btn-r');

    if (!torneioId || viceNomes.length === 0) {
        alert('Selecione o torneio e ao menos um vice-campeão antes de salvar!');
        return;
    }

    const campeao = dbJogadores.find(j => j.nome.toLowerCase() === atualCampeaoName.toLowerCase());
    if (!campeao) { alert(`Jogador "${atualCampeaoName}" não encontrado no banco!`); return; }

    const viceIds = [];
    const naoEncontrados = [];
    viceNomes.forEach(nome => {
        const j = dbJogadores.find(x => x.nome.toLowerCase() === nome.toLowerCase());
        if (j) viceIds.push(j.id); else naoEncontrados.push(nome);
    });

    if (naoEncontrados.length) {
        if (!confirm(`Estes vices não estão no banco e serão ignorados: ${naoEncontrados.join(', ')}.\n\nContinuar mesmo assim?`)) return;
    }
    if (viceIds.length === 0) { alert('Nenhum vice válido encontrado no banco.'); return; }

    if (btnSalvar) { btnSalvar.textContent = '⏳ Salvando...'; btnSalvar.disabled = true; }

    try {
        const data = await apiCall('/api/registrar', 'POST', {
            torneioId,
            campeaoId: campeao.id,
            viceIds
        });
        if (!data) return;
        if (data.error) throw new Error(data.error);

        alert(`✅ ${data.message}`);
        await fetchDatabase();

    } catch(e) {
        alert('❌ Erro ao salvar: ' + e.message);
    } finally {
        if (btnSalvar) { btnSalvar.textContent = '💾 Salvar no Banco de Dados'; btnSalvar.disabled = false; }
    }
}

async function cancelarEdicao() {
    if (!usuarioLogado) { abrirModal(); return; }

    const t = getTorneioRegra();
    if (!t) { alert('Selecione um torneio no jogo para cancelar a edição.'); return; }

    const ed = (t.edicao_atual || 0) + 1;
    if (!confirm(`Cancelar a ${ed}ª edição de "${t.nome}"?\n\nSerá registrada como CANCELADA — conta como edição disputada, mas sem campeão. O jogo atual será encerrado.`)) return;

    const data = await apiCall('/api/cancelar-edicao', 'POST', { torneioId: t.id });
    if (!data) return;
    if (data.error) { alert('❌ ' + data.error); return; }

    alert(`✅ ${data.message}`);
    players = [];
    gameState.fase = 1;
    gameState.rodada = 1;
    save();
    await fetchDatabase();
}

// ── RENDER: STATS ─────────────────────────────────────────────

function renderRivalidades() {
    const rList = document.getElementById('rivalidadesList');
    if(!rList) return;
    const rivaisOrdenados = [...dbRivalidades].sort((a,b) => (b.vitorias_1 + b.vitorias_2) - (a.vitorias_1 + a.vitorias_2));
    rList.innerHTML = rivaisOrdenados.map(r => {
        const total = r.vitorias_1 + r.vitorias_2;
        return `
        <div style="background:var(--bg); border-radius:8px; padding:12px; margin-bottom:10px; border-left:4px solid var(--red);">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px; font-size:0.7rem; color:var(--gold); text-transform:uppercase; font-weight:bold;">
                <span>${r.nome_classico}</span>
                <span>${total} Finais</span>
            </div>
            <div style="display:flex; align-items:center; justify-content:space-between; font-size:1.1rem; font-weight:bold;">
                <span>${r.j1?.nome || '?'} <small style="color:var(--muted)">${r.vitorias_1}</small></span>
                <span style="background:var(--s3); padding:4px 10px; border-radius:20px; font-size:0.9rem; color:var(--red);">VS</span>
                <span><small style="color:var(--muted)">${r.vitorias_2}</small> ${r.j2?.nome || '?'}</span>
            </div>
        </div>`;
    }).join('');
}

async function renderStatsGraficos() {
    if (!dbJogadores || dbJogadores.length === 0) return;

    const titulos = [...dbJogadores].sort((a,b) => (b.titulos_total || 0) - (a.titulos_total || 0)).filter(j => (j.titulos_total || 0) > 0);
    mkRanking('rankTitulos', titulos.length ? titulos.map(j => ({n: j.nome, v: j.titulos_total})) : [{n: 'Sem dados', v: 1}]);

    const finais = [...dbJogadores].sort((a,b) => (b.finais_total || 0) - (a.finais_total || 0)).filter(j => (j.finais_total || 0) > 0);
    mkRanking('rankFinais', finais.length ? finais.map(j => ({n: j.nome, v: j.finais_total})) : [{n: 'Sem dados', v: 1}]);

    const tList = document.getElementById('torniosList');
    if(tList && dbTorneios.length > 0) {
        const { data: todasPartidas } = await dbClient
            .from('partidas')
            .select('*, jogadores!campeao_id(nome)')
            .order('edicao', { ascending: true });

        const torneiosOrdenados = [...dbTorneios].sort((a, b) => (b.edicao_atual || 0) - (a.edicao_atual || 0));

        tList.innerHTML = torneiosOrdenados.map((t) => {
            const historico = todasPartidas ? todasPartidas.filter(p => p.torneio_id === t.id) : [];
            return `
                <div class="torneio-item" style="margin-bottom:10px; background:var(--s2); border-radius:8px; overflow:hidden;">
                    <button onclick="document.getElementById('t-hist-${t.id}').classList.toggle('show')"
                            style="width:100%; display:flex; justify-content:space-between; padding:15px; background:transparent; border:none; color:var(--text); font-weight:bold; cursor:pointer;">
                        <span style="font-size: 1.1rem;">🏆 ${t.nome}</span>
                        <span style="color:var(--gold);">${t.edicao_atual || 0} Edições ▼</span>
                    </button>
                    <div id="t-hist-${t.id}" class="historico-lista" style="display:none; padding:15px; background:var(--bg); border-top:1px solid var(--border); font-size:0.85rem; max-height:350px; overflow-y:auto;">
                        <div style="display:flex; justify-content:space-between; color:var(--gold); font-weight:bold; border-bottom:1px solid var(--s3); padding-bottom:8px; margin-bottom:10px;">
                            <span style="width:40px;">Ed.</span>
                            <span style="flex:1; text-align:center;">Confronto / Final</span>
                            <span style="width:70px; text-align:right;">Campeão</span>
                        </div>
                        ${historico.length > 0 ? historico.map(p => p.cancelada ? `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:8px; opacity:.55;">
                                <span style="color:var(--muted); width:40px; font-weight:bold;">${p.edicao}º</span>
                                <span style="flex:1; text-align:center; text-decoration:line-through;">🚫 Edição cancelada</span>
                                <span style="color:var(--muted); width:70px; text-align:right;">—</span>
                            </div>
                        ` : `
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; border-bottom:1px solid rgba(255,255,255,0.03); padding-bottom:8px;">
                                <span style="color:var(--muted); width:40px; font-weight:bold;">${p.edicao}º</span>
                                <span style="flex:1; text-align:center;">${p.placar_detalhado}</span>
                                <span style="color:var(--green); width:70px; text-align:right; font-weight:bold;">${p.jogadores?.nome || '?'}</span>
                            </div>
                        `).join('') : '<p style="color:var(--muted); text-align:center;">Nenhum histórico no banco.</p>'}
                    </div>
                </div>
            `;
        }).join('');
    }
}

async function renderTitulosDetalhados() {
    const container = document.getElementById('titulosDetalhados');
    if (!container) return;

    const { data, error } = await dbClient
        .from('titulos_detalhados')
        .select('quantidade, jogadores(id, nome, titulos_total), torneios(nome)')
        .gt('quantidade', 0);

    if (error || !data || data.length === 0) {
        container.innerHTML = '<p style="color:var(--muted);text-align:center;padding:16px">Nenhum dado encontrado.</p>';
        return;
    }

    const byPlayer = {};
    data.forEach(row => {
        const nome = row.jogadores?.nome;
        if (!nome) return;
        if (!byPlayer[nome]) byPlayer[nome] = { total: row.jogadores.titulos_total || 0, torneios: [] };
        byPlayer[nome].torneios.push({ nome: row.torneios?.nome || '?', qty: row.quantidade });
    });

    const ordenados = Object.entries(byPlayer).sort((a, b) => b[1].total - a[1].total);

    container.innerHTML = ordenados.map(([nome, info]) => {
        const ts = [...info.torneios].sort((a, b) => b.qty - a.qty);
        return `
        <div class="ptcard">
            <div class="ptcard-header">
                <span class="ptcard-name">${nome}</span>
                <span class="ptcard-total">${info.total} 🏆</span>
            </div>
            <div class="ptcard-badges">
                ${ts.map(t => `
                    <div class="ptbadge">
                        <span class="ptbadge-n">${t.qty}</span>
                        <span class="ptbadge-t">${t.nome}</span>
                    </div>`).join('')}
            </div>
        </div>`;
    }).join('');
}

function mkRanking(id, data){
  const el = document.getElementById(id);
  if(!el) return;
  const max = data[0].v || 1;
  el.innerHTML = data.map((d,i)=>{
    const pct = Math.round((d.v/max)*100);
    const cls = i===0?'r1':i===1?'r2':i===2?'r3':'rx';
    return `<div class="ritem">
      <div class="rbadge ${cls}">${i+1}</div>
      <div class="rinfo">
        <div class="rname">${d.n}</div>
        <div class="rbar"><div class="rbf" style="width:${pct}%"></div></div>
      </div>
      <div class="rval">${d.v}</div>
    </div>`;
  }).join('');
}

function tab(name, btn){
  document.querySelectorAll('.tab').forEach(b=>b.classList.remove('on'));
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));
  btn.classList.add('on');
  const page = document.getElementById('page-'+name);
  if(page) page.classList.add('on');
}

// ── INICIALIZAÇÃO ─────────────────────────────────────────────
render();
iniciarAuth();
fetchDatabase();
