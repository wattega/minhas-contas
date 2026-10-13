/* Minhas Contas — regras do app (sem nada de tela, para poder ser testado) */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.Logica = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- datas (sempre texto "AAAA-MM-DD" ou "AAAA-MM") ---------- */
  const pad = n => String(n).padStart(2, '0');
  const paraISO = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const hoje = () => paraISO(new Date());
  const deISO = s => { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const mesDe = iso => iso.slice(0, 7);
  const diasNoMes = (ano, mes) => new Date(ano, mes, 0).getDate(); // mes de 1 a 12

  function somaMes(ym, n) {
    let p = ym.split('-').map(Number);
    let y = p[0], m = p[1] + n;
    y += Math.floor((m - 1) / 12);
    m = (((m - 1) % 12) + 12) % 12 + 1;
    return y + '-' + pad(m);
  }
  function somaDias(iso, n) {
    const d = deISO(iso);
    d.setDate(d.getDate() + n);
    return paraISO(d);
  }
  function dataDoMes(ym, dia) {
    const p = ym.split('-').map(Number);
    return ym + '-' + pad(Math.min(dia, diasNoMes(p[0], p[1])));
  }
  function diferencaDias(a, b) { // quantos dias de "a" até "b"
    const A = deISO(a), B = deISO(b);
    return Math.round((Date.UTC(B.getFullYear(), B.getMonth(), B.getDate()) -
      Date.UTC(A.getFullYear(), A.getMonth(), A.getDate())) / 86400000);
  }
  function dataValida(iso) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || '')) return false;
    const d = deISO(iso);
    return paraISO(d) === iso && d.getFullYear() >= 2000 && d.getFullYear() <= 2100;
  }

  /* ---------- dinheiro ---------- */
  const arredonda = n => Math.round(n * 100) / 100;
  const formatador = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const moeda = n => formatador.format(n);

  // Entende "150", "150,5", "1.234,56", "R$ 1234.56", etc.
  function lerValor(txt) {
    if (txt == null) return null;
    let s = String(txt).replace(/[^\d.,]/g, '');
    if (!s) return null;
    if (s.includes(',')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      const partes = s.split('.');
      if (partes.length > 2) s = partes.join('');
      else if (partes.length === 2 && partes[1].length === 3) s = partes.join('');
    }
    const n = Number(s);
    return Number.isFinite(n) ? arredonda(n) : null;
  }

  /* ---------- lançamentos e ocorrências ---------- */
  // Um "lançamento" (item) é a conta ou a entrada que ela anotou.
  // Uma "ocorrência" é uma vez em que ele acontece (um mês, no caso dos que se repetem).
  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function montar(item, mes, data) {
    const baixa = (item.baixas || {})[mes] || null;
    return { id: item.id + '|' + mes, itemId: item.id, mes, data, item, baixa, feito: !!baixa };
  }

  // ocorrências de UM item entre dois meses (inclusive), formato "AAAA-MM"
  function ocorrenciasItem(item, mesIni, mesFim) {
    const res = [];
    const pulos = item.pulos || [];
    const inicio = mesDe(item.data);
    if (!item.repete) {
      if (inicio >= mesIni && inicio <= mesFim && !pulos.includes(inicio)) res.push(montar(item, inicio, item.data));
      return res;
    }
    const dia = item.dia || Number(item.data.slice(8));
    const ultimo = item.ate && item.ate < mesFim ? item.ate : mesFim;
    for (let m = inicio > mesIni ? inicio : mesIni; m <= ultimo; m = somaMes(m, 1)) {
      if (pulos.includes(m)) continue;
      res.push(montar(item, m, dataDoMes(m, dia)));
    }
    return res;
  }

  // todas as ocorrências cuja data cai entre "de" e "ate" (inclusive)
  function ocorrencias(dados, de, ate) {
    const out = [];
    for (const it of dados.itens) {
      for (const o of ocorrenciasItem(it, mesDe(de), mesDe(ate))) {
        if (o.data >= de && o.data <= ate) out.push(o);
      }
    }
    out.sort((a, b) => a.data < b.data ? -1 : a.data > b.data ? 1 :
      (a.item.nome || '').localeCompare(b.item.nome || '', 'pt-BR'));
    return out;
  }

  const DIAS_ATRASO = 90; // até quantos dias para trás mostramos "passou do dia"
  function atrasadas(dados, hojeISO) {
    return ocorrencias(dados, somaDias(hojeISO, -DIAS_ATRASO), somaDias(hojeISO, -1)).filter(o => !o.feito);
  }

  function criarItem(f, hojeISO) {
    const it = {
      id: novoId(), tipo: f.tipo, nome: f.nome.trim(),
      vtipo: f.vtipo, valor: f.vtipo === 'desconhecido' ? null : f.valor,
      repete: !!f.repete, data: f.data, dia: Number(f.data.slice(8)),
      ate: null, pulos: [], baixas: {}, criado: Date.now()
    };
    // Conta mensal anotada com data de um mês que já passou: começa neste mês.
    if (it.repete && mesDe(it.data) < mesDe(hojeISO)) it.data = dataDoMes(mesDe(hojeISO), it.dia);
    return it;
  }

  function atualizarItem(it, f, hojeISO) {
    it.nome = f.nome.trim();
    it.vtipo = f.vtipo;
    it.valor = f.vtipo === 'desconhecido' ? null : f.valor;
    const novoDia = Number(f.data.slice(8));
    if (f.repete) {
      if (!it.repete) {
        it.repete = true; it.data = f.data; it.ate = null; it.pulos = [];
        if (mesDe(it.data) < mesDe(hojeISO)) it.data = dataDoMes(mesDe(hojeISO), novoDia);
      }
      it.dia = novoDia; // quem já repetia só muda o dia do mês
    } else {
      it.repete = false; it.data = f.data; it.dia = novoDia; it.ate = null; it.pulos = [];
    }
  }

  function darBaixa(item, mes, valor, em, venc) {
    item.baixas = item.baixas || {};
    item.baixas[mes] = { valor: valor == null ? null : arredonda(valor), em, venc, ts: Date.now() };
  }
  function desfazerBaixa(item, mes) { if (item.baixas) delete item.baixas[mes]; }

  /* ---------- saldo, projeção e histórico ---------- */
  // Dinheiro que ela tem agora = o que informou + tudo que anotou como pago/recebido depois disso.
  function saldoAtual(dados) {
    if (dados.saldoBase == null) return null;
    let s = dados.saldoBase;
    for (const it of dados.itens) {
      for (const b of Object.values(it.baixas || {})) {
        if ((b.ts || 0) > (dados.saldoTs || 0) && b.valor != null) s += it.tipo === 'receita' ? b.valor : -b.valor;
      }
    }
    return arredonda(s);
  }

  // Mês a mês: quanto ainda vai entrar/sair. O primeiro mês inclui o que já passou do dia e não foi marcado.
  function projecao(dados, hojeISO, nMeses) {
    const mesAtual = mesDe(hojeISO);
    let saldo = saldoAtual(dados);
    const meses = [];
    for (let i = 0; i < nMeses; i++) {
      const ym = somaMes(mesAtual, i);
      const de = i === 0 ? somaDias(hojeISO, -DIAS_ATRASO) : ym + '-01';
      const ate = dataDoMes(ym, 31);
      const pend = ocorrencias(dados, de, ate).filter(o => !o.feito);
      let entradas = 0, saidas = 0, semValor = 0, estimados = 0, atrasos = 0;
      for (const o of pend) {
        const v = o.item.valor;
        if (o.item.vtipo === 'desconhecido' || v == null) semValor++;
        else if (o.item.vtipo === 'estimado') estimados++;
        if (o.data < hojeISO) atrasos++;
        if (v != null) { if (o.item.tipo === 'receita') entradas += v; else saidas += v; }
      }
      entradas = arredonda(entradas); saidas = arredonda(saidas);
      const resultado = arredonda(entradas - saidas);
      if (saldo != null) saldo = arredonda(saldo + resultado);
      meses.push({ ym, entradas, saidas, resultado, saldoFim: saldo, semValor, estimados, atrasos, ocs: pend });
    }
    return meses;
  }

  // tudo que já foi pago/recebido, do mais novo para o mais antigo
  function historico(dados) {
    const lista = [];
    for (const it of dados.itens) {
      for (const [mes, b] of Object.entries(it.baixas || {})) lista.push({ item: it, mes, baixa: b });
    }
    lista.sort((a, b) => a.baixa.em < b.baixa.em ? 1 : a.baixa.em > b.baixa.em ? -1 : (b.baixa.ts || 0) - (a.baixa.ts || 0));
    return lista;
  }

  return {
    pad, paraISO, hoje, deISO, mesDe, somaMes, somaDias, dataDoMes, diferencaDias, dataValida,
    arredonda, moeda, lerValor,
    novoId, ocorrenciasItem, ocorrencias, atrasadas, criarItem, atualizarItem, darBaixa, desfazerBaixa,
    saldoAtual, projecao, historico, DIAS_ATRASO
  };
});
