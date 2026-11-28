// Test du pont Iloh ↔ Journée RP avec deux Firestore simulés (aucun accès réseau) : node test-pont.js
'use strict';
const Module = require('module');
let fails = 0;
const ok = (c, l) => { console.log((c ? '  ok  ' : '  ÉCHEC ') + l); if (!c) fails++; };
const DEL = Symbol('delete');
class FieldPath { constructor(...s) { this.s = s; } }
const FieldValue = { delete: () => DEL, serverTimestamp: () => 'TS' };
Module._load = (orig => function (req, ...r) { return req === 'firebase-admin/firestore' ? { FieldPath, FieldValue } : orig.call(this, req, ...r); })(Module._load);

// ---------- Firestore simulé (documents, requêtes where ==/in, update par chemin) ----------
function fakeDb() {
  const st = {}, ls = [];
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const fire = () => setTimeout(() => ls.forEach(l => l()), 0);
  const snap = p => ({ id: p.split('/').pop(), exists: p in st, data: () => clone(st[p]) });
  const setAt = (o, segs, v) => { segs.slice(0, -1).forEach(k => { o = (o[k] && typeof o[k] === 'object') ? o[k] : (o[k] = {}); }); if (v === DEL) delete o[segs.at(-1)]; else o[segs.at(-1)] = clone(v); };
  const merge = (a, b) => { for (const [k, v] of Object.entries(b)) { if (v === DEL) delete a[k]; else if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') merge(a[k], v); else a[k] = clone(v); } return a; };
  const doc = p => ({ path: p, id: p.split('/').pop(), get: async () => snap(p),
    set: async (d, opt) => { st[p] = opt?.merge ? merge(st[p] || {}, d) : clone(d); fire(); },
    update: async (...a) => { if (!(p in st)) throw new Error('no doc ' + p);
      if (a[0] instanceof FieldPath) { for (let i = 0; i < a.length; i += 2) setAt(st[p], a[i].s, a[i + 1]); } else for (const [k, v] of Object.entries(a[0])) setAt(st[p], k.split('.'), v); fire(); },
    delete: async () => { delete st[p]; fire(); },
    onSnapshot: (cb) => { let last; const l = () => { const j = JSON.stringify(st[p] ?? null); if (j !== last) { last = j; cb(snap(p)); } }; ls.push(l); setTimeout(l, 0); return () => ls.splice(ls.indexOf(l), 1); } });
  const query = (p, conds) => ({ where: (f, op, v) => query(p, [...conds, [f, op, v]]),
    onSnapshot: (cb) => { let last; const l = () => { const docs = Object.keys(st).filter(k => k.startsWith(p + '/') && k.split('/').length === p.split('/').length + 1)
        .filter(k => conds.every(([f, op, v]) => op === 'in' ? v.includes(st[k][f]) : st[k][f] === v)).map(snap);
      const j = JSON.stringify(docs.map(d => [d.id, d.data()])); if (j !== last) { last = j; cb({ docs, size: docs.length }); } };
      ls.push(l); setTimeout(l, 0); return () => ls.splice(ls.indexOf(l), 1); } });
  return { doc, collection: p => query(p, []), _st: st };
}

const P = require('./pont');
const src = fakeDb(), dst = fakeDb(), wait = (ms = 60) => new Promise(r => setTimeout(r, ms));
const pad = n => String(n).padStart(2, '0');
const rp = new Date(Date.now() - 5 * 3600e3), ym = `${rp.getFullYear()}-${pad(rp.getMonth() + 1)}`, day = String(rp.getDate()), iso = `${ym}-${pad(rp.getDate())}`;
// Iloh : événement du jour avec une action de Boroo, événement simple (Tamachag inscrit), fiche validée de Boroo
// avec « Chasse en groupe » notée avec Tamachag, fiche validée de Taiga (recopiée), une demande dans la boîte.
Object.assign(dst._st, {
  'shared/events': { e1: { type: 'ceremonie', text: 'Grandes Funérailles', date: iso, daily: true, by: 'lou', at: 1, acts: { a1: { text: 'Apporter les fleurs', by: 'boroo', p: 'idriss', at: 2, who: { boroo: 'idriss' } } } },
    e2: { type: 'fete', text: 'Fête du feu', date: iso, by: 'eden', at: 3, going: { tamachag: 'nono', buyan: 'eden' } },
    e3: { type: 'autre', text: 'Ancien', date: '2020-01-01', by: 'eden', at: 0 } },
  [`days/boroo/months/${ym}`]: { [day]: { done: true, checked: { $set: ['Chasse en groupe', 'Cuisine'] }, withActs: { 'Chasse en groupe': ['tamachag', 'reaksa'] }, slots: { 'Chasse en groupe': ['matin'] } } },
  [`days/taiga/months/${ym}`]: { [day]: { done: true, checked: { $set: ['Chasse en groupe', 'Sexe avec Tamachag'] } } },
  'shared/projects': { pr1: { v: 2, title: 'Nouvelle yourte', by: 'lou', at: 1, mode: 'suite', goal: 3, acts: ['Chant'], done: null, contrib: {},
    steps: [{ name: 'Matériaux', goal: 1, acts: ['Couper du bois'] }, { name: 'Charpente', goal: 2, acts: ['Tanner les peaux'] }] },
    pr2: { v: 2, title: 'Fini', by: 'lou', at: 2, goal: 1, acts: ['X'], steps: [], done: 5, contrib: {} } },
  'mailbox/m1': { status: 'new', text: 'secret' }, 'mailbox/m2': { status: 'posted' }, 'requests/r1': { status: 'pending' },
});
(async () => {
  P.start(src, dst, rp); await wait(600);
  let d = src._st[`iloh/_live/months/${iso}`];
  console.log('Résumé déposé dans Journée RP');
  ok(d && d.iso === iso, 'résumé du jour écrit dans iloh/_live/months/' + iso);
  ok(d.events.length === 2 && d.events[0].daily && d.events[0].acts[0].text === 'Apporter les fleurs', 'événements du jour (passés exclus), actions de l\'événement du jour');
  ok(d.shared.tamachag?.some(x => x.kind === 'with' && x.from === 'boroo' && x.act === 'Chasse en groupe' && x.others.includes('reaksa') && x.slots[0] === 'matin'), 'activité commune notée par Boroo avec Tamachag');
  ok(d.shared.tamachag?.some(x => x.kind === 'ev' && x.act === 'Fête du feu' && x.others.includes('buyan')), 'événement auquel Tamachag participe, à ajouter');
  ok(d.fiches.boroo && d.fiches.taiga && !d.fiches.taiga.acts.some(a => a.act.startsWith('Sexe')), 'fiches validées pour « J\'y participe aussi » (sans activité intime)');
  ok(d.todo.mail === 1 && d.todo.logi === 1 && !JSON.stringify(d).includes('secret'), 'boîte et logistique : nombres seulement, aucun contenu');

  console.log('Gestes notés sur la fiche de Tamachag dans Journée RP');
  src._st[`days/tamachag/months/${ym}`] = { [day]: { done: true, ilohOps: {
    o1: { op: 'evdayWho', ev: 'e1', aid: 'a1', on: true, at: 1, day: iso },
    o2: { op: 'evdayAct', ev: 'e1', text: '  Nettoyer   la yourte ', at: 2, day: iso },
    o3: { op: 'joinAsk', host: 'boroo', act: 'Cuisine', at: 3, day: iso },
    o4: { op: 'evGo', ev: 'e2', on: false, at: 4, day: iso },
    o5: { op: 'joinAsk', host: 'boroo', act: 'Inexistante', at: 5, day: iso } } } };
  // Le pont écoute la fiche : on la « modifie » pour déclencher l'écoute.
  await src.doc(`days/tamachag/months/${ym}`).set(src._st[`days/tamachag/months/${ym}`]); await wait(500);
  const ev = dst._st['shared/events'];
  ok(ev.e1.acts.a1.who.tamachag === 'nono', 'Tamachag rejoint « Apporter les fleurs »');
  ok(Object.values(dst._st).some(n => n?.key === 'evday:e1:a1:go-tamachag' && n.to === 'idriss' && n.from === 'nono'), 'nouvelle pour le joueur de Boroo');
  const mine = Object.entries(ev.e1.acts).find(([, a]) => a.by === 'tamachag');
  ok(mine && mine[1].text === 'Nettoyer la yourte' && mine[1].who.tamachag === 'nono', 'action proposée par Tamachag');
  ok(['jynette', 'eden', 'lou', 'sheyla', 'idriss'].every(p => Object.values(dst._st).some(n => n?.key === `evday:e1:${mine[0]}:${p}`)) && !Object.values(dst._st).some(n => n?.key === `evday:e1:${mine[0]}:nono`), 'nouvelle pour chaque autre joueur');
  const jn = Object.entries(dst._st).find(([k, v]) => k.startsWith('joins/') && v.host === 'boroo');
  ok(jn && jn[1].act === 'Cuisine' && jn[1].chars[0] === 'tamachag' && jn[1].p === 'nono' && jn[1].via === 'jrp' && jn[1].status === 'asked', '« J\'y participe aussi » : demande créée (via Journée RP)');
  ok(!ev.e2.going.tamachag && ev.e2.going.buyan, 'Tamachag ne participe plus à la fête');
  d = src._st[`iloh/_live/months/${iso}`];
  ok(d.ops.o1 === 'ok' && d.ops.o5 === 'activité introuvable', 'résultats des gestes dans le résumé (refus expliqué)');
  ok(d.joins.some(j => j.host === 'boroo' && j.status === 'asked'), 'demande visible dans le résumé');
  ok(dst._st[`pont/ops-${iso}`]?.o2 === 'ok', 'gestes traités notés dans l\'Iloh (pas refaits après un redémarrage)');
  const nEv = Object.keys(ev.e1.acts).length;
  P.start(src, dst, rp); await wait(600);
  ok(Object.keys(dst._st['shared/events'].e1.acts).length === nEv, 'redémarrage : rien n\'est refait');

  console.log('Demande reçue sur une fiche recopiée, réponse depuis Journée RP');
  dst._st['joins/jx'] = { host: 'tamachag', act: 'Course', chars: ['boroo'], p: 'idriss', day: iso, at: 9, status: 'asked' };
  await dst.doc('joins/jx').set(dst._st['joins/jx']); await wait(200);
  const t = src._st[`days/tamachag/months/${ym}`]; t[day].ilohOps.o6 = { op: 'joinAnswer', jid: 'jx', ok: true, at: 6, day: iso };
  t[day].ilohOps.o7 = { op: 'joinAnswer', jid: jn[0], ok: true, at: 7, day: iso };   // pas sa fiche : refusé
  await src.doc(`days/tamachag/months/${ym}`).set(t); await wait(500);
  ok(dst._st['joins/jx'].status === 'ok' && Object.values(dst._st).some(n => n?.key === 'join:jx:ok' && n.to === 'idriss'), 'acceptée : statut et nouvelle pour le joueur de Boroo');
  ok(src._st[`iloh/_live/months/${iso}`].ops.o7 === 'demande introuvable' && dst._st[jn[0]].status === 'asked', 'impossible de répondre à la place d\'un autre');
  ok(!Object.keys(src._st).some(k => !k.startsWith('iloh/') && !k.startsWith('days/')), 'Journée RP : rien d\'écrit hors de iloh/');
  console.log('Projets de l\'Iloh depuis Journée RP');
  d = src._st[`iloh/_live/months/${iso}`];
  const pj = d.projects?.find(x => x.id === 'pr1');
  ok(d.projects.length === 1 && pj.steps[0].open && !pj.steps[1].open && pj.total === 3, 'projets en cours dans le résumé (terminés exclus), étape 2 verrouillée');
  ok(pj.acts.find(a => a.act === 'Tanner les peaux').tag === 'Étape 2 verrouillée' && !pj.acts.find(a => a.act === 'Tanner les peaux').open && pj.acts.find(a => a.act === 'Chant').tag === 'Tout le projet', 'actions : ouvertes ou verrouillées, avec leur étiquette');
  t[day].ilohOps.o8 = { op: 'projDo', pid: 'pr1', act: 'Tanner les peaux', on: true, at: 8, day: iso };
  t[day].ilohOps.o9 = { op: 'projDo', pid: 'pr1', act: 'Couper du bois', on: true, at: 9, day: iso };
  t[day].ilohOps.o10 = { op: 'projDo', pid: 'pr1', act: 'Chant', on: true, at: 10, day: iso };
  await src.doc(`days/tamachag/months/${ym}`).set(t); await wait(600);
  d = src._st[`iloh/_live/months/${iso}`];
  ok(d.ops.o8 === 'étape pas encore débloquée', 'action d\'une étape verrouillée refusée');
  ok(dst._st['shared/projects'].pr1.contrib[`tamachag:${iso}`]?.s === 0 && dst._st['shared/projects'].pr1.contrib[`tamachag:${iso}`].p === 'nono', 'participation de Tamachag pour l\'étape 1');
  ok(dst._st['news/proj:pr1:etape0:lou']?.text === 'Projet « Nouvelle yourte » : étape « Matériaux » terminée, l\'étape « Charpente » est débloquée (1/3).' && !dst._st['news/proj:pr1:etape0:nono'], 'nouvelle d\'étape pour les autres joueurs');
  ok(d.ops.o10 === 'déjà une participation aujourd\'hui', 'une participation par jour');
  ok(d.projects[0].mine.tamachag === 'Couper du bois' && d.projects[0].steps[1].open, 'résumé : participation du jour, étape 2 débloquée');
  t[day].ilohOps.o11 = { op: 'projDo', pid: 'pr1', act: 'Couper du bois', on: false, at: 11, day: iso };
  await src.doc(`days/tamachag/months/${ym}`).set(t); await wait(600);
  ok(!dst._st['shared/projects'].pr1.contrib[`tamachag:${iso}`] && !src._st[`iloh/_live/months/${iso}`].projects[0].mine.tamachag, 'participation retirée');
  P.stop();
  console.log(fails ? `${fails} échec(s)` : 'Tout est bon.'); process.exit(fails ? 1 : 0);
})();
