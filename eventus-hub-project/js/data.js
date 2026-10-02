"use strict";

/* ============================================================
   DATA — tudo fictício, só para validar a lógica do produto
   ============================================================ */

var BRL = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});

var CITIES = [
  {id:'curitiba',   nome:'Curitiba',              lat:-25.43, lng:-49.27, capital:true},
  {id:'londrina',   nome:'Londrina',               lat:-23.31, lng:-51.16},
  {id:'maringa',    nome:'Maringá',                lat:-23.42, lng:-51.93},
  {id:'pontagrossa',nome:'Ponta Grossa',           lat:-25.09, lng:-50.16},
  {id:'cascavel',   nome:'Cascavel',               lat:-24.96, lng:-53.46},
  {id:'foz',        nome:'Foz do Iguaçu',          lat:-25.52, lng:-54.59},
  {id:'guarapuava', nome:'Guarapuava',             lat:-25.39, lng:-51.46},
  {id:'sjpinhais',  nome:'São José dos Pinhais',   lat:-25.53, lng:-49.20},
  {id:'paranagua',  nome:'Paranaguá',              lat:-25.52, lng:-48.51},
  {id:'umuarama',   nome:'Umuarama',               lat:-23.77, lng:-53.32}
];
var CITY_BY_ID = {}; CITIES.forEach(function(c){CITY_BY_ID[c.id]=c;});

var EVENT_TYPES = [
  {id:'casamento',  label:'Casamento'},
  {id:'debutante',  label:'Debutante · 15 anos'},
  {id:'infantil',   label:'Aniversário infantil'},
  {id:'formatura',  label:'Formatura'},
  {id:'corporativo',label:'Corporativo'},
  {id:'show',       label:'Show / Festival'}
];

var DATE_POOL = ['2026-09-12','2026-09-19','2026-09-26','2026-10-03','2026-10-17','2026-10-24','2026-11-07','2026-11-14','2026-11-21','2026-12-05','2026-12-12','2026-12-19'];

function fmtDate(iso){
  var d = new Date(iso+'T12:00:00');
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'short'}).replace('.','').replace(' de ',' ');
}
function fmtDateLong(iso){
  var d = new Date(iso+'T12:00:00');
  return d.toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
}

var CATEGORY_ORDER_DEFAULT = ['dj','buffet','decoracao','banda','foto','cerimonial','florista','maquiagem','animador','salao','estrutura'];

var CATEGORY_PRIORITY = {
  casamento:   ['salao','buffet','decoracao','dj','foto','cerimonial','florista','banda','maquiagem','estrutura','animador'],
  debutante:   ['salao','buffet','decoracao','dj','foto','maquiagem','cerimonial','florista','animador','banda','estrutura'],
  infantil:    ['animador','buffet','decoracao','salao','foto','dj','florista','estrutura','cerimonial','banda','maquiagem'],
  formatura:   ['salao','buffet','dj','foto','decoracao','banda','estrutura','cerimonial','florista','animador','maquiagem'],
  corporativo: ['salao','estrutura','buffet','foto','dj','decoracao','cerimonial','animador','banda','florista','maquiagem'],
  show:        ['salao','estrutura','banda','dj','foto','buffet','decoracao','animador','cerimonial','florista','maquiagem']
};

