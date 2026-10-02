"use strict";

/* ============================================================
   Eventus Hub — protótipo do app mobile
   Reaproveita os dados fictícios de ../js/data.js (CITIES, PROVIDERS,
   CATEGORY_META, EXTRA_META, DATE_POOL, EVENT_TYPES, PACOTES, etc.).
   Duas "contas": cliente (busca e monta orçamento) e prestador (gerencia
   agenda, preços e pedidos). Tudo roda só neste navegador — nada é
   salvo de verdade além desta sessão (é um protótipo pra discutir a ideia).
   ============================================================ */

var $ = function(id){ return document.getElementById(id); };

var state = {
  role: null,           // 'cliente' | 'prestador'
  screen: 'entry',
  sheetId: null,         // prestador aberto no bottom sheet (lado cliente)

  // --- lado cliente ---
  cidade: null, data: null, tipo: null, convidados: 100,
  activeCat: null,
  subfilters: {},   // por categoria: {estilo:'', formato:''}
  duracaoSel: {},   // por categoria: horas escolhidas
  extrasSel: {},    // por providerId: {fumaca:true,...}
  cart: [],         // {providerId, duracao, extras:[]}

  // --- lado prestador ---
  providerId: null,
  pedidos: [],
  provSearch: ''
};

var NOMES_CLIENTES = ['Marina Alves','Rafael Souza','Camila Duarte','Bruno Ferreira','Juliana Rocha','Pedro Henrique',
  'Larissa Martins','Gustavo Lima','Beatriz Nogueira','Felipe Cardoso','Amanda Teixeira','Lucas Barros',
  'Fernanda Pires','Thiago Moraes','Isabela Correia','Diego Farias'];

/* ============================================================
   HELPERS DE NEGÓCIO (mesma lógica do site, versão enxuta)
   ============================================================ */
function providerAvailable(p){
  if(state.cidade && p.cidades.indexOf(state.cidade)===-1) return false;
  if(state.data && p.blackout.indexOf(state.data)!==-1) return false;
  return true;
}
function providerPriceFor(p, opts){
  opts = opts||{};
  var total = p.preco;
  if(CATEGORY_META[p.cat].unit==='porPessoa'){ total = p.preco * state.convidados; }
  if(p.hasOwnProperty('duracaoBase') && opts.duracao && opts.duracao>p.duracaoBase){
    total += (opts.duracao - p.duracaoBase) * p.horaExtra;
  }
  if(opts.extras && opts.extras.length){
    opts.extras.forEach(function(k){ if(EXTRA_META[k]) total += EXTRA_META[k].preco; });
  }
  return total;
}
function providersOfCategory(cat){ return PROVIDERS.filter(function(p){ return p.cat===cat; }); }
function providerById(id){ return PROVIDERS.filter(function(p){ return p.id===id; })[0]; }
function categoryOrder(){
  if(state.tipo && CATEGORY_PRIORITY[state.tipo]) return CATEGORY_PRIORITY[state.tipo];
  return CATEGORY_ORDER_DEFAULT;
}
function readyToSearch(){ return !!(state.cidade && state.data && state.tipo); }
function extrasArrayFor(id){
  var sel = state.extrasSel[id]||{};
  return Object.keys(sel).filter(function(k){ return sel[k]; });
}
function passesSubfilters(p){
  var f = state.subfilters[state.activeCat] || {};
  for(var k in f){ if(f[k] && p[k] && p[k]!==f[k]) return false; if(f[k] && !p[k]) return false; }
  return true;
}
function updateCartExtras(id){
  var item = state.cart.filter(function(c){ return c.providerId===id; })[0];
  if(item) item.extras = extrasArrayFor(id);
}
// texto "sobre" gerado a partir dos dados do prestador (mesma ideia do site)
function providerAboutText(p, meta){
  var estiloLbl = null;
  meta.filters.forEach(function(fl){
    var opt = fl.options.filter(function(o){ return o.v===p[fl.key]; })[0];
    if(opt && !estiloLbl) estiloLbl = opt.l;
  });
  var frases = [];
  frases.push(p.nome+' atua na categoria '+meta.label.toLowerCase()+(estiloLbl? ', com perfil "'+estiloLbl+'"' : '')+'.');
  frases.push('Nota '+p.rating.toFixed(1)+' em '+p.aval+' avaliações'+(p.badge? ' · destaque: '+p.badge : '')+'.');
  frases.push('Atende: '+p.cidades.map(function(cid){ return CITY_BY_ID[cid].nome; }).join(', ')+'.');
  if(meta.hasDuration && p.duracaoBase){
    frases.push('Pacote base de '+p.duracaoBase+'h'+(p.horaExtra? ', hora adicional a '+BRL.format(p.horaExtra) : '')+'.');
  }
  return frases.join(' ');
}
// estatísticas fictícias do prestador, determinísticas por id (mesma pessoa = mesmos números)
function statsFor(p){
  var rnd = mulberry32(seedFromString(p.id+'-stats'));
  return {
    pedidosMes: 2 + Math.floor(rnd()*9),
    taxaResposta: 84 + Math.floor(rnd()*16),
    diasLivres: DATE_POOL.filter(function(d){ return p.blackout.indexOf(d)===-1; }).length
  };
}
// pedidos (solicitações) fictícios do prestador, gerados uma vez no login
function pedidosFor(p){
  var rnd = mulberry32(seedFromString(p.id+'-pedidos'));
  var n = 3 + Math.floor(rnd()*3);
  var list = [];
  for(var i=0;i<n;i++){
    var nome = NOMES_CLIENTES[Math.floor(rnd()*NOMES_CLIENTES.length)];
    var tipo = EVENT_TYPES[Math.floor(rnd()*EVENT_TYPES.length)];
    var data = DATE_POOL[Math.floor(rnd()*DATE_POOL.length)];
    var cidade = p.cidades[Math.floor(rnd()*p.cidades.length)];
    var roll = rnd();
    var status = roll<0.4 ? 'pendente' : (roll<0.75 ? 'aceito' : 'recusado');
    list.push({id:p.id+'-pd'+i, nome:nome, tipo:tipo.label, data:data, cidade:cidade, status:status, valor:p.preco});
  }
  return list;
}
function statusLabel(s){ return s==='pendente'?'Pendente': s==='aceito'?'Aceito':'Recusado'; }

