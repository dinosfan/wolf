'use strict';
const assert = require('assert');
const {
  makeCard, effectiveRole, cardFaceView, finalRoleView,
  validateRoleSelection, computeBaseDeaths, computeDeathsWithHunter, resolveOutcome
} = require('../game-engine');

function P(id, name, vote=null){ return { id, name, vote }; }
function cardMap(entries){ return new Map(entries); }

// Setup validation
assert.equal(validateRoleSelection(['werewolf','werewolf','seer','robber','troublemaker','villager'],3).ok, true);
assert.equal(validateRoleSelection(['werewolf','werewolf','mason','seer','robber','troublemaker'],3).ok, false, 'single Mason must fail');
assert.equal(validateRoleSelection(['werewolf','werewolf','insomniac','seer','villager','villager'],3).ok, false, 'Insomniac without Robber/Troublemaker must fail');

// Voting: if the highest vote total is only 1, nobody dies.
let players=[P('a','A','b'),P('b','B','c'),P('c','C','a')];
assert.deepEqual(computeBaseDeaths(players),[]);

// Voting tie: all tied for the highest vote count die.
players=[P('a','A','c'),P('b','B','c'),P('c','C','d'),P('d','D','c'),P('e','E','d'),P('f','F','d')];
assert.deepEqual(new Set(computeBaseDeaths(players)),new Set(['c','d']));

// Hunter chains recursively if a killed Hunter points at another Hunter.
players=[P('a','A','b'),P('b','B','a'),P('c','C','a')];
let cards=cardMap([
  ['a',makeCard('hunter','ha')],
  ['b',makeCard('hunter','hb')],
  ['c',makeCard('villager','vc')]
]);
// A gets 2 votes and dies -> points B -> B dies -> points A (already dead).
assert.deepEqual(new Set(computeDeathsWithHunter(players,id=>cards.get(id))),new Set(['a','b']));

players=[P('a','A','b'),P('b','B','c'),P('c','C','a'),P('d','D','a')];
cards=cardMap([
  ['a',makeCard('hunter','ha')],
  ['b',makeCard('hunter','hb')],
  ['c',makeCard('villager','vc')],
  ['d',makeCard('villager','vd')]
]);
// A dies by votes, kills B, B is also Hunter and kills C.
assert.deepEqual(new Set(computeDeathsWithHunter(players,id=>cards.get(id))),new Set(['a','b','c']));

// Doppelgänger face vs effective role: looking at the card only reveals the physical card.
const dop=makeCard('doppelganger','dop');dop.doppelRole='werewolf';
assert.equal(cardFaceView(dop).role,'doppelganger');
assert.equal(effectiveRole(dop),'werewolf');
assert.equal(finalRoleView(dop).role,'werewolf');
assert.equal(finalRoleView(dop).physicalRole,'doppelganger');

function outcome(playerRows, roleRows){
  const ps=playerRows.map(x=>P(x[0],x[1],x[2]));
  const cm=cardMap(roleRows.map(([id,role])=>[id,typeof role==='string'?makeCard(role,`${id}-${role}`):role]));
  return resolveOutcome(ps,id=>cm.get(id));
}

// Werewolf present and killed -> village.
let o=outcome([
  ['a','A','b'],['b','B','a'],['c','C','a']
],[['a','werewolf'],['b','villager'],['c','villager']]);
assert.deepEqual(o.winningTeams,['village']);

// Werewolf present and survives -> wolf team.
o=outcome([
  ['a','A','b'],['b','B','c'],['c','C','b']
],[['a','werewolf'],['b','villager'],['c','villager']]);
assert.deepEqual(o.winningTeams,['wolf']);

// No player-Werewolf and nobody dies -> village.
o=outcome([
  ['a','A','b'],['b','B','c'],['c','C','a']
],[['a','villager'],['b','seer'],['c','robber']]);
assert.deepEqual(o.winningTeams,['village']);

// No player-Werewolf but a villager dies -> nobody wins.
o=outcome([
  ['a','A','b'],['b','B','a'],['c','C','a']
],[['a','villager'],['b','seer'],['c','robber']]);
assert.deepEqual(o.winningTeams,[]);

// No player-Werewolf: killing only the Minion satisfies neither side.
o=outcome([
  ['a','A','b'],['b','B','a'],['c','C','a']
],[['a','minion'],['b','villager'],['c','villager']]);
assert.deepEqual(o.winningTeams,[]);

// No player-Werewolf: if a non-Minion dies, Minion/wolf side wins.
o=outcome([
  ['a','A','b'],['b','B','c'],['c','C','b']
],[['a','minion'],['b','villager'],['c','villager']]);
assert.deepEqual(o.winningTeams,['wolf']);

// Tanner dies and no wolf dies -> Tanner only, even if a Minion is present.
o=outcome([
  ['a','A','b'],['b','B','c'],['c','C','b']
],[['a','minion'],['b','tanner'],['c','villager']]);
assert.deepEqual(o.winningTeams,['tanner']);

// Tanner and Werewolf die together -> Tanner + village.
o=outcome([
  ['a','A','b'],['b','B','a'],['c','C','a'],['d','D','b']
],[['a','werewolf'],['b','tanner'],['c','villager'],['d','villager']]);
assert.deepEqual(new Set(o.winningTeams),new Set(['tanner','village']));

// A moved Doppelgänger card copied as Werewolf counts as a Werewolf at game end.
const moved=makeCard('doppelganger','move');moved.doppelRole='werewolf';
o=outcome([
  ['a','A','b'],['b','B','a'],['c','C','a']
],[['a',moved],['b','villager'],['c','villager']]);
assert.deepEqual(o.winningTeams,['village']);

console.log('All rule-engine tests passed.');

// Individual winner tracking: a Tanner role wins only when that Tanner-role player dies.
{
  const t1=makeCard('tanner','t1');
  const t2=makeCard('doppelganger','d2');t2.doppelRole='tanner';
  const ps=[P('a','Tanner A','a'),P('b','Doppel Tanner','a'),P('c','Villager','a')];
  // Self-votes are impossible in the server, but outcome math only consumes a completed vote map.
  // Three votes on A means only A's Tanner role satisfies the personal Tanner objective.
  ps[0].vote='b'; ps[1].vote='a'; ps[2].vote='a';
  const cm=cardMap([['a',t1],['b',t2],['c',makeCard('villager','v')]]);
  const x=resolveOutcome(ps,id=>cm.get(id));
  assert.deepEqual(x.winnerIds,['a']);
}

console.log('Individual winner tracking test passed.');

// Doppelgänger-as-Robber: the copied role stays attached to the physical
// Doppelgänger card when that card is handed to another player.
{
  const d=makeCard('doppelganger','dg');
  const w=makeCard('werewolf','ww');
  d.doppelRole='robber';
  const current=new Map([['dPlayer',d],['wolfPlayer',w]]);
  const mine=current.get('dPlayer'), theirs=current.get('wolfPlayer');
  current.set('dPlayer',theirs); current.set('wolfPlayer',mine);
  assert.equal(effectiveRole(current.get('dPlayer')),'werewolf');
  assert.equal(effectiveRole(current.get('wolfPlayer')),'robber');
  assert.equal(cardFaceView(current.get('wolfPlayer')).role,'doppelganger');
}

console.log('Doppelgänger card-movement test passed.');
