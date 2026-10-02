"use strict";

/* ============================================================
   ESTADO
   ============================================================ */
var state = {
  cidade:null, data:null, tipo:null, convidados:100,
  stage:'gate',
  activeCat:null,
  subfilters:{}, // por categoria: {estilo:'', formato:''}
  duracaoSel:{}, // por categoria: horas escolhidas
  extrasSel:{},  // por providerId: {fumaca:true,...}
  cart:[],       // {providerId, extras:[], duracaoExtra:0}
  mapPopupCity:null // qual balão do mapa deve continuar aberto após um re-render
};

/* ============================================================
   HELPERS DE NEGÓCIO
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
function providersOfCategory(cat){
  return PROVIDERS.filter(function(p){ return p.cat===cat; });
}
function categoryOrder(){
  if(state.tipo && CATEGORY_PRIORITY[state.tipo]) return CATEGORY_PRIORITY[state.tipo];
  return CATEGORY_ORDER_DEFAULT;
}

// média de "kit" de evento completo servindo uma cidade (para o mapa)
var CORE_CATS_FOR_BUDGET = ['salao','buffet','dj','decoracao','foto'];
function avgEventBudget(cityId){
  var parts = {};
  var total = 0;
  CORE_CATS_FOR_BUDGET.forEach(function(cat){
    var local = PROVIDERS.filter(function(p){return p.cat===cat && p.cidades.indexOf(cityId)!==-1;});
    var pool = local.length? local : providersOfCategory(cat); // fallback: média geral se ninguém atende a cidade
    var sum = 0;
    pool.forEach(function(p){ sum += providerPriceFor(p,{}); });
    var avg = pool.length? sum/pool.length : 0;
    parts[cat] = {valor:avg, local: local.length>0};
    total += avg;
  });
  return {total:total, parts:parts};
}

/* ============================================================
   RENDER — GATE
   ============================================================ */
var $ = function(id){return document.getElementById(id);};

function renderGateCities(){
  var el = $('gate-cities'); el.innerHTML='';
  CITIES.forEach(function(c){
    var b = document.createElement('button');
    b.type='button'; b.className='chip'; b.setAttribute('aria-pressed', state.cidade===c.id);
    b.innerHTML = c.nome + (c.capital? ' <span class="sw">capital</span>':'');
    b.onclick = function(){ state.cidade = (state.cidade===c.id? null : c.id); syncAll(); };
    el.appendChild(b);
  });
}
function renderGateDates(){
  var el = $('gate-dates'); el.innerHTML='';
  DATE_POOL.forEach(function(d){
    var b = document.createElement('button');
    b.type='button'; b.className='chip'; b.setAttribute('aria-pressed', state.data===d);
    b.innerHTML = fmtDate(d);
    b.onclick = function(){ state.data = (state.data===d? null : d); syncAll(); };
    el.appendChild(b);
  });
}
function renderGateTypes(){
  var el = $('gate-types'); el.innerHTML='';
  EVENT_TYPES.forEach(function(t){
    var b = document.createElement('button');
    b.type='button'; b.className='chip'; b.setAttribute('aria-pressed', state.tipo===t.id);
    b.textContent = t.label;
    b.onclick = function(){ state.tipo = (state.tipo===t.id? null : t.id); syncAll(); };
    el.appendChild(b);
  });
}
function renderGuest(){ $('guest-val').textContent = state.convidados; }

function renderSearchPill(){
  $('seg-city-v').textContent = state.cidade? CITY_BY_ID[state.cidade].nome : 'Selecionar cidade';
  $('seg-city-v').classList.toggle('placeholder', !state.cidade);
  $('seg-date-v').textContent = state.data? fmtDate(state.data) : 'Quando é o evento?';
  $('seg-date-v').classList.toggle('placeholder', !state.data);
  var t = EVENT_TYPES.filter(function(e){return e.id===state.tipo;})[0];
  $('seg-type-v').textContent = t? t.label : 'Tipo de evento';
  $('seg-type-v').classList.toggle('placeholder', !t);
}

function readyToSearch(){ return !!(state.cidade && state.data && state.tipo); }

/* ============================================================
   RENDER — RESULTADOS
   ============================================================ */
function renderCatRail(){
  var el = $('catrail'); el.innerHTML='';
  categoryOrder().forEach(function(catId){
    var meta = CATEGORY_META[catId];
    var count = providersOfCategory(catId).filter(providerAvailable).length;
    var b = document.createElement('button');
    b.type='button'; b.className='catchip'; b.setAttribute('aria-pressed', state.activeCat===catId);
    b.style.position='relative';
    b.innerHTML = '<svg><use href="#'+meta.icon+'"/></svg><span>'+meta.label+'</span>'+(count? '<i class="cnt" style="position:absolute;top:2px;right:6px;">'+count+'</i>':'');
    b.onclick = function(){ state.activeCat = catId; renderCatRail(); renderSubfilters(); renderCards(); };
    el.appendChild(b);
  });
}