var CATEGORY_META = {
  dj:         {label:'DJ',                  icon:'ic-dj',        unit:'pacote',
                filters:[{key:'estilo',label:'Formato / estilo',options:[
                  {v:'open-format',l:'Open format'},{v:'sertanejo',l:'Sertanejo'},{v:'eletronica',l:'Eletrônica / balada'},{v:'retro',l:'Retrô / anos 2000'}]}],
                hasDuration:true, hasExtras:true},
  banda:      {label:'Banda',               icon:'ic-banda',     unit:'pacote',
                filters:[{key:'estilo',label:'Gênero',options:[
                  {v:'pop-rock',l:'Pop / Rock'},{v:'sertanejo',l:'Sertanejo'},{v:'mpb',l:'MPB / Bossa'},{v:'samba-pagode',l:'Samba / Pagode'}]},
                  {key:'formato',label:'Formato',options:[{v:'trio',l:'Trio'},{v:'banda-completa',l:'Banda completa'},{v:'dupla',l:'Dupla'}]}],
                hasDuration:true},
  buffet:     {label:'Buffet',              icon:'ic-buffet',    unit:'porPessoa',
                filters:[{key:'estilo',label:'Estilo de cozinha',options:[
                  {v:'brasileira',l:'Brasileira'},{v:'italiana',l:'Italiana'},{v:'autoral',l:'Contemporânea/autoral'},{v:'vegana',l:'Vegana/vegetariana'}]},
                  {key:'formato',label:'Formato de serviço',options:[{v:'bufe',l:'Bufê tradicional'},{v:'estacoes',l:'Estações'},{v:'coquetel',l:'Coquetel volante'}]}]},
  decoracao:  {label:'Decoração',           icon:'ic-decor',     unit:'pacote',
                filters:[{key:'estilo',label:'Estilo',options:[
                  {v:'classica',l:'Clássica'},{v:'boho',l:'Boho / rústica'},{v:'moderna',l:'Moderna minimalista'},{v:'infantil',l:'Temática infantil'}]}]},
  foto:       {label:'Fotografia & Vídeo',  icon:'ic-foto',      unit:'pacote',
                filters:[{key:'formato',label:'Cobertura',options:[
                  {v:'foto',l:'Só foto'},{v:'foto-video',l:'Foto + vídeo'},{v:'drone',l:'Foto + vídeo + drone'}]},
                  {key:'estilo',label:'Estilo',options:[{v:'classico',l:'Clássico'},{v:'documental',l:'Documental / fine art'}]}],
                hasDuration:true},
  cerimonial: {label:'Cerimonialista',      icon:'ic-cerim',     unit:'pacote',
                filters:[{key:'estilo',label:'Nível de assessoria',options:[
                  {v:'dia-evento',l:'Assessoria do dia'},{v:'completa',l:'Assessoria completa'},{v:'coordenacao-equipe',l:'Coordenação de equipe'}]}]},
  florista:   {label:'Florista',            icon:'ic-flor',      unit:'pacote',
                filters:[{key:'estilo',label:'Estilo',options:[
                  {v:'classicos',l:'Arranjos clássicos'},{v:'tropicais',l:'Flores tropicais'},{v:'fake',l:'Fake / permanentes'}]},
                  {key:'formato',label:'Aplicação',options:[{v:'mesa',l:'Mesa'},{v:'altar',l:'Altar / cerimônia'},{v:'ambientacao',l:'Ambientação completa'}]}]},
  maquiagem:  {label:'Maquiagem',           icon:'ic-maq',       unit:'pacote',
                filters:[{key:'estilo',label:'Especialidade',options:[
                  {v:'noiva',l:'Noiva'},{v:'debutante',l:'Debutante'},{v:'social',l:'Social'},{v:'grupo',l:'Grupo (madrinhas)'}]}]},
  animador:   {label:'Animação',            icon:'ic-anim',      unit:'pacote',
                filters:[{key:'estilo',label:'Público',options:[
                  {v:'infantil',l:'Infantil'},{v:'adulto',l:'Adulto / descontração'},{v:'misto',l:'Misto'}]},
                  {key:'formato',label:'Inclui',options:[{v:'recreadores',l:'Recreadores'},{v:'personagens',l:'Personagens vivos'},{v:'oficinas',l:'Oficinas'}]}]},
  salao:      {label:'Local / Salão',       icon:'ic-salao',     unit:'diaria',
                filters:[{key:'estilo',label:'Capacidade',options:[
                  {v:'ate-80',l:'Até 80 pessoas'},{v:'80-200',l:'80 a 200 pessoas'},{v:'200-mais',l:'200+ pessoas'}]},
                  {key:'formato',label:'Ambiente',options:[{v:'interno',l:'Interno'},{v:'externo',l:'Ao ar livre'},{v:'misto',l:'Misto'}]}]},
  estrutura:  {label:'Som & Luz',           icon:'ic-estrutura', unit:'pacote',
                filters:[{key:'estilo',label:'Tipo de estrutura',options:[
                  {v:'som-luz-pista',l:'Som + luz de pista'},{v:'cenico',l:'Iluminação cênica'},{v:'telao-led',l:'Telão de LED'}]}]}
};

var EXTRA_META = {
  fumaca: {label:'Máquina de fumaça', preco:300},
  led:    {label:'Pista de LED',       preco:450},
  telao:  {label:'Telão / projeção',   preco:350},
  frios:  {label:'Efeitos frios',      preco:250},
  moving: {label:'Moving heads',       preco:400}
};