/* ============================================================
   NAVEGAÇÃO / RENDER
   ============================================================ */
function goTo(screen){
  state.screen = screen;
  render();
  var scr = $('screen'); if(scr) scr.scrollTop = 0;
}
function render(){
  var scr = $('screen'); if(!scr) return;
  switch(state.screen){
    case 'entry':               scr.innerHTML = entryHTML();               wireEntry();               break;
    case 'cliente-gate':        scr.innerHTML = clienteGateHTML();         wireClienteGate();          break;
    case 'cliente-resultados':  scr.innerHTML = clienteResultadosHTML();   wireClienteResultados();    break;
    case 'cliente-carrinho':    scr.innerHTML = clienteCarrinhoHTML();     wireClienteCarrinho();      break;
    case 'prestador-login':     scr.innerHTML = prestadorLoginHTML();      wirePrestadorLogin();       break;
    case 'prestador-inicio':    scr.innerHTML = prestadorInicioHTML();     wirePrestadorInicio();      break;
    case 'prestador-agenda':    scr.innerHTML = prestadorAgendaHTML();     wirePrestadorAgenda();      break;
    case 'prestador-servico':   scr.innerHTML = prestadorServicoHTML();    wirePrestadorServico();     break;
    case 'prestador-pedidos':   scr.innerHTML = prestadorPedidosHTML();    wirePrestadorPedidos();     break;
  }
  renderBottomNav();
}
function headHTML(title, opts){
  opts = opts||{};
  return '<div class="screen-head">'+
    (opts.back!==false? '<button type="button" class="m-back" id="head-back" aria-label="Voltar"><svg><use href="#ic-arrow"/></svg></button>':'')+
    '<h2>'+title+(opts.sub?'<span class="sub"> · '+opts.sub+'</span>':'')+'</h2>'+
    (opts.action? '<button type="button" class="m-headbtn" id="head-action">'+opts.action+'</button>':'')+
  '</div>';
}
function showToast(msg){
  var t = $('toast'); if(!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._tm);
  showToast._tm = setTimeout(function(){ t.classList.remove('show'); }, 1800);
}

/* ============================================================
   NAV INFERIOR
   ============================================================ */
function navBtn(screen, icon, label, active){
  return '<button type="button" data-nav="'+screen+'" class="'+(active?'active':'')+'"><svg><use href="#'+icon+'"/></svg><span>'+label+'</span></button>';
}
function renderBottomNav(){
  var nav = $('bottomnav');
  // o menu só aparece depois de "logado" de verdade — cliente a partir da tela de
  // busca, prestador só depois de escolher qual dos prestadores ele é.
  var mostrar = state.role==='cliente' || (state.role==='prestador' && !!state.providerId);
  if(!mostrar){ nav.hidden = true; nav.innerHTML=''; return; }
  nav.hidden = false;
  if(state.role==='cliente'){
    var buscaAtivo = state.screen==='cliente-gate' || state.screen==='cliente-resultados';
    nav.innerHTML =
      navBtn('cliente-gate','ic-search','Buscar', buscaAtivo) +
      navBtn('cliente-carrinho','ic-bag','Orçamento', state.screen==='cliente-carrinho');
  } else {
    nav.innerHTML =
      navBtn('prestador-inicio','ic-home','Início', state.screen==='prestador-inicio') +
      navBtn('prestador-agenda','ic-calendar','Agenda', state.screen==='prestador-agenda') +
      navBtn('prestador-servico','ic-wrench','Serviço', state.screen==='prestador-servico') +
      navBtn('prestador-pedidos','ic-inbox','Pedidos', state.screen==='prestador-pedidos');
  }
  nav.querySelectorAll('button[data-nav]').forEach(function(b){
    b.onclick = function(){ goTo(b.getAttribute('data-nav')); };
  });
}

/* ============================================================
   TELA: ENTRADA (escolher cliente ou prestador)
   ============================================================ */