function currentFiltersFor(cat){
  if(!state.subfilters[cat]) state.subfilters[cat] = {};
  return state.subfilters[cat];
}

function renderSubfilters(){
  var el = $('subfilters'); el.innerHTML='';
  if(!state.activeCat) return;
  var meta = CATEGORY_META[state.activeCat];
  var f = currentFiltersFor(state.activeCat);

  meta.filters.forEach(function(fl){
    var sel = document.createElement('select');
    sel.className='selfilter';
    var optAll = document.createElement('option'); optAll.value=''; optAll.textContent = fl.label+': todos'; sel.appendChild(optAll);
    fl.options.forEach(function(o){
      var op=document.createElement('option'); op.value=o.v; op.textContent=o.l; sel.appendChild(op);
    });
    sel.value = f[fl.key]||'';
    sel.onchange = function(){ f[fl.key]=sel.value; renderCards(); };
    el.appendChild(sel);
  });

  if(meta.hasDuration){
    var wrap = document.createElement('div'); wrap.className='durwrap';
    var span = document.createElement('span'); span.textContent='Duração';
    var sel = document.createElement('select');
    [3,4,5,6,7,8].forEach(function(h){
      var op=document.createElement('option'); op.value=h; op.textContent=h+'h'; sel.appendChild(op);
    });
    sel.value = state.duracaoSel[state.activeCat]|| (state.activeCat==='foto'?6:4);
    state.duracaoSel[state.activeCat]=parseInt(sel.value,10);
    sel.onchange=function(){ state.duracaoSel[state.activeCat]=parseInt(sel.value,10); renderCards(); };
    wrap.appendChild(span); wrap.appendChild(sel);
    el.appendChild(wrap);
  }

  if(state.activeCat==='buffet'){
    var badge=document.createElement('span'); badge.className='selfilter'; badge.style.cursor='default';
    badge.innerHTML = '<span class="mono">'+state.convidados+'</span> convidados (ajuste na busca)';
    el.appendChild(badge);
  }
}

function extrasSelectedFor(providerId){
  return state.extrasSel[providerId] || {};
}
function extrasArrayFor(providerId){
  var o = extrasSelectedFor(providerId);
  return Object.keys(o).filter(function(k){return o[k];});
}

// Retorna a foto do prestador: usa p.foto (arquivo local) se existir,
// senão busca uma foto de exemplo por categoria (precisa de internet).
// Se a foto não carregar (offline, ou serviço fora do ar), o card volta
// sozinho pra ilustração — ver o onerror da <img> em cardHTML().
function photoUrlFor(p){
  if(p.foto) return p.foto;
  var kw = CATEGORY_PHOTO_KEYWORDS[p.cat] || 'event,party';
  var seed = Math.abs(seedFromString(p.id+'-photo')) % 100000;
  return 'https://loremflickr.com/400/300/'+kw+'?lock='+seed;
}

function providerArtSVG(p, meta){
  var rnd = mulberry32(seedFromString(p.id+'-art'));
  var rot = (rnd()*16-8).toFixed(1);
  var accents = [];
  for(var i=0;i<4;i++){
    accents.push({x:16+rnd()*368, y:14+rnd()*70, r:3.5+rnd()*6, op:0.12+rnd()*0.16});
  }
  var accentSvg = accents.map(function(a){return '<circle cx="'+a.x.toFixed(1)+'" cy="'+a.y.toFixed(1)+'" r="'+a.r.toFixed(1)+'" fill="#fff" opacity="'+a.op.toFixed(2)+'"/>';}).join('');
  var uid = p.id;
  return '<svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0;width:100%;height:100%;">'+
    '<defs><radialGradient id="glow-'+uid+'" cx="50%" cy="34%" r="70%"><stop offset="0" stop-color="#fff" stop-opacity="0.30"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'+
    '<rect width="400" height="220" fill="url(#glow-'+uid+')"/>'+
    accentSvg+
    '<g transform="translate(200,114) rotate('+rot+')">'+
      '<circle r="56" fill="#fff" opacity="0.15"/>'+
      '<use href="#'+meta.icon+'" x="-34" y="-34" width="68" height="68" color="#fff" opacity="0.94"/>'+
    '</g>'+
    '<rect x="6" y="6" width="388" height="208" rx="10" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="1.5"/>'+
  '</svg>';
}