// Palavras-chave por categoria, usadas para buscar uma foto de exemplo
// (via loremflickr.com — um serviço público de fotos-placeholder por assunto,
// só para dar uma referência visual; não são fotos reais destes prestadores).
// Para usar uma foto real de um prestador específico, defina p.foto no objeto
// dele em PROVIDERS com o caminho do arquivo, ex: foto:'images/dj-theo.jpg'
// (veja o README, seção "Como colocar fotos reais").
var CATEGORY_PHOTO_KEYWORDS = {
  dj:         'dj,nightclub',
  banda:      'liveband,concert',
  buffet:     'buffet,catering',
  decoracao:  'eventdecor,partydecoration',
  foto:       'photographer,camera',
  cerimonial: 'wedding,ceremony',
  florista:   'flowerbouquet,florist',
  maquiagem:  'makeupartist,beauty',
  animador:   'kidsparty,balloons',
  salao:      'eventvenue,weddinghall',
  estrutura:  'stagelighting,concertlights'
};

// prestadores fictícios --------------------------------------------------
var PROVIDERS = [
  // DJ
  {id:'dj1',cat:'dj',nome:'DJ Theo Bittencourt',cidades:['curitiba','sjpinhais','pontagrossa'],preco:1800,estilo:'open-format',duracaoBase:4,horaExtra:280,extras:['fumaca','led','telao'],rating:4.9,aval:132,eventos:['casamento','debutante','formatura','corporativo'],badge:'Preferido',cores:['#7D2248','#A8791E']},
  {id:'dj2',cat:'dj',nome:'DJ Marê Fontoura',cidades:['curitiba','foz'],preco:2600,estilo:'eletronica',duracaoBase:5,horaExtra:340,extras:['led','moving','frios'],rating:4.8,aval:64,eventos:['show','corporativo','formatura'],badge:'Reserva instantânea',cores:['#33604A','#201B14']},
  {id:'dj3',cat:'dj',nome:'DJ Batidão do Grão',cidades:['londrina','maringa','umuarama'],preco:1500,estilo:'sertanejo',duracaoBase:4,horaExtra:250,extras:['fumaca','telao'],rating:4.7,aval:201,eventos:['casamento','debutante','infantil'],badge:'Mais contratado',cores:['#A8791E','#33604A']},
  {id:'dj4',cat:'dj',nome:'DJ Retrô Vinil',cidades:['curitiba','guarapuava','pontagrossa'],preco:2000,estilo:'retro',duracaoBase:4,horaExtra:300,extras:['fumaca','led'],rating:5.0,aval:41,eventos:['casamento','corporativo'],badge:'Nota 5,0',cores:['#7D2248','#33604A']},

  // Banda
  {id:'ba1',cat:'banda',nome:'Trio Sabiá Acústico',cidades:['curitiba','sjpinhais'],preco:3200,estilo:'mpb',formato:'trio',duracaoBase:3,horaExtra:600,rating:4.9,aval:58,eventos:['casamento','corporativo'],cores:['#33604A','#A8791E']},
  {id:'ba2',cat:'banda',nome:'Banda Vento Sul',cidades:['londrina','maringa'],preco:6500,estilo:'pop-rock',formato:'banda-completa',duracaoBase:3,horaExtra:900,rating:4.8,aval:73,eventos:['formatura','show','corporativo'],badge:'Popular',cores:['#7D2248','#201B14']},
  {id:'ba3',cat:'banda',nome:'Império do Pagode',cidades:['curitiba','pontagrossa','cascavel'],preco:4800,estilo:'samba-pagode',formato:'banda-completa',duracaoBase:3,horaExtra:750,rating:4.9,aval:110,eventos:['casamento','debutante','infantil'],cores:['#A8791E','#7D2248']},
  {id:'ba4',cat:'banda',nome:'Raízes Caiçaras',cidades:['cascavel','foz','guarapuava'],preco:3900,estilo:'sertanejo',formato:'dupla',duracaoBase:3,horaExtra:650,rating:4.6,aval:39,eventos:['debutante','formatura','show'],cores:['#33604A','#7D2248']},

  // Buffet
  {id:'bu1',cat:'buffet',nome:'Sabor & Arte Buffet',cidades:['curitiba','sjpinhais','pontagrossa'],preco:165,estilo:'brasileira',formato:'estacoes',rating:4.8,aval:210,eventos:['casamento','debutante','corporativo'],badge:'Preferido',cores:['#A8791E','#201B14']},
  {id:'bu2',cat:'buffet',nome:'Dona Zulmira Fogão a Lenha',cidades:['londrina','maringa','umuarama'],preco:98,estilo:'brasileira',formato:'bufe',rating:4.9,aval:301,eventos:['infantil','corporativo','formatura'],badge:'Melhor custo',cores:['#33604A','#A8791E']},
  {id:'bu3',cat:'buffet',nome:'Távola Bella',cidades:['curitiba','guarapuava'],preco:190,estilo:'italiana',formato:'bufe',rating:4.7,aval:88,eventos:['casamento','formatura'],cores:['#7D2248','#A8791E']},
  {id:'bu4',cat:'buffet',nome:'Verde Vivo Bufê Vegano',cidades:['curitiba','cascavel'],preco:145,estilo:'vegana',formato:'coquetel',rating:5.0,aval:34,eventos:['casamento','corporativo','show'],cores:['#33604A','#7D2248']},

  // Decoração
  {id:'de1',cat:'decoracao',nome:'Ateliê Flor de Lis',cidades:['curitiba','sjpinhais'],preco:4200,estilo:'classica',rating:4.9,aval:97,eventos:['casamento','debutante'],cores:['#7D2248','#33604A']},
  {id:'de2',cat:'decoracao',nome:'Nuvem Boho Cenários',cidades:['londrina','maringa'],preco:3100,estilo:'boho',rating:4.8,aval:66,eventos:['casamento','formatura'],cores:['#A8791E','#33604A']},
  {id:'de3',cat:'decoracao',nome:'Studio Linhas Minimal',cidades:['curitiba','pontagrossa'],preco:3800,estilo:'moderna',rating:4.7,aval:45,eventos:['corporativo','formatura','show'],cores:['#201B14','#A8791E']},
  {id:'de4',cat:'decoracao',nome:'Mundo Encantado Festas',cidades:['cascavel','foz','guarapuava'],preco:1900,estilo:'infantil',rating:4.9,aval:150,eventos:['infantil','debutante'],badge:'Favorito das crianças',cores:['#33604A','#7D2248']},

  // Foto/Vídeo
  {id:'fo1',cat:'foto',nome:'Instante Certo Fotografia',cidades:['curitiba','sjpinhais','pontagrossa'],preco:3800,estilo:'documental',formato:'foto-video',duracaoBase:6,horaExtra:350,rating:5.0,aval:180,eventos:['casamento','debutante','formatura'],badge:'Preferido',cores:['#201B14','#7D2248']},
  {id:'fo2',cat:'foto',nome:'Olhar de Prata',cidades:['londrina','maringa'],preco:2200,estilo:'classico',formato:'foto',duracaoBase:5,horaExtra:280,rating:4.7,aval:52,eventos:['casamento','infantil'],cores:['#A8791E','#201B14']},
  {id:'fo3',cat:'foto',nome:'Voo Alto Drone Filmes',cidades:['curitiba','foz'],preco:4600,estilo:'documental',formato:'drone',duracaoBase:6,horaExtra:400,rating:4.9,aval:71,eventos:['casamento','corporativo','show'],cores:['#33604A','#201B14']},
  {id:'fo4',cat:'foto',nome:'Retratos do Sul',cidades:['cascavel','guarapuava','umuarama'],preco:1900,estilo:'documental',formato:'foto',duracaoBase:5,horaExtra:260,rating:4.6,aval:38,eventos:['debutante','formatura','infantil'],cores:['#7D2248','#33604A']},

  // Cerimonialista
  {id:'ce1',cat:'cerimonial',nome:'Bianca Live Assessoria',cidades:['curitiba','sjpinhais','pontagrossa'],preco:3800,estilo:'completa',rating:4.9,aval:64,eventos:['casamento','formatura'],cores:['#7D2248','#A8791E']},
  {id:'ce2',cat:'cerimonial',nome:'Cerimonial Passo a Passo',cidades:['londrina','maringa'],preco:1800,estilo:'dia-evento',rating:4.7,aval:41,eventos:['casamento','debutante'],cores:['#33604A','#A8791E']},
  {id:'ce3',cat:'cerimonial',nome:'Vívida Eventos',cidades:['curitiba','cascavel'],preco:4600,estilo:'coordenacao-equipe',rating:4.8,aval:29,eventos:['corporativo','show'],cores:['#201B14','#33604A']},
  {id:'ce4',cat:'cerimonial',nome:'Laços & Detalhes',cidades:['foz','guarapuava','umuarama'],preco:2600,estilo:'completa',rating:4.9,aval:37,eventos:['casamento','debutante','formatura'],cores:['#A8791E','#7D2248']},

  // Florista
  {id:'fl1',cat:'florista',nome:'Jardim Secreto Floral',cidades:['curitiba','sjpinhais'],preco:2400,estilo:'classicos',formato:'altar',rating:4.9,aval:52,eventos:['casamento','formatura'],cores:['#33604A','#7D2248']},
  {id:'fl2',cat:'florista',nome:'Trópico Flor',cidades:['londrina','maringa','umuarama'],preco:1900,estilo:'tropicais',formato:'ambientacao',rating:4.8,aval:63,eventos:['casamento','debutante','corporativo'],cores:['#A8791E','#33604A']},
  {id:'fl3',cat:'florista',nome:'Permanentes Bella Flor',cidades:['curitiba','pontagrossa'],preco:1200,estilo:'fake',formato:'mesa',rating:4.6,aval:20,eventos:['corporativo','formatura'],cores:['#7D2248','#201B14']},
  {id:'fl4',cat:'florista',nome:'Flor & Cia Festas',cidades:['cascavel','foz'],preco:1500,estilo:'classicos',formato:'mesa',rating:4.7,aval:33,eventos:['debutante','infantil'],cores:['#33604A','#A8791E']},

  // Maquiagem
  {id:'ma1',cat:'maquiagem',nome:'Studio Ana Prado',cidades:['curitiba','sjpinhais'],preco:650,estilo:'noiva',rating:5.0,aval:88,eventos:['casamento'],badge:'Nota 5,0',cores:['#7D2248','#33604A']},
  {id:'ma2',cat:'maquiagem',nome:'Bela Debutante Makeup',cidades:['londrina','maringa'],preco:480,estilo:'debutante',rating:4.9,aval:71,eventos:['debutante'],cores:['#A8791E','#7D2248']},
  {id:'ma3',cat:'maquiagem',nome:'Grupo Glam',cidades:['curitiba','pontagrossa'],preco:1800,estilo:'grupo',rating:4.7,aval:26,eventos:['casamento','debutante'],cores:['#33604A','#201B14']},
  {id:'ma4',cat:'maquiagem',nome:'Social Face Curitiba',cidades:['cascavel','guarapuava'],preco:320,estilo:'social',rating:4.6,aval:19,eventos:['corporativo','formatura'],cores:['#201B14','#A8791E']},

  // Animação
  {id:'an1',cat:'animador',nome:'Turma do Riso Recreação',cidades:['curitiba','sjpinhais','pontagrossa'],preco:1400,estilo:'infantil',formato:'oficinas',rating:4.9,aval:112,eventos:['infantil','debutante'],badge:'Favorito das crianças',cores:['#A8791E','#7D2248']},
  {id:'an2',cat:'animador',nome:'Fábrica de Personagens',cidades:['londrina','maringa'],preco:1900,estilo:'infantil',formato:'personagens',rating:4.8,aval:67,eventos:['infantil'],cores:['#33604A','#7D2248']},
  {id:'an3',cat:'animador',nome:'Quebra-Gelo Corporativo',cidades:['curitiba','cascavel'],preco:1600,estilo:'adulto',formato:'recreadores',rating:4.6,aval:22,eventos:['corporativo','formatura'],cores:['#201B14','#33604A']},
  {id:'an4',cat:'animador',nome:'Festa Encantada Kids',cidades:['foz','guarapuava','umuarama'],preco:1100,estilo:'infantil',formato:'personagens',rating:4.9,aval:59,eventos:['infantil','debutante'],cores:['#7D2248','#A8791E']},

  // Local / Salão
  {id:'sa1',cat:'salao',nome:'Espaço Villa Verde',cidades:['curitiba'],preco:8500,estilo:'200-mais',formato:'misto',rating:4.9,aval:74,eventos:['casamento','formatura','corporativo'],badge:'Preferido',cores:['#33604A','#201B14']},
  {id:'sa2',cat:'salao',nome:'Chácara Recanto do Lago',cidades:['sjpinhais','pontagrossa'],preco:5200,estilo:'80-200',formato:'externo',rating:4.8,aval:51,eventos:['casamento','debutante','infantil'],cores:['#A8791E','#33604A']},
  {id:'sa3',cat:'salao',nome:'Salão Cristal Eventos',cidades:['londrina','maringa'],preco:6800,estilo:'200-mais',formato:'interno',rating:4.7,aval:63,eventos:['formatura','corporativo','show'],cores:['#7D2248','#201B14']},
  {id:'sa4',cat:'salao',nome:'Buffet Jardim Encantado',cidades:['cascavel','foz'],preco:3200,estilo:'ate-80',formato:'misto',rating:4.8,aval:44,eventos:['infantil','debutante'],cores:['#33604A','#A8791E']},

  // Som & Luz
  {id:'es1',cat:'estrutura',nome:'Prime Áudio Eventos',cidades:['curitiba','sjpinhais','pontagrossa'],preco:2400,estilo:'som-luz-pista',rating:4.8,aval:56,eventos:['casamento','debutante','formatura'],cores:['#201B14','#A8791E']},
  {id:'es2',cat:'estrutura',nome:'Luz Cênica Produções',cidades:['curitiba','foz'],preco:4200,estilo:'cenico',rating:4.9,aval:38,eventos:['show','corporativo'],cores:['#7D2248','#33604A']},
  {id:'es3',cat:'estrutura',nome:'Telão Norte PR',cidades:['londrina','maringa'],preco:3600,estilo:'telao-led',rating:4.7,aval:29,eventos:['corporativo','formatura','show'],cores:['#33604A','#7D2248']},
  {id:'es4',cat:'estrutura',nome:'Base Sonora Oeste',cidades:['cascavel','guarapuava','umuarama'],preco:1900,estilo:'som-luz-pista',rating:4.6,aval:24,eventos:['casamento','debutante','infantil'],cores:['#A8791E','#201B14']}
];

