'use strict';

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const {
  ROLE_INFO,
  makeCard,
  effectiveRole,
  cardFaceView,
  finalRoleView,
  validateRoleSelection,
  resolveOutcome
} = require('./game-engine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const liveSockets = new Map();

const NIGHT_ORDER = [
  'doppelganger', 'werewolf', 'minion', 'mason', 'seer', 'robber',
  'troublemaker', 'drunk', 'insomniac', 'doppel_insomniac'
];

// Korean paraphrases of the rules, not copied audio/text from the official app.
const NARRATION = {
  doppelganger: {
    start: '도플갱어는 눈을 뜨세요. 다른 플레이어 한 명의 카드를 확인하고 그 역할을 복사하세요. 화면에 추가 행동이 나오면 지금 실행하세요.',
    end: '도플갱어는 눈을 감아 주세요.'
  },
  werewolf: {
    start: '늑대인간은 눈을 뜨세요. 함께 깨어난 다른 늑대인간을 확인하세요.',
    end: '늑대인간은 눈을 감아 주세요.'
  },
  minion: {
    start: '하수인은 눈을 뜨세요. 휴대폰 화면에서 늑대인간이 누구인지 확인하세요.',
    end: '하수인은 눈을 감아 주세요.'
  },
  mason: {
    start: '석공은 눈을 뜨세요. 함께 깨어난 다른 석공을 확인하세요.',
    end: '석공은 눈을 감아 주세요.'
  },
  seer: {
    start: '예언자는 눈을 뜨세요. 다른 플레이어 한 명의 카드 또는 가운데 카드 두 장을 확인할 수 있습니다.',
    end: '예언자는 눈을 감아 주세요.'
  },
  robber: {
    start: '강도는 눈을 뜨세요. 원한다면 다른 플레이어 한 명과 카드를 바꾸고 새로 받은 카드의 앞면을 확인하세요.',
    end: '강도는 눈을 감아 주세요.'
  },
  troublemaker: {
    start: '말썽쟁이는 눈을 뜨세요. 원한다면 자신을 제외한 두 플레이어의 카드를 보지 않고 서로 바꾸세요.',
    end: '말썽쟁이는 눈을 감아 주세요.'
  },
  drunk: {
    start: '주정뱅이는 눈을 뜨세요. 자신의 카드와 가운데 카드 한 장을 바꾸세요. 새로 받은 카드는 확인하지 마세요.',
    end: '주정뱅이는 눈을 감아 주세요.'
  },
  insomniac: {
    start: '불면증 환자는 눈을 뜨세요. 현재 자기 앞에 있는 카드의 앞면을 확인하세요.',
    end: '불면증 환자는 눈을 감아 주세요.'
  },
  doppel_insomniac: {
    start: '도플갱어가 불면증 환자를 복사했다면 지금 눈을 뜨고 현재 자기 앞의 카드를 확인하세요.',
    end: '해당 도플갱어는 다시 눈을 감아 주세요.'
  }
};

const MIN_ACTION_MS = {
  doppelganger: 3000,
  werewolf: 3000,
  minion: 3000,
  mason: 3000,
  seer: 3000,
  robber: 3000,
  troublemaker: 3000,
  drunk: 3000,
  insomniac: 3000,
  doppel_insomniac: 3000
};

function token() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function code4() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  do s = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  while (rooms.has(s));
  return s;
}

function shuffle(a) {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function defaultRoles(n) {
  const presets = {
    3: ['werewolf','werewolf','seer','robber','troublemaker','villager'],
    4: ['werewolf','werewolf','seer','robber','troublemaker','villager','villager'],
    5: ['werewolf','werewolf','seer','robber','troublemaker','villager','villager','villager'],
    6: ['werewolf','werewolf','minion','doppelganger','seer','robber','troublemaker','drunk','insomniac'],
    7: ['werewolf','werewolf','minion','doppelganger','seer','robber','troublemaker','drunk','insomniac','hunter'],
    8: ['werewolf','werewolf','minion','doppelganger','seer','robber','troublemaker','drunk','insomniac','hunter','tanner'],
    9: ['werewolf','werewolf','minion','doppelganger','seer','robber','troublemaker','drunk','insomniac','hunter','tanner','villager'],
    10:['werewolf','werewolf','minion','doppelganger','seer','robber','troublemaker','drunk','insomniac','hunter','tanner','villager','villager']
  };
  return presets[n] ? [...presets[n]] : [];
}


function presetRoles(n, mode) {
  if (mode === 'chaos') {
    const pool=['werewolf','werewolf','doppelganger','robber','troublemaker','drunk','seer','minion','insomniac','hunter','tanner','villager','villager'];
    return pool.slice(0,n+3);
  }
  const roles=['werewolf','werewolf','seer','robber','troublemaker','villager'];
  if(n>=6) roles.push('mason','mason');
  for(const role of ['villager','villager','hunter','drunk','insomniac','minion']){
    if(roles.length>=n+3) break;
    roles.push(role);
  }
  return roles;
}
function recordSwap(room,player,role,a,b,cardA,cardB){
  (room.actionHistory ||= []).push({kind:'swap',actor:player.name,role:ROLE_INFO[role].name,a,b,cardA:finalRoleView(cardA),cardB:finalRoleView(cardB)});
}

function sanitizeName(name) {
  return String(name || '').trim().slice(0, 12) || '익명';
}

function fastBotGame(room){return !!room.fastBots && room.players.some(p=>p.bot) && room.players.filter(p=>!p.bot).length===1;}

function publicRoom(room) {
  return {
    code: room.code,
    fastBots: !!room.fastBots,
    fastBotGame: fastBotGame(room),
    hostId: room.hostId,
    phase: room.phase,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      connected: p.connected,
      bot: !!p.bot,
      voted: !!p.vote
    })),
    selectedRoles: room.selectedRoles,
    readyIds: [...(room.ready || [])],
    playerCount: room.playerCount,
    discussionSeconds: room.discussionSeconds,
    discussionEndsAt: room.discussionEndsAt || null,
    loneWolfCenter: !!room.loneWolfCenter,
    winnerText: room.winnerText || null,
    killedIds: room.killedIds || []
  };
}

