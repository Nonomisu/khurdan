// Iloh Khurdan — chronique de la semaine : chaque dimanche à 20 h (heure de Paris), un résumé de la semaine
// de l'Iloh est posté sur le salon Discord commun.
//
//   node chronique.js              sous pm2 : lancé chaque heure le dimanche, n'envoie qu'à 20 h et une seule fois par semaine
//   node chronique.js --apercu     affiche la chronique de la semaine en cours, sans rien envoyer
//   node chronique.js --maintenant envoie la chronique tout de suite (même si elle est déjà partie cette semaine)
//
// Ne lit que la base Iloh Khurdan (khurdans-afc03) ; n'y écrit que shared/chronique (semaine déjà envoyée).
// Rien d'intime : les nuits sont dans les espaces des couples, que ce service ne lit pas.
'use strict';
process.env.TZ = 'Europe/Paris';
const admin = require('firebase-admin');
const NOMS = require('./noms.json');

const need = k => { const v = process.env[k]; if (!v) { console.error(`Variable ${k} manquante.`); process.exit(1); } return v; };
const key = require(need('DST_KEY'));
if (key.project_id !== 'khurdans-afc03') { console.error(`Clé inattendue (${key.project_id}) : arrêt.`); process.exit(1); }
const db = admin.initializeApp({ credential: admin.credential.cert(key) }, 'iloh-chronique').firestore();
const log = (...a) => console.log(new Date().toLocaleString('fr-FR'), ...a);

const pad = n => String(n).padStart(2, '0');
const ymOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const nameOf = id => NOMS.chars[id]?.name || null;
const and = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1];
const list = v => Array.isArray(v) ? v : Array.isArray(v?.$set) ? v.$set : [];
const HUNT = ['Chasse solo', 'Chasse en groupe'];
// Activités libres parfois longues : coupées à 60 caractères, au dernier mot entier.
const short = t => { t = String(t).replace(/\s+/g, ' ').trim(); if (t.length <= 60) return t.replace(/[.\s]+$/, ''); const c = t.slice(0, 60); return c.slice(0, c.lastIndexOf(' ') > 30 ? c.lastIndexOf(' ') : 60).replace(/[.,;:\s]+$/, '') + '…'; };

// Semaine RP en cours (la journée commence à 5 h) : du lundi au dimanche.
function weekOf(now = new Date()) {
  const rp = new Date(now.getTime() - 5 * 3600e3), d = new Date(rp.getFullYear(), rp.getMonth(), rp.getDate());
  const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const days = Array.from({ length: 7 }, (_, i) => { const x = new Date(mon); x.setDate(mon.getDate() + i); return x; });
  const thu = new Date(mon); thu.setDate(mon.getDate() + 3);
  const wk = Math.ceil(((thu - new Date(thu.getFullYear(), 0, 1)) / 864e5 + 1) / 7);
  return { days, id: `${thu.getFullYear()}-S${pad(wk)}`, until: d };
}
const dayLabel = d => `${DAYS[d.getDay()]} ${d.getDate()}${d.getDate() === 1 ? 'er' : ''}`;
const rangeLabel = (a, b) => a.getMonth() === b.getMonth() ? `du lundi ${a.getDate()} au dimanche ${b.getDate()} ${MONTHS[b.getMonth()]}` : `du lundi ${a.getDate()} ${MONTHS[a.getMonth()]} au dimanche ${b.getDate()} ${MONTHS[b.getMonth()]}`;

async function gather(week) {
  const ids = Object.keys(NOMS.chars), yms = [...new Set(week.days.map(ymOf))];
  const entries = [];   // { id, d, e }
  for (const id of ids) for (const ym of yms) {
    const [m, x] = await Promise.all([db.doc(`days/${id}/months/${ym}`).get(), db.doc(`extras/${id}/months/${ym}`).get()]);
    const data = m.data() || {}, ex = x.data() || {};
    for (const d of week.days.filter(d => ymOf(d) === ym && d <= week.until)) {
      const k = String(d.getDate()), e = data[k], xe = ex[k];
      if (!e && !xe) continue;
      // Fiche recopiée de Journée RP + compléments Iloh (activités ajoutées, personnages présents)
      const checked = new Set([...list(e?.checked), ...list(xe?.added)]);
      const withActs = { ...(e?.withActs || {}), ...(xe?.withActs || {}) };
      entries.push({ id, d, done: !!e?.done, checked, withActs });
    }
  }
  const [ev, il, rq] = await Promise.all([db.doc('shared/events').get(), db.doc('shared/iloh').get(), db.collection('requests').get()]);
  return { entries, events: ev.data() || {}, guests: il.data()?.guests || { 53: ['davaajav'] }, requests: rq.docs.map(x => x.data()) };
}

