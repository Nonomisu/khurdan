// Test de la chronique avec un Firestore et un Discord simulés (aucun accès réseau) : node test-chronique.js
'use strict';
const Module = require('module');
let fails = 0;
const ok = (c, l) => { console.log((c ? '  ok  ' : '  ÉCHEC ') + l); if (!c) fails++; };
process.env.TZ = 'Europe/Paris';
const st = {}, writes = [];
const doc = p => ({ path: p, get: async () => ({ exists: p in st, data: () => st[p] }), set: async (d, o) => { writes.push(p); st[p] = o?.merge ? { ...(st[p] || {}), ...d } : d; } });
const db = { doc, collection: c => ({ get: async () => ({ docs: Object.keys(st).filter(k => k.startsWith(c + '/') && k.split('/').length === 2).map(k => ({ data: () => st[k] })) }) }) };
Module._load = (orig => function (req, ...rest) {
  if (req === 'firebase-admin') return { credential: { cert: k => k }, initializeApp: () => ({ firestore: () => db }) };
  if (/cle\.json$/.test(req)) return { project_id: 'khurdans-afc03' };
  return orig.call(this, req, ...rest);
})(Module._load);
process.env.DST_KEY = '/x/khurdans-cle.json';
const posts = [];
global.fetch = async (url, o) => { posts.push({ url, body: JSON.parse(o.body) }); return { ok: true, json: async () => ({ id: 'm1' }) }; };
const Ch = require('./chronique.js');

// Semaine du lundi 2 au dimanche 8 novembre 2026, envoyée le dimanche à 20 h
const week = Ch.weekOf(new Date(2026, 10, 8, 20, 10));
ok(week.days[0].getDate() === 2 && week.days[6].getDate() === 8 && week.id === '2026-S45', 'semaine du lundi 2 au dimanche 8 novembre');
Object.assign(st, {
  'days/tamachag/months/2026-11': { '3': { done: true, mood: 'Calme', checked: { $set: ['Travail du bois', 'Chasse solo'] } }, '7': { done: true, checked: { $set: ['Chasse en groupe'] }, withActs: { 'Chasse en groupe': ['buyan', 'shiruun'] } } },
  'extras/tamachag/months/2026-11': { '3': { added: ['Tir à l\'arc'], withActs: { 'Tir à l\'arc': ['buyan'] } } },
  'days/buyan/months/2026-11': { '3': { done: true, checked: { $set: ['Tir à l\'arc'] }, withActs: { 'Tir à l\'arc': ['tamachag'] } }, '7': { done: true, checked: { $set: ['Chasse en groupe'] } } },
  'days/shiruun/months/2026-11': { '1': { done: true, checked: { $set: ['Pêche'] } } },   // dimanche précédent : hors semaine
  'couples/taiga-tamachag/months/2026-11': { '3': { nights: { tamachag: { hot: true, with: 'taiga' } } } },
  'shared/events': { a: { type: 'fete', text: 'Naadam d\'automne', date: '2026-11-07', going: { tamachag: 'nono', buyan: 'eden' } }, b: { type: 'info', text: 'Ancien', date: '2026-10-01' } },
  'shared/iloh': { guests: { 53: ['davaajav'] } },
  'requests/r1': { status: 'done', doneAt: new Date(2026, 10, 5, 12).getTime(), item: 'Yourte' },
  'requests/r2': { status: 'pending', item: 'Arc' },
  'shared/discord': { webhook: 'https://discord.test/hook' },
});
(async () => {
  const c = Ch.compose(week, await Ch.gather(week));
  console.log('\n' + c.title + '\n' + c.text + '\n');
  ok(c.title === 'Chronique de l\'Iloh, semaine du lundi 2 au dimanche 8 novembre', 'titre');
  ok(/4 journées racontées/.test(c.text) && /Tamachag \(2\)/.test(c.text), 'journées racontées de la semaine seulement');
  ok(/Buyan et Tamachag \(2 jours\)/.test(c.text), 'duo Buyan et Tamachag : 2 jours (compléments Iloh compris)');
  ok(/Chasse en groupe, samedi 7 : Tamachag, Buyan et Shiruun/.test(c.text), 'activité à trois');
  ok(/3 sorties/.test(c.text), 'sorties de chasse');
  ok(/« Naadam d'automne » \(samedi 7, 2 participants\)/.test(c.text) && !c.text.includes('Ancien'), 'événement de la semaine, avec participants');
  ok(/Logistique\*\* : 1 commande livrée par Khokkutsai/.test(c.text), 'logistique');
  ok(/Davaajav \(Mammouth\)/.test(c.text), 'invités');
  ok(!/nuit|chaude|Taiga/i.test(c.text), 'rien des nuits ni des espaces de couple');
  await Ch.send(week, c);
  ok(posts.length === 1 && posts[0].url.startsWith('https://discord.test/hook') && posts[0].body.embeds[0].title === c.title, 'envoyée sur le salon Discord commun');
  ok(st['shared/chronique']?.week === '2026-S45' && writes.every(p => p === 'shared/chronique'), 'semaine notée ; aucune autre écriture');
  console.log(fails ? `${fails} échec(s)` : 'Tout est bon.');
  process.exit(fails ? 1 : 0);
})();
