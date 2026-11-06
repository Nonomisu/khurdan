// Test du service de recopie avec deux Firestore simulés (aucun accès réseau) : node test-miroir.js
'use strict';
const Module = require('module');
const path = require('path');
let fails = 0;
const ok = (c, l) => { console.log((c ? '  ok  ' : '  ÉCHEC ') + l); if (!c) fails++; };

// ---------- Firestore simulé ----------
const DEL = Symbol('delete');
class FieldPath { constructor(...s) { this.s = s; } }
const FieldValue = { delete: () => DEL };
const stores = {}, listeners = {};
const getAt = (o, segs) => segs.reduce((a, k) => a == null ? undefined : a[k], o);
function fakeDb(name) {
  const st = stores[name] ||= {}, ls = listeners[name] ||= [];
  const fire = p => ls.filter(l => l.path === p).forEach(l => l.cb(snap(p)));
  const snap = p => ({ id: p.split('/').pop(), exists: p in st, data: () => st[p] ? JSON.parse(JSON.stringify(st[p])) : undefined });
  const doc = p => ({
    path: p, id: p.split('/').pop(),
    get: async () => snap(p),
    set: async (data, opt) => {
      if (opt?.mergeFields) {
        const d = st[p] ||= {};
        for (const fp of opt.mergeFields) {
          const v = getAt(data, fp.s); let o = d;
          fp.s.slice(0, -1).forEach(k => { o = (o[k] && typeof o[k] === 'object') ? o[k] : (o[k] = {}); });
          if (v === DEL || v === undefined) delete o[fp.s.at(-1)]; else o[fp.s.at(-1)] = JSON.parse(JSON.stringify(v));
        }
      } else st[p] = JSON.parse(JSON.stringify(data));
      fire(p);
    },
    delete: async () => { delete st[p]; fire(p); },
    onSnapshot: cb => { const l = { path: p, cb }; ls.push(l); setTimeout(() => cb(snap(p)), 0); return () => { ls.splice(ls.indexOf(l), 1); }; },
  });
  return { doc, collection: p => ({ listDocuments: async () => Object.keys(st).filter(k => k.startsWith(p + '/') && k.split('/').length === p.split('/').length + 1).map(doc) }),
    _store: st, _doc: doc };
}
const fakeAdmin = { credential: { cert: k => k }, initializeApp: (opts, name) => ({ firestore: () => fakeDb(name) }) };
const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === 'firebase-admin') return fakeAdmin;
  if (req === 'firebase-admin/firestore') return { FieldPath, FieldValue };
  if (/(journal-rp|khurdans)\.json$/.test(req)) return { project_id: req.includes('journal-rp') ? 'journal-rp' : 'khurdans-afc03' };
  return origLoad.call(this, req, ...rest);
};
process.env.SRC_KEY = '/x/journal-rp.json'; process.env.DST_KEY = '/x/khurdans.json';

// ---------- Données de Journée RP ----------
process.env.TZ = 'Europe/Paris';
const pad = n => String(n).padStart(2, '0');
const rp = new Date(Date.now() - 5 * 3600e3), ym = `${rp.getFullYear()}-${pad(rp.getMonth() + 1)}`, day = String(rp.getDate());
const iso = `${ym}-${pad(rp.getDate())}`;
const S = stores['journee-rp'] = {
  [`days/tamachag/months/2026-03`]: { '4': { mood: 'Ancien', checked: { $set: ['Travail du bois', 'Sexe avec Taiga'] }, night: { hot: true, with: 'taiga' }, intime: 'secret' } },
  [`days/tamachag/months/${ym}`]: { [day]: { mood: 'Aujourd\'hui', done: true, night: { hot: true, with: 'taiga' } } },
  [`days/tengis/months/2026-03`]: { '4': { mood: 'Seul', night: { hot: true, with: 'Une passante' } } },
  [`days/eoor/months/2026-03`]: { '4': { mood: 'Hors groupe' } },
  [`shared/day-${iso}`]: { nights: { tamachag: { hot: true, with: 'taiga' }, taiga: { hot: true, with: 'tamachag' }, eoor: { hot: true, with: 'yasmeen' } },
    protect: { tamachag: true }, shell: { taiga: true }, rp: { tamachag: 'eoor' }, calm: {} },
  'shared/global': { lovers: { tamachag: ['ogloo', 'Une voyageuse'], viggo: ['Jais'] }, protect: { tamachag: true, viggo: false },
    alerts: { ankhbayar: 'En exil temporaire', khopses: 'Malade' }, milestones: { tamachag: [{ key: '2026-1-1', type: 'Mariage', with: 'taiga' }] } },
  'characters/tamachag': { player: 'corentin', addedActs: ['Pêche', 'Sexe avec Taiga'] },
  'today/tamachag': { mood: 'ok', activities: ['Pêche', 'Sexe avec Taiga'], place: 'Khurdan Iloh' },
};
const before = JSON.stringify(S);