// Monta um texto de "sobre" a partir dos próprios dados do prestador (nada
// escrito à mão por prestador — são 44 fictícios, então geramos a partir do
// que já existe: estilo/formato, nota, cidades atendidas, pacote/hora extra).
function providerAboutText(p, meta){
  var estiloLbl = null;
  meta.filters.forEach(function(fl){
    var opt = fl.options.filter(function(o){return o.v===p[fl.key];})[0];
    if(opt && !estiloLbl) estiloLbl = opt.l;
  });
  var frases = [];
  frases.push(p.nome+' atua na categoria '+meta.label.toLowerCase()+(estiloLbl? ', com perfil "'+estiloLbl+'"' : '')+'.');
  frases.push('Nota '+p.rating.toFixed(1)+' em '+p.aval+' avaliações de clientes'+(p.badge? ' · destaque: '+p.badge : '')+'.');
  var cidNomes = p.cidades.map(function(cid){return CITY_BY_ID[cid].nome;});
  frases.push('Atende: '+cidNomes.join(', ')+'.');
  if(meta.hasDuration && p.duracaoBase){
    frases.push('Pacote base de '+p.duracaoBase+'h'+(p.horaExtra? ', hora adicional a '+BRL.format(p.horaExtra) : '')+'.');
  }
  if(meta.hasExtras && (p.extras||[]).length){
    frases.push('Equipamentos disponíveis sob consulta: '+p.extras.map(function(k){return EXTRA_META[k].label;}).join(', ')+'.');
  }
  return frases.join(' ');
}

function cardHTML(p){
  var meta = CATEGORY_META[p.cat];
  var duracao = meta.hasDuration? (state.duracaoSel[p.cat]|| p.duracaoBase) : null;
  var extras = meta.hasExtras? extrasArrayFor(p.id) : [];
  var preco = providerPriceFor(p, {duracao:duracao, extras:extras});
  var unitLabel = meta.unit==='porPessoa'? ' total · '+state.convidados+' conv.' : meta.unit==='diaria'? ' / diária' : '';
  var inCart = state.cart.some(function(c){return c.providerId===p.id;});

  var tags = [];
  Object.keys(meta.filters.reduce(function(a,f){a[f.key]=1;return a;},{})).forEach(function(){});
  meta.filters.forEach(function(fl){
    var val = p[fl.key];
    var opt = fl.options.filter(function(o){return o.v===val;})[0];
    if(opt) tags.push(opt.l);
  });
  if(p.badge) tags.unshift(p.badge);

  var div = document.createElement('div');
  div.className='card'+(inCart?' added':'');
  div.tabIndex = 0;
  div.setAttribute('role','button');
  div.setAttribute('aria-label','Ver detalhes de '+p.nome);
  div.onclick = function(){ openProviderModal(p.id); };
  div.onkeydown = function(e){ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); openProviderModal(p.id); } };

  var thumb = document.createElement('div');
  thumb.className='thumb';
  thumb.style.background='linear-gradient(135deg,'+p.cores[0]+','+p.cores[1]+')';
  thumb.insertAdjacentHTML('afterbegin', providerArtSVG(p, meta));
  var img = document.createElement('img');
  img.className='photo'; img.alt=''; img.loading='lazy'; img.decoding='async';
  img.src = photoUrlFor(p);
  img.onerror = function(){ img.style.display='none'; };
  thumb.appendChild(img);
  var bd = document.createElement('span'); bd.className='badge'; bd.textContent = CITY_BY_ID[p.cidades[0]]? CITY_BY_ID[p.cidades[0]].nome : '';
  thumb.appendChild(bd);
  div.appendChild(thumb);

  var body = document.createElement('div'); body.className='body';
  body.innerHTML =
    '<div class="row1"><span class="name">'+p.nome+'</span><span class="rating"><svg width="12" height="12" style="color:var(--gold)"><use href="#ic-star"/></svg><b>'+p.rating.toFixed(1)+'</b> ('+p.aval+')</span></div>'+
    '<div class="meta">Atende: '+p.cidades.map(function(cid){return CITY_BY_ID[cid].nome;}).join(', ')+'</div>'+
    '<div class="tagrow">'+tags.map(function(t){return '<span>'+t+'</span>';}).join('')+(duracao?'<span>'+duracao+'h contratadas</span>':'')+'</div>'+
    '<div class="spacer"></div>'+
    '<div class="pricerow"><span class="price">'+BRL.format(preco)+'<br><small>'+unitLabel+'</small></span></div>';
  div.appendChild(body);

  var priceRow = body.querySelector('.pricerow');
  var addBtn = document.createElement('button');
  addBtn.className='addbtn';
  addBtn.textContent = inCart? 'Adicionado ✓' : 'Adicionar';
  addBtn.onclick = function(e){ e.stopPropagation(); toggleCart(p, {duracao:duracao, extras:extras}); };
  priceRow.appendChild(addBtn);

  if(meta.hasExtras){
    var ep = document.createElement('div'); ep.className='extras-panel';
    ep.onclick = function(e){ e.stopPropagation(); };
    var et = document.createElement('div'); et.className='et'; et.textContent='Equipamentos adicionais';
    ep.appendChild(et);
    var list = document.createElement('div'); list.className='extras-list';
    (p.extras||[]).forEach(function(k){
      var m = EXTRA_META[k];
      var lbl = document.createElement('label'); lbl.className='extra-toggle';
      var sel = extrasSelectedFor(p.id);
      lbl.setAttribute('data-checked', !!sel[k]);
      lbl.innerHTML = '<input type="checkbox" '+(sel[k]?'checked':'')+'> '+m.label+' <span class="p">+'+BRL.format(m.preco)+'</span>';
      lbl.querySelector('input').onchange = function(e){
        if(!state.extrasSel[p.id]) state.extrasSel[p.id]={};
        state.extrasSel[p.id][k] = e.target.checked;
        renderCards();
        if(inCart){ updateCartExtras(p.id); }
        if(pdmodalState.providerId===p.id){ renderProviderModal(p.id); }
      };
      list.appendChild(lbl);
    });
    ep.appendChild(list);
    div.appendChild(ep);
  }

  return div;
}

