# Eventus Hub — protótipo

Protótipo navegável do **Eventus Hub**, a plataforma de curadoria de prestadores de eventos (baseada na ideia da Luanna). Roda 100% no navegador, sem servidor, sem build, sem dependências — só HTML, CSS e JavaScript puro. Todos os prestadores, preços, disponibilidade e o mapa são **dados fictícios**, feitos para testar e discutir o fluxo antes de qualquer desenvolvimento real.

## Como abrir

**Opção mais simples:** dê duplo clique em `index.html`. Ele abre direto no navegador e funciona (o fluxo inteiro é local; só os ícones de fonte do Google puxam a internet — sem internet, ele usa uma fonte parecida no lugar).

**Opção recomendada para editar o código:** abra a pasta no VS Code e use a extensão *Live Server* (botão "Go Live"), ou rode um servidor local simples:

```bash
# dentro da pasta do projeto
python3 -m http.server 8080
# depois acesse http://localhost:8080 no navegador
```

Qualquer uma das duas formas funciona igual — a segunda só ajuda o navegador a recarregar sozinho quando você salva uma alteração.

## Estrutura do projeto

```
eventus-hub-project/
├── index.html         → o SITE (desktop/responsivo): estrutura da página, cabeçalho, ícones, layout
├── css/
│   └── styles.css     → cores, tipografia, espaçamento, tema claro/escuro (do site)
├── js/
│   ├── data.js         → TUDO que é conteúdo fictício: cidades, categorias, prestadores, preços, datas, pacotes
│   └── app.js           → a lógica do site: filtros, carrinho/orçamento, mapa, tema
├── mobile/             → o protótipo do APP MOBILE (ver seção própria abaixo)
│   ├── index.html
│   ├── css/mobile.css
│   └── js/mobile-app.js
└── README.md
```

## O que já funciona

- Busca por **cidade → data → tipo de evento → nº de convidados**, com filtro real por disponibilidade.
- 11 categorias de prestador (Local/Salão, Buffet, Decoração, DJ, Banda, Fotografia & Vídeo, Cerimonialista, Florista, Maquiagem, Animação, Som & Luz), cada uma com seus próprios sub-filtros.
- No DJ, equipamentos adicionais (fumaça, pista de LED, telão, efeitos frios, moving heads) que somam ao preço na hora.
- Carrinho/orçamento flutuante, com o total comparado à média de um evento completo naquela cidade.
- Mapa real e interativo do Paraná (pan/zoom de verdade, OpenStreetMap), com um pino por cidade mostrando o preço médio. Clique no valor: se a cidade tiver **pacotes prontos** cadastrados (local + buffet + DJ + decoração + fotografia já combinados), o balão lista as opções com preço e as datas em que cada uma está disponível — escolher uma já leva pros resultados com esses prestadores marcados como "Adicionado ✓" no orçamento. Sem pacote cadastrado, o balão mostra a média estimada da cidade, com um botão pra só selecioná-la e navegar manualmente.
- **Clique em qualquer card da lista** para abrir uma caixa maior com os detalhes do prestador: foto/ilustração ampliada, nota e avaliações, um texto "sobre" (gerado a partir dos próprios dados — estilo, cidades atendidas, pacote/hora extra), equipamentos adicionais (quando existem, com o preço atualizando ao vivo) e o botão de adicionar/remover do orçamento. Fecha no X, clicando fora da caixa ou apertando Esc.
- Tema claro por padrão, com alternância para escuro (ícone de sol/lua no topo).

## Como editar o conteúdo (o mais comum)

Abra **`js/data.js`**. Está tudo em português, em blocos fáceis de achar:

- **`CITIES`** — as cidades do Paraná e sua coordenada real (`lat`, `lng`) no mapa.
- **`EVENT_TYPES`** — os tipos de evento (casamento, debutante, etc.).
- **`DATE_POOL`** — as datas disponíveis para teste.
- **`CATEGORY_META`** — as 11 categorias, seus sub-filtros e se têm duração/equipamentos extras.
- **`EXTRA_META`** — os equipamentos adicionais do DJ e seus preços.
- **`PROVIDERS`** — a lista de prestadores fictícios (nome, cidades atendidas, preço, estilo, badge, cores do card, etc.). É só copiar um objeto existente da mesma categoria e trocar os valores para adicionar um prestador novo.
- **`PACOTES`** — os pacotes prontos que aparecem no balão do mapa (cidade, nome do pacote, e o id de um prestador de cada categoria-base: salão, buffet, DJ, decoração, fotografia). Só é possível montar um pacote pra cidades que já tenham pelo menos 1 prestador local em cada uma dessas 5 categorias — as datas disponíveis de cada pacote são calculadas sozinhas a partir da agenda de cada prestador escolhido, não precisa preencher à mão.

Depois de editar `data.js`, é só salvar e recarregar a página — não precisa rodar nada.

## Sobre o mapa

