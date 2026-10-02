# Fotos reais dos prestadores

Coloque aqui as fotos que você quiser usar de verdade (jpg, png ou webp).

Depois, em `js/data.js`, ache o prestador dentro de `PROVIDERS` e adicione o campo `foto` apontando pro arquivo, por exemplo:

```js
{id:'dj1', cat:'dj', nome:'DJ Theo Bittencourt', ..., foto:'images/dj-theo.jpg'},
```

Quando `foto` está definido, ele sempre tem prioridade sobre a foto de exemplo automática — e funciona offline, sem depender de internet.