function emitRoom(room) {
  io.to(room.code).emit('room:update', publicRoom(room));
}

function getRoomOf(socket) {
  const code = socket.data.roomCode;
  return code ? rooms.get(code) : null;
}

function selectedNightSteps(room) {
  const selected = new Set(room.selectedRoles || []);
  return NIGHT_ORDER.filter(role => {
    if (role === 'doppel_insomniac') return selected.has('doppelganger') && selected.has('insomniac');
    return selected.has(role);
  });
}

function doppelPlayer(room) {
  return room.players.find(p => p.initialCard?.role === 'doppelganger') || null;
}

function werewolfActors(room) {
  return room.players.filter(p =>
    p.initialCard?.role === 'werewolf' ||
    (p.initialCard?.role === 'doppelganger' && p.initialCard?.doppelRole === 'werewolf')
  );
}

function masonActors(room) {
  return room.players.filter(p =>
    p.initialCard?.role === 'mason' ||
    (p.initialCard?.role === 'doppelganger' && p.initialCard?.doppelRole === 'mason')
  );
}

function activeNightActors(room, step) {
  if (step === 'doppelganger') return room.players.filter(p => p.initialCard?.role === 'doppelganger');
  if (step === 'werewolf') return werewolfActors(room);
  if (step === 'mason') return masonActors(room);
  if (step === 'doppel_insomniac') {
    return room.players.filter(p => p.initialCard?.role === 'doppelganger' && p.initialCard?.doppelRole === 'insomniac');
  }
  // Doppelgänger-Seer/Robber/Troublemaker/Drunk acts immediately during the
  // Doppelgänger phase and therefore is intentionally NOT included here.
  return room.players.filter(p => p.initialCard?.role === step);
}

function clearNightTimers(room) {
  for (const timer of room.botTimers || []) clearTimeout(timer);
  room.botTimers = new Set();
  room.players.forEach(p => { p.botTimer = null; });
  clearTimeout(room.narrationFallbackTimer);
  clearTimeout(room.minimumActionTimer);
  clearTimeout(room.nightTransitionTimer);
  room.narrationFallbackTimer = null;
  room.minimumActionTimer = null;
  room.nightTransitionTimer = null;
}

function narrationFallbackMs(text) {
  // Keep the server fallback comfortably behind the host phone's local TTS
  // fallback so the game normally advances only after the host reports that
  // narration has finished. This fallback exists only for a disconnected or
  // broken host browser.
  return Math.max(65000, 15000 + String(text || '').length * 250);
}

function narrateAndWait(room, text, kind, role, next) {
  if (!room || room.phase !== 'night') return;
  if(fastBotGame(room)){
    io.to(room.code).emit('narration:say',{text,kind,role,fast:true});
    room.nightTransitionTimer=setTimeout(()=>{if(room.phase==='night')next();},80);
    return;
  }
  clearTimeout(room.narrationFallbackTimer);
  const cueId = token();
  const payload = { text, kind, role, cueId, at: Date.now() };
  room.narrationCue = { cueId, next, payload };
  io.to(room.code).emit('narration:say', payload);
  room.narrationFallbackTimer = setTimeout(() => finishNarrationCue(room, cueId), narrationFallbackMs(text));
}

function finishNarrationCue(room, cueId) {
  if (!room?.narrationCue || room.narrationCue.cueId !== cueId) return;
  clearTimeout(room.narrationFallbackTimer);
  const next = room.narrationCue.next;
  room.narrationCue = null;
  room.narrationFallbackTimer = null;
  if (typeof next === 'function') next();
}

function genericActionPrompt(room, player, actionRole, wrapperRole = actionRole) {
  const others = room.players.filter(p => p.id !== player.id).map(p => ({ id: p.id, name: p.name }));
  const info = ROLE_INFO[actionRole];
  const isDoppel = wrapperRole === 'doppelganger';
  const data = {
    role: wrapperRole,
    actionRole,
    roleName: isDoppel ? `도플갱어 → ${info.name}` : info.name,
    emoji: isDoppel ? ROLE_INFO.doppelganger.emoji : info.emoji,
    copiedEmoji: isDoppel ? info.emoji : null,
    others,
    center: [0,1,2],
    instructions: '',
    skipAllowed: false,
    stage: isDoppel ? 'followup' : 'action'
  };

  if (actionRole === 'seer') {
    data.instructions = '다른 플레이어 1명 또는 가운데 카드 2장의 앞면을 확인할 수 있습니다.';
    data.skipAllowed = true;
  } else if (actionRole === 'robber') {
    data.instructions = '원한다면 다른 플레이어 1명과 카드를 바꾼 뒤 새 카드의 앞면을 확인하세요.';
    data.skipAllowed = true;
  } else if (actionRole === 'troublemaker') {
    data.instructions = '원한다면 자신을 제외한 다른 플레이어 2명의 카드를 보지 않고 서로 바꾸세요.';
    data.skipAllowed = true;
  } else if (actionRole === 'drunk') {
    data.instructions = '자기 카드와 가운데 카드 1장을 반드시 바꾸세요. 새 카드는 확인하지 않습니다.';
  } else if (actionRole === 'insomniac') {
    data.instructions = '현재 자기 앞에 있는 카드의 앞면을 확인하세요.';
    data.currentCard = cardFaceView(room.currentCards.get(player.id));
  }
  return data;
}