/* ============================================================
   MODAL DE DETALHES DO PRESTADOR (abre ao clicar num card)
   ============================================================ */
var pdmodalState = { providerId:null };

function openProviderModal(id){
  pdmodalState.providerId = id;
  renderProviderModal(id);
  $('pdmodal').classList.add('show');
  $('pdmodal').setAttribute('aria-hidden','false');
  document.body.style.overflow='hidden';
}
function closeProviderModal(){
  pdmodalState.providerId = null;
  $('pdmodal').classList.remove('show');
  $('pdmodal').setAttribute('aria-hidden','true');
  document.body.style.overflow='';
}

function renderProviderModal(id){
  var p = providerById(id);
  if(!p) return;
  var meta = CATEGORY_META[p.cat];
  var duracao = meta.hasDuration? (state.duracaoSel[p.cat]|| p.duracaoBase) : null;
  var extras = meta.hasExtras? extrasArrayFor(p.id) : [];
  var preco = providerPriceFor(p, {duracao:duracao, extras:extras});
  var unitLabel = meta.unit==='porPessoa'? ' total · '+state.convidados+' conv.' : meta.unit==='diaria'? ' / diária' : '';
  var inCart = state.cart.some(function(c){return c.providerId===p.id;});

  var tags = [];
  meta.filters.forEach(function(fl){
    var opt = fl.options.filter(function(o){return o.v===p[fl.key];})[0];
    if(opt) tags.push(opt.l);
  });
  if(p.badge) tags.unshift(p.badge);

  var media = $('pdmodal-media');
  media.innerHTML='';
  media.style.background='linear-gradient(135deg,'+p.cores[0]+','+p.cores[1]+')';
  media.insertAdjacentHTML('afterbegin', providerArtSVG(p, meta));
  if(typeof photoUrlFor==='function'){
    var img = document.createElement('img');
    img.className='photo'; img.alt=''; img.loading='lazy'; img.decoding='async';
    img.src = photoUrlFor(p);
    img.onerror = function(){ img.style.display='none'; };
    media.appendChild(img);
  }
  var bd = document.createElement('span'); bd.className='badge';
  bd.textContent = CITY_BY_ID[p.cidades[0]]? CITY_BY_ID[p.cidades[0]].nome : '';
  media.appendChild(bd);

  var body = $('pdmodal-body');
  body.innerHTML =
    '<div class="row1"><span class="name">'+p.nome+'</span><span class="rating"><svg width="14" height="14" style="color:var(--gold)"><use href="#ic-star"/></svg><b>'+p.rating.toFixed(1)+'</b> ('+p.aval+' avaliações)</span></div>'+
    '<div class="tagrow">'+tags.map(function(t){return '<span>'+t+'</span>';}).join('')+(duracao?'<span>'+duracao+'h contratadas</span>':'')+'</div>'+
    '<div class="about">'+providerAboutText(p, meta)+'</div>';

  if(meta.hasExtras && (p.extras||[]).length){
    var ep = document.createElement('div'); ep.className='extras-panel';
    var et = document.createElement('div'); et.className='et'; et.textContent='Equipamentos adicionais';
    ep.appendChild(et);
    var list = document.createElement('div'); list.className='extras-list';
    p.extras.forEach(function(k){
      var m = EXTRA_META[k];
      var lbl = document.createElement('label'); lbl.className='extra-toggle';
      var sel = extrasSelectedFor(p.id);
      lbl.setAttribute('data-checked', !!sel[k]);
      lbl.innerHTML = '<input type="checkbox" '+(sel[k]?'checked':'')+'> '+m.label+' <span class="p">+'+BRL.format(m.preco)+'</span>';
      lbl.querySelector('input').onchange = function(e){
        if(!state.extrasSel[p.id]) state.extrasSel[p.id]={};
        state.extrasSel[p.id][k] = e.target.checked;
        renderCards();
        if(state.cart.some(function(c){return c.providerId===p.id;})){ updateCartExtras(p.id); }
        renderProviderModal(p.id);
      };
      list.appendChild(lbl);
    });
    ep.appendChild(list);
    body.appendChild(ep);
  }

  var foot = document.createElement('div'); foot.className='pdmodal-foot';
  foot.innerHTML = '<span class="price">'+BRL.format(preco)+'<small>'+(unitLabel||'valor estimado')+'</small></span>';
  var addBtn = document.createElement('button');
  addBtn.className='addbtn'+(inCart?' added':'');
  addBtn.textContent = inCart? 'Adicionado ✓ (remover)' : 'Adicionar ao orçamento';
  addBtn.onclick = function(){ toggleCart(p, {duracao:duracao, extras:extras}); renderProviderModal(p.id); };
  foot.appendChild(addBtn);
  body.appendChild(foot);
}