function entryHTML(){
  return '<div class="m-hero"><div class="mark"><b>Eventus</b> Hub</div><span class="tag">protótipo do app · dados fictícios</span></div>'+
    '<div class="m-rolecards">'+
      '<button type="button" class="m-rolecard" data-role="cliente">'+
        '<span class="ic"><svg><use href="#ic-search"/></svg></span>'+
        '<span class="tx"><span class="tt">Sou cliente</span><span class="dd">Buscar e contratar prestadores pro meu evento</span></span>'+
        '<span class="arr"><svg><use href="#ic-arrow"/></svg></span>'+
      '</button>'+
      '<button type="button" class="m-rolecard" data-role="prestador">'+
        '<span class="ic"><svg><use href="#ic-wrench"/></svg></span>'+
        '<span class="tx"><span class="tt">Sou prestador de serviço</span><span class="dd">DJ, buffet, decoração e outros parceiros da plataforma</span></span>'+
        '<span class="arr"><svg><use href="#ic-arrow"/></svg></span>'+
      '</button>'+
    '</div>'+
    '<p class="m-footnote">Protótipo com dados fictícios — nada aqui é salvo de verdade além desta sessão do navegador.</p>';
}
function wireEntry(){
  $('screen').querySelectorAll('[data-role]').forEach(function(b){
    b.onclick = function(){
      state.role = b.getAttribute('data-role');
      goTo(state.role==='cliente' ? 'cliente-gate' : 'prestador-login');
    };
  });
}

/* ============================================================
   CLIENTE — busca (cidade / data / tipo / convidados)
   ============================================================ */
function clienteGateHTML(){
  return headHTML('Buscar prestadores') +
    '<div class="m-section">'+
      '<div class="m-label">Cidade</div>'+
      '<div class="m-chiprow">'+ CITIES.map(function(c){
        return '<button type="button" class="m-chip" data-city="'+c.id+'" aria-pressed="'+(state.cidade===c.id)+'">'+c.nome+(c.capital?' <span class="sw">capital</span>':'')+'</button>';
      }).join('') +'</div>'+
    '</div>'+
    '<div class="m-section">'+
      '<div class="m-label">Data</div>'+
      '<div class="m-chiprow scrollx">'+ DATE_POOL.map(function(d){
        return '<button type="button" class="m-chip" data-date="'+d+'" aria-pressed="'+(state.data===d)+'">'+fmtDate(d)+'</button>';
      }).join('') +'</div>'+
    '</div>'+
    '<div class="m-section">'+
      '<div class="m-label">Tipo de evento</div>'+
      '<div class="m-chiprow">'+ EVENT_TYPES.map(function(t){
        return '<button type="button" class="m-chip" data-tipo="'+t.id+'" aria-pressed="'+(state.tipo===t.id)+'">'+t.label+'</button>';
      }).join('') +'</div>'+
    '</div>'+
    '<div class="m-section">'+
      '<div class="m-label">Convidados</div>'+
      '<div class="m-stepper"><span class="lb">Nº de convidados</span><span class="ctrl">'+
        '<button type="button" id="guest-minus">−</button><span class="val tabular">'+state.convidados+'</span><button type="button" id="guest-plus">+</button>'+
      '</span></div>'+
    '</div>'+
    '<div class="m-section">'+
      '<button type="button" class="m-btn-primary" id="gate-cta" '+(readyToSearch()?'':'disabled')+'>Ver prestadores</button>'+
    '</div>';
}
function wireClienteGate(){
  $('head-back').onclick = function(){ state.role=null; goTo('entry'); };
  $('screen').querySelectorAll('[data-city]').forEach(function(b){ b.onclick=function(){ state.cidade = state.cidade===b.dataset.city? null : b.dataset.city; goTo('cliente-gate'); }; });
  $('screen').querySelectorAll('[data-date]').forEach(function(b){ b.onclick=function(){ state.data = state.data===b.dataset.date? null : b.dataset.date; goTo('cliente-gate'); }; });
  $('screen').querySelectorAll('[data-tipo]').forEach(function(b){ b.onclick=function(){ state.tipo = state.tipo===b.dataset.tipo? null : b.dataset.tipo; goTo('cliente-gate'); }; });
  $('guest-minus').onclick = function(){ state.convidados = Math.max(20, state.convidados-10); goTo('cliente-gate'); };
  $('guest-plus').onclick  = function(){ state.convidados = Math.min(500, state.convidados+10); goTo('cliente-gate'); };
  var cta = $('gate-cta');
  if(cta) cta.onclick = function(){
    if(!readyToSearch()) return;
    if(!state.activeCat) state.activeCat = categoryOrder()[0];
    goTo('cliente-resultados');
  };
}

/* ============================================================
   CLIENTE — resultados (categorias, sub-filtros, cards)
   ============================================================ */