O mapa é real e interativo, feito com **[Leaflet](https://leafletjs.com)** + tiles do **OpenStreetMap/CARTO** — pan, zoom, os mesmos gestos do Google Maps. Escolhi essa combinação (em vez do Google Maps de verdade) porque **não precisa de chave de API nem de conta**: funciona assim que a página carrega, só exigindo internet nesse momento (os tiles do mapa são baixados ao vivo). Se preferirem trocar pelo Google Maps de verdade mais pra frente — por exemplo, pra ganhar Street View ou uma busca de endereço melhor — dá pra fazer: seria preciso criar uma chave gratuita no [Google Cloud Console](https://console.cloud.google.com) e trocar a inicialização do mapa em `js/app.js` (função `initLeafletMap`) pelo SDK do Google Maps; as coordenadas de cada cidade (`lat`/`lng` em `CITIES`, no `js/data.js`) continuam servindo do mesmo jeito.

Sem internet no momento do carregamento, o mapa mostra um aviso e o resto do site (filtros, cards, carrinho) continua funcionando normalmente.

O Leaflet (a partir da v1.9) inclui por padrão uma pequena bandeira da Ucrânia ao lado do crédito "Leaflet" no canto do mapa. Ela está desativada neste projeto (via CSS) para não aparecer enorme caso o arquivo de estilo do Leaflet demore ou falhe ao carregar — o crédito ao OpenStreetMap continua normalmente. Para reativá-la, é só remover a linha `.leaflet-attribution-flag{display:none !important;}` de `css/styles.css`.

## Sobre as fotos dos prestadores

Como os prestadores são fictícios, não existem fotos reais deles. Por padrão, cada card busca automaticamente **uma foto de exemplo por categoria** (via [loremflickr.com](https://loremflickr.com), um serviço público de fotos-placeholder por assunto — ex.: DJ puxa fotos de "dj,nightclub", buffet puxa "buffet,catering", etc.). Isso **precisa de internet** na hora de carregar a página; se estiver offline ou a foto não carregar por qualquer motivo, o card volta sozinho pra uma ilustração (ícone da categoria sobre um fundo colorido), sem quebrar o layout.

Importante: são fotos genéricas de banco de imagens, não fotos reais destes prestadores fictícios — sirva só como referência visual enquanto não há fotos de verdade.

**Para usar uma foto real de um prestador** (a forma definitiva, que funciona offline): coloque o arquivo em `images/` e, no objeto dele dentro de `PROVIDERS` (em `js/data.js`), adicione:

```js
foto: 'images/dj-theo.jpg'
```

Isso tem prioridade sobre a foto automática. Veja também `images/README.md`.

## App mobile (protótipo)

Além do site, a pasta `mobile/` tem um **protótipo clicável do app**, no formato de uma moldura de celular (visual de iPhone, com barra de status e notch) — dá pra clicar em tudo, mas não é um app de verdade (não é React Native nem nada instalável), é só HTML/CSS/JS, igual ao site. Usa exatamente os mesmos dados fictícios do `js/data.js`, então qualquer prestador/preço que você editar lá aparece nos dois lugares.

**Como abrir:** dê duplo clique em `mobile/index.html`. No computador, ele aparece dentro da moldura de celular, do lado do site; se abrir direto pelo navegador do próprio celular, a moldura some e ele ocupa a tela inteira, como um app de verdade.

O app tem **duas portas de entrada**, escolhidas na primeira tela:

- **Sou cliente** — o mesmo fluxo de busca do site (cidade → data → tipo de evento → nº de convidados → categorias e filtros → cards de prestador → detalhes → orçamento/carrinho), só que adaptado pra tela de celular (filtros em chips, cards em lista, detalhes num "sheet" que sobe de baixo).
- **Sou prestador de serviço** — a área de quem oferece o serviço (DJ, buffet, decoração, etc.). Como ainda não existe cadastro de verdade, o "login" aqui é escolher um dos 44 prestadores fictícios já existentes numa lista com busca. Depois de escolher, o prestador cai num painel com 4 abas:
  - **Início** — um resumo (nota, avaliações, pedidos/mês, taxa de resposta) e atalhos pras outras abas.
  - **Agenda** — as datas de exemplo, com botão pra marcar/desmarcar cada uma como disponível ou bloqueada.
  - **Serviço** — editar preço, duração/hora extra (quando se aplica), sub-filtros de estilo/formato, cidades atendidas e equipamentos adicionais (no caso do DJ).
  - **Pedidos** — uma lista de pedidos de clientes fictícios (nome, tipo de evento, data, cidade), com botões pra aceitar/recusar/marcar como concluído.

Importante: qualquer alteração feita do lado do prestador (preço, agenda, cidades, etc.) é **só naquela sessão do navegador** — é pra simular a experiência e discutir o fluxo, não fica salva depois de fechar a aba. Pra persistir de verdade, seria preciso um backend (mesmo ponto do site, ver "Próximos passos" abaixo).

## Próximos passos sugeridos

- Trocar os dados fictícios por prestadores e preços reais conforme forem cadastrados.
- Plugar um mapa real (Google Maps/Mapbox) usando as mesmas coordenadas de cidade já mapeadas em `CITIES`.
- Conectar a um backend de verdade para persistir orçamentos, cadastro de prestadores e disponibilidade.
- No app mobile: trocar a "escolha de prestador" por um login de verdade (email/senha ou convite), e salvar as edições do prestador (preço, agenda, cidades) no mesmo backend acima, em vez de só durante a sessão do navegador.