function passesSubfilters(p){
  var f = currentFiltersFor(p.cat);
  for(var k in f){ if(f[k] && p[k] && p[k]!==f[k]) return false; if(f[k] && !p[k]) return false; }
  return true;
}

function renderCards(){
  var el = $('cards'); el.innerHTML='';
  if(!state.activeCat) return;
  var meta = CATEGORY_META[state.activeCat];
  var all = providersOfCategory(state.activeCat);
  var avail = all.filter(providerAvailable).filter(passesSubfilters);

  if(!avail.length){
    var f = currentFiltersFor(state.activeCat);
    var hasActiveFilter = Object.keys(f).some(function(k){return !!f[k];});
    var availIgnoringFilters = all.filter(providerAvailable);
    var wrap = document.createElement('div'); wrap.className='empty-state';
    if(hasActiveFilter && availIgnoringFilters.length){
      wrap.innerHTML = '<b>Nenhum '+meta.label.toLowerCase()+' com esse filtro em '+ (state.cidade? CITY_BY_ID[state.cidade].nome : 'sua região') +' nessa data.</b><br>Existem '+availIgnoringFilters.length+' opção(ões) nessa categoria sem esse filtro — em produção a IA sugeriria alternativas parecidas.';
      var btn=document.createElement('button'); btn.type='button'; btn.textContent='Limpar sub-filtros desta categoria';
      btn.onclick=function(){ state.subfilters[state.activeCat]={}; renderSubfilters(); renderCards(); };
      wrap.appendChild(btn);
    } else {
      wrap.innerHTML = '<b>Nenhum '+meta.label.toLowerCase()+' disponível em '+ (state.cidade? CITY_BY_ID[state.cidade].nome : 'sua região') +' para essa data.</b><br>Isso também aconteceria em produção — a IA do Eventus Hub sugeriria ampliar para uma cidade vizinha ou trocar a data.';
      var btn2=document.createElement('button'); btn2.type='button'; btn2.textContent='Voltar e trocar cidade/data';
      btn2.onclick=goToGate;
      wrap.appendChild(btn2);
    }
    el.appendChild(wrap);
    return;
  }
  avail.sort(function(a,b){return b.rating-a.rating;});
  avail.forEach(function(p){ el.appendChild(cardHTML(p)); });
}

/* ============================================================
   CARRINHO / ORÇAMENTO
   ============================================================ */
function toggleCart(p, opts){
  var idx = state.cart.findIndex(function(c){return c.providerId===p.id;});
  if(idx>-1){ state.cart.splice(idx,1); }
  else{ state.cart.push({providerId:p.id, duracao:opts.duracao, extras:(opts.extras||[]).slice()}); }
  renderCards(); renderCart();
}
function updateCartExtras(providerId){
  var item = state.cart.filter(function(c){return c.providerId===providerId;})[0];
  if(!item) return;
  item.extras = extrasArrayFor(providerId);
  renderCart();
}
function removeFromCart(providerId){
  state.cart = state.cart.filter(function(c){return c.providerId!==providerId;});
  renderCards(); renderCart();
}
function providerById(id){ return PROVIDERS.filter(function(p){return p.id===id;})[0]; }

function renderCart(){
  $('cart-count').textContent = state.cart.length;
  var body = $('drawer-body'); body.innerHTML='';
  if(!state.cart.length){
    body.innerHTML = '<div class="drawer-empty">Seu orçamento está vazio.<br>Adicione prestadores nas categorias ao lado para montar o pacote do seu evento.</div>';
  } else {
    state.cart.forEach(function(item){
      var p = providerById(item.providerId); if(!p) return;
      var meta = CATEGORY_META[p.cat];
      var preco = providerPriceFor(p,{duracao:item.duracao, extras:item.extras});
      var row = document.createElement('div'); row.className='drawer-item';
      var exTxt = (item.extras&&item.extras.length)? item.extras.map(function(k){return EXTRA_META[k].label;}).join(', ') : (item.duracao? item.duracao+'h contratadas':'');
      row.innerHTML =
        '<div class="di-icon"><svg><use href="#'+meta.icon+'"/></svg></div>'+
        '<div class="di-main"><div class="cat">'+meta.label+'</div><div class="nm">'+p.nome+'</div>'+(exTxt?'<div class="ex">'+exTxt+'</div>':'')+'</div>'+
        '<div class="di-right"><span class="price">'+BRL.format(preco)+'</span><button class="rm">remover</button></div>';
      row.querySelector('.rm').onclick=function(){ removeFromCart(item.providerId); };
      body.appendChild(row);
    });
  }

  var foot = $('drawer-foot');
  var total = state.cart.reduce(function(s,item){ var p=providerById(item.providerId); return p? s+providerPriceFor(p,{duracao:item.duracao,extras:item.extras}) : s; },0);
  var bench = state.cidade? avgEventBudget(state.cidade).total : null;
  foot.innerHTML =
    '<div class="line"><span>'+state.cart.length+' item(ns) selecionado(s)</span><span></span></div>'+
    '<div class="grand"><span>Total estimado</span><span class="tabular">'+BRL.format(total)+'</span></div>'+
    (bench? '<div class="bench">Média estimada de um evento completo em '+CITY_BY_ID[state.cidade].nome+': <b class="tabular">'+BRL.format(bench)+'</b> (considerando salão, buffet, DJ, decoração e fotografia).</div>' : '');
}