function cardHTML(p){
  var meta = CATEGORY_META[p.cat];
  var duracao = meta.hasDuration? (state.duracaoSel[p.cat] || p.duracaoBase) : null;
  var extras = meta.hasExtras? extrasArrayFor(p.id) : [];
  var preco = providerPriceFor(p, {duracao:duracao, extras:extras});
  var unitLabel = meta.unit==='porPessoa'? state.convidados+' conv.' : meta.unit==='diaria'? 'diária' : '';
  var inCart = state.cart.some(function(c){ return c.providerId===p.id; });
  var tags = [];
  meta.filters.forEach(function(fl){ var opt = fl.options.filter(function(o){ return o.v===p[fl.key]; })[0]; if(opt) tags.push(opt.l); });
  if(p.badge) tags.unshift(p.badge);
  return '<div class="m-card'+(inCart?' added':'')+'" data-open="'+p.id+'">'+
    '<div class="thumb" style="background:linear-gradient(135deg,'+p.cores[0]+','+p.cores[1]+')">'+
      '<span class="icwm"><svg width="24" height="24"><use href="#'+meta.icon+'"/></svg></span>'+
      '<span class="badge">'+(CITY_BY_ID[p.cidades[0]]? CITY_BY_ID[p.cidades[0]].nome:'')+'</span>'+
    '</div>'+
    '<div class="body">'+
      '<div class="row1"><span class="name">'+p.nome+'</span><span class="rating"><svg><use href="#ic-star"/></svg>'+p.rating.toFixed(1)+'</span></div>'+
      '<div class="tagrow">'+tags.slice(0,3).map(function(t){ return '<span>'+t+'</span>'; }).join('')+'</div>'+
      '<div class="pricerow"><span class="price">'+BRL.format(preco)+(unitLabel?'<small>'+unitLabel+'</small>':'')+'</span>'+
        '<button type="button" class="addbtn" data-quickadd="'+p.id+'">'+(inCart?'Adicionado ✓':'Adicionar')+'</button>'+
      '</div>'+
    '</div>'+
  '</div>';
}
function clienteResultadosHTML(){
  var meta = CATEGORY_META[state.activeCat];
  var cats = categoryOrder();
  var railHTML = cats.map(function(cat){
    var m = CATEGORY_META[cat];
    var n = providersOfCategory(cat).filter(providerAvailable).length;
    return '<button type="button" class="m-catchip" data-cat="'+cat+'" aria-pressed="'+(state.activeCat===cat)+'"><svg><use href="#'+m.icon+'"/></svg>'+m.label+(n?'<span class="cnt">'+n+'</span>':'')+'</button>';
  }).join('');

  var subfiltersHTML = '<div class="m-fieldrow">' + meta.filters.map(function(fl){
    var cur = (state.subfilters[state.activeCat]||{})[fl.key] || '';
    return '<div class="m-selfield"><label>'+fl.label+'</label><select data-filterkey="'+fl.key+'">'+
      '<option value="">Todos</option>'+
      fl.options.map(function(o){ return '<option value="'+o.v+'" '+(cur===o.v?'selected':'')+'>'+o.l+'</option>'; }).join('')+
    '</select></div>';
  }).join('') +
  (meta.hasDuration? '<div class="m-selfield"><label>Duração</label><select id="duracao-sel">'+
     [2,3,4,5,6,7,8].map(function(h){
       var selVal = state.duracaoSel[state.activeCat] || (state.activeCat==='foto'?6:4);
       return '<option value="'+h+'" '+(selVal===h?'selected':'')+'>'+h+'h</option>';
     }).join('')+
   '</select></div>' : '') +
  '</div>';

  var all = providersOfCategory(state.activeCat);
  var avail = all.filter(providerAvailable).filter(passesSubfilters);
  var cardsHTML;
  if(!avail.length){
    cardsHTML = '<div class="m-empty"><b>Nenhum '+meta.label.toLowerCase()+' disponível</b><br>Tente outra cidade, data ou limpe os filtros.</div>';
  } else {
    avail.sort(function(a,b){ return b.rating-a.rating; });
    cardsHTML = '<div class="m-cardlist">' + avail.map(cardHTML).join('') + '</div>';
  }

  return headHTML(CITY_BY_ID[state.cidade]? CITY_BY_ID[state.cidade].nome : 'Resultados', {sub: state.data? fmtDate(state.data):''}) +
    '<div class="m-catbar"><div class="m-chiprow scrollx">'+railHTML+'</div></div>'+
    '<div class="m-section">'+subfiltersHTML+'</div>'+
    '<div class="m-section">'+cardsHTML+'</div>';
}
function wireClienteResultados(){
  $('head-back').onclick = function(){ goTo('cliente-gate'); };
  $('screen').querySelectorAll('[data-cat]').forEach(function(b){ b.onclick=function(){ state.activeCat=b.dataset.cat; goTo('cliente-resultados'); }; });
  $('screen').querySelectorAll('[data-filterkey]').forEach(function(sel){
    sel.onchange=function(){
      if(!state.subfilters[state.activeCat]) state.subfilters[state.activeCat]={};
      state.subfilters[state.activeCat][sel.dataset.filterkey] = sel.value;
      goTo('cliente-resultados');
    };
  });
  var durSel = $('duracao-sel');
  if(durSel) durSel.onchange = function(){ state.duracaoSel[state.activeCat] = parseInt(durSel.value,10); goTo('cliente-resultados'); };

  $('screen').querySelectorAll('[data-open]').forEach(function(el){
    el.addEventListener('click', function(e){
      if(e.target.closest('[data-quickadd]')) return;
      openSheet(el.getAttribute('data-open'));
    });
  });
  $('screen').querySelectorAll('[data-quickadd]').forEach(function(b){
    b.onclick = function(e){ e.stopPropagation(); quickAddToggle(b.getAttribute('data-quickadd')); };
  });
}
function quickAddToggle(id){
  var p = providerById(id);
  var meta = CATEGORY_META[p.cat];
  var idx = state.cart.findIndex(function(c){ return c.providerId===id; });
  if(idx>-1){ state.cart.splice(idx,1); }
  else{
    var duracao = meta.hasDuration? (state.duracaoSel[p.cat] || p.duracaoBase) : null;
    state.cart.push({providerId:id, duracao:duracao, extras:extrasArrayFor(id)});
  }
  render();
}