function compose(week, g) {
  const out = [], first = week.days[0], last = week.days[6], isoIn = iso => iso >= isoOf(first) && iso <= isoOf(last);
  // Journées racontées
  const done = g.entries.filter(x => x.done), per = {};
  done.forEach(x => { per[x.id] = (per[x.id] || 0) + 1; });
  const top = Object.entries(per).sort((a, b) => b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0]), 'fr'));
  if (done.length) out.push(`📖 **${done.length} journée${done.length > 1 ? 's' : ''} racontée${done.length > 1 ? 's' : ''}** par ${top.length} personnage${top.length > 1 ? 's' : ''}. Les plus assidus : ${and(top.slice(0, 3).map(([id, n]) => `${nameOf(id)} (${n})`))}.`);
  // Activités communes : duos (une fois par jour) et activités à plusieurs
  const pairs = {}, groups = {};
  for (const x of g.entries) for (const [l, ids] of Object.entries(x.withActs)) {
    if (!x.checked.has(l)) continue;
    const people = [x.id, ...(Array.isArray(ids) ? ids : []).filter(nameOf)].filter((v, i, a) => a.indexOf(v) === i);
    if (people.length < 2) continue;
    for (const o of people.slice(1)) (pairs[[x.id, o].sort().join('+')] ||= new Set()).add(isoOf(x.d));
    const gk = isoOf(x.d) + '|' + l;
    const gr = (groups[gk] ||= { l, d: x.d, who: new Set() }); people.forEach(p => gr.who.add(p));
  }
  const duos = Object.entries(pairs).map(([p, s]) => [p.split('+'), s.size]).sort((a, b) => b[1] - a[1]);
  if (duos.length) {
    out.push(`🤝 **Activités communes** : ${and(duos.slice(0, 4).map(([[a, b], n]) => `${nameOf(a)} et ${nameOf(b)} (${n} jour${n > 1 ? 's' : ''})`))}.`);
    const big = Object.values(groups).filter(x => x.who.size >= 3).sort((a, b) => b.who.size - a.who.size).slice(0, 3);
    big.forEach(x => out.push(`   • ${short(x.l)}, ${dayLabel(x.d)} : ${and([...x.who].map(nameOf))}`));
  }
  // Chasse
  const hunts = {}; g.entries.forEach(x => { const n = HUNT.filter(h => x.checked.has(h)).length; if (n) hunts[x.id] = (hunts[x.id] || 0) + n; });
  const hn = Object.values(hunts).reduce((a, b) => a + b, 0);
  if (hn) out.push(`🏹 **Chasse** : ${hn} sortie${hn > 1 ? 's' : ''}. ${and(Object.entries(hunts).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => `${nameOf(id)} (${n})`))}.`);
  // Événements de la semaine
  const evs = Object.values(g.events).filter(e => e && e.text && (isoIn(e.date || '') || (e.until && e.date <= isoOf(last) && e.until >= isoOf(first))));
  evs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  if (evs.length) out.push(`🎉 **Événements** : ${evs.map(e => { const n = Object.keys(e.going || {}).filter(nameOf).length;
    const [y, m, d] = (e.date || '').split('-').map(Number); return `« ${e.text} » (${y ? dayLabel(new Date(y, m - 1, d)) : 'cette semaine'}${n ? `, ${n} participant${n > 1 ? 's' : ''}` : ''})`; }).join(' ; ')}.`);
  // Anniversaires de la semaine
  const bd = Object.entries(NOMS.birthdays).map(([id, [m, d]]) => [id, week.days.find(x => x.getMonth() === m && x.getDate() === d)]).filter(([, d]) => d);
  if (bd.length) out.push(`🎂 **Anniversaires** : ${and(bd.map(([id, d]) => `${nameOf(id)} (${dayLabel(d)})`))}.`);
  // Logistique
  const delivered = g.requests.filter(r => r.status === 'done' && r.doneAt && isoIn(isoOf(new Date(r.doneAt)))).length;
  if (delivered) out.push(`📦 **Logistique** : ${delivered} commande${delivered > 1 ? 's' : ''} livrée${delivered > 1 ? 's' : ''} par ${nameOf('khokkutsai')}.`);
  // Yourtes des invités
  const YNAMES = { 45: 'Baras', 49: 'Hainag', 53: 'Mammouth' };
  const guests = Object.entries(g.guests).flatMap(([n, ids]) => (ids || []).filter(nameOf).map(id => `${nameOf(id)} (${YNAMES[n] || 'n° ' + n})`));
  if (guests.length) out.push(`🏕️ **Invités de l'Iloh** : ${and(guests)}.`);
  const title = `Chronique de l'Iloh, semaine ${rangeLabel(first, last)}`;
  return { title, text: out.length ? out.join('\n') : "Semaine calme sur l'Iloh : rien n'a été raconté." };
}

async function send(week, c) {
  const hook = (await db.doc('shared/discord').get()).data()?.webhook;
  if (!hook) throw new Error('aucun webhook Discord réglé dans l\'appli');
  const r = await fetch(hook + '?wait=true', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Chronique · Iloh Khurdan', embeds: [{ title: c.title, description: c.text.slice(0, 4000), color: 0xc9a45c, url: 'https://nonomisu.github.io/khurdan/' }] }) });
  if (!r.ok) throw new Error(`Discord a répondu ${r.status}`);
  const msg = (await r.json().catch(() => ({}))).id || null;
  await db.doc('shared/chronique').set({ week: week.id, msg, sentAt: Date.now() }, { merge: true });
  return msg;
}

const main = async () => {
  const week = weekOf(), args = process.argv.slice(2), preview = args.includes('--apercu'), now = args.includes('--maintenant');
  if (!preview && !now) {
    const h = new Date().getHours(), sunday = new Date().getDay() === 0;
    if (!sunday || h !== 20) { log('pas l\'heure de la chronique (dimanche 20 h)'); process.exit(0); }
    if ((await db.doc('shared/chronique').get()).data()?.week === week.id) { log('chronique déjà envoyée cette semaine'); process.exit(0); }
  }
  const c = compose(week, await gather(week));
  if (preview) { console.log(`\n${c.title}\n\n${c.text}\n`); process.exit(0); }
  await send(week, c);
  log(`chronique envoyée (${week.id})`);
  process.exit(0);
};
if (require.main === module) main().catch(e => { log('ÉCHEC de la chronique :', e.message); process.exit(1); });
module.exports = { weekOf, compose, gather, send, main };