/* ============================================================
   MAPA (Leaflet + OpenStreetMap/CARTO — mapa real, sem chave de API)
   ============================================================ */
var leafletMap = null;
var cityLayer = null;

// pixel transparente: usado quando um tile do mapa falha, pra nunca aparecer
// um ícone de "imagem quebrada" gigante em cima do mapa.
var BLANK_TILE = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7';

function initLeafletMap(){
  if(leafletMap || typeof L==='undefined') return;
  leafletMap = L.map('map-leaflet', { zoomControl:false, scrollWheelZoom:true }).setView([-24.75, -51.4], 7);
  L.control.zoom({ position:'topright' }).addTo(leafletMap);
  L.control.scale({ metric:true, imperial:false, position:'bottomleft' }).addTo(leafletMap);
  // OpenStreetMap "padrão" — a mesma URL de tile usada no exemplo oficial do Leaflet,
  // é a que funciona de forma mais confiável abrindo o arquivo direto (file://) ou
  // de qualquer domínio, sem exigir cadastro.
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    subdomains:'abc', maxZoom:19, errorTileUrl: BLANK_TILE
  }).addTo(leafletMap);
  cityLayer = L.layerGroup().addTo(leafletMap);
  setTimeout(function(){ leafletMap.invalidateSize(); }, 150);

  // Ao clicar num pino, guardamos qual cidade deve reabrir o balão depois do
  // re-render (ver renderMap) — sem isso, o clearLayers()+rebuild do mapa
  // destrói o marcador na mesma hora e o balão nunca chega a aparecer.
  leafletMap.on('popupclose', function(){ state.mapPopupCity = null; });
  // Delegação de clique nos botões que ficam DENTRO do balão (lista de
  // pacotes prontos, ou o link de fallback "selecionar esta cidade").
  leafletMap.on('popupopen', function(e){
    var el = e.popup.getElement();
    if(!el) return;
    el.querySelectorAll('.pacote-item').forEach(function(btn){
      btn.onclick = function(){ selecionarPacote(btn.getAttribute('data-pacote')); };
    });
    var fb = el.querySelector('.pacote-fallback-btn');
    if(fb){
      fb.onclick = function(){
        var cid = fb.getAttribute('data-cidade');
        state.cidade = cid;
        leafletMap.closePopup();
        syncAll();
      };
    }
  });
}

// Calcula, pra cada pacote pronto de uma cidade, em quais datas ele está
// realmente disponível (nenhum dos prestadores do pacote com bloqueio nesse
// dia) e o preço total somado — é isso que faz "o valor variar conforme a
// data": o mesmo pacote pode não estar disponível (ou ter prestadores
// diferentes, num pacote futuro mais elaborado) em datas diferentes.
function pacotesInfo(cityId){
  return PACOTES.filter(function(pc){ return pc.cidade===cityId; }).map(function(pc){
    var provs = Object.keys(pc.providers).map(function(cat){ return providerById(pc.providers[cat]); });
    var datas = DATE_POOL.filter(function(d){
      return provs.every(function(p){ return p && p.blackout.indexOf(d)===-1; });
    });
    var preco = provs.reduce(function(s,p){ return p? s+providerPriceFor(p,{}) : s; }, 0);
    return {pac:pc, datas:datas, preco:preco};
  }).filter(function(info){ return info.datas.length>0; });
}

// Escolher um pacote pronto: seleciona a cidade, cai numa data em que ele
// esteja disponível, e já deixa os prestadores daquele pacote "adicionados"
// no orçamento — assim, ao entrar em cada categoria, o serviço do pacote já
// aparece marcado como "Adicionado ✓", sem precisar escolher de novo.
function selecionarPacote(id){
  var pac = PACOTES.filter(function(x){ return x.id===id; })[0];
  if(!pac) return;
  var info = pacotesInfo(pac.cidade).filter(function(i){ return i.pac.id===id; })[0];
  if(!info) return;

  state.cidade = pac.cidade;
  if(info.datas.indexOf(state.data)===-1){ state.data = info.datas[0]; }
  if(!state.tipo) state.tipo = pac.tipo;

  state.cart = [];
  state.extrasSel = {};
  Object.keys(pac.providers).forEach(function(cat){
    var p = providerById(pac.providers[cat]);
    if(!p) return;
    var meta = CATEGORY_META[p.cat];
    if(meta.hasDuration){ state.duracaoSel[cat] = p.duracaoBase; }
    state.cart.push({providerId:p.id, duracao: meta.hasDuration? p.duracaoBase : null, extras:[]});
  });
  state.activeCat = pac.providers.salao? 'salao' : Object.keys(pac.providers)[0];

  if(leafletMap) leafletMap.closePopup();
  goToResults();
  renderCart();
}