function buildNightPrompt(room, player, step) {
  if (step === 'doppelganger') {
    player.nightState = { stage: 'copy' };
    return {
      role: 'doppelganger',
      actionRole: 'doppelganger',
      stage: 'copy',
      roleName: '도플갱어',
      emoji: ROLE_INFO.doppelganger.emoji,
      others: room.players.filter(p => p.id !== player.id).map(p => ({ id: p.id, name: p.name })),
      instructions: '다른 플레이어 한 명의 카드 앞면을 확인하고 그 역할을 복사하세요.',
      skipAllowed: false
    };
  }

  if (step === 'werewolf') {
    const wolves = werewolfActors(room);
    const mates = wolves.filter(p => p.id !== player.id).map(p => ({ id: p.id, name: p.name }));
    const solo = wolves.length === 1;
    return {
      role: 'werewolf', actionRole: 'werewolf', stage: 'action',
      roleName: player.initialCard.role === 'doppelganger' ? '도플갱어 → 늑대인간' : '늑대인간',
      emoji: player.initialCard.role === 'doppelganger' ? ROLE_INFO.doppelganger.emoji : ROLE_INFO.werewolf.emoji,
      copiedEmoji: player.initialCard.role === 'doppelganger' ? ROLE_INFO.werewolf.emoji : null,
      mates, solo, loneWolfCenter: !!room.loneWolfCenter,
      instructions: solo && room.loneWolfCenter
        ? '당신은 이번 밤에 혼자 깨어난 늑대입니다. 외로운 늑대 옵션으로 가운데 카드 1장을 확인할 수 있습니다.'
        : (solo ? '이번 밤에 함께 깨어난 다른 늑대가 없습니다.' : '함께 깨어난 다른 늑대를 확인하세요.'),
      center: [0,1,2], skipAllowed: solo && room.loneWolfCenter
    };
  }

  if (step === 'minion') {
    return {
      role: 'minion', actionRole: 'minion', stage: 'action', roleName: '하수인', emoji: ROLE_INFO.minion.emoji,
      wolves: werewolfActors(room).map(p => ({ id: p.id, name: p.name })),
      instructions: '늑대인간이 누구인지 확인하세요. 늑대인간은 하수인이 누구인지 알 수 없습니다.',
      skipAllowed: false
    };
  }

  if (step === 'mason') {
    const masons = masonActors(room);
    return {
      role: 'mason', actionRole: 'mason', stage: 'action',
      roleName: player.initialCard.role === 'doppelganger' ? '도플갱어 → 석공' : '석공',
      emoji: player.initialCard.role === 'doppelganger' ? ROLE_INFO.doppelganger.emoji : ROLE_INFO.mason.emoji,
      copiedEmoji: player.initialCard.role === 'doppelganger' ? ROLE_INFO.mason.emoji : null,
      mates: masons.filter(p => p.id !== player.id).map(p => ({ id: p.id, name: p.name })),
      instructions: '함께 깨어난 다른 석공을 확인하세요.', skipAllowed: false
    };
  }

  if (step === 'doppel_insomniac') {
    return {
      role: 'doppel_insomniac', actionRole: 'insomniac', stage: 'action',
      roleName: '도플갱어 → 불면증 환자', emoji: ROLE_INFO.doppelganger.emoji, copiedEmoji: ROLE_INFO.insomniac.emoji,
      instructions: '현재 자기 앞에 있는 카드의 앞면을 확인하세요.',
      currentCard: cardFaceView(room.currentCards.get(player.id)), skipAllowed: false
    };
  }

  return genericActionPrompt(room, player, step, step);
}


function rebuildPendingPrompt(room, player) {
  if (!room || room.phase !== 'night' || !room.actionWindowOpen || !room.pendingActors?.has(player.id) || room.awaitingAck?.has(player.id)) return null;
  if (room.activeNightRole === 'doppelganger' && player.nightState?.stage === 'followup') {
    const copiedRole = player.nightState.copiedRole || player.initialCard?.doppelRole;
    const prompt = genericActionPrompt(room, player, copiedRole, 'doppelganger');
    player.nightState.currentPrompt = prompt;
    return prompt;
  }
  return buildNightPrompt(room, player, room.activeNightRole);
}

function refreshPendingNightPrompts(room, excludePlayerId = null) {
  if (!room || room.phase !== 'night') return;
  for (const player of room.players) {
    if (player.id === excludePlayerId) continue;
    const prompt = rebuildPendingPrompt(room, player);
    if (prompt && player.connected) sendNightPrompt(room, player, prompt);
  }
}

function maybeFinishNightStep(room) {
  if (!room || room.phase !== 'night' || room.finishingNightStep) return;
  if (!room.minimumActionElapsed || room.pendingActors.size > 0 || room.awaitingAck.size > 0) return;
  room.finishingNightStep = true;
  const step = room.activeNightRole;
  narrateAndWait(room, NARRATION[step].end, 'role-end', step, () => {
    if (!room || room.phase !== 'night') return;
    room.nightIndex += 1;
    room.finishingNightStep = false;
    room.nightTransitionTimer = setTimeout(() => startNextNightStep(room), fastBotGame(room)?80:450);
  });
}

function actorDone(room, playerId) {
  room.pendingActors.delete(playerId);
  room.awaitingAck.delete(playerId);
  const p = room.players.find(x => x.id === playerId);
  if (p) {
    p.pendingReveal = null;
    if (p.nightState?.stage === 'done') p.nightState = null;
  }
  io.to(playerId).emit('night:done');
  maybeFinishNightStep(room);
}

function scheduleBot(room, player, fn) {
  room.botTimers = room.botTimers || new Set();
  if (player.botTimer) {
    clearTimeout(player.botTimer);
    room.botTimers.delete(player.botTimer);
  }
  const timer = setTimeout(() => {
    room.botTimers.delete(timer);
    player.botTimer = null;
    if (rooms.get(room.code) === room && room.players.includes(player)) fn();
  }, fastBotGame(room)?100:600 + Math.floor(Math.random() * 600));
  player.botTimer = timer;
  room.botTimers.add(timer);
}

function botNightPayload(prompt) {
  const others = prompt.others || [];
  const pick = list => list[Math.floor(Math.random() * list.length)];
  if (prompt.stage === 'copy') return { targets: [pick(others).id] };
  if (prompt.skipAllowed && Math.random() < 0.2) return { skip: true };
  if (prompt.actionRole === 'seer') {
    return Math.random() < 0.5
      ? { type: 'player', targets: [pick(others).id] }
      : { type: 'center', centerIndexes: shuffle([0,1,2]).slice(0,2) };
  }
  if (prompt.actionRole === 'robber') return { targets: [pick(others).id] };
  if (prompt.actionRole === 'troublemaker') return { targets: shuffle(others).slice(0,2).map(p => p.id) };
  if (prompt.actionRole === 'drunk' || (prompt.actionRole === 'werewolf' && prompt.solo && prompt.loneWolfCenter)) {
    return { centerIndexes: [Math.floor(Math.random() * 3)] };
  }
  return {};
}