/* ============================================================
   CLIENTE — bottom sheet de detalhes do prestador
   ============================================================ */
function openSheet(id){ state.sheetId = id; renderSheet(); }
function closeSheet(){
  state.sheetId = null;
  var ov = document.getElementById('sheet-overlay');
  if(ov){ ov.classList.remove('show'); setTimeout(function(){ if(ov.parentNode) ov.parentNode.removeChild(ov); }, 200); }
  render();
}
function renderSheet(){
  var p = providerById(state.sheetId); if(!p) return;
  var meta = CATEGORY_META[p.cat];
  var duracao = meta.hasDuration? (state.duracaoSel[p.cat] || p.duracaoBase) : null;
  var extras = meta.hasExtras? extrasArrayFor(p.id) : [];
  var preco = providerPriceFor(p, {duracao:duracao, extras:extras});
  var unitLabel = meta.unit==='porPessoa'? ' total · '+state.convidados+' conv.' : meta.unit==='diaria'? ' / diária' : '';
  var inCart = state.cart.some(function(c){ return c.providerId===p.id; });
  var tags = [];
  meta.filters.forEach(function(fl){ var opt = fl.options.filter(function(o){ return o.v===p[fl.key]; })[0]; if(opt) tags.push(opt.l); });
  if(p.badge) tags.unshift(p.badge);

  var tagsHTML = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px;">'+
    tags.map(function(t){ return '<span style="font-size:11px;background:var(--surface);border:1px solid var(--border);color:var(--ink-soft);padding:3px 9px;border-radius:999px;">'+t+'</span>'; }).join('')+
    (duracao?'<span style="font-size:11px;background:var(--surface);border:1px solid var(--border);color:var(--ink-soft);padding:3px 9px;border-radius:999px;">'+duracao+'h contratadas</span>':'')+
  '</div>';

  var extrasHTML = '';
  if(meta.hasExtras && (p.extras||[]).length){
    var sel = state.extrasSel[p.id]||{};
    extrasHTML = '<div class="m-label" style="margin-top:2px;">Equipamentos adicionais</div><div class="m-extras">'+
      p.extras.map(function(k){
        var m = EXTRA_META[k];
        return '<label class="m-extra-toggle" data-checked="'+(!!sel[k])+'"><input type="checkbox" data-extra="'+k+'" '+(sel[k]?'checked':'')+'> '+m.label+' <span class="p">+'+BRL.format(m.preco)+'</span></label>';
      }).join('') +
    '</div>';
  }

  var html =
    '<div class="m-sheet-overlay" id="sheet-overlay">'+
      '<div class="m-sheet">'+
        '<div class="m-sheet-handle"></div>'+
        '<div class="m-sheet-media" style="background:linear-gradient(135deg,'+p.cores[0]+','+p.cores[1]+')">'+
          '<span class="badge">'+(CITY_BY_ID[p.cidades[0]]? CITY_BY_ID[p.cidades[0]].nome:'')+'</span>'+
        '</div>'+
        '<div class="m-sheet-body">'+
          '<div class="row1"><span class="name">'+p.nome+'</span><span class="rating"><svg><use href="#ic-star"/></svg>'+p.rating.toFixed(1)+' ('+p.aval+')</span></div>'+
          tagsHTML +
          '<div class="about">'+providerAboutText(p, meta)+'</div>'+
          extrasHTML +
          '<div class="m-sheet-foot"><span class="price">'+BRL.format(preco)+'<small>'+(unitLabel||'valor estimado')+'</small></span>'+
            '<button type="button" class="m-btn-primary" style="width:auto;padding:12px 20px;" id="sheet-addbtn">'+(inCart?'Remover':'Adicionar')+'</button>'+
          '</div>'+
        '</div>'+
      '</div>'+
    '</div>';

  var old = document.getElementById('sheet-overlay'); if(old) old.remove();
  $('phone-shell').insertAdjacentHTML('beforeend', html);
  var ov = document.getElementById('sheet-overlay');
  requestAnimationFrame(function(){ ov.classList.add('show'); });
  ov.addEventListener('click', function(e){ if(e.target===ov) closeSheet(); });
  ov.querySelectorAll('[data-extra]').forEach(function(inp){
    inp.onchange = function(){
      if(!state.extrasSel[p.id]) state.extrasSel[p.id]={};
      state.extrasSel[p.id][inp.dataset.extra] = inp.checked;
      if(inCart) updateCartExtras(p.id);
      renderSheet();
    };
  });
  document.getElementById('sheet-addbtn').onclick = function(){
    quickAddToggle(p.id);
    renderSheet();
  };
}