// ---------- 1. Recopie complète ----------
process.argv.push('--tout');
const realExit = process.exit;
process.exit = code => {
  process.exit = realExit;
  const D = stores['iloh-khurdan'];
  console.log('Recopie complète (code ' + code + ')');
  ok(JSON.stringify(S) === before, 'Journée RP n\'est pas modifiée');
  ok(D['days/tamachag/months/2026-03']?.['4']?.mood === 'Ancien', 'journée passée recopiée');
  ok(!JSON.stringify(D['days/tamachag/months/2026-03']).match(/intime|night|Sexe avec/), 'journée recopiée sans rien d\'intime');
  ok(D['couples/taiga-tamachag/months/2026-03']?.['4']?.nights?.tamachag?.hot === true, 'nuit chaude passée dans l\'espace du couple');
  ok(!Object.keys(D).some(k => k.includes('eoor')), 'personnage hors groupe (Eoor) jamais recopié');
  ok(!JSON.stringify(D).includes('Une passante'), 'nuit chaude d\'un personnage hors couple (Tengis) non reprise');
  ok(D[`couples/taiga-tamachag/months/${ym}`]?.[day]?.nights?.taiga?.hot === true, 'nuit du jour (Taiga) prise dans shared/day');
  ok(D[`couples/taiga-tamachag/months/${ym}`]?.[day]?.protect?.tamachag === true && D[`couples/taiga-tamachag/months/${ym}`]?.[day]?.shell?.taiga === true, 'protection et coquillage du jour dans l\'espace du couple');
  ok(!JSON.stringify(D[`shared/day-${iso}`] || {}).match(/hot|protect|shell/), 'rien d\'intime dans la journée partagée');
  ok(D[`shared/day-${iso}`]?.rp?.tamachag === 'Eoor', 'journée jouée en RP recopiée (partenaire hors groupe → nom)');
  ok(JSON.stringify(D['couples/taiga-tamachag/state/main']?.lovers?.tamachag) === '["Une voyageuse"]', 'amants : PNJ seulement, dans l\'espace du couple');
  ok(D['couples/taiga-tamachag/state/main']?.protect?.tamachag === true && !('viggo' in (D['couples/taiga-tamachag/state/main']?.protect || {})), 'protection retenue : couple seulement');
  ok(D['shared/global']?.alerts?.ankhbayar === 'En exil temporaire' && !('khopses' in (D['shared/global']?.alerts || {})), 'alertes : personnages recopiés seulement');
  ok(!JSON.stringify(D['shared/global'] || {}).match(/lovers|"protect"/), 'ni amants ni protection dans les réglages partagés');
  ok(D['characters/tamachag']?.addedActs?.length === 1 && !('player' in D['characters/tamachag']), 'fiche recopiée, sans activité intime ni joueur de Journée RP');
  ok(D['today/tamachag']?.activities?.length === 1, 'encart public sans activité intime');
  ok(Object.keys(D).every(k => /^(days|couples|shared|characters|today)\//.test(k)), 'écriture seulement dans les collections prévues');
  // Un champ écrit par un joueur d'Iloh ne doit pas être écrasé
  D[`shared/day-${iso}`].rp.buyan = 'cheyenne';
  live(D);
};
require('./miroir.js');

// ---------- 2. Écoute en direct ----------
async function live(D) {
  console.log('Écoute en direct');
  process.argv.pop();
  delete require.cache[require.resolve('./miroir.js')];
  const src = fakeDb('journee-rp');
  require('./miroir.js');
  await new Promise(r => setTimeout(r, 50));
  await src._doc(`days/tamachag/months/${ym}`).set({ [day]: { mood: 'Changé', done: true, intime: 'non' } });
  await new Promise(r => setTimeout(r, 50));
  ok(D[`days/tamachag/months/${ym}`]?.[day]?.mood === 'Changé' && !D[`days/tamachag/months/${ym}`][day].intime, 'modification de la journée recopiée aussitôt');
  ok(D[`couples/taiga-tamachag/months/${ym}`]?.[day]?.nights?.tamachag?.hot === true, 'nuit du jour gardée (shared/day fait foi pour aujourd\'hui)');
  const g = JSON.parse(JSON.stringify(S['shared/global'])); g.alerts.ankhbayar = null;
  await src._doc('shared/global').set(g);
  await new Promise(r => setTimeout(r, 50));
  ok(!D['shared/global']?.alerts?.ankhbayar, 'alerte retirée dans Journée RP → retirée dans Iloh');
  const dd = JSON.parse(JSON.stringify(S[`shared/day-${iso}`])); dd.nights = {};
  await src._doc(`shared/day-${iso}`).set(dd);
  await new Promise(r => setTimeout(r, 50));
  ok(!D[`couples/taiga-tamachag/months/${ym}`]?.[day]?.nights?.tamachag, 'nuit chaude décochée → retirée dans Iloh');
  ok(D[`shared/day-${iso}`]?.rp?.buyan === 'cheyenne', 'données des joueurs d\'Iloh intactes');
  // Activité masquée ce jour-là, puis toujours masquée (réglage dans shared/global)
  await src._doc(`days/tamachag/months/${ym}`).set({ [day]: { mood: 'Changé', done: true, checked: { $set: ['Pêche', 'Travail du bois'] }, hideIloh: { $set: ['Pêche'] } } });
  await new Promise(r => setTimeout(r, 50));
  ok(JSON.stringify(D[`days/tamachag/months/${ym}`]?.[day]?.checked) === '{"$set":["Travail du bois"]}', 'activité masquée ce jour-là absente d\'Iloh');
  const g2 = JSON.parse(JSON.stringify(S['shared/global'])); g2.hideIloh = { tamachag: { $set: ['Travail du bois'] } };
  await src._doc('shared/global').set(g2);
  await new Promise(r => setTimeout(r, 200));
  ok(JSON.stringify(D[`days/tamachag/months/${ym}`]?.[day]?.checked) === '{"$set":[]}', 'activité toujours masquée : retirée aussitôt');
  ok(!JSON.stringify(D['days/tamachag/months/2026-03'] || {}).includes('Travail du bois'), 'et retirée de l\'historique déjà recopié');
  ok(!JSON.stringify(D['shared/global']).includes('hideIloh'), 'le réglage lui-même n\'est pas recopié');
  console.log(fails ? `${fails} échec(s)` : 'Tout est bon.');
  process.exit(fails ? 1 : 0);
}