function sendNightPrompt(room, player, prompt) {
  if (!player.bot) return io.to(player.id).emit('night:prompt', prompt);
  scheduleBot(room, player, () => {
    if (room.phase !== 'night' || !room.actionWindowOpen) return;
    handleNightAction(room, player.id, botNightPayload(prompt), res => {
      if (res?.ok && res.requiresAck) scheduleBot(room, player, () => handleNightAck(room, player.id));
    });
  });
}

function openActionWindow(room, step, actors) {
  if (!room || room.phase !== 'night' || room.activeNightRole !== step) return;
  room.actionWindowOpen = true;
  room.minimumActionElapsed = false;
  room.actionWindowStartedAt = Date.now();

  actors.forEach(p => sendNightPrompt(room, p, buildNightPrompt(room, p, step)));
  room.players.filter(p => !room.pendingActors.has(p.id)).forEach(p => {
    io.to(p.id).emit('night:waiting', { message: `${step === 'doppel_insomniac' ? '도플갱어-불면증 확인' : ROLE_INFO[step]?.name || '역할'} 차례입니다. 눈을 감고 기다려주세요.` });
  });
  emitRoom(room);

  room.minimumActionTimer = setTimeout(() => {
    room.minimumActionElapsed = true;
    maybeFinishNightStep(room);
  }, fastBotGame(room)?100:(MIN_ACTION_MS[step] || 7000));

  if (actors.length === 0) maybeFinishNightStep(room);
}

function startNextNightStep(room) {
  if (!room || room.phase !== 'night') return;
  const steps = selectedNightSteps(room);
  if (room.nightIndex >= steps.length) {
    narrateAndWait(room, '밤이 끝났습니다. 모두 눈을 뜨고 토론을 시작하세요.', 'wake', null, () => beginDiscussion(room));
    return;
  }

  const step = steps[room.nightIndex];
  const actors = activeNightActors(room, step);
  room.activeNightRole = step;
  room.actionWindowOpen = false;
  room.pendingActors = new Set(actors.map(p => p.id));
  room.awaitingAck = new Set();
  room.finishingNightStep = false;
  room.minimumActionElapsed = false;
  actors.forEach(p => { p.pendingReveal = null; p.nightState = null; });

  // The selected role is always announced even when every copy of that role is
  // in the center, preventing narration timing from revealing center cards.
  const text = step === 'werewolf' && room.loneWolfCenter
    ? NARRATION[step].start + ' 혼자 깨어난 늑대인간은 원한다면 가운데 카드 한 장을 확인하세요.'
    : NARRATION[step].start;
  narrateAndWait(room, text, 'role-start', step, () => openActionWindow(room, step, actors));
}

function beginDiscussion(room) {
  if (!room) return;
  clearNightTimers(room);
  room.narrationCue = null;
  room.phase = 'discussion';
  room.activeNightRole = null;
  room.pendingActors = new Set();
  room.awaitingAck = new Set();
  const seconds = fastBotGame(room)?3:(room.discussionSeconds || 240);
  room.discussionEndsAt = Date.now() + seconds * 1000;
  room.players.forEach(p => io.to(p.id).emit('discussion:start', { endsAt: room.discussionEndsAt }));
  emitRoom(room);
  clearTimeout(room.discussionTimer);
  room.discussionTimer = setTimeout(() => beginVoting(room), seconds * 1000);
}

function beginVoting(room) {
  if (!room || room.phase !== 'discussion') return;
  clearTimeout(room.discussionTimer);
  room.discussionTimer = null;
  room.phase = 'voting';
  room.discussionEndsAt = null;
  room.players.forEach(p => { p.vote = null; });
  io.to(room.code).emit('voting:start');
  emitRoom(room);
  room.players.filter(p => p.bot).forEach(player => scheduleBot(room, player, () => {
    if (room.phase !== 'voting') return;
    const others = room.players.filter(p => p.id !== player.id);
    const target = others[Math.floor(Math.random() * others.length)];
    castVote(room, player.id, target.id);
  }));
}

function resolveGame(room) {
  const outcome = resolveOutcome(room.players, id => room.currentCards.get(id));
  room.phase = 'result';
  room.killedIds = outcome.killedIds;
  room.winnerText = outcome.winnerText;
  room.winningTeams = outcome.winningTeams;
  clearTimeout(room.discussionTimer);
  clearNightTimers(room);

  const reveal = {
    winnerText: outcome.winnerText,
    winningTeams: outcome.winningTeams,
    winnerIds: outcome.winnerIds,
    killedIds: outcome.killedIds,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      initial: cardFaceView(p.initialCard),
      final: finalRoleView(room.currentCards.get(p.id)),
      vote: p.vote
    })),
    history: room.actionHistory || [],
    center: room.centerCards.map(finalRoleView)
  };
  room.lastReveal = reveal;
  io.to(room.code).emit('game:result', reveal);
  emitRoom(room);
}

function finishWithReveal(room, player, cb, result, options = {}) {
  const { nextPrompt = null } = options;
  room.awaitingAck.add(player.id);
  player.pendingReveal = { ...result, nextPrompt: !!nextPrompt };
  if (nextPrompt) {
    player.nightState = player.nightState || {};
    player.nightState.nextPrompt = nextPrompt;
  }
  cb?.({ ok: true, requiresAck: true, ...result, nextPrompt: !!nextPrompt });
}

function finishWithoutReveal(room, player, cb, result = {}) {
  cb?.({ ok: true, ...result });
  actorDone(room, player.id);
}