function mapPopupHTML(cityId){
  var c = CITY_BY_ID[cityId];
  var infos = pacotesInfo(cityId);
  if(infos.length){
    var intro = infos.length===1
      ? 'Este local tem 1 pacote pronto de evento — já vem com o local, buffet, DJ, decoração e fotografia definidos.'
      : 'Este local tem '+infos.length+' pacotes prontos de evento, com prestadores e preço diferentes — escolha um deles:';
    var items = infos.map(function(info){
      var datasTxt = info.datas.slice(0,2).map(fmtDate).join(', ') + (info.datas.length>2? ' +'+(info.datas.length-2)+' data(s)' : '');
      return '<button type="button" class="pacote-item" data-pacote="'+info.pac.id+'">'+
          '<span class="pi-top"><span class="pi-nome">'+info.pac.nome+'</span><span class="pi-preco tabular">'+BRL.format(info.preco)+'</span></span>'+
          '<span class="pi-datas">Disponível: '+datasTxt+'</span>'+
        '</button>';
    }).join('');
    return '<div class="mp-body">'+
      '<h4>'+c.nome+'</h4>'+
      '<div class="sub">'+intro+'</div>'+
      '<div class="pacote-list">'+items+'</div>'+
      '<button type="button" class="pacote-fallback-btn" data-cidade="'+cityId+'">Ver todos os prestadores desta cidade, sem pacote fixo</button>'+
    '</div>';
  }
  return breakdownHTML(cityId) +
    '<button type="button" class="pacote-fallback-btn" data-cidade="'+cityId+'">Selecionar esta cidade</button>';
}

function breakdownHTML(cityId){
  var c = CITY_BY_ID[cityId];
  var b = avgEventBudget(cityId);
  var venue = PROVIDERS.filter(function(p){return p.cat==='salao' && p.cidades.indexOf(cityId)!==-1;})[0];
  var rows = CORE_CATS_FOR_BUDGET.map(function(cat){
    var meta = CATEGORY_META[cat];
    var part = b.parts[cat];
    return '<div><span>'+meta.label+(part.local?'':' *')+'</span><span class="tabular">'+BRL.format(part.valor)+'</span></div>';
  }).join('');
  return '<div class="mp-body">'+
    '<h4>'+(venue? venue.nome : c.nome)+'</h4>'+
    '<div class="sub">'+(venue? 'Salão parceiro em '+c.nome : 'Sem salão parceiro cadastrado ainda') + ' · média de orçamento completo</div>'+
    '<div class="breakdown">'+rows+'</div>'+
    '<div class="total"><span>Total médio</span><span class="tabular">'+BRL.format(b.total)+'</span></div>'+
    ((Object.keys(b.parts).some(function(k){return !b.parts[k].local;}))? '<div class="sub" style="margin-top:8px;">* nenhum prestador dessa categoria atende '+c.nome+' ainda — usamos a média geral do estado.</div>':'')+
  '</div>';
}

function renderMap(){
  if(typeof L==='undefined'){
    // Leaflet não carregou (sem internet nesta primeira visita) — evita quebrar o resto do app.
    var w = $('map-leaflet');
    if(w && !w.dataset.fallbackShown){
      w.dataset.fallbackShown='1';
      w.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;text-align:center;color:var(--ink-faint);font-size:13px;">Não foi possível carregar o mapa (Leaflet/OpenStreetMap) — verifique sua conexão com a internet e recarregue a página.</div>';
    }
    return;
  }
  initLeafletMap();
  cityLayer.clearLayers();

  CITIES.forEach(function(c){
    var budget = avgEventBudget(c.id);
    if(budget.total<=0) return;
    var isSel = state.cidade===c.id;

    var html = '<div class="leaflet-city-pin">'+
        '<div class="lp-name">'+c.nome+'</div>'+
        '<div class="lp-dot'+(isSel?' sel':'')+'"></div>'+
        '<div class="pin-price'+(isSel?' active':'')+'">'+BRL.format(budget.total)+'</div>'+
      '</div>';
    var icon = L.divIcon({ className:'', html:html, iconSize:[150,74], iconAnchor:[75,30] });
    var marker = L.marker([c.lat, c.lng], { icon:icon, riseOnHover:true });
    marker.bindPopup(mapPopupHTML(c.id), { closeButton:true, maxWidth:280, className:'pacote-popup' });
    marker.on('click', function(cid){ return function(){
      state.mapPopupCity = cid;
      state.cidade = (state.cidade===cid?null:cid);
      syncAll();
    }; }(c.id));
    marker.addTo(cityLayer);
    // o clearLayers() acima destrói o marcador antigo (e o balão que estivesse
    // aberto nele) antes que o navegador chegue a mostrar alguma coisa — por
    // isso reabrimos aqui, no marcador novo, pro balão realmente aparecer.
    if(state.mapPopupCity===c.id) marker.openPopup();
  });
}