/* ============================================================
   CLIENTE — orçamento (carrinho)
   ============================================================ */
function clienteCarrinhoHTML(){
  var body;
  if(!state.cart.length){
    body = '<div class="m-empty"><b>Seu orçamento está vazio.</b><br>Volte pra busca e adicione prestadores.</div>';
  } else {
    body = state.cart.map(function(item){
      var p = providerById(item.providerId); if(!p) return '';
      var meta = CATEGORY_META[p.cat];
      var preco = providerPriceFor(p, {duracao:item.duracao, extras:item.extras});
      var exTxt = (item.extras&&item.extras.length)? item.extras.map(function(k){ return EXTRA_META[k].label; }).join(', ') : (item.duracao? item.duracao+'h contratadas':'');
      return '<div class="m-cartrow"><div class="ci"><svg><use href="#'+meta.icon+'"/></svg></div>'+
        '<div class="cm"><div class="cat">'+meta.label+'</div><div class="nm">'+p.nome+'</div>'+(exTxt?'<div style="font-size:11px;color:var(--ink-faint);">'+exTxt+'</div>':'')+'</div>'+
        '<div class="cr"><span class="price">'+BRL.format(preco)+'</span><button type="button" class="rm" data-rm="'+p.id+'">remover</button></div>'+
      '</div>';
    }).join('');
  }
  var total = state.cart.reduce(function(s,item){ var p=providerById(item.providerId); return p? s+providerPriceFor(p,{duracao:item.duracao,extras:item.extras}) : s; },0);
  return headHTML('Orçamento') +
    '<div class="m-section">'+body+'</div>'+
    (state.cart.length? '<div class="m-cartfoot"><div class="line"><span>'+state.cart.length+' item(ns) selecionado(s)</span><span></span></div>'+
      '<div class="grand"><span>Total estimado</span><span class="tabular">'+BRL.format(total)+'</span></div></div>' : '');
}
function wireClienteCarrinho(){
  $('head-back').onclick = function(){ goTo(state.cidade? 'cliente-resultados':'cliente-gate'); };
  $('screen').querySelectorAll('[data-rm]').forEach(function(b){
    b.onclick = function(){ state.cart = state.cart.filter(function(c){ return c.providerId!==b.dataset.rm; }); render(); };
  });
}

/* ============================================================
   PRESTADOR — login (escolher qual dos 44 prestadores fictícios)
   ============================================================ */
function prestadorLoginHTML(){
  return headHTML('Entrar como prestador') +
    '<div class="m-section">'+
      '<div class="m-search"><svg><use href="#ic-search"/></svg><input type="text" id="prov-search" placeholder="Buscar por nome ou categoria" value="'+(state.provSearch||'')+'"></div>'+
      '<div class="m-provlist" id="prov-list"></div>'+
    '</div>';
}
function provListHTML(){
  var q = (state.provSearch||'').toLowerCase().trim();
  var list = PROVIDERS.filter(function(p){
    if(!q) return true;
    var meta = CATEGORY_META[p.cat];
    return p.nome.toLowerCase().indexOf(q)!==-1 || meta.label.toLowerCase().indexOf(q)!==-1;
  });
  if(!list.length) return '<div class="m-empty">Nenhum prestador encontrado.</div>';
  return list.map(function(p){
    var meta = CATEGORY_META[p.cat];
    return '<button type="button" class="m-provrow" data-login="'+p.id+'">'+
      '<span class="ic" style="background:linear-gradient(135deg,'+p.cores[0]+','+p.cores[1]+')"><svg><use href="#'+meta.icon+'"/></svg></span>'+
      '<span class="info"><span class="nm">'+p.nome+'</span><br><span class="ct">'+meta.label+' · '+CITY_BY_ID[p.cidades[0]].nome+(p.cidades.length>1? ' +'+(p.cidades.length-1):'')+'</span></span>'+
      '<span class="arr"><svg><use href="#ic-arrow"/></svg></span>'+
    '</button>';
  }).join('');
}
function wirePrestadorLogin(){
  $('head-back').onclick = function(){ state.role=null; goTo('entry'); };
  var listEl = $('prov-list'); listEl.innerHTML = provListHTML();
  wireProvList();
  var search = $('prov-search');
  search.oninput = function(){ state.provSearch = search.value; listEl.innerHTML = provListHTML(); wireProvList(); };
}
function wireProvList(){
  $('prov-list').querySelectorAll('[data-login]').forEach(function(b){
    b.onclick = function(){ loginAsProvider(b.getAttribute('data-login')); };
  });
}
function loginAsProvider(id){
  state.providerId = id;
  state.pedidos = pedidosFor(providerById(id));
  goTo('prestador-inicio');
}

/* ============================================================
   PRESTADOR — início (perfil + estatísticas + atalhos)
   ============================================================ */