function performRoleAction(room, player, actionRole, payload, cb, wrapperRole = actionRole) {
  const targets = Array.isArray(payload.targets) ? payload.targets : [];
  const centerIndexes = Array.isArray(payload.centerIndexes) ? payload.centerIndexes : [];
  const type = payload.type;
  const skip = !!payload.skip;

  if (skip && ['seer','robber','troublemaker'].includes(actionRole)) {
    player.nightState = { stage: 'done' };
    return finishWithoutReveal(room, player, cb, { skipped: true });
  }

  if (actionRole === 'werewolf') {
    const wolves = werewolfActors(room);
    if (wolves.length === 1 && room.loneWolfCenter) {
      if (skip) return finishWithoutReveal(room, player, cb, { skipped: true });
      const idx = Number(centerIndexes[0]);
      if (![0,1,2].includes(idx)) throw new Error('가운데 카드 1장을 선택하거나 건너뛰세요.');
      player.nightState = { stage: 'done' };
      return finishWithReveal(room, player, cb, { seen: [cardFaceView(room.centerCards[idx])] });
    }
    player.nightState = { stage: 'done' };
    return finishWithoutReveal(room, player, cb);
  }

  if (actionRole === 'minion' || actionRole === 'mason') {
    player.nightState = { stage: 'done' };
    return finishWithoutReveal(room, player, cb);
  }

  if (actionRole === 'seer') {
    if (type === 'player') {
      const tid = targets[0];
      if (!tid || tid === player.id || !room.currentCards.has(tid)) throw new Error('다른 플레이어 1명을 선택하세요.');
      player.nightState = { stage: 'done' };
      return finishWithReveal(room, player, cb, { seen: [cardFaceView(room.currentCards.get(tid))] });
    }
    if (type === 'center') {
      const uniq = [...new Set(centerIndexes.map(Number))];
      if (uniq.length !== 2 || uniq.some(i => ![0,1,2].includes(i))) throw new Error('가운데 카드 2장을 선택하세요.');
      player.nightState = { stage: 'done' };
      return finishWithReveal(room, player, cb, { seen: uniq.map(i => cardFaceView(room.centerCards[i])) });
    }
    throw new Error('확인 방법을 선택하거나 행동을 건너뛰세요.');
  }

  if (actionRole === 'robber') {
    const tid = targets[0];
    if (!tid || tid === player.id || !room.currentCards.has(tid)) throw new Error('다른 플레이어 1명을 선택하거나 행동을 건너뛰세요.');
    const mine = room.currentCards.get(player.id);
    const theirs = room.currentCards.get(tid);
    recordSwap(room,player,actionRole,player.name,room.players.find(p=>p.id===tid).name,mine,theirs);
    room.currentCards.set(player.id, theirs);
    room.currentCards.set(tid, mine);
    player.nightState = { stage: 'done' };
    return finishWithReveal(room, player, cb, { seen: [cardFaceView(theirs)] });
  }

  if (actionRole === 'troublemaker') {
    const uniq = [...new Set(targets)].filter(id => id !== player.id && room.currentCards.has(id));
    if (uniq.length !== 2) throw new Error('다른 플레이어 2명을 선택하거나 행동을 건너뛰세요.');
    const a = room.currentCards.get(uniq[0]);
    const b = room.currentCards.get(uniq[1]);
    recordSwap(room,player,actionRole,room.players.find(p=>p.id===uniq[0]).name,room.players.find(p=>p.id===uniq[1]).name,a,b);
    room.currentCards.set(uniq[0], b);
    room.currentCards.set(uniq[1], a);
    player.nightState = { stage: 'done' };
    return finishWithoutReveal(room, player, cb);
  }

  if (actionRole === 'drunk') {
    const idx = Number(centerIndexes[0]);
    if (![0,1,2].includes(idx)) throw new Error('가운데 카드 1장을 선택하세요.');
    const mine = room.currentCards.get(player.id);
    const center = room.centerCards[idx];
    recordSwap(room,player,actionRole,player.name,`가운데 ${idx+1}`,mine,center);
    room.currentCards.set(player.id, center);
    room.centerCards[idx] = mine;
    player.nightState = { stage: 'done' };
    return finishWithoutReveal(room, player, cb);
  }

  if (actionRole === 'insomniac') {
    player.nightState = { stage: 'done' };
    return finishWithoutReveal(room, player, cb);
  }

  throw new Error(`지원하지 않는 밤 행동입니다: ${wrapperRole}/${actionRole}`);
}

function handleNightAction(room, playerId, payload = {}, cb) {

    if (!room || room.phase !== 'night' || !room.actionWindowOpen || !room.pendingActors.has(playerId) || room.awaitingAck.has(playerId)) {
      return cb?.({ ok: false, error: '현재 행동할 차례가 아닙니다.' });
    }
    const player = room.players.find(p => p.id === playerId);
    if (!player) return cb?.({ ok: false, error: '플레이어를 찾을 수 없습니다.' });
    const step = room.activeNightRole;

    try {
      if (step === 'doppelganger') {
        const stage = player.nightState?.stage || 'copy';
        if (stage === 'copy') {
          const tid = Array.isArray(payload.targets) ? payload.targets[0] : null;
          if (!tid || tid === player.id || !room.currentCards.has(tid)) throw new Error('다른 플레이어 한 명을 선택하세요.');
          const targetCard = room.currentCards.get(tid);
          const copiedRole = effectiveRole(targetCard);
          player.initialCard.doppelRole = copiedRole;
          (room.actionHistory ||= []).push({kind:'copy',actor:player.name,target:room.players.find(p=>p.id===tid).name,role:ROLE_INFO[copiedRole].name});

          const seen = [cardFaceView(targetCard)];
          const copiedInfo = ROLE_INFO[copiedRole];
          let extraText = `복사한 역할: ${copiedInfo.emoji} ${copiedInfo.name}`;
          let nextPrompt = null;

          if (['seer','robber','troublemaker','drunk'].includes(copiedRole)) {
            nextPrompt = genericActionPrompt(room, player, copiedRole, 'doppelganger');
            player.nightState = { stage: 'awaitFollowup', copiedRole, nextPrompt };
            extraText += ' · 이 역할의 밤 행동을 지금 바로 실행합니다.';
          } else if (copiedRole === 'minion') {
            const wolves = werewolfActors(room).filter(p => p.id !== player.id);
            extraText += wolves.length
              ? ` · 늑대인간: ${wolves.map(p => p.name).join(', ')}`
              : ' · 플레이어 중 늑대인간이 없습니다.';
            player.nightState = { stage: 'done', copiedRole };
          } else if (copiedRole === 'werewolf') {
            extraText += ' · 잠시 후 늑대인간 차례에 다시 눈을 뜹니다.';
            player.nightState = { stage: 'done', copiedRole };
          } else if (copiedRole === 'mason') {
            extraText += ' · 잠시 후 석공 차례에 다시 눈을 뜹니다.';
            player.nightState = { stage: 'done', copiedRole };
          } else if (copiedRole === 'insomniac') {
            extraText += ' · 밤 마지막에 다시 현재 카드를 확인합니다.';
            player.nightState = { stage: 'done', copiedRole };
          } else {
            player.nightState = { stage: 'done', copiedRole };
          }

          return finishWithReveal(room, player, cb, { seen, extraText }, { nextPrompt });
        }

        if (stage === 'followup') {
          const copiedRole = player.nightState?.copiedRole;
          if (!['seer','robber','troublemaker','drunk'].includes(copiedRole)) throw new Error('도플갱어 추가 행동 상태가 올바르지 않습니다.');
          return performRoleAction(room, player, copiedRole, payload, cb, 'doppelganger');
        }

        throw new Error('도플갱어 행동 상태가 올바르지 않습니다.');
      }

      if (step === 'doppel_insomniac') return performRoleAction(room, player, 'insomniac', payload, cb, 'doppelganger');
      return performRoleAction(room, player, step, payload, cb, step);
    } catch (e) {
      cb?.({ ok: false, error: e.message || '밤 행동 중 오류가 발생했습니다.' });
    }
}

