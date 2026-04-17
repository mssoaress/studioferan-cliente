// ═══════════════════════════════════════════════
// STUDIO FERRAN — agendar.js
// 1 barbeiro · 3 passos · Firebase compat
// ═══════════════════════════════════════════════

var B = {
  servicos:      [],       // ids selecionados
  data:          null,
  horario:       null,
  servicosDB:    [],
  agendamentosDB:[],
  profId:        'feran', // único barbeiro
  profNome:      'Feran',
};

var DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
var MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
var SLOTS = ['09:00','09:30','10:00','10:30','11:00','11:30','12:00',
             '13:00','13:30','14:00','14:30','15:00','15:30','16:00',
             '16:30','17:00','17:30','18:00','18:30'];

window.addEventListener('DOMContentLoaded', function() { iniciar(); });

async function iniciar() {
  try {
    await seedBanco();
    var res = await Promise.all([
      db.collection('servicos').orderBy('nome').get(),
      db.collection('agendamentos').get(),
    ]);
    B.servicosDB     = res[0].docs.map(toObj);
    B.agendamentosDB = res[1].docs.map(toObj);
    console.log('[Studio Feran] OK —', B.servicosDB.length, 'serviços');
  } catch(e) {
    console.error('[agendar]', e.code, e.message);
    B.servicosDB     = demoServs();
    B.agendamentosDB = [];
    toast('Sem conexão — modo demo', true);
  }
  renderServicos();
  renderDates();
  goStep(1);
}

// ── SERVIÇOS ──────────────────────────────────
function renderServicos() {
  var el = document.getElementById('servList');
  if (!B.servicosDB.length) {
    el.innerHTML = '<p style="color:var(--t3);padding:20px 0">Nenhum serviço encontrado.</p>';
    return;
  }
  el.innerHTML = B.servicosDB.map(function(s) {
    var sel = B.servicos.indexOf(s.id) > -1;
    return '<div class="serv-card'+(sel?' selected':'')+'" onclick="toggleServ(\''+s.id+'\')">'
      +'<div class="serv-left">'
      +  '<div class="serv-nome">'+s.nome+'</div>'
      +  '<div class="serv-dur">'+(s.duracao ? s.duracao+' min' : 'Consumível')+'</div>'
      +'</div>'
      +'<div class="serv-right">'
      +  '<span class="serv-preco">R$ '+fmtM(s.preco)+'</span>'
      +  '<div class="serv-chk">'
      +    '<svg viewBox="0 0 12 12" fill="none" width="10" height="10">'
      +      '<path d="M2 6l3 3 5-5" stroke="'+(sel?'var(--bg)':'transparent')+'" stroke-width="2.2" stroke-linecap="round"/>'
      +    '</svg>'
      +  '</div>'
      +'</div>'
      +'</div>';
  }).join('');
  atualizarTotal();
}

function toggleServ(id) {
  var i = B.servicos.indexOf(id);
  if (i > -1) B.servicos.splice(i, 1); else B.servicos.push(id);
  renderServicos();
}

function atualizarTotal() {
  var bar = document.getElementById('totalBar');
  if (!B.servicos.length) { bar.classList.add('hidden'); return; }
  var total = calcTotal();
  document.getElementById('totalVal').textContent = 'R$ '+fmtM(total);
  bar.classList.remove('hidden');
}

// ── DATAS ─────────────────────────────────────
function renderDates() {
  var strip = document.getElementById('dateStrip');
  var hoje = new Date();
  var html = '', primeira = null;
  for (var i = 0; i < 21; i++) {
    var d = new Date(hoje);
    d.setDate(hoje.getDate() + i);
    if (d.getDay() === 0) continue;
    var str = toDateStr(d);
    if (!primeira) primeira = str;
    var sel = B.data === str;
    html += '<div class="date-pill'+(sel?' selected':'')+'" onclick="selData(\''+str+'\')">'
      +'<div class="dp-wd">'+DIAS[d.getDay()]+'</div>'
      +'<div class="dp-d">'+d.getDate()+'</div>'
      +'<div class="dp-m">'+MESES[d.getMonth()]+'</div>'
      +'</div>';
  }
  strip.innerHTML = html;
  if (!B.data && primeira) selData(primeira);
}