function quickRow(screen, icon, title, desc){
  return '<div class="m-quickrow" data-goto="'+screen+'"><span class="ic"><svg><use href="#'+icon+'"/></svg></span>'+
    '<span class="tt">'+title+'<span class="dd" style="display:block;font-weight:500;">'+desc+'</span></span>'+
    '<span class="arr"><svg><use href="#ic-arrow"/></svg></span></div>';
}
function prestadorInicioHTML(){
  var p = providerById(state.providerId);
  var meta = CATEGORY_META[p.cat];
  var stats = statsFor(p);
  return headHTML('Olá, '+p.nome.split(' ')[0], {back:false, action:'Sair'}) +
    '<div class="m-section">'+
      '<div class="m-profile-card">'+
        '<span class="av" style="background:linear-gradient(135deg,'+p.cores[0]+','+p.cores[1]+')"><svg><use href="#'+meta.icon+'"/></svg></span>'+
        '<div><div class="nm">'+p.nome+'</div><div class="ct">'+meta.label+' · atende '+p.cidades.length+' cidade(s)</div>'+
        '<div class="rt"><svg><use href="#ic-star"/></svg>'+p.rating.toFixed(1)+' ('+p.aval+' avaliações)</div></div>'+
      '</div>'+
      '<div class="m-statrow">'+
        '<div class="m-stat"><div class="v">'+stats.pedidosMes+'</div><div class="l">pedidos este mês</div></div>'+
        '<div class="m-stat"><div class="v">'+stats.taxaResposta+'%</div><div class="l">taxa de resposta</div></div>'+
        '<div class="m-stat"><div class="v">'+stats.diasLivres+'</div><div class="l">datas livres cadastradas</div></div>'+
      '</div>'+
      '<div class="m-quicklist">'+
        quickRow('prestador-agenda','ic-calendar','Agenda','Marcar datas disponíveis ou bloqueadas')+
        quickRow('prestador-servico','ic-wrench','Serviços & preços','Editar valores, estilo e regiões atendidas')+
        quickRow('prestador-pedidos','ic-inbox','Pedidos','Ver e responder solicitações de clientes')+
      '</div>'+
    '</div>';
}
function wirePrestadorInicio(){
  var actionBtn = $('head-action');
  if(actionBtn) actionBtn.onclick = function(){ state.role=null; state.providerId=null; goTo('entry'); };
  $('screen').querySelectorAll('[data-goto]').forEach(function(el){ el.onclick = function(){ goTo(el.getAttribute('data-goto')); }; });
}

/* ============================================================
   PRESTADOR — agenda (disponibilidade por data)
   ============================================================ */
function prestadorAgendaHTML(){
  var p = providerById(state.providerId);
  var rows = DATE_POOL.map(function(d){
    var disponivel = p.blackout.indexOf(d)===-1;
    return '<div class="m-daterow"><span class="dt">'+fmtDateLong(d)+'<small>'+(disponivel?'Disponível':'Bloqueado')+'</small></span>'+
      '<button type="button" class="m-toggle" data-date="'+d+'" aria-pressed="'+disponivel+'" aria-label="'+(disponivel?'Disponível':'Bloqueado')+'"></button>'+
    '</div>';
  }).join('');
  return headHTML('Agenda', {back:false}) +
    '<div class="m-section">'+
      '<p style="font-size:12px;color:var(--ink-faint);margin:0 0 14px;">Toque no botão pra marcar uma data como disponível ou bloqueada. Neste protótipo as datas começam com um bloqueio de exemplo gerado automaticamente.</p>'+
      '<div class="m-datelist">'+rows+'</div>'+
    '</div>';
}
function wirePrestadorAgenda(){
  var p = providerById(state.providerId);
  $('screen').querySelectorAll('[data-date]').forEach(function(btn){
    btn.onclick = function(){
      var d = btn.getAttribute('data-date');
      var idx = p.blackout.indexOf(d);
      var ficandoDisponivel = idx>-1;
      if(idx>-1){ p.blackout.splice(idx,1); } else { p.blackout.push(d); }
      render();
      showToast(ficandoDisponivel? 'Data marcada como disponível' : 'Data marcada como bloqueada');
    };
  });
}

/* ============================================================
   PRESTADOR — serviços & preços
   ============================================================ */