function handleNightAck(room, playerId) {

    if (!room || room.phase !== 'night' || !room.awaitingAck.has(playerId)) return;
    const player = room.players.find(p => p.id === playerId);
    if (!player) return;
    room.awaitingAck.delete(playerId);
    player.pendingReveal = null;

    if (room.activeNightRole === 'doppelganger' && player.nightState?.nextPrompt) {
      const nextPrompt = player.nightState.nextPrompt;
      player.nightState = { stage: 'followup', copiedRole: player.initialCard.doppelRole, currentPrompt: nextPrompt };
      sendNightPrompt(room, player, nextPrompt);
      return;
    }
    actorDone(room, playerId);
}

function castVote(room, playerId, targetId, cb) {

    if (!room || room.phase !== 'voting') return cb?.({ ok: false, error: '지금은 투표 시간이 아닙니다.' });
    const p = room.players.find(x => x.id === playerId);
    if (!p) return cb?.({ ok: false, error: '플레이어를 찾을 수 없습니다.' });
    if (p.vote) return cb?.({ ok: false, error: '투표는 한 번 확정하면 바꿀 수 없습니다.' });
    if (!targetId || targetId === playerId || !room.players.some(x => x.id === targetId)) {
      return cb?.({ ok: false, error: '공식 규칙상 자기 자신이 아닌 다른 플레이어에게 투표해야 합니다.' });
    }
    p.vote = targetId;
    emitRoom(room);
    cb?.({ ok: true });
    if (room.players.every(x => x.vote)) resolveGame(room);
}

