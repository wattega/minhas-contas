/* Minhas Contas — telas e ações */
(function () {
  'use strict';

  const L = window.Logica;
  const CHAVE = 'minhas-contas-v1';
  const CHAVE_ANTERIOR = 'minhas-contas-v1-anterior';

  /* ================= dados guardados no próprio celular ================= */
  const dadosVazios = () => ({ versao: 1, itens: [], saldoBase: null, saldoTs: 0, saldoEm: null, fonte: 'grande' });

  function lerArmazenado(chave) {
    try {
      const t = localStorage.getItem(chave);
      if (!t) return null;
      const d = JSON.parse(t);
      return d && Array.isArray(d.itens) ? d : null;
    } catch (e) { return null; }
  }
  function normalizar(d) {
    const r = Object.assign(dadosVazios(), d || {});
    r.itens = r.itens.filter(i => i && i.id && i.data && L.dataValida(i.data)).map(i => {
      i.baixas = i.baixas || {}; i.pulos = i.pulos || []; i.dia = i.dia || Number(i.data.slice(8));
      return i;
    });
    return r;
  }

  let dados = normalizar(lerArmazenado(CHAVE) || lerArmazenado(CHAVE_ANTERIOR));

  function salvar() {
    try {
      const atual = localStorage.getItem(CHAVE);
      if (atual) localStorage.setItem(CHAVE_ANTERIOR, atual);
      localStorage.setItem(CHAVE, JSON.stringify(dados));
    } catch (e) {
      aviso('Não consegui guardar. Talvez o celular esteja sem espaço.', true);
    }
  }

  /* ================= estado da tela ================= */
  const estado = { aba: 'inicio', filtro: 'todos', meses: 3, wizard: null, modal: null, instalar: null };

  /* ================= ajudantes ================= */
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const moeda = n => L.moeda(n);
  const dataLonga = iso => cap(L.deISO(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }));
  const dataLongaAno = iso => cap(L.deISO(iso).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  const dm = iso => iso.slice(8) + '/' + iso.slice(5, 7);
  const nomeMes = ym => { const p = ym.split('-').map(Number); return cap(new Date(p[0], p[1] - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })); };
  const nomeMesCurto = ym => { const p = ym.split('-').map(Number); return new Date(p[0], p[1] - 1, 1).toLocaleDateString('pt-BR', { month: 'long' }); };
  const valorParaCampo = v => (v == null ? '' : v.toFixed(2).replace('.', ','));

  function quando(iso, hoje) {
    const d = L.diferencaDias(hoje, iso);
    if (d === 0) return { texto: 'HOJE', classe: 'hoje' };
    if (d === 1) return { texto: 'AMANHÃ', classe: 'breve' };
    if (d === -1) return { texto: 'Passou ontem', classe: 'atrasado' };
    if (d < 0) return { texto: 'Passou há ' + (-d) + ' dias', classe: 'atrasado' };
    return { texto: 'Daqui a ' + d + ' dias', classe: d <= 7 ? 'breve' : '' };
  }
  function textoValor(vtipo, valor) {
    if (vtipo === 'desconhecido' || valor == null) return 'Ainda não sei o valor';
    if (vtipo === 'estimado') return 'Mais ou menos ' + moeda(valor);
    return moeda(valor);
  }
  function ocPorId(id) {
    const p = String(id).split('|');
    const item = dados.itens.find(i => i.id === p[0]);
    return item ? (L.ocorrenciasItem(item, p[1], p[1])[0] || null) : null;
  }
  function itemPorId(id) { return dados.itens.find(i => i.id === id) || null; }

  let temporizadorAviso = null;
  function aviso(texto, erro) {
    const el = $('#aviso');
    el.textContent = texto;
    el.className = erro ? 'erro-aviso' : '';
    el.hidden = false;
    clearTimeout(temporizadorAviso);
    temporizadorAviso = setTimeout(() => { el.hidden = true; }, erro ? 6000 : 3500);
  }

  /* ================= telas ================= */
  function cartaoOcorrencia(oc, hoje) {
    const it = oc.item, desp = it.tipo === 'despesa';
    const q = quando(oc.data, hoje);
    return `<article class="cartao ${desp ? 'despesa' : 'receita'}">
      <button class="cartao-corpo" data-acao="detalhe" data-oc="${oc.id}">
        <span class="linha-topo"><span class="selo">${desp ? 'PAGAR' : 'RECEBER'}</span><span class="quando ${q.classe}">${q.texto}</span></span>
        <span class="nome">${esc(it.nome)}</span>
        <span class="data">${dataLonga(oc.data)}</span>
        <span class="valor">${textoValor(it.vtipo, it.valor)}</span>
        ${it.repete ? '<span class="repete">🔁 Todo mês</span>' : ''}
        <span class="dica">Toque aqui para mudar ou apagar</span>
      </button>
      <button class="botao" data-acao="baixar" data-oc="${oc.id}">✓ ${desp ? 'JÁ PAGUEI' : 'JÁ RECEBI'}</button>
    </article>`;
  }

  function telaInicio() {
    const hj = L.hoje();
    const atras = L.atrasadas(dados, hj);
    const prox = L.ocorrencias(dados, hj, L.somaDias(hj, 30)).filter(o => !o.feito);
    const deHoje = prox.filter(o => o.data === hj);
    const semana = prox.filter(o => o.data > hj && o.data <= L.somaDias(hj, 7));
    const adiante = prox.filter(o => o.data > L.somaDias(hj, 7));
    const mes0 = L.projecao(dados, hj, 1)[0];
    const saldo = L.saldoAtual(dados);
    const lista = (titulo, arr) => arr.length ? `<h2>${titulo}</h2>${arr.map(o => cartaoOcorrencia(o, hj)).join('')}` : '';

    let h = `<h1>Olá! 👋</h1><p class="dica-texto" style="font-size:1.1rem;margin-top:-.6rem">Hoje é ${dataLongaAno(hj).toLowerCase()}.</p>`;

    h += `<section class="painel" aria-label="Resumo">
      <p class="rotulo">Dinheiro que tenho agora</p>
      ${saldo == null
        ? '<p class="saldo" style="font-size:1.2rem">Ainda não informado</p>'
        : `<p class="saldo ${saldo < 0 ? 'neg' : ''}">${moeda(saldo)}</p>`}
      <button class="botao claro" data-acao="saldo-abrir">${saldo == null ? 'INFORMAR QUANTO TENHO' : 'MUDAR ESSE VALOR'}</button>
      <div class="duas-colunas">
        <div><span class="rotulo">Falta pagar este mês</span><strong class="sai">${moeda(mes0.saidas)}</strong></div>
        <div><span class="rotulo">Falta receber este mês</span><strong class="entra">${moeda(mes0.entradas)}</strong></div>
      </div>
      ${mes0.semValor ? `<div class="aviso-suave">${mes0.semValor === 1 ? '1 conta ainda está sem valor' : mes0.semValor + ' contas ainda estão sem valor'}. O total pode ser maior.</div>` : ''}
    </section>`;

    h += `<div class="dois-botoes">
      <button class="botao vermelho grande" data-acao="novo" data-tipo="despesa">➖ ANOTAR UMA CONTA A PAGAR</button>
      <button class="botao grande" data-acao="novo" data-tipo="receita">➕ ANOTAR DINHEIRO QUE VAI ENTRAR</button>
    </div>`;

    if (!dados.itens.length) {
      h += `<p class="vazio">Bem-vinda! 😊<br>Toque em um dos botões acima para anotar sua primeira conta ou entrada de dinheiro.</p>`;
    } else {
      if (atras.length) h += `<div class="faixa-atraso"><h2>⚠ Já passou do dia</h2><p>Se já resolveu, toque em “${atras.some(o => o.item.tipo === 'despesa') ? 'JÁ PAGUEI' : 'JÁ RECEBI'}”.</p>${atras.map(o => cartaoOcorrencia(o, hj)).join('')}</div>`;
      h += lista('Hoje', deHoje) + lista('Nos próximos 7 dias', semana) + lista('Mais para frente (até 30 dias)', adiante);
      if (!atras.length && !prox.length) h += `<p class="vazio">Nenhuma conta nem entrada nos próximos 30 dias. 🎉<br>Veja mais em “Futuro”.</p>`;
    }
    return h;
  }

  function telaFuturo() {
    const hj = L.hoje();
    const meses = L.projecao(dados, hj, estado.meses);
    const maximo = Math.max(1, ...meses.map(m => Math.max(m.entradas, m.saidas)));
    const largura = v => v > 0 ? Math.max(3, Math.round(v / maximo * 100)) : 0;
    let h = `<h1>Como vão ficar os próximos meses</h1>
      <p class="dica-texto">Só entram aqui as contas e entradas que ainda não foram pagas ou recebidas.</p>
      <div class="pilulas" role="group" aria-label="Quantos meses mostrar">
        ${[3, 6, 12].map(n => `<button class="pilula" data-acao="horizonte" data-n="${n}" aria-pressed="${estado.meses === n}">${n} meses</button>`).join('')}
      </div>`;
    if (!dados.itens.length) return h + '<p class="vazio">Anote uma conta ou uma entrada de dinheiro para ver a previsão aqui.</p>';

    meses.forEach((m, i) => {
      const sobra = m.resultado >= 0;
      const lista = m.ocs;
      let fim = '';
      if (m.saldoFim != null) {
        fim = `<p style="margin-top:.7rem"><span class="rotulo">Dinheiro que terei no fim do mês</span><br><strong style="font-size:1.35rem" class="${m.saldoFim < 0 ? 'sai' : ''}">${moeda(m.saldoFim)}</strong></p>`;
        if (m.saldoFim < 0) fim += '<p class="aviso-suave">⚠ Atenção: nesse mês pode faltar dinheiro.</p>';
      } else if (!sobra) {
        fim = '<p class="aviso-suave">⚠ Nesse mês sai mais dinheiro do que entra.</p>';
      }
      h += `<section class="mes">
        <h3>${nomeMes(m.ym)}${i === 0 ? '<span class="atual">este mês</span>' : ''}</h3>
        <div class="linha-barra"><div class="topo"><span class="entra">▲ Vai entrar</span><span class="entra">${moeda(m.entradas)}</span></div><div class="barra"><span class="b-entra" style="width:${largura(m.entradas)}%"></span></div></div>
        <div class="linha-barra"><div class="topo"><span class="sai">▼ Vai sair</span><span class="sai">${moeda(m.saidas)}</span></div><div class="barra"><span class="b-sai" style="width:${largura(m.saidas)}%"></span></div></div>
        <div class="resultado ${sobra ? 'bom' : 'ruim'}">${sobra ? 'Sobra no mês: ' : 'Falta no mês: '}${moeda(Math.abs(m.resultado))}</div>
        ${fim}
        ${m.semValor ? `<p class="aviso-suave">${m.semValor === 1 ? '1 conta sem valor definido' : m.semValor + ' contas sem valor definido'} — o gasto pode ser maior.</p>` : ''}
        ${m.estimados ? `<p class="dica-texto">Inclui ${m.estimados === 1 ? '1 valor estimado' : m.estimados + ' valores estimados'} (mais ou menos).</p>` : ''}
        ${lista.length ? `<details><summary>Ver as ${lista.length} ${lista.length === 1 ? 'conta' : 'contas'} deste mês</summary>
          ${lista.map(o => `<div class="item-mes"><span><strong>${esc(o.item.nome)}</strong><small>${o.data < hj ? 'Já passou do dia ' : 'Dia '}${dm(o.data)} · ${o.item.tipo === 'despesa' ? 'sai' : 'entra'}</small></span><span class="${o.item.tipo === 'despesa' ? 'sai' : 'entra'}"><strong>${o.item.vtipo === 'desconhecido' || o.item.valor == null ? 'sem valor' : (o.item.vtipo === 'estimado' ? '~ ' : '') + moeda(o.item.valor)}</strong></span></div>`).join('')}
        </details>` : '<p class="dica-texto">Nada anotado para este mês.</p>'}
      </section>`;
    });
    return h;
  }

  function telaHistorico() {
    let lista = L.historico(dados);
    if (estado.filtro === 'gastos') lista = lista.filter(x => x.item.tipo === 'despesa');
    if (estado.filtro === 'entradas') lista = lista.filter(x => x.item.tipo === 'receita');
    let h = `<h1>O que já aconteceu</h1>
      <div class="pilulas" role="group" aria-label="Filtro">
        <button class="pilula" data-acao="filtro" data-f="todos" aria-pressed="${estado.filtro === 'todos'}">Tudo</button>
        <button class="pilula" data-acao="filtro" data-f="gastos" aria-pressed="${estado.filtro === 'gastos'}">Contas pagas</button>
        <button class="pilula" data-acao="filtro" data-f="entradas" aria-pressed="${estado.filtro === 'entradas'}">Recebidos</button>
      </div>`;
    if (!lista.length) return h + '<p class="vazio">Ainda não tem nada aqui.<br>Quando você tocar em “JÁ PAGUEI” ou “JÁ RECEBI”, vai aparecer nesta lista.</p>';

    const grupos = {};
    lista.forEach(x => { (grupos[x.baixa.em.slice(0, 7)] = grupos[x.baixa.em.slice(0, 7)] || []).push(x); });
    Object.keys(grupos).sort().reverse().forEach(ym => {
      const g = grupos[ym];
      let pago = 0, recebido = 0;
      g.forEach(x => { if (x.baixa.valor != null) { if (x.item.tipo === 'despesa') pago += x.baixa.valor; else recebido += x.baixa.valor; } });
      h += `<section class="mes-hist"><h2>${nomeMes(ym)}</h2>
        <p class="totais">Pagou <span class="sai">${moeda(pago)}</span> · Recebeu <span class="entra">${moeda(recebido)}</span></p>
        ${g.map(x => {
          const desp = x.item.tipo === 'despesa';
          const v = x.baixa.valor;
          return `<button class="linha-hist" data-acao="hist-abrir" data-item="${x.item.id}" data-mes="${x.mes}">
            <span class="dia">${dm(x.baixa.em)}</span>
            <span><strong>${esc(x.item.nome)}</strong><small>${desp ? 'Pago' : 'Recebido'}</small></span>
            <span class="quanto ${desp ? 'sai' : 'entra'}">${v == null ? 'sem valor' : (desp ? '− ' : '+ ') + moeda(v)}</span>
          </button>`;
        }).join('')}
      </section>`;
    });
    return h;
  }

  function telaAjustes() {
    const saldo = L.saldoAtual(dados);
    const fontes = [['normal', 'Normal'], ['grande', 'Grande'], ['enorme', 'Enorme']];
    const jaInstalado = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    return `<h1>Ajustes</h1>
      <section class="bloco"><h2>Tamanho da letra</h2>
        <div class="pilulas" role="group" aria-label="Tamanho da letra">
          ${fontes.map(f => `<button class="pilula" data-acao="fonte" data-f="${f[0]}" aria-pressed="${dados.fonte === f[0]}">${f[1]}</button>`).join('')}
        </div>
      </section>
      <section class="bloco"><h2>Dinheiro que tenho agora</h2>
        <p>${saldo == null ? 'Ainda não informado.' : '<strong>' + moeda(saldo) + '</strong>'}</p>
        <button class="botao claro" data-acao="saldo-abrir">${saldo == null ? 'INFORMAR' : 'MUDAR'}</button>
      </section>
      <section class="bloco"><h2>Cópia de segurança</h2>
        <p class="dica-texto">Tudo fica guardado só neste celular. Guarde uma cópia de vez em quando (por exemplo, mandando para o WhatsApp de um filho). Assim, se o celular for trocado, nada se perde.</p>
        <button class="botao" data-acao="backup">💾 SALVAR / ENVIAR UMA CÓPIA</button>
        <button class="botao claro" data-acao="restaurar">📂 RECUPERAR UMA CÓPIA</button>
      </section>
      ${!jaInstalado ? `<section class="bloco"><h2>Colocar na tela do celular</h2>
        ${estado.instalar ? '<button class="botao azul" data-acao="instalar">📲 INSTALAR O APLICATIVO</button>' : ''}
        <details><summary>Como fazer?</summary>
          <p><strong>No Android (Chrome):</strong></p>
          <ol><li>Toque nos 3 pontinhos no canto de cima.</li><li>Toque em “Instalar aplicativo” ou “Adicionar à tela inicial”.</li></ol>
          <p><strong>No iPhone (Safari):</strong></p>
          <ol><li>Toque no botão de compartilhar (quadrado com seta).</li><li>Toque em “Adicionar à Tela de Início”.</li></ol>
        </details></section>` : ''}
      <section class="bloco"><h2>Apagar tudo</h2>
        <p class="dica-texto">Apaga todas as contas, entradas e o histórico deste celular.</p>
        <button class="botao vermelho" data-acao="apagar-tudo">🗑 APAGAR TUDO</button>
      </section>
      <p class="dica-texto" style="text-align:center">Minhas Contas · versão 1</p>`;
  }

  /* ================= passo a passo para anotar ================= */
  const SUGESTOES = {
    despesa: ['Luz', 'Água', 'Aluguel', 'Cartão de crédito', 'Internet', 'Telefone', 'Mercado', 'Remédios', 'Plano de saúde', 'Gás'],
    receita: ['Aposentadoria', 'Pensão', 'Salário', 'Aluguel recebido']
  };
  const TOTAL_PASSOS = 5;

  function iniciarWizard(tipo, item, oc) {
    estado.wizard = item
      ? { modo: 'editar', itemId: item.id, tipo: item.tipo, passo: 1, nome: item.nome, vtipo: item.vtipo, valorTxt: valorParaCampo(item.valor), data: oc ? oc.data : item.data, repete: !!item.repete }
      : { modo: 'novo', tipo, passo: 1, nome: '', vtipo: null, valorTxt: '', data: '', repete: null };
    estado.modal = null;
    render(true);
    if (!item) setTimeout(() => { const c = $('[data-campo="nome"]'); if (c) c.focus(); }, 50);
  }

  function diaDoMes(w) { return w.data ? Number(w.data.slice(8)) : null; }

  function telaWizard() {
    const w = estado.wizard, desp = w.tipo === 'despesa';
    let titulo = '', corpo = '';
    if (w.passo === 1) {
      titulo = desp ? 'Qual conta você vai pagar?' : 'Que dinheiro vai entrar?';
      corpo = `<p class="dica-texto">Escreva o nome ou toque em uma das sugestões.</p>
        <input class="campo" data-campo="nome" value="${esc(w.nome)}" maxlength="40" autocomplete="off" placeholder="${desp ? 'Ex.: Conta de luz' : 'Ex.: Aposentadoria'}" aria-label="Nome">
        <div class="fichas">${SUGESTOES[w.tipo].map(s => `<button class="ficha" data-acao="w-sugestao" data-nome="${esc(s)}">${esc(s)}</button>`).join('')}</div>`;
    } else if (w.passo === 2) {
      titulo = 'Qual é o valor?';
      const op = (v, t, d) => `<button class="opcao" data-acao="w-vtipo" data-v="${v}" aria-pressed="${w.vtipo === v}"><span class="marca">${w.vtipo === v ? '✓' : ''}</span><span><strong>${t}</strong><small>${d}</small></span></button>`;
      corpo = op('exato', 'Sei o valor certinho', 'Por exemplo, o boleto já chegou.') +
        op('estimado', 'Sei mais ou menos', 'Uma estimativa, como a conta de luz.') +
        op('desconhecido', 'Ainda não sei quanto', 'Só quero lembrar que tenho que ' + (desp ? 'pagar' : 'receber') + '.');
      if (w.vtipo === 'exato' || w.vtipo === 'estimado') {
        corpo += `<label class="rotulo" for="w-valor">${w.vtipo === 'estimado' ? 'Mais ou menos quanto? (em reais)' : 'Quanto é? (em reais)'}</label>
          <input id="w-valor" class="campo" data-campo="valor" inputmode="decimal" autocomplete="off" value="${esc(w.valorTxt)}" placeholder="Ex.: 150,00">
          <p class="previa" id="previa-valor"></p>`;
      }
    } else if (w.passo === 3) {
      titulo = desp ? 'Em que dia você precisa pagar?' : 'Em que dia o dinheiro entra?';
      corpo = `<p class="dica-texto">${w.modo === 'editar' && w.repete ? 'Se mudar o dia, vale para todos os meses daqui para frente.' : 'Toque no campo abaixo e escolha o dia no calendário.'}</p>
        <input class="campo" type="date" data-campo="data" value="${esc(w.data)}" aria-label="Dia">
        <div class="fichas"><button class="ficha" data-acao="w-dia-rapido" data-d="0">Hoje</button><button class="ficha" data-acao="w-dia-rapido" data-d="1">Amanhã</button></div>
        <p class="previa" id="previa-data"></p>`;
    } else if (w.passo === 4) {
      titulo = 'Isso acontece todo mês?';
      const d = diaDoMes(w);
      corpo = `<button class="opcao" data-acao="w-repete" data-v="nao" aria-pressed="${w.repete === false}"><span class="marca">${w.repete === false ? '✓' : ''}</span><span><strong>SÓ DESTA VEZ</strong><small>Vai aparecer uma vez só.</small></span></button>
        <button class="opcao" data-acao="w-repete" data-v="sim" aria-pressed="${w.repete === true}"><span class="marca">${w.repete === true ? '✓' : ''}</span><span><strong>TODO MÊS</strong><small>Vai aparecer todo mês, no dia ${d}.${d > 28 ? ' Nos meses mais curtos, vai para o último dia.' : ''}</small></span></button>`;
    } else {
      titulo = 'Veja se está certo';
      const linha = (r, v) => `<div><span class="rotulo">${r}</span><strong>${v}</strong></div>`;
      corpo = `<div class="resumo">
        ${linha('O que é', desp ? 'Conta a pagar' : 'Dinheiro que vai entrar')}
        ${linha('Nome', esc(w.nome.trim()))}
        ${linha('Valor', w.vtipo === 'desconhecido' ? 'Ainda não sei o valor' : (w.vtipo === 'estimado' ? 'Mais ou menos ' : '') + moeda(L.lerValor(w.valorTxt)))}
        ${linha('Quando', w.repete ? 'Todo mês, no dia ' + diaDoMes(w) : dataLongaAno(w.data))}
      </div>`;
    }
    const ultimo = w.passo === TOTAL_PASSOS;
    const passos = [1, 2, 3, 4, 5].map(i => `<i class="${i <= w.passo ? 'on' : ''}"></i>`).join('');
    return `<div class="topo-wizard"><button class="botao claro pequeno" data-acao="w-cancelar">✕ Cancelar</button><p class="passo">Passo ${w.passo} de ${TOTAL_PASSOS}</p></div>
      <div class="barra-passos" aria-hidden="true">${passos}</div>
      <h1>${titulo}</h1>
      ${corpo}
      <p class="erro" id="erro" role="alert"></p>
      <button class="botao grande" data-acao="${ultimo ? 'w-salvar' : 'w-continuar'}">${ultimo ? '✓ SALVAR' : 'CONTINUAR ▶'}</button>
      ${w.passo > 1 ? '<button class="botao claro" data-acao="w-voltar">◀ VOLTAR</button>' : ''}`;
  }

  function mostrarErro(t) {
    const e = $('#erro');
    if (e) { e.textContent = t; e.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
  }

  function wContinuar() {
    const w = estado.wizard;
    if (w.passo === 1) {
      if (!w.nome.trim()) return mostrarErro('Escreva o nome primeiro.');
    } else if (w.passo === 2) {
      if (!w.vtipo) return mostrarErro('Escolha uma das três opções.');
      if (w.vtipo !== 'desconhecido') {
        const v = L.lerValor(w.valorTxt);
        if (v == null || v <= 0) return mostrarErro('Escreva o valor. Exemplo: 150,00');
      }
    } else if (w.passo === 3) {
      if (!w.data) return mostrarErro('Escolha o dia.');
      if (!L.dataValida(w.data)) return mostrarErro('Esse dia parece estranho. Confira o ano.');
    } else if (w.passo === 4) {
      if (w.repete === null) return mostrarErro('Escolha uma das duas opções.');
    }
    w.passo++;
    render(true);
  }

  function wSalvar() {
    const w = estado.wizard, hj = L.hoje();
    const f = { tipo: w.tipo, nome: w.nome, vtipo: w.vtipo, valor: w.vtipo === 'desconhecido' ? null : L.lerValor(w.valorTxt), data: w.data, repete: w.repete };
    let aviso1 = 'Anotado! ✓';
    if (w.modo === 'editar') {
      const it = itemPorId(w.itemId);
      if (!it) { estado.wizard = null; render(true); return; }
      L.atualizarItem(it, f, hj);
      aviso1 = 'Mudança salva! ✓';
    } else {
      dados.itens.push(L.criarItem(f, hj));
      if (L.diferencaDias(hj, w.data) > 30 && !w.repete) aviso1 = 'Anotado! ✓ Veja em “Futuro”.';
    }
    salvar();
    estado.wizard = null;
    estado.aba = 'inicio';
    render(true);
    aviso(aviso1);
  }

  /* ================= janelas ================= */
  function conteudoModal() {
    const m = estado.modal, hj = L.hoje();
    if (m.tipo === 'detalhe') {
      const oc = ocPorId(m.ocId);
      if (!oc) return '<p>Não encontrei essa conta.</p><button class="botao claro" data-acao="fechar">FECHAR</button>';
      const it = oc.item, desp = it.tipo === 'despesa', q = quando(oc.data, hj);
      return `<span class="selo" style="display:inline-block;color:#fff;background:${desp ? 'var(--vermelho)' : 'var(--verde)'}">${desp ? 'PAGAR' : 'RECEBER'}</span>
        <p class="nome-modal">${esc(it.nome)}</p>
        <p><strong>${dataLongaAno(oc.data)}</strong> <span class="quando ${q.classe}">(${q.texto.toLowerCase()})</span></p>
        <p style="font-size:1.25rem;font-weight:800">${textoValor(it.vtipo, it.valor)}</p>
        <p>${it.repete ? '🔁 Todo mês, no dia ' + it.dia : 'Só desta vez'}</p>
        <button class="botao grande" data-acao="baixar" data-oc="${oc.id}">✓ ${desp ? 'JÁ PAGUEI' : 'JÁ RECEBI'}</button>
        <button class="botao azul" data-acao="editar" data-oc="${oc.id}">✏️ MUDAR</button>
        <button class="botao vermelho" data-acao="apagar" data-oc="${oc.id}">🗑 APAGAR</button>
        <button class="botao claro" data-acao="fechar">FECHAR</button>`;
    }
    if (m.tipo === 'baixar') {
      const oc = ocPorId(m.ocId);
      if (!oc) return '<p>Não encontrei essa conta.</p><button class="botao claro" data-acao="fechar">FECHAR</button>';
      const desp = oc.item.tipo === 'despesa';
      return `<h2>${desp ? 'Quanto você pagou?' : 'Quanto você recebeu?'}</h2>
        <p class="nome-modal">${esc(oc.item.nome)}</p>
        <label class="rotulo" for="m-valor">Valor (em reais)</label>
        <input id="m-valor" class="campo" data-campo="m-valor" inputmode="decimal" autocomplete="off" value="${valorParaCampo(oc.item.valor)}" placeholder="Ex.: 150,00">
        <p class="previa" id="m-previa"></p>
        <p class="dica-texto">Se não souber o valor, pode deixar em branco.</p>
        <label class="rotulo" for="m-data">${desp ? 'Você pagou no dia' : 'Você recebeu no dia'}</label>
        <input id="m-data" class="campo" type="date" value="${hj}">
        <p class="erro" id="m-erro" role="alert"></p>
        <button class="botao grande" data-acao="baixa-ok" data-oc="${oc.id}">✓ ${desp ? 'CONFIRMAR PAGAMENTO' : 'CONFIRMAR RECEBIMENTO'}</button>
        <button class="botao claro" data-acao="fechar">VOLTAR</button>`;
    }
    if (m.tipo === 'apagar') {
      const oc = ocPorId(m.ocId);
      if (!oc) return '<p>Não encontrei essa conta.</p><button class="botao claro" data-acao="fechar">FECHAR</button>';
      if (oc.item.repete) {
        return `<h2>Apagar “${esc(oc.item.nome)}”?</h2>
          <p class="dica-texto">Essa conta se repete todo mês. O que você quer fazer?</p>
          <button class="botao vermelho" data-acao="apagar-mes" data-oc="${oc.id}">SÓ DE ${nomeMesCurto(oc.mes).toUpperCase()}</button>
          <button class="botao vermelho" data-acao="apagar-adiante" data-oc="${oc.id}">DE ${nomeMesCurto(oc.mes).toUpperCase()} EM DIANTE<br><small>(deixa de repetir)</small></button>
          <button class="botao claro" data-acao="fechar">NÃO APAGAR</button>`;
      }
      return `<h2>Apagar “${esc(oc.item.nome)}”?</h2>
        <p class="dica-texto">Essa conta vai sair da lista.</p>
        <button class="botao vermelho" data-acao="apagar-unico" data-oc="${oc.id}">SIM, APAGAR</button>
        <button class="botao claro" data-acao="fechar">NÃO APAGAR</button>`;
    }
    if (m.tipo === 'hist') {
      const it = itemPorId(m.itemId), b = it && it.baixas[m.mes];
      if (!b) return '<p>Não encontrei esse registro.</p><button class="botao claro" data-acao="fechar">FECHAR</button>';
      const desp = it.tipo === 'despesa';
      return `<span class="selo" style="display:inline-block;color:#fff;background:${desp ? 'var(--vermelho)' : 'var(--verde)'}">${desp ? 'PAGO' : 'RECEBIDO'}</span>
        <p class="nome-modal">${esc(it.nome)}</p>
        <p><strong>${dataLongaAno(b.em)}</strong></p>
        <p style="font-size:1.25rem;font-weight:800">${b.valor == null ? 'Sem valor anotado' : moeda(b.valor)}</p>
        <p class="dica-texto">Anotou errado? Toque abaixo para voltar essa conta para a lista de “${desp ? 'contas a pagar' : 'dinheiro a receber'}”.</p>
        <button class="botao vermelho" data-acao="hist-desfazer" data-item="${it.id}" data-mes="${m.mes}">↩ DESFAZER</button>
        <button class="botao claro" data-acao="fechar">FECHAR</button>`;
    }
    if (m.tipo === 'saldo') {
      return `<h2>Quanto dinheiro você tem agora?</h2>
        <p class="dica-texto">Some o que tem na carteira e na conta do banco.</p>
        <label class="rotulo" for="m-saldo">Valor (em reais)</label>
        <input id="m-saldo" class="campo" data-campo="m-saldo" inputmode="decimal" autocomplete="off" value="${valorParaCampo(L.saldoAtual(dados))}" placeholder="Ex.: 1200,00">
        <p class="previa" id="m-previa"></p>
        <p class="erro" id="m-erro" role="alert"></p>
        <button class="botao grande" data-acao="saldo-ok">✓ SALVAR</button>
        <button class="botao claro" data-acao="fechar">VOLTAR</button>`;
    }
    if (m.tipo === 'confirma') {
      return `<h2>${esc(m.titulo)}</h2><p class="dica-texto" style="font-size:1.05rem">${esc(m.texto)}</p>
        <button class="botao ${m.classe || 'vermelho'}" data-acao="confirma-sim">${esc(m.sim)}</button>
        <button class="botao claro" data-acao="fechar">NÃO, VOLTAR</button>`;
    }
    return '';
  }

  function atualizarPrevias() {
    const mv = $('#m-valor') || $('#m-saldo');
    const pm = $('#m-previa');
    if (mv && pm) { const v = L.lerValor(mv.value); pm.textContent = v == null ? '' : 'Vou anotar: ' + moeda(v); }
    const w = estado.wizard;
    if (w) {
      const pv = $('#previa-valor');
      if (pv) { const v = L.lerValor(w.valorTxt); pv.textContent = v == null ? '' : 'Vou anotar: ' + moeda(v); }
      const pd = $('#previa-data');
      if (pd) pd.textContent = w.data && L.dataValida(w.data) ? dataLongaAno(w.data) : '';
    }
  }

  function abrirModal(m) { estado.modal = m; renderModal(); }
  function fecharModal() { estado.modal = null; renderModal(); }
  function confirmar(titulo, texto, sim, aoConfirmar, classe) {
    estado.modal = { tipo: 'confirma', titulo, texto, sim, aoConfirmar, classe };
    renderModal();
  }

  function renderModal() {
    const el = $('#modal');
    if (!estado.modal) { el.hidden = true; el.innerHTML = ''; document.body.classList.remove('modal-aberto'); return; }
    el.innerHTML = '<div class="folha" role="dialog" aria-modal="true" tabindex="-1">' + conteudoModal() + '</div>';
    el.hidden = false;
    $('#aviso').hidden = true; // o aviso antigo não pode ficar por cima dos botões
    document.body.classList.add('modal-aberto');
    el.querySelector('.folha').focus();
    el.querySelector('.folha').scrollTop = 0;
    atualizarPrevias();
  }

  /* ================= desenhar ================= */
  function render(rolarTopo) {
    document.documentElement.dataset.fonte = dados.fonte || 'grande';
    document.body.classList.toggle('no-wizard', !!estado.wizard);
    let h;
    if (estado.wizard) h = telaWizard();
    else if (estado.aba === 'futuro') h = telaFuturo();
    else if (estado.aba === 'historico') h = telaHistorico();
    else if (estado.aba === 'ajustes') h = telaAjustes();
    else h = telaInicio();
    $('#tela').innerHTML = h;
    document.querySelectorAll('#menu [data-aba]').forEach(b => b.setAttribute('aria-current', b.dataset.aba === estado.aba ? 'page' : 'false'));
    renderModal();
    atualizarPrevias();
    if (rolarTopo) window.scrollTo(0, 0);
  }

  /* ================= ações (toques) ================= */
  function acao(nome, d) {
    const w = estado.wizard;
    switch (nome) {
      case 'aba': estado.aba = d.aba; render(true); break;
      case 'novo': iniciarWizard(d.tipo); break;
      case 'detalhe': abrirModal({ tipo: 'detalhe', ocId: d.oc }); break;
      case 'baixar': abrirModal({ tipo: 'baixar', ocId: d.oc }); break;
      case 'editar': { const oc = ocPorId(d.oc); if (oc) iniciarWizard(null, oc.item, oc); break; }
      case 'apagar': abrirModal({ tipo: 'apagar', ocId: d.oc }); break;
      case 'fechar': fecharModal(); break;
      case 'fechar-fundo': fecharModal(); break;

      case 'baixa-ok': {
        const oc = ocPorId(d.oc); if (!oc) return fecharModal();
        const txt = $('#m-valor').value.trim();
        const v = txt ? L.lerValor(txt) : null;
        if (txt && v == null) { $('#m-erro').textContent = 'Não entendi o valor. Exemplo: 150,00'; return; }
        const em = L.dataValida($('#m-data').value) ? $('#m-data').value : L.hoje();
        L.darBaixa(oc.item, oc.mes, v, em, oc.data);
        salvar(); estado.modal = null; render();
        aviso(oc.item.tipo === 'despesa' ? 'Pronto! Anotado como pago ✓' : 'Pronto! Anotado como recebido ✓');
        break;
      }
      case 'apagar-unico': {
        const oc = ocPorId(d.oc); if (!oc) return fecharModal();
        dados.itens = dados.itens.filter(i => i.id !== oc.itemId);
        salvar(); estado.modal = null; render(); aviso('Apagado.');
        break;
      }
      case 'apagar-mes': {
        const oc = ocPorId(d.oc); if (!oc) return fecharModal();
        oc.item.pulos.push(oc.mes);
        salvar(); estado.modal = null; render(); aviso('Tirei só de ' + nomeMesCurto(oc.mes) + '.');
        break;
      }
      case 'apagar-adiante': {
        const oc = ocPorId(d.oc); if (!oc) return fecharModal();
        const it = oc.item;
        it.ate = L.somaMes(oc.mes, -1);
        if (it.ate < L.mesDe(it.data) && !Object.keys(it.baixas).length) dados.itens = dados.itens.filter(i => i.id !== it.id);
        salvar(); estado.modal = null; render(); aviso('Pronto. Não vai mais repetir.');
        break;
      }
      case 'hist-abrir': abrirModal({ tipo: 'hist', itemId: d.item, mes: d.mes }); break;
      case 'hist-desfazer': {
        const it = itemPorId(d.item); if (!it) return fecharModal();
        L.desfazerBaixa(it, d.mes);
        salvar(); estado.modal = null; render(); aviso('Desfeito. Voltou para a lista.');
        break;
      }
      case 'saldo-abrir': abrirModal({ tipo: 'saldo' }); break;
      case 'saldo-ok': {
        const v = L.lerValor($('#m-saldo').value);
        if (v == null) { $('#m-erro').textContent = 'Escreva um valor. Exemplo: 1200,00'; return; }
        dados.saldoBase = v; dados.saldoTs = Date.now(); dados.saldoEm = L.hoje();
        salvar(); estado.modal = null; render(); aviso('Valor guardado ✓');
        break;
      }
      case 'confirma-sim': { const f = estado.modal && estado.modal.aoConfirmar; estado.modal = null; renderModal(); if (f) f(); break; }

      case 'filtro': estado.filtro = d.f; render(); break;
      case 'horizonte': estado.meses = Number(d.n); render(); break;
      case 'fonte': dados.fonte = d.f; salvar(); render(); break;

      case 'backup': fazerBackup(); break;
      case 'restaurar': $('#arquivo').click(); break;
      case 'instalar': if (estado.instalar) { estado.instalar.prompt(); estado.instalar = null; } break;
      case 'apagar-tudo':
        confirmar('Apagar tudo?', 'Todas as contas, entradas e o histórico serão apagados deste celular. Isso não pode ser desfeito.', 'SIM, QUERO APAGAR', () => {
          confirmar('Tem certeza mesmo?', 'Se tiver dúvida, volte e antes salve uma cópia de segurança.', 'SIM, APAGAR TUDO', () => {
            try { localStorage.removeItem(CHAVE); localStorage.removeItem(CHAVE_ANTERIOR); } catch (e) {}
            const fonte = dados.fonte;
            dados = dadosVazios(); dados.fonte = fonte;
            salvar(); estado.aba = 'inicio'; render(true); aviso('Tudo apagado.');
          });
        });
        break;

      /* passo a passo */
      case 'w-cancelar': {
        const sair = () => { estado.wizard = null; render(true); };
        if (w && (w.nome || w.data) && w.modo === 'novo') confirmar('Sair sem salvar?', 'O que você escreveu até agora vai ser perdido.', 'SIM, SAIR', sair);
        else sair();
        break;
      }
      case 'w-continuar': wContinuar(); break;
      case 'w-voltar': w.passo--; render(true); break;
      case 'w-salvar': wSalvar(); break;
      case 'w-sugestao': { w.nome = d.nome; const c = $('[data-campo="nome"]'); if (c) c.value = d.nome; break; }
      case 'w-vtipo': w.vtipo = d.v; render(); break;
      case 'w-repete': w.repete = d.v === 'sim'; render(); break;
      case 'w-dia-rapido': {
        w.data = L.somaDias(L.hoje(), Number(d.d));
        const c = $('[data-campo="data"]'); if (c) c.value = w.data;
        atualizarPrevias();
        break;
      }
    }
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-acao]');
    if (!el) return;
    if (el.dataset.acao === 'fechar-fundo' && e.target !== el) return;
    acao(el.dataset.acao, el.dataset);
  });

  document.addEventListener('input', e => {
    const c = e.target.dataset && e.target.dataset.campo;
    if (!c) return;
    const w = estado.wizard;
    if (c === 'nome' && w) w.nome = e.target.value;
    else if (c === 'valor' && w) w.valorTxt = e.target.value;
    else if (c === 'data' && w) w.data = e.target.value;
    atualizarPrevias();
  });
  document.addEventListener('change', e => {
    if (e.target.dataset && e.target.dataset.campo === 'data' && estado.wizard) { estado.wizard.data = e.target.value; atualizarPrevias(); }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && estado.modal) { fecharModal(); return; }
    if (e.key === 'Enter' && e.target.dataset && e.target.dataset.campo) {
      e.preventDefault();
      const c = e.target.dataset.campo;
      if (c === 'm-valor') { const b = document.querySelector('[data-acao="baixa-ok"]'); if (b) b.click(); }
      else if (c === 'm-saldo') { const b = document.querySelector('[data-acao="saldo-ok"]'); if (b) b.click(); }
      else if (estado.wizard) { const b = document.querySelector('[data-acao="w-continuar"],[data-acao="w-salvar"]'); if (b) b.click(); }
    }
  });

  /* ================= cópia de segurança ================= */
  async function fazerBackup() {
    const texto = JSON.stringify(dados, null, 2);
    const nome = 'minhas-contas-' + L.hoje() + '.json';
    try {
      const arq = new File([texto], nome, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [arq] })) {
        await navigator.share({ files: [arq], title: 'Cópia das Minhas Contas' });
        return;
      }
    } catch (e) {
      if (e && e.name === 'AbortError') return; // ela fechou a janela de compartilhar
    }
    const url = URL.createObjectURL(new Blob([texto], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    aviso('Cópia salva no celular (pasta Downloads).');
  }

  $('#arquivo').addEventListener('change', e => {
    const arq = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!arq) return;
    const leitor = new FileReader();
    leitor.onload = () => {
      let novo;
      try {
        const d = JSON.parse(leitor.result);
        if (!d || !Array.isArray(d.itens)) throw new Error('formato');
        novo = normalizar(d);
      } catch (err) { aviso('Esse arquivo não parece ser uma cópia das Minhas Contas.', true); return; }
      confirmar('Recuperar esta cópia?', 'Ela tem ' + novo.itens.length + ' ' + (novo.itens.length === 1 ? 'conta/entrada' : 'contas/entradas') + '. O que está no celular agora será substituído.', 'SIM, RECUPERAR', () => {
        dados = novo; salvar(); estado.aba = 'inicio'; render(true); aviso('Cópia recuperada ✓');
      }, 'azul');
    };
    leitor.onerror = () => aviso('Não consegui abrir o arquivo.', true);
    leitor.readAsText(arq);
  });

  /* ================= instalação e funcionamento sem internet ================= */
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    estado.instalar = e;
    if (estado.aba === 'ajustes' && !estado.wizard && !estado.modal) render();
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ao voltar para o app (depois de horas aberto), atualiza o "hoje"
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !estado.wizard && !estado.modal) render();
  });

  render();
})();
