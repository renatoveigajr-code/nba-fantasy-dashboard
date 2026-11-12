const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball';

const state = {
  league: 'nba',
  date: todayEastern(),
};

function todayEastern() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`ESPN API ${res.status}`);
  return res.json();
}

function parseIntOrZero(v) {
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
}

// "12-20" -> [12, 20]; "--" or missing -> [0, 0]
function parseMadeAttempted(v) {
  if (!v || v === '--') return [0, 0];
  const [made, att] = v.split('-').map(parseIntOrZero);
  return [made, att];
}

function fantasyPoints(p) {
  return (
    p.pts +
    p.dreb +
    p.oreb * 1.2 +
    p.ast * 1.1 +
    p.stl * 1.2 +
    p.blk * 1.3 -
    p.pf -
    p.turnover * 1.1 -
    p.fga * 0.4 -
    p.fta * 0.2
  );
}

function extractPlayers(boxscorePlayers, teamId) {
  const players = [];
  for (const teamEntry of boxscorePlayers || []) {
    if (teamEntry.team?.id !== teamId) continue;
    for (const statGroup of teamEntry.statistics || []) {
      const idx = {};
      (statGroup.names || statGroup.labels || []).forEach((name, i) => (idx[name] = i));

      for (const a of statGroup.athletes || []) {
        const s = a.stats || [];
        const get = (name) => s[idx[name]];
        const [fgm, fga] = parseMadeAttempted(get('FG'));
        const [ftm, fta] = parseMadeAttempted(get('FT'));
        const [fg3m, fg3a] = parseMadeAttempted(get('3PT'));

        players.push({
          name: a.athlete?.displayName || '—',
          min: get('MIN') || '—',
          fgm,
          fga,
          fg3m,
          fg3a,
          ftm,
          fta,
          oreb: parseIntOrZero(get('OREB')),
          dreb: parseIntOrZero(get('DREB')),
          ast: parseIntOrZero(get('AST')),
          stl: parseIntOrZero(get('STL')),
          blk: parseIntOrZero(get('BLK')),
          turnover: parseIntOrZero(get('TO')),
          pf: parseIntOrZero(get('PF')),
          pts: parseIntOrZero(get('PTS')),
        });
      }
    }
  }
  return players;
}

function esc(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function renderGames(events) {
  const container = document.getElementById('games');
  container.innerHTML = '';

  for (const event of events) {
    const comp = event.competitions?.[0];
    if (!comp) continue;
    const competitors = comp.competitors || [];
    const away = competitors.find((c) => c.homeAway === 'away');
    const home = competitors.find((c) => c.homeAway === 'home');
    if (!away || !home) continue;

    const card = document.createElement('a');
    card.className = 'game-card';
    card.href = `#game-${event.id}`;
    card.innerHTML = `
      <div class="team-line">
        <span>${esc(away.team?.abbreviation)}</span>
        <span class="score">${away.score ?? ''}</span>
      </div>
      <div class="team-line">
        <span>${esc(home.team?.abbreviation)}</span>
        <span class="score">${home.score ?? ''}</span>
      </div>
      <div class="game-status">${esc(event.status?.type?.shortDetail || '')}</div>
    `;
    container.appendChild(card);
  }
}

function playerRow(p) {
  const fps = fantasyPoints(p);
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>${esc(p.name)}</td>
    <td>${esc(p.min)}</td>
    <td>${p.fgm}-${p.fga}</td>
    <td>${p.ftm}-${p.fta}</td>
    <td>${p.oreb}</td>
    <td>${p.dreb}</td>
    <td>${p.ast}</td>
    <td>${p.stl}</td>
    <td>${p.blk}</td>
    <td>${p.turnover}</td>
    <td>${p.pf}</td>
    <td>${p.pts}</td>
    <td class="fps">${fps.toFixed(2)}</td>
  `;
  return tr;
}

function renderTeamTable(title, players) {
  const sorted = [...players].sort((a, b) => fantasyPoints(b) - fantasyPoints(a));

  const section = document.createElement('div');
  section.className = 'team-table';
  section.innerHTML = `
    <h3>${esc(title)}</h3>
    <table>
      <thead>
        <tr>
          <th>Jogador</th><th>Min</th><th>FG</th><th>FT</th>
          <th>OREB</th><th>DREB</th><th>AST</th><th>STL</th><th>BLK</th>
          <th>TO</th><th>PF</th><th>PTS</th><th>FPS</th>
        </tr>
      </thead>
      <tbody></tbody>
    </table>
  `;
  const tbody = section.querySelector('tbody');
  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="13" class="empty">Sem dados de boxscore.</td></tr>';
  } else {
    sorted.forEach((p) => tbody.appendChild(playerRow(p)));
  }
  return section;
}

async function loadDashboard() {
  const statusEl = document.getElementById('status');
  const statsEl = document.getElementById('stats');
  statsEl.innerHTML = '';
  statusEl.hidden = false;
  statusEl.textContent = 'Carregando...';

  try {
    const yyyymmdd = state.date.replaceAll('-', '');
    const base = `${ESPN_BASE}/${state.league}`;

    const scoreboard = await fetchJSON(`${base}/scoreboard?dates=${yyyymmdd}`);
    const events = scoreboard.events || [];

    renderGames(events);

    if (events.length === 0) {
      statusEl.textContent = 'Nenhum jogo encontrado para esta data.';
      return;
    }

    const summaries = await Promise.all(
      events.map((e) => fetchJSON(`${base}/summary?event=${e.id}`).catch(() => null))
    );

    statusEl.hidden = true;

    events.forEach((event, i) => {
      const comp = event.competitions?.[0];
      if (!comp) return;
      const competitors = comp.competitors || [];
      const away = competitors.find((c) => c.homeAway === 'away') || competitors[1];
      const home = competitors.find((c) => c.homeAway === 'home') || competitors[0];
      if (!away || !home) return;

      const boxscorePlayers = summaries[i]?.boxscore?.players;
      const gameSection = document.createElement('section');
      gameSection.id = `game-${event.id}`;
      gameSection.className = 'game-stats';
      gameSection.innerHTML = `
        <h2>${esc(away.team?.abbreviation)} @ ${esc(home.team?.abbreviation)}
          <span class="game-status">${esc(event.status?.type?.shortDetail || '')}</span>
        </h2>
      `;

      if (boxscorePlayers) {
        gameSection.appendChild(renderTeamTable(`${away.team?.abbreviation} (visitante)`, extractPlayers(boxscorePlayers, away.team?.id)));
        gameSection.appendChild(renderTeamTable(`${home.team?.abbreviation} (mandante)`, extractPlayers(boxscorePlayers, home.team?.id)));
      } else {
        gameSection.innerHTML += '<p class="empty">Boxscore ainda não disponível.</p>';
      }

      statsEl.appendChild(gameSection);
    });
  } catch (err) {
    statusEl.textContent = `Erro ao carregar dados: ${err.message}`;
  }
}

document.getElementById('league').addEventListener('change', (e) => {
  state.league = e.target.value;
});
document.getElementById('search').addEventListener('click', loadDashboard);
document.getElementById('date').addEventListener('change', (e) => {
  state.date = e.target.value;
});

document.getElementById('league').value = state.league;
document.getElementById('date').value = state.date;
loadDashboard();