// RNG determinístico p/ datas indisponíveis (mesma seed = mesmo resultado sempre)
function seedFromString(s){var h=0;for(var i=0;i<s.length;i++){h=(h<<5)-h+s.charCodeAt(i);h|=0;}return h;}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;var t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};}
PROVIDERS.forEach(function(p){
  var rnd = mulberry32(seedFromString(p.id));
  var n = 2 + Math.floor(rnd()*3); // 2 a 4 datas bloqueadas
  var pool = DATE_POOL.slice();
  var blocked = [];
  for(var i=0;i<n && pool.length;i++){
    var idx = Math.floor(rnd()*pool.length);
    blocked.push(pool.splice(idx,1)[0]);
  }
  p.blackout = blocked;
});

// Pacotes prontos: combinações fixas de prestadores (salão + buffet + DJ +
// decoração + fotografia) para as cidades que já têm pelo menos 1 prestador
// local em cada uma dessas 5 categorias-base. As datas em que cada pacote
// fica disponível NÃO são fixas aqui — são calculadas em tempo real (ver
// pacotesInfo() em app.js), cruzando o bloqueio de agenda de cada prestador
// do pacote. É assim que "o valor tem variação de acordo com a data": o
// mesmo pacote pode custar/estar disponível diferente dependendo do dia.
var PACOTES = [
  {id:'pac-cur-classico', cidade:'curitiba',    nome:'Pacote Clássico', tipo:'casamento',
    providers:{salao:'sa1', buffet:'bu1', dj:'dj1', decoracao:'de1', foto:'fo1'}},
  {id:'pac-cur-autoral',  cidade:'curitiba',    nome:'Pacote Autoral',  tipo:'formatura',
    providers:{salao:'sa1', buffet:'bu3', dj:'dj2', decoracao:'de3', foto:'fo3'}},
  {id:'pac-pg-classico',  cidade:'pontagrossa', nome:'Pacote Clássico', tipo:'casamento',
    providers:{salao:'sa2', buffet:'bu1', dj:'dj1', decoracao:'de3', foto:'fo1'}},
  {id:'pac-pg-retro',     cidade:'pontagrossa', nome:'Pacote Retrô',    tipo:'debutante',
    providers:{salao:'sa2', buffet:'bu1', dj:'dj4', decoracao:'de3', foto:'fo1'}},
  {id:'pac-sjp-classico', cidade:'sjpinhais',   nome:'Pacote Clássico', tipo:'casamento',
    providers:{salao:'sa2', buffet:'bu1', dj:'dj1', decoracao:'de1', foto:'fo1'}},
  {id:'pac-lon-classico', cidade:'londrina',    nome:'Pacote Clássico', tipo:'casamento',
    providers:{salao:'sa3', buffet:'bu2', dj:'dj3', decoracao:'de2', foto:'fo2'}},
  {id:'pac-mar-classico', cidade:'maringa',     nome:'Pacote Clássico', tipo:'casamento',
    providers:{salao:'sa3', buffet:'bu2', dj:'dj3', decoracao:'de2', foto:'fo2'}}
];
