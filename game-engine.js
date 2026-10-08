'use strict';

const ROLE_INFO = {
  doppelganger: { name: '도플갱어', team: 'dynamic', emoji: '🪞', max: 1, order: 0 },
  werewolf: { name: '늑대인간', team: 'wolf', emoji: '🐺', max: 2, order: 10 },
  minion: { name: '하수인', team: 'wolf', emoji: '🕯️', max: 1, order: 20 },
  mason: { name: '석공', team: 'village', emoji: '🧱', max: 2, order: 30 },
  seer: { name: '예언자', team: 'village', emoji: '🔮', max: 1, order: 40 },
  robber: { name: '강도', team: 'village', emoji: '🦹', max: 1, order: 50 },
  troublemaker: { name: '말썽쟁이', team: 'village', emoji: '🃏', max: 1, order: 60 },
  drunk: { name: '주정뱅이', team: 'village', emoji: '🍺', max: 1, order: 70 },
  insomniac: { name: '불면증 환자', team: 'village', emoji: '🌙', max: 1, order: 80 },
  hunter: { name: '사냥꾼', team: 'village', emoji: '🏹', max: 1, order: 100 },
  tanner: { name: '무두장이', team: 'tanner', emoji: '🪓', max: 1, order: 100 },
  villager: { name: '주민', team: 'village', emoji: '🏠', max: 3, order: 100 }
};

function makeCard(role, id) {
  return { id, role, doppelRole: null };
}

function effectiveRole(card) {
  if (!card) return null;
  return card.role === 'doppelganger' && card.doppelRole ? card.doppelRole : card.role;
}

// What a player physically sees when looking at a card during the night.
// A moved Doppelgänger card still LOOKS like the Doppelgänger card; its copied
// effective role is deliberately not revealed by looking at the card face.
function cardFaceView(card) {
  if (!card) return null;
  const info = ROLE_INFO[card.role];
  return { id: card.id, role: card.role, name: info.name, emoji: info.emoji, team: info.team };
}

// Used only after the game, when all hidden information is revealed.
function finalRoleView(card) {
  if (!card) return null;
  const eff = effectiveRole(card);
  const info = ROLE_INFO[eff];
  const physical = ROLE_INFO[card.role];
  return {
    id: card.id,
    role: eff,
    name: info.name,
    emoji: info.emoji,
    team: info.team,
    physicalRole: card.role,
    physicalName: physical.name,
    physicalEmoji: physical.emoji,
    copiedRole: card.role === 'doppelganger' ? card.doppelRole : null,
    displayName: card.role === 'doppelganger' && card.doppelRole ? `도플갱어 → ${info.name}` : info.name
  };
}

function validateRoleSelection(roles, playerCount) {
  if (!Number.isInteger(playerCount) || playerCount < 3 || playerCount > 10) {
    return { ok: false, error: '플레이어는 3~10명이어야 합니다.' };
  }
  if (!Array.isArray(roles) || roles.length !== playerCount + 3) {
    return { ok: false, error: `역할은 정확히 ${playerCount + 3}장이어야 합니다.` };
  }
  const counts = {};
  for (const role of roles) {
    const info = ROLE_INFO[role];
    if (!info) return { ok: false, error: '알 수 없는 역할이 있습니다.' };
    counts[role] = (counts[role] || 0) + 1;
    if (counts[role] > info.max) return { ok: false, error: `${info.name} 카드가 너무 많습니다.` };
  }
  // Official rule: when Masons are used, both Mason cards are put in the game.
  if ((counts.mason || 0) === 1) return { ok: false, error: '석공을 사용할 때는 석공 카드 2장을 모두 넣어야 합니다.' };
  // Official role guidance: Insomniac is used with Robber and/or Troublemaker.
  if ((counts.insomniac || 0) > 0 && !(counts.robber || counts.troublemaker)) {
    return { ok: false, error: '불면증 환자를 넣을 때는 강도 또는 말썽쟁이도 함께 넣어주세요.' };
  }
  return { ok: true };
}

function computeBaseDeaths(players) {
  const counts = new Map();
  for (const p of players) {
    if (p.vote) counts.set(p.vote, (counts.get(p.vote) || 0) + 1);
  }
  const maxVotes = counts.size ? Math.max(...counts.values()) : 0;
  if (maxVotes <= 1) return [];
  return [...counts.entries()].filter(([, n]) => n === maxVotes).map(([id]) => id);
}

