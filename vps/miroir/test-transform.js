// Tests des règles de recopie (sans Firebase) : node test-transform.js
'use strict';
const T = require('./transform');
let fails = 0;
const ok = (c, l) => { console.log((c ? '  ok  ' : '  ÉCHEC ') + l); if (!c) fails++; };

const e = {
  mood: 'Tendu', done: true, checked: { $set: ['Travail du bois', 'Sexe avec Taiga', 'Temps avec Taiga'] },
  slots: { 'Travail du bois': ['matin'], 'Sexe avec Taiga': ['nuit'] }, details: { 'Sexe avec Taiga': 'x' },
  intime: 'secret', intimeWith: { $set: ['taiga'] }, night: { hot: true, with: 'taiga' }, discordMsg: '123',
  nightNotes: { 'Nuit chaude': 'détail', 'Cauchemar': 'loups' }, rp: 'eoor', calmWith: 'taiga', film: true, nefaste: 'x',
};
const p = T.publicEntry(e);
ok(p.mood === 'Tendu' && p.done === true, 'humeur et validation gardées');
ok(!('intime' in p) && !('intimeWith' in p), 'vie intime retirée');
ok(!('night' in p), 'nuit chaude retirée de la fiche (elle va dans l\'espace du couple)');
ok(!('discordMsg' in p) && !('film' in p) && !('nefaste' in p), 'champs propres à Journée RP retirés');
ok(p.checked.$set.length === 2 && !p.checked.$set.includes('Sexe avec Taiga'), 'activité intime retirée des cases cochées');
ok(!('Sexe avec Taiga' in p.slots) && !('Sexe avec Taiga' in p.details), 'activité intime retirée des périodes et précisions');
ok(!('Nuit chaude' in p.nightNotes) && p.nightNotes.Cauchemar === 'loups', 'précision de nuit chaude retirée, les autres gardées');
ok(p.rp === 'Eoor', 'partenaire de jeu absent d\'Iloh : devient un nom (PNJ)');
ok(p.calmWith === 'taiga', 'personnage présent dans Iloh : identifiant gardé');
ok(e.intime === 'secret', 'la journée d\'origine n\'est pas modifiée');
ok(T.publicEntry(null) === null, 'journée vide : rien');
const h = T.publicEntry({ checked: { $set: ['Travail du bois', 'Chasse solo', 'Pêche'] }, slots: { 'Chasse solo': ['matin'], 'Pêche': ['soir'] },
  details: { 'Pêche': 'truite' }, hideIloh: { $set: ['Chasse solo'] } }, { $set: ['Pêche'] });
ok(JSON.stringify(h.checked.$set) === '["Travail du bois"]', 'activités masquées (ce jour-là et toujours) retirées');
ok(!('Chasse solo' in h.slots) && !('Pêche' in h.slots) && !('Pêche' in h.details), 'masquées aussi dans les périodes et précisions');
ok(!('hideIloh' in h), 'le réglage « masquer » lui-même n\'est pas recopié');
const w = T.publicEntry({ checked: { $set: ['Pêche', 'Sexe avec Taiga', 'Chasse solo'] }, hideIloh: { $set: ['Chasse solo'] },
  withActs: { 'Pêche': ['taiga', 'eoor', 'buyan'], 'Sexe avec Taiga': ['taiga'], 'Chasse solo': ['tengis'], 'Ancienne': ['taiga'] } });
ok(JSON.stringify(w.withActs) === '{"Pêche":["taiga","buyan"]}', 'activités communes de Journée RP : sans activité intime ni masquée, personnages d\'Iloh seulement');
ok(!('withActs' in T.publicEntry({ checked: { $set: ['Pêche'] }, withActs: { 'Pêche': ['eoor'] } })), 'activité commune avec des personnages hors Iloh seulement : rien');
ok(T.todayDoc({ activities: ['Pêche', 'Chasse solo', 'Travail du bois'] }, { hideIloh: { $set: ['Chasse solo'] } }, { $set: ['Pêche'] }).activities.join() === 'Travail du bois', 'encart public : activités masquées retirées');

ok(JSON.stringify(T.hotNight({ hot: true, with: 'taiga' })) === '{"hot":true,"with":"taiga"}', 'nuit chaude avec la partenaire');
ok(T.hotNight({ hot: false }) === null && T.hotNight(undefined) === null, 'pas de nuit chaude : null');
ok(T.hotNight({ hot: true, with: 'eoor' }).with === 'Eoor', 'nuit chaude avec un personnage hors Iloh : nom');

ok(T.coupleOf('tamachag').id === 'taiga-tamachag' && T.coupleOf('inkaraa').id === 'inkaraa-khokkutsai', 'identifiants des couples');
ok(T.coupleOf('tengis') === null && T.coupleOf('davaajav') === null, 'personnages hors couple');
ok(JSON.stringify(T.lovers(['Une voyageuse', 'ogloo', 'taiga', 'eoor'], 'tamachag')) === '["Une voyageuse","Eoor"]', 'amants : PNJ seulement');
ok(JSON.stringify(T.protectFor({ tamachag: true, 'pnj:tamachag:Lune': false, viggo: true, khokkutsai: true }, ['taiga', 'tamachag'])) === '{"tamachag":true,"pnj:tamachag:Lune":false}', 'protection : clés du couple seulement');

const c = T.charDoc({ player: 'corentin', addedActs: ['Pêche', 'Sexe avec Taiga'], actCat: { 'Sexe avec Taiga': 'liens', 'Pêche': 'quotidien' } });
ok(!('player' in c), 'fiche : le joueur de Journée RP n\'est pas recopié');
ok(c.addedActs.length === 1 && !('Sexe avec Taiga' in c.actCat), 'fiche : activité intime retirée');
ok(T.todayDoc({ mood: 'ok', activities: ['Pêche', 'Sexe avec Taiga'] }).activities.length === 1, 'encart public : activité intime retirée');
ok(T.MIRROR.length === 10 && T.MIRROR.every(x => T.ILOH.includes(x)), '10 personnages recopiés, tous présents dans Iloh');

console.log(fails ? `${fails} échec(s)` : 'Tout est bon.');
process.exitCode = fails ? 1 : 0;