function selData(str) {
  B.data = str; B.horario = null;
  renderDates(); renderSlots();
}

// ── SLOTS ─────────────────────────────────────
function renderSlots() {
  var grid = document.getElementById('slotsGrid');
  if (!B.data) { grid.innerHTML = '<p class="slot-empty">Selecione uma data primeiro.</p>'; return; }

  var ocupados = B.agendamentosDB
    .filter(function(a) { return a.data === B.data && a.profissionalId === B.profId && a.status !== 'cancelado'; })
    .map(function(a) { return a.horario; });

  var isSab = new Date(B.data+'T12:00:00').getDay() === 6;
  var slots = SLOTS.filter(function(h) { return isSab ? parseInt(h) < 17 : true; });

  grid.innerHTML = slots.map(function(h) {
    var busy = ocupados.indexOf(h) > -1;
    var sel  = B.horario === h;
    return '<div class="slot-pill'+(busy?' busy':'')+(sel?' selected':'')+'"'
      +(busy ? '' : ' onclick="selSlot(\''+h+'\')"')
      +'>'+h+'</div>';
  }).join('');
}

function selSlot(h) { B.horario = h; renderSlots(); }

// ── NAVEGAÇÃO ─────────────────────────────────
function goStep(n) {
  if (n === 2 && !B.servicos.length) { toast('Selecione ao menos um serviço', true); return; }
  if (n === 3) {
    if (!B.data)    { toast('Selecione uma data', true); return; }
    if (!B.horario) { toast('Selecione um horário', true); return; }
    renderResumo();
  }
  if (n === 2) renderDates();

  // progress
  var pct = n === 1 ? 33 : n === 2 ? 66 : 100;
  document.getElementById('progFill').style.width = pct+'%';

  document.querySelectorAll('.prog-step').forEach(function(el) {
    var s = parseInt(el.getAttribute('data-n'));
    el.classList.toggle('active', s === n);
    el.classList.toggle('done',   s < n);
  });

  for (var i = 1; i <= 3; i++) {
    document.getElementById('sc'+i).classList.toggle('active', i === n);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── RESUMO ────────────────────────────────────
function renderResumo() {
  var total = calcTotal();
  var nomes = nomesServicos();
  var p = B.data.split('-');
  var dtFmt = p[2]+'/'+p[1]+'/'+p[0];
  var wd = DIAS[new Date(B.data+'T12:00:00').getDay()];

  document.getElementById('resumeCard').innerHTML =
    '<div class="rc-head">'
    +'<div class="rc-mark">SF</div>'
    +'<div><div class="rc-title">Resumo do agendamento</div><div class="rc-sub">Revise antes de confirmar</div></div>'
    +'</div>'
    +'<div class="rc-rows">'
    +rcRow('Serviços', nomes.join(', '))
    +rcRow('Data', wd+', '+dtFmt)
    +rcRow('Horário', B.horario)
    +rcRowTotal('Total', 'R$ '+fmtM(total))
    +'</div>';
}

function rcRow(k,v)      { return '<div class="rc-row"><span class="rc-key">'+k+'</span><span class="rc-val">'+v+'</span></div>'; }
function rcRowTotal(k,v) { return '<div class="rc-row total"><span class="rc-key">'+k+'</span><span class="rc-val">'+v+'</span></div>'; }

// ── CONFIRMAR ─────────────────────────────────
async function confirmar() {
  var nome = (document.getElementById('fNome').value||'').trim();
  var tel  = (document.getElementById('fTel').value||'').trim();
  if (!nome) { toast('Informe seu nome', true); return; }
  if (!tel)  { toast('Informe seu WhatsApp', true); return; }

  var btn = document.getElementById('btnConfirmar');
  btn.disabled = true; btn.textContent = 'Salvando...';

  var total = calcTotal();
  var nomes = nomesServicos();

  // salva cliente
  var cliId = null;
  try {
    var cr = await db.collection('clientes').add({
      nome: nome, telefone: tel, origem: 'online',
      criadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
    cliId = cr.id;
  } catch(e) {
    toast(e.code==='permission-denied'
      ? 'Permissão negada — configure as Regras do Firestore'
      : 'Erro: '+e.message, true);
    btn.disabled = false; btn.textContent = '✓ Confirmar'; return;
  }

  // salva agendamento
  var ag = {
    profissionalId:   B.profId,
    profissionalNome: B.profNome,
    clienteId:   cliId, clienteNome: nome, clienteTel: tel,
    servicos:    nomes, servicosIds: B.servicos.slice(),
    total:       total, horario: B.horario, data: B.data,
    status:      'aguardando', origem: 'online',
    criadoEm:    firebase.firestore.FieldValue.serverTimestamp()
  };
  try {
    var ar = await db.collection('agendamentos').add(ag);
    ag.id = ar.id; B.agendamentosDB.push(ag);
    console.log('[Studio Feran] Agendamento salvo:', ar.id);
  } catch(e) {
    toast('Erro ao salvar: '+e.message, true);
    btn.disabled = false; btn.textContent = '✓ Confirmar'; return;
  }

  // tela sucesso
  var p2   = B.data.split('-');
  var dtFmt = p2[2]+'/'+p2[1]+'/'+p2[0];
  var wd = DIAS[new Date(B.data+'T12:00:00').getDay()];
  document.getElementById('sucCard').innerHTML =
    sucRow('Serviços', nomes.join(', '))
    +sucRow('Data', wd+', '+dtFmt)
    +sucRow('Horário', B.horario)
    +sucRow('Total', 'R$ '+fmtM(total));

  document.getElementById('progWrap').style.display = 'none';
  for (var i = 1; i <= 3; i++) document.getElementById('sc'+i).classList.remove('active');
  var ov = document.getElementById('successScreen');
  ov.classList.remove('hidden'); ov.classList.add('show');
  window.scrollTo({ top: 0 });
}

function sucRow(k,v) { return '<div class="suc-row"><span>'+k+'</span><span>'+v+'</span></div>'; }

function reiniciar() {
  B.servicos = []; B.data = null; B.horario = null;
  document.getElementById('fNome').value = '';
  document.getElementById('fTel').value  = '';
  document.getElementById('btnConfirmar').disabled    = false;
  document.getElementById('btnConfirmar').textContent = '✓ Confirmar';
  document.getElementById('progWrap').style.display = '';
  var ov = document.getElementById('successScreen');
  ov.classList.add('hidden'); ov.classList.remove('show');
  renderServicos(); renderDates(); goStep(1);
}

// ── UTILS ─────────────────────────────────────
function toast(msg, err) {
  var t = document.getElementById('toast');
  t.textContent = msg; t.className = 'toast show'+(err?' err':'');
  clearTimeout(window._tt); window._tt = setTimeout(function(){t.classList.remove('show');}, 4000);
}
function calcTotal()     { return B.servicos.reduce(function(acc,id){var s=B.servicosDB.find(function(x){return x.id===id;});return acc+(s?Number(s.preco):0);},0); }
function nomesServicos() { return B.servicos.map(function(id){var s=B.servicosDB.find(function(x){return x.id===id;});return s?s.nome:id;}); }
function toDateStr(d)    { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function fmtM(v)         { return Number(v||0).toFixed(2).replace('.',','); }
function toObj(doc)      { return Object.assign({id:doc.id},doc.data()); }
function demoServs()     {
  return [
    {id:'corte',   nome:'Corte',             preco:45, duracao:40},
    {id:'barba',   nome:'Barba',             preco:35, duracao:30},
    {id:'combo',   nome:'Combo Corte + Barba',preco:70, duracao:60},
    {id:'pezinho', nome:'Pezinho',           preco:10, duracao:15},
  ];
}