function computeDeathsWithHunter(players, getCard) {
  const killed = new Set(computeBaseDeaths(players));
  const queue = [...killed];
  while (queue.length) {
    const id = queue.shift();
    const player = players.find(p => p.id === id);
    const card = getCard(id);
    if (!player || effectiveRole(card) !== 'hunter' || !player.vote) continue;
    if (!killed.has(player.vote)) {
      killed.add(player.vote);
      queue.push(player.vote); // Hunter killing another Hunter can chain again.
    }
  }
  return [...killed];
}

function resolveOutcome(players, getCard) {
  const killedIds = computeDeathsWithHunter(players, getCard);
  const rows = players.map(player => ({ player, card: getCard(player.id), role: effectiveRole(getCard(player.id)) }));
  const wolves = rows.filter(x => x.role === 'werewolf');
  const minions = rows.filter(x => x.role === 'minion');
  const villageMembers = rows.filter(x => ROLE_INFO[x.role]?.team === 'village');
  const wolfMembers = rows.filter(x => ['werewolf','minion'].includes(x.role));
  const deadWolves = wolves.filter(x => killedIds.includes(x.player.id));
  const deadTanners = rows.filter(x => x.role === 'tanner' && killedIds.includes(x.player.id));

  let winnerText = '';
  let winningTeams = [];
  let winnerIds = [];

  // Each Tanner-role player only satisfies the Tanner objective by dying.
  // If a Werewolf also dies, the village team wins in addition to the dead Tanner(s).
  if (deadTanners.length > 0) {
    const names = deadTanners.map(x => x.player.name).join(', ');
    if (deadWolves.length > 0) {
      winnerText = `무두장이와 마을팀 승리! ${names} 님이 무두장이로 죽었고 늑대도 함께 죽었습니다.`;
      winningTeams = ['tanner', 'village'];
      winnerIds = [...deadTanners.map(x => x.player.id), ...villageMembers.map(x => x.player.id)];
    } else {
      winnerText = `무두장이 승리! ${names} 님이 무두장이로 죽었습니다.`;
      winningTeams = ['tanner'];
      winnerIds = deadTanners.map(x => x.player.id);
    }
  } else if (wolves.length > 0) {
    if (deadWolves.length > 0) {
      winnerText = `마을팀 승리! 늑대 ${deadWolves.map(x => x.player.name).join(', ')} 님이 죽었습니다.`;
      winningTeams = ['village'];
      winnerIds = villageMembers.map(x => x.player.id);
    } else {
      winnerText = '늑대팀 승리! 플레이어 중 늑대가 있었지만 늑대는 한 명도 죽지 않았습니다.';
      winningTeams = ['wolf'];
      winnerIds = wolfMembers.map(x => x.player.id);
    }
  } else if (killedIds.length === 0) {
    winnerText = '마을팀 승리! 플레이어 중 늑대가 없었고 아무도 죽지 않았습니다.';
    winningTeams = ['village'];
    winnerIds = villageMembers.map(x => x.player.id);
  } else if (minions.length > 0) {
    // With no player-Werewolves, the Minion side wins if at least one non-Minion
    // player dies. A Tanner death has already been handled above and overrides this.
    const nonMinionDied = rows.some(x => x.role !== 'minion' && killedIds.includes(x.player.id));
    if (nonMinionDied) {
      winnerText = '하수인(늑대팀) 승리! 플레이어 중 늑대는 없었지만 하수인 이외의 플레이어가 죽었습니다.';
      winningTeams = ['wolf'];
      winnerIds = minions.map(x => x.player.id);
    } else {
      winnerText = '승리자 없음. 플레이어 중 늑대가 없었고 하수인만 죽었습니다.';
      winningTeams = [];
      winnerIds = [];
    }
  } else {
    winnerText = '승리자 없음. 플레이어 중 늑대가 없는데 누군가 죽었습니다.';
    winningTeams = [];
    winnerIds = [];
  }

  return { killedIds, winnerText, winningTeams, winnerIds: [...new Set(winnerIds)] };
}

module.exports = {
  ROLE_INFO,
  makeCard,
  effectiveRole,
  cardFaceView,
  finalRoleView,
  validateRoleSelection,
  computeBaseDeaths,
  computeDeathsWithHunter,
  resolveOutcome
};