function prestadorServicoHTML(){
  var p = providerById(state.providerId);
  var meta = CATEGORY_META[p.cat];
  var unitLabel = meta.unit==='porPessoa' ? 'por pessoa' : meta.unit==='diaria' ? 'por diária' : 'pacote fechado';

  var filtrosHTML = meta.filters.map(function(fl){
    return '<div class="m-field"><label>'+fl.label+'</label><select data-field="'+fl.key+'">'+
      fl.options.map(function(o){ return '<option value="'+o.v+'" '+(p[fl.key]===o.v?'selected':'')+'>'+o.l+'</option>'; }).join('')+
    '</select></div>';
  }).join('');

  var duracaoHTML = meta.hasDuration ? (
    '<div class="m-field"><label>Duração inclusa no pacote (horas)</label><input type="number" min="1" max="12" id="f-duracaoBase" value="'+p.duracaoBase+'"></div>'+
    '<div class="m-field"><label>Valor da hora extra</label><input type="number" min="0" step="10" id="f-horaExtra" value="'+p.horaExtra+'"></div>'
  ) : '';

  var extrasHTML = meta.hasExtras ? (
    '<div class="m-field"><label>Equipamentos adicionais que você oferece</label><div class="m-checklist">'+
      Object.keys(EXTRA_META).map(function(k){
        var m = EXTRA_META[k];
        var checked = (p.extras||[]).indexOf(k)!==-1;
        return '<div class="m-checkrow"><input type="checkbox" id="ex-'+k+'" data-extra="'+k+'" '+(checked?'checked':'')+'><label for="ex-'+k+'">'+m.label+' <span class="tabular" style="color:var(--ink-faint);">(+'+BRL.format(m.preco)+')</span></label></div>';
      }).join('')+
    '</div></div>'
  ) : '';

  var regioesHTML = '<div class="m-field"><label>Regiões atendidas</label><div class="m-checklist">'+
    CITIES.map(function(c){
      var checked = p.cidades.indexOf(c.id)!==-1;
      return '<div class="m-checkrow"><input type="checkbox" id="ct-'+c.id+'" data-cidade="'+c.id+'" '+(checked?'checked':'')+'><label for="ct-'+c.id+'">'+c.nome+'</label></div>';
    }).join('')+
  '</div></div>';

  return headHTML('Serviços & preços', {back:false}) +
    '<div class="m-section">'+
      '<div class="m-field"><label>Preço base ('+unitLabel+')</label><input type="number" min="0" step="10" id="f-preco" value="'+p.preco+'">'+
        '<div class="hint">Este é o valor que os clientes veem antes de horas extras ou equipamentos adicionais.</div>'+
      '</div>'+
      filtrosHTML + duracaoHTML + regioesHTML + extrasHTML +
    '</div>'+
    '<div class="m-savebar"><button type="button" class="m-btn-primary" id="save-servico">Salvar alterações</button></div>';
}
function wirePrestadorServico(){
  var p = providerById(state.providerId);
  $('save-servico').onclick = function(){
    var precoInp = $('f-preco'); if(precoInp) p.preco = Math.max(0, Number(precoInp.value)||p.preco);
    var durInp = $('f-duracaoBase'); if(durInp) p.duracaoBase = Math.max(1, Number(durInp.value)||p.duracaoBase);
    var horaInp = $('f-horaExtra'); if(horaInp) p.horaExtra = Math.max(0, Number(horaInp.value)||p.horaExtra);
    $('screen').querySelectorAll('[data-field]').forEach(function(sel){ p[sel.getAttribute('data-field')] = sel.value; });
    var novasCidades = [];
    $('screen').querySelectorAll('[data-cidade]').forEach(function(chk){ if(chk.checked) novasCidades.push(chk.getAttribute('data-cidade')); });
    if(novasCidades.length) p.cidades = novasCidades;
    if(CATEGORY_META[p.cat].hasExtras){
      var novosExtras = [];
      $('screen').querySelectorAll('[data-extra]').forEach(function(chk){ if(chk.checked) novosExtras.push(chk.getAttribute('data-extra')); });
      p.extras = novosExtras;
    }
    render();
    showToast('Alterações salvas ✓');
  };
}

/* ============================================================
   PRESTADOR — pedidos (solicitações fictícias)
   ============================================================ */
function prestadorPedidosHTML(){
  var list = state.pedidos || [];
  var body;
  if(!list.length){
    body = '<div class="m-empty">Nenhum pedido ainda.</div>';
  } else {
    body = list.map(function(pd){
      var acts = pd.status==='pendente'
        ? '<div class="acts"><button type="button" class="ok" data-accept="'+pd.id+'">Aceitar</button><button type="button" class="no" data-decline="'+pd.id+'">Recusar</button></div>'
        : '';
      return '<div class="m-pedido"><div class="top"><div><div class="nm">'+pd.nome+'</div><div class="meta">'+pd.tipo+' · '+CITY_BY_ID[pd.cidade].nome+' · '+fmtDate(pd.data)+'</div></div><div class="val">'+BRL.format(pd.valor)+'</div></div>'+
        '<span class="m-status '+pd.status+'">'+statusLabel(pd.status)+'</span>'+
        acts +
      '</div>';
    }).join('');
  }
  return headHTML('Pedidos', {back:false}) + '<div class="m-section">'+body+'</div>';
}
function wirePrestadorPedidos(){
  $('screen').querySelectorAll('[data-accept]').forEach(function(b){ b.onclick = function(){ setPedidoStatus(b.getAttribute('data-accept'),'aceito'); }; });
  $('screen').querySelectorAll('[data-decline]').forEach(function(b){ b.onclick = function(){ setPedidoStatus(b.getAttribute('data-decline'),'recusado'); }; });
}
function setPedidoStatus(id, status){
  var pd = (state.pedidos||[]).filter(function(x){ return x.id===id; })[0];
  if(!pd) return;
  pd.status = status;
  render();
  showToast(status==='aceito' ? 'Pedido aceito ✓' : 'Pedido recusado');
}

/* ============================================================
   RELÓGIO DA BARRA DE STATUS + INÍCIO
   ============================================================ */
function updateClock(){
  var t = $('sb-time');
  if(t) t.textContent = new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
}
updateClock();
setInterval(updateClock, 30000);

render();