io.on('connection', socket => {
  liveSockets.set(socket.id,socket);
  socket.on('room:close', (_,cb) => {
    const room=getRoomOf(socket);
    if(!room || room.hostId!==socket.id) return cb?.({ok:false,error:'방장만 방을 종료할 수 있습니다.'});
    room.phase='closed';clearNightTimers(room);clearTimeout(room.discussionTimer);room.narrationCue=null;
    io.to(room.code).emit('room:closed',{message:'방장이 방을 종료했습니다.'});
    for(const player of room.players){const member=liveSockets.get(player.id);if(member){member.leave(room.code);member.data.roomCode=null;}}
    rooms.delete(room.code);cb?.({ok:true});
  });
  socket.on('room:create', ({ name }, cb) => {
    if (getRoomOf(socket)) return cb?.({ ok: false, error: '현재 방을 먼저 나가주세요.' });
    const code = code4();
    const player = { id: socket.id, name: sanitizeName(name), connected: true, vote: null, resumeToken: token() };
    const room = {
      code,
      hostId: socket.id,
      players: [player],
      phase: 'lobby',
      playerCount: 3,
      selectedRoles: [],
      discussionSeconds: 240,
      loneWolfCenter: true,
      fastBots: true,
      currentCards: new Map(),
      centerCards: [],
      nightIndex: 0,
      pendingActors: new Set(),
      awaitingAck: new Set()
    };
    rooms.set(code, room);
    socket.join(code);
    socket.data.roomCode = code;
    emitRoom(room);
    cb?.({ ok: true, code, playerId: socket.id, resumeToken: player.resumeToken });
  });

  socket.on('room:join', ({ code, name }, cb) => {
    if (getRoomOf(socket)) return cb?.({ ok: false, error: '현재 방을 먼저 나가주세요.' });
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false, error: '방을 찾을 수 없습니다.' });
    if (room.phase !== 'lobby') return cb?.({ ok: false, error: '이미 게임이 시작된 방입니다.' });
    if (room.players.length >= room.playerCount) return cb?.({ ok: false, error: '설정한 인원이 모두 입장했습니다. 방장에게 인원수를 늘려 달라고 하세요.' });
    const player = { id: socket.id, name: sanitizeName(name), connected: true, vote: null, resumeToken: token() };
    room.players.push(player);
    socket.join(code);
    socket.data.roomCode = code;

    emitRoom(room);
    cb?.({ ok: true, code, playerId: socket.id, resumeToken: player.resumeToken });
  });

  socket.on('room:resume', ({ code, resumeToken }, cb) => {
    code = String(code || '').toUpperCase().trim();
    const room = rooms.get(code);
    if (!room) return cb?.({ ok: false });
    const p = room.players.find(x => x.resumeToken === resumeToken);
    if (!p || p.bot) return cb?.({ ok: false });
    const oldId = p.id;
    const newId = socket.id;

    if (oldId !== newId) {
      p.id = newId;
      if (room.hostId === oldId) room.hostId = newId;
      if (room.currentCards?.has(oldId)) {
        const card = room.currentCards.get(oldId);
        room.currentCards.delete(oldId);
        room.currentCards.set(newId, card);
      }
      if (room.ready?.has(oldId)) { room.ready.delete(oldId); room.ready.add(newId); }
      if (room.pendingActors?.has(oldId)) { room.pendingActors.delete(oldId); room.pendingActors.add(newId); }
      if (room.awaitingAck?.has(oldId)) { room.awaitingAck.delete(oldId); room.awaitingAck.add(newId); }
      room.players.forEach(x => { if (x.vote === oldId) x.vote = newId; });
      if (Array.isArray(room.killedIds)) room.killedIds = room.killedIds.map(id => id === oldId ? newId : id);
      if (room.lastReveal) {
        room.lastReveal.winnerIds = room.lastReveal.winnerIds.map(id => id === oldId ? newId : id);
        room.lastReveal.killedIds = room.lastReveal.killedIds.map(id => id === oldId ? newId : id);
        room.lastReveal.players.forEach(x => {
          if (x.id === oldId) x.id = newId;
          if (x.vote === oldId) x.vote = newId;
        });
      }
    }

    p.connected = true;
    delete p.disconnectedAt;
    socket.join(code);
    socket.data.roomCode = code;
    emitRoom(room);
    if (room.phase === 'night') refreshPendingNightPrompts(room, newId);

    if (room.phase === 'roleReveal' && p.initialCard) io.to(newId).emit('role:reveal', cardFaceView(p.initialCard));
    else if (room.phase === 'night') {
      if (room.awaitingAck?.has(newId) && p.pendingReveal) {
        io.to(newId).emit('night:reveal', p.pendingReveal);
      } else if (room.actionWindowOpen && room.pendingActors?.has(newId)) {
        const prompt = rebuildPendingPrompt(room, p);
        if (prompt) io.to(newId).emit('night:prompt', prompt);
      } else io.to(newId).emit('night:waiting', { message: '밤이 진행 중입니다. 눈을 감고 기다려주세요.' });
      if (room.hostId === newId && room.narrationCue?.payload) {
        io.to(newId).emit('narration:say', room.narrationCue.payload);
      }
    } else if (room.phase === 'discussion') io.to(newId).emit('discussion:start', { endsAt: room.discussionEndsAt });
    else if (room.phase === 'voting') io.to(newId).emit('voting:start');
    else if (room.phase === 'result' && room.lastReveal) io.to(newId).emit('game:result', room.lastReveal);

    cb?.({ ok: true, playerId: newId, room: publicRoom(room) });
  });

  socket.on('room:leave', (_, cb) => {
    const room = getRoomOf(socket);
    if (!room || !['lobby', 'result'].includes(room.phase)) return cb?.({ ok: false, error: '대기방 또는 게임이 끝난 뒤에 나갈 수 있습니다.' });
    room.players = room.players.filter(p => p.id !== socket.id);
    socket.leave(room.code);
    socket.data.roomCode = null;
    if (!room.players.some(p => !p.bot)) { clearNightTimers(room); rooms.delete(room.code); }
    else {
      if (room.hostId === socket.id) room.hostId = room.players.find(p => !p.bot && p.connected)?.id || room.players.find(p => !p.bot).id;
      emitRoom(room);
    }
    cb?.({ ok: true });
  });

  socket.on('room:addBot', (payload = {}, cb) => {
    const room = getRoomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return cb?.({ ok: false, error: '대기방에서 방장만 봇을 추가할 수 있습니다.' });
    const seats = room.playerCount - room.players.length;
    if (seats <= 0) return cb?.({ ok: false, error: '빈 자리가 없습니다. 참가 인원수를 늘려주세요.' });
    const count = payload.fill === true ? seats : 1;
    for (let i = 0; i < count; i++) {
      room.botCounter = (room.botCounter || 0) + 1;
      room.players.push({ id: `bot-${token()}`, name: `봇 ${room.botCounter}`, bot: true, connected: true, vote: null, resumeToken: null });
    }
    if (!room.selectedRoles.length) room.selectedRoles = defaultRoles(room.playerCount);
    emitRoom(room);
    cb?.({ ok: true });
  });

  socket.on('room:removeBot', ({ playerId }, cb) => {
    const room = getRoomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return cb?.({ ok: false, error: '대기방에서 방장만 봇을 삭제할 수 있습니다.' });
    const bot = room.players.find(p => p.id === playerId && p.bot);
    if (!bot) return cb?.({ ok: false, error: '삭제할 봇을 찾을 수 없습니다.' });
    room.players = room.players.filter(p => p.id !== playerId);
    emitRoom(room);
    cb?.({ ok: true });
  });

  socket.on('room:setPreset', ({ mode } = {}, cb) => {
    const room=getRoomOf(socket);
    if(!room || room.hostId!==socket.id || room.phase!=='lobby') return cb?.({ok:false,error:'대기방에서 방장만 구성을 변경할 수 있습니다.'});
    if(!['beginner','chaos'].includes(mode)) return cb?.({ok:false,error:'알 수 없는 구성입니다.'});
    const roles=presetRoles(room.playerCount,mode);
    const valid=validateRoleSelection(roles,room.playerCount);
    if(!valid.ok) return cb?.(valid);
    room.selectedRoles=roles;emitRoom(room);cb?.({ok:true});
  });

  socket.on('room:setPlayerCount', ({ count }, cb) => {
    const room = getRoomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return cb?.({ ok: false, error: '방장만 인원수를 변경할 수 있습니다.' });
    if (!Number.isInteger(count) || count < 3 || count > 10 || count < room.players.length) return cb?.({ ok: false, error: '현재 참가자 수 이상으로 3~10명을 선택하세요.' });
    room.playerCount = count;
    room.selectedRoles = room.selectedRoles.slice(0, count + 3);
    emitRoom(room);
    cb?.({ ok: true });
  });

  socket.on('room:setRoles', ({ roles }, cb) => {
    const room = getRoomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return cb?.({ ok: false, error: '방장만 역할을 변경할 수 있습니다.' });
    const need = room.playerCount + 3;
    if (!Array.isArray(roles) || roles.length > need) return cb?.({ ok: false, error: `역할은 최대 ${need}장까지 선택할 수 있습니다.` });
    const counts = {};
    for (const role of roles) {
      const info = ROLE_INFO[role];
      if (!info) return cb?.({ ok: false, error: '알 수 없는 역할이 있습니다.' });
      counts[role] = (counts[role] || 0) + 1;
      if (counts[role] > info.max) return cb?.({ ok: false, error: `${info.name} 카드가 너무 많습니다.` });
    }
    room.selectedRoles = [...roles];
    emitRoom(room);
    cb?.({ ok: true });
  });

  socket.on('room:setFastBots', ({enabled} = {}, cb) => {
    const room=getRoomOf(socket);
    if(!room || room.hostId!==socket.id || room.phase!=='lobby') return cb?.({ok:false,error:'대기방에서 방장만 변경할 수 있습니다.'});
    room.fastBots=!!enabled;emitRoom(room);cb?.({ok:true});
  });

  socket.on('room:setDiscussion', ({ seconds }) => {
    const room = getRoomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    room.discussionSeconds = Math.max(60, Math.min(600, Number(seconds) || 240));
    emitRoom(room);
  });

  socket.on('room:setLoneWolf', ({ enabled }) => {
    const room = getRoomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'lobby') return;
    room.loneWolfCenter = !!enabled;
    emitRoom(room);
  });

  socket.on('game:start', (_, cb) => {
    const room = getRoomOf(socket);
    if (!room || room.hostId !== socket.id) return cb?.({ ok: false, error: '방장만 시작할 수 있습니다.' });
    if (room.phase !== 'lobby') return cb?.({ ok: false, error: '이미 게임이 시작됐습니다.' });
    if (room.players.length !== room.playerCount || room.players.some(p => !p.connected)) return cb?.({ ok: false, error: `참가자 ${room.playerCount}명이 모두 접속해야 시작할 수 있습니다.` });
    const valid = validateRoleSelection(room.selectedRoles, room.players.length);
    if (!valid.ok) return cb?.(valid);

    clearNightTimers(room);
    room.actionHistory = [];
    const deck = shuffle(room.selectedRoles.map((r, i) => makeCard(r, `c${Date.now()}_${i}`)));
    room.currentCards = new Map();
    room.players.forEach((p, i) => {
      p.initialCard = deck[i];
      p.vote = null;
      p.nightState = null;
      p.pendingReveal = null;
      room.currentCards.set(p.id, deck[i]);
    });
    room.centerCards = deck.slice(room.players.length);
    room.phase = 'roleReveal';
    room.nightIndex = 0;
    room.activeNightRole = null;
    room.finishingNightStep = false;
    room.killedIds = [];
    room.winnerText = null;
    room.lastReveal = null;
    room.ready = new Set(room.players.filter(p => p.bot).map(p => p.id));
    room.pendingActors = new Set();
    room.awaitingAck = new Set();

    room.players.forEach(p => io.to(p.id).emit('role:reveal', cardFaceView(p.initialCard)));
    emitRoom(room);
    cb?.({ ok: true });
  });

  socket.on('role:ready', () => {
    const room = getRoomOf(socket);
    if (!room || room.phase !== 'roleReveal') return;
    room.ready.add(socket.id);
    if (room.ready.size !== room.players.length) { emitRoom(room); return; }

    room.phase = 'night';
    room.nightIndex = 0;
    room.activeNightRole = null;
    room.players.forEach(p => io.to(p.id).emit('night:waiting', { message: '밤이 시작됩니다. 모두 눈을 감아 주세요.' }));
    emitRoom(room);
    narrateAndWait(
      room,
      '밤이 되었습니다. 모두 눈을 감아 주세요. 자신의 역할이 호명될 때만 눈을 뜨고 자기 휴대폰을 확인하세요.',
      'sleep',
      null,
      () => { room.nightTransitionTimer = setTimeout(() => startNextNightStep(room), fastBotGame(room)?80:500); }
    );
  });

  socket.on('narration:done', ({ cueId }) => {
    const room = getRoomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'night') return;
    finishNarrationCue(room, cueId);
  });

  socket.on('night:action', (payload = {}, cb) => handleNightAction(getRoomOf(socket), socket.id, payload, cb));

  socket.on('night:ack', () => handleNightAck(getRoomOf(socket), socket.id));

  socket.on('discussion:endEarly', () => {
    const room = getRoomOf(socket);
    if (room && room.hostId === socket.id && room.phase === 'discussion') beginVoting(room);
  });

  socket.on('vote:cast', ({ targetId }, cb) => castVote(getRoomOf(socket), socket.id, targetId, cb));

  socket.on('game:restart', () => {
    const room = getRoomOf(socket);
    if (!room || room.hostId !== socket.id || room.phase !== 'result') return;
    clearNightTimers(room);
    clearTimeout(room.discussionTimer);
    room.phase = 'lobby';
    room.players.forEach(p => {
      p.vote = null;
      p.nightState = null;
      p.pendingReveal = null;
      delete p.initialCard;
    });
    room.currentCards = new Map();
    room.centerCards = [];
    room.actionHistory = [];
    room.activeNightRole = null;
    room.finishingNightStep = false;
    room.winnerText = null;
    room.lastReveal = null;
    room.killedIds = [];
    room.narrationCue = null;
    io.to(room.code).emit('game:reset');
    emitRoom(room);
  });

  socket.on('disconnect', () => {
    liveSockets.delete(socket.id);
    const room = getRoomOf(socket);
    if (!room) return;
    const p = room.players.find(x => x.id === socket.id);
    if (p) {
      p.connected = false;
      p.disconnectedAt = Date.now();
    }
    emitRoom(room);

    if (room.phase === 'lobby' && p) {
      setTimeout(() => {
        const r = rooms.get(room.code);
        const stale = r?.players.find(x => x.resumeToken === p.resumeToken);
        if (!r || r.phase !== 'lobby' || !stale || stale.connected || Date.now() - (stale.disconnectedAt || 0) < 29000) return;
        const oldId = stale.id;
        r.players = r.players.filter(x => x.resumeToken !== stale.resumeToken);
        if (r.hostId === oldId) r.hostId = r.players.find(p => !p.bot)?.id;
        if (!r.players.some(p => !p.bot)) { clearNightTimers(r); rooms.delete(r.code); }
        else {

          emitRoom(r);
        }
      }, 30000);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Midnight Werewolf running on http://0.0.0.0:${PORT}`);
});