/* ============================================================
   DRAWER
   ============================================================ */
function openDrawer(){ $('overlay').classList.add('show'); $('drawer').classList.add('show'); }
function closeDrawer(){ $('overlay').classList.remove('show'); $('drawer').classList.remove('show'); }

/* ============================================================
   NAVEGAÇÃO ENTRE GATE / RESULTS
   ============================================================ */
function goToResults(){
  if(!readyToSearch()) return;
  state.stage='results';
  $('app').setAttribute('data-stage','results');
  $('gate').style.display='none';
  $('results').style.display='block';
  var t = EVENT_TYPES.filter(function(e){return e.id===state.tipo;})[0];
  $('res-title').textContent = 'Prestadores em '+CITY_BY_ID[state.cidade].nome;
  $('res-sub').textContent = fmtDateLong(state.data)+' · '+t.label+' · '+state.convidados+' convidados';
  if(!state.activeCat) state.activeCat = categoryOrder()[0];
  renderCatRail(); renderSubfilters(); renderCards();
  window.scrollTo({top:0,behavior:'smooth'});
}
function goToGate(){
  state.stage='gate';
  $('app').setAttribute('data-stage','gate');
  $('gate').style.display='block';
  $('results').style.display='none';
}

function syncAll(){
  renderGateCities(); renderGateDates(); renderGateTypes(); renderSearchPill();
  $('gate-cta').disabled = !readyToSearch();
  renderMap();
  if(state.stage==='results'){
    // se já estava nos resultados, re-renderiza tudo já filtrado pela nova busca
    var t = EVENT_TYPES.filter(function(e){return e.id===state.tipo;})[0];
    if(state.cidade && state.data && t){
      $('res-title').textContent = 'Prestadores em '+CITY_BY_ID[state.cidade].nome;
      $('res-sub').textContent = fmtDateLong(state.data)+' · '+t.label+' · '+state.convidados+' convidados';
      renderCatRail(); renderSubfilters(); renderCards();
    }
  }
  renderCart();
}

/* ============================================================
   EVENTOS
   ============================================================ */
$('guest-minus').onclick=function(){ state.convidados=Math.max(20,state.convidados-10); renderGuest(); syncAll(); };
$('guest-plus').onclick=function(){ state.convidados=Math.min(500,state.convidados+10); renderGuest(); syncAll(); };
$('gate-cta').onclick=goToResults;
$('go-btn').onclick=goToResults;
$('edit-search').onclick=goToGate;
$('seg-city').onclick=goToGate;
$('seg-date').onclick=goToGate;
$('seg-type').onclick=goToGate;
$('cart-open').onclick=openDrawer;
$('drawer-close').onclick=closeDrawer;
$('overlay').onclick=closeDrawer;
$('legend-toggle').onclick=function(){
  var el = $('map-legend');
  var show = el.hasAttribute('hidden');
  if(show){ el.removeAttribute('hidden'); } else { el.setAttribute('hidden',''); }
  $('legend-toggle').setAttribute('aria-expanded', show?'true':'false');
};
$('legend-close').onclick=function(){ $('map-legend').setAttribute('hidden',''); $('legend-toggle').setAttribute('aria-expanded','false'); };
$('pdmodal-close').onclick=closeProviderModal;
$('pdmodal').addEventListener('click', function(e){ if(e.target===$('pdmodal')){ closeProviderModal(); } });
window.addEventListener('keydown', function(e){
  if(e.key==='Escape'){
    if($('pdmodal').classList.contains('show')) closeProviderModal();
    else if($('drawer').classList.contains('show')) closeDrawer();
  }
});

/* ============================================================
   TEMA (claro por padrão — alternável, guardado só neste navegador)
   ============================================================ */
function applyTheme(t){
  document.documentElement.setAttribute('data-theme', t);
  $('theme-icon-sun').style.display = t==='dark'? 'none':'block';
  $('theme-icon-moon').style.display = t==='dark'? 'block':'none';
  try{ localStorage.setItem('eventus-hub-theme', t); }catch(e){}
}
function initTheme(){
  var saved = 'light';
  try{ saved = localStorage.getItem('eventus-hub-theme') || 'light'; }catch(e){}
  applyTheme(saved);
}
$('theme-toggle').onclick = function(){
  var cur = document.documentElement.getAttribute('data-theme')==='dark'? 'dark':'light';
  applyTheme(cur==='dark'? 'light':'dark');
};

/* ============================================================
   INIT
   ============================================================ */
initTheme();
renderGuest();
syncAll();
renderCart();
window.addEventListener('resize', function(){ if(leafletMap) leafletMap.invalidateSize(); });
