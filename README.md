# NBA Fantasy Dashboard

Dashboard estático que consome a API pública da ESPN para exibir jogos da NBA e calcular fantasy points por jogador.

**Demo:** https://renatoveigajr-code.github.io/nba-fantasy-dashboard/

## Funcionalidades

- Seletor de liga: **NBA** (temporada regular/playoffs) e **NBA Summer League** (Las Vegas)
- Filtro por data (padrão: dia atual no horário `America/New_York`)
- Cards com os jogos do dia (placar e status)
- Boxscore completo por jogo, separado por mandante/visitante
- Cálculo de fantasy points por jogador, ordenado do maior para o menor

## Como usar

É 100% estático — sem backend, sem build, sem dependências.

- **Local:** abra `index.html` diretamente no navegador, ou sirva a pasta com qualquer servidor estático
- **GitHub Pages:** já publicado em https://renatoveigajr-code.github.io/nba-fantasy-dashboard/

## Fonte de dados

API pública da ESPN (sem autenticação):

```
https://site.api.espn.com/apis/site/v2/sports/basketball/{liga}/scoreboard?dates=YYYYMMDD
https://site.api.espn.com/apis/site/v2/sports/basketball/{liga}/summary?event={id}
```

Onde `{liga}` é `nba` ou `nba-summer-las-vegas`.

## Fórmula de fantasy points

```
FPS = pts + dreb + oreb*1.2 + ast*1.1 + stl*1.2 + blk*1.3
      - pf - turnover*1.1 - fga*0.4 - fta*0.2
```

## Estrutura

```
├── index.html   # markup da página
├── app.js       # fetch da API, parsing do boxscore e cálculo de FPS
├── styles.css   # estilos
└── favicon.svg  # ícone
```
