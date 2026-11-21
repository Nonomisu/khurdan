// Iloh Khurdan ↔ Journée RP : le « pont » du service de recopie, pour remplir entièrement les fiches Khurdans depuis Journée RP.
//
// 1. Résumé de l'Iloh déposé dans Journée RP (iloh/_live/months/{AAAA-MM-JJ}, lecture seule là-bas) :
//    événements (dont l'événement du jour et ses actions), activités communes notées dans l'Iloh avec les personnages recopiés,
//    fiches validées du jour (pour « J'y participe aussi »), demandes de participation, nombre de messages et de demandes
//    de logistique en attente (sans leur contenu), résultat des gestes déjà traités.
// 2. Gestes faits dans Journée RP : le joueur les note sur la fiche du jour de SON personnage (champ ilohOps, jamais recopié).
//    Seul le joueur d'un personnage peut écrire sa fiche : le geste vient donc bien de lui. Le pont le vérifie et l'exécute
//    dans l'Iloh, comme s'il avait été fait dans l'appli (avec les mêmes nouvelles), puis note son résultat (pont/ops-{jour}).
'use strict';
const { FieldPath, FieldValue } = require('firebase-admin/firestore');
const T = require('./transform');

const NOMS = T.noms();
const PLAYERS = ['nono', 'jynette', 'eden', 'lou', 'sheyla', 'idriss'];
const PLAYER_NAME = { nono: 'Nono', jynette: 'Jynette', eden: 'Eden', lou: 'Lou', sheyla: 'Sheyla', idriss: 'Idriss' };
const EV_LABEL = { info: "Information importante pour l'Iloh", chasse: 'Grand événement de chasse', fete: 'Fête ou rassemblement', ceremonie: 'Cérémonie', autre: 'Annonce à la tribu' };
const nameOf = id => NOMS[id]?.name || (id ? id[0].toUpperCase() + id.slice(1) : '?');
const playerOf = id => NOMS[id]?.player || null;
const isChar = id => typeof id === 'string' && !!NOMS[id];
const andList = a => a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' et ' + a[a.length - 1];
const canShareAct = l => typeof l === 'string' && l !== 'Voyage' && !/^Sexe avec /i.test(l) && !T.isPrivateAct(l);
const J = v => JSON.stringify(v ?? null);
const pad = n => String(n).padStart(2, '0');
const isoPlus = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
// Mêmes règles que l'appli Iloh Khurdan.
const evStart = e => e.date || (e.at ? new Date(e.at).toISOString().slice(0, 10) : '');
const evOn = (e, iso) => evStart(e) <= iso && iso <= (e.until || evStart(e));
const evActLabel = e => e.text.length <= 60 ? e.text : (EV_LABEL[e.type] || EV_LABEL.autre);
const evDayActLabel = (e, a) => a.text.length + e.text.length <= 56 ? `${a.text} (${e.text})` : a.text;
const setOf = v => new Set(Array.isArray(v?.$set) ? v.$set : Array.isArray(v) ? v : []);
const withOf = (wa, l) => (Array.isArray(wa?.[l]) ? wa[l] : []).filter(x => typeof x === 'string');

let S = null;   // état de la journée suivie
const log = (...a) => console.log(new Date().toLocaleString('fr-FR'), 'pont :', ...a);

// Fiche du jour telle qu'Iloh l'affiche : journée (recopiée ou propre à l'Iloh) + compléments Iloh des fiches recopiées.
function entryOf(id) {
  const e = S.days[id] || null, x = S.extras[id] || null;
  if (!x) return e;
  const out = JSON.parse(JSON.stringify(e || {})), set = setOf(out.checked);
  (x.added || []).forEach(l => set.add(l));
  out.checked = { $set: [...set] };
  out.withActs = { ...(out.withActs || {}), ...(x.withActs || {}) };
  if (x.slots) out.slots = { ...(out.slots || {}), ...x.slots };
  if (x.withFrom) out.withFrom = { ...(out.withFrom || {}), ...x.withFrom };
  return out;
}

// ---------- 1. Résumé ----------
function digest() {
  const iso = S.iso, events = [], shared = {}, fiches = {};
  for (const [id, e] of Object.entries(S.events)) {
    if (!e || typeof e.text !== 'string') continue;
    const st = evStart(e); if (!(evOn(e, iso) || (st > iso && st <= isoPlus(iso, 14)))) continue;
    events.push({ id, type: e.type || 'autre', label: EV_LABEL[e.type] || EV_LABEL.autre, text: e.text, date: st, until: e.until || null, daily: !!e.daily,
      by: PLAYER_NAME[e.by] || '?', going: Object.keys(e.going || {}).filter(isChar),
      acts: e.daily ? Object.entries(e.acts || {}).filter(([, a]) => a && a.text).sort((a, b) => a[1].at - b[1].at)
        .map(([aid, a]) => ({ id: aid, text: a.text, by: a.by, who: Object.keys(a.who || {}).filter(isChar) })) : [] });
  }
  events.sort((a, b) => a.date.localeCompare(b.date));
  for (const m of T.MIRROR) {
    const items = [];
    // Activités notées dans l'Iloh avec ce personnage, sur une fiche validée (propre à l'Iloh, ou complément Iloh d'une fiche recopiée).
    for (const x of T.ILOH) {
      if (x === m) continue;
      const e = entryOf(x); if (!e?.done) continue;
      const checked = setOf(e.checked), base = S.days[x] || {};
      for (const [l, ids] of Object.entries(e.withActs || {})) {
        if (!Array.isArray(ids) || !ids.includes(m) || !checked.has(l) || e.withFrom?.[l] || !canShareAct(l)) continue;
        if (T.MIRROR.includes(x) && withOf(base.withActs, l).includes(m)) continue;   // déjà dans Journée RP
        items.push({ kind: 'with', from: x, act: l, others: ids.filter(o => o !== m && typeof o === 'string'), slots: Array.isArray(e.slots?.[l]) ? e.slots[l] : [] });
      }
    }
    for (const ev of events.filter(v => evOn(S.events[v.id], iso))) {
      const e = S.events[ev.id];
      if (ev.daily) ev.acts.filter(a => a.who.includes(m)).forEach(a => items.push({ kind: 'evday', ev: ev.id, aid: a.id, evText: ev.text, text: a.text,
        act: evDayActLabel(e, a), others: a.who.filter(o => o !== m) }));
      else if (ev.going.includes(m)) items.push({ kind: 'ev', ev: ev.id, evText: ev.text, act: evActLabel(e), others: ev.going.filter(o => o !== m) });
    }
    if (items.length) shared[m] = items;
  }
  // Fiches validées du jour : activités où l'on peut dire « J'y participe aussi ».
  for (const x of T.ILOH) {
    const e = entryOf(x); if (!e?.done) continue;
    const acts = [...setOf(e.checked)].filter(canShareAct); if (!acts.length) continue;
    fiches[x] = { player: playerOf(x), acts: acts.map(l => ({ act: l, with: withOf(e.withActs, l), slots: Array.isArray(e.slots?.[l]) ? e.slots[l] : [] })) };
  }
  const joins = Object.entries(S.joins).filter(([, j]) => j && j.day === iso)
    .map(([id, j]) => ({ id, host: j.host, act: j.act, chars: j.chars || [], p: j.p, status: j.status, applied: !!j.applied, via: j.via || null }));
  return { iso, at: Date.now(), events, shared, fiches, joins, todo: { mail: S.mailNew, logi: S.logiOpen },
    ops: S.done, names: Object.fromEntries(T.ILOH.map(x => [x, nameOf(x)])), players: PLAYER_NAME };
}
let digestTimer = 0, lastDigest = '';
const pushDigest = () => { clearTimeout(digestTimer); digestTimer = setTimeout(async () => {
  if (!S) return;
  const d = digest(), j = J({ ...d, at: 0 }); if (j === lastDigest) return; lastDigest = j;
  try { await S.src.doc(`iloh/_live/months/${S.iso}`).set(d); } catch (e) { console.error('pont, résumé :', e.message || e); }
}, 400); };

// ---------- 2. Gestes venus de Journée RP ----------
const news = (to, from, key, text, charId = null) => to && to !== from
  ? S.dst.doc('news/' + key.replace(/\//g, '_')).set({ to, text, charId, key, read: false, from, createdAt: FieldValue.serverTimestamp() }) : null;
const dropNews = key => S.dst.doc('news/' + key.replace(/\//g, '_')).delete().catch(() => {});
async function runOp(carrier, opId, o) {
  const p = playerOf(carrier), iso = S.iso, evRef = S.dst.doc('shared/events');
  if (!p || !o || typeof o !== 'object') return 'geste illisible';
  if (o.day && o.day !== iso) return 'journée passée';
  const ev = typeof o.ev === 'string' ? S.events[o.ev] : null;
  switch (o.op) {
    case 'evGo': {   // participer (ou plus) à un événement
      if (!ev || ev.daily) return 'événement introuvable';
      if (ev.until && ev.until < iso) return 'événement terminé';
      await evRef.update(new FieldPath(o.ev, 'going', carrier), o.on ? p : FieldValue.delete());
      return 'ok';
    }
    case 'evdayAct': {   // proposer une action pour l'événement du jour
      const text = typeof o.text === 'string' ? o.text.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
      if (!ev?.daily || !text) return 'action illisible';
      if (evStart(ev) < iso) return 'événement passé';
      const aid = 'j' + opId.replace(/[^a-z0-9]/gi, '').slice(-10), at = Date.now();
      await evRef.update(new FieldPath(o.ev, 'acts', aid), { text, by: carrier, p, at, who: { [carrier]: p } });
      await Promise.all(PLAYERS.filter(x => x !== p).map(x => news(x, p, `evday:${o.ev}:${aid}:${x}`, `${nameOf(carrier)} propose « ${text} » pour l'événement du jour « ${ev.text} ».`)));
      return 'ok';
    }
    case 'evdayWho': {   // rejoindre (ou quitter) une action de l'événement du jour
      const a = ev?.daily ? ev.acts?.[o.aid] : null;
      if (!a) return 'action introuvable';
      if (evStart(ev) < iso) return 'événement passé';
      if (a.by === carrier) return 'ok';
      await evRef.update(new FieldPath(o.ev, 'acts', o.aid, 'who', carrier), o.on ? p : FieldValue.delete());
      const key = `evday:${o.ev}:${o.aid}:go-${carrier}`;
      if (o.on) await news(playerOf(a.by), p, key, `${nameOf(carrier)} rejoint l'action « ${a.text} » proposée par ${nameOf(a.by)} (${ev.text}).`, a.by);
      else await dropNews(key);
      return 'ok';
    }
    case 'joinAsk': {   // « J'y participe aussi » sur la fiche validée d'un autre joueur
      const host = o.host, e = isChar(host) ? entryOf(host) : null;
      if (!e?.done || !setOf(e.checked).has(o.act) || !canShareAct(o.act)) return 'activité introuvable';
      if (playerOf(host) === p) return 'fiche de ce joueur';
      if (withOf(e.withActs, o.act).includes(carrier)) return 'déjà noté';
      if (Object.values(S.joins).some(j => j && j.day === iso && j.host === host && j.act === o.act && j.status === 'asked' && (j.chars || []).includes(carrier))) return 'déjà demandé';
      const id = 'j' + opId.replace(/[^a-z0-9]/gi, '').slice(-12), at = Date.now();
      await S.dst.doc('joins/' + id).set({ host, act: o.act, chars: [carrier], p, day: iso, at, status: 'asked', via: 'jrp' });
      await news(playerOf(host), p, `join:${id}`, `${nameOf(carrier)} a aussi participé à « ${o.act} » avec ${nameOf(host)}. À accepter sur sa fiche.`, host);
      return 'ok';
    }
    case 'joinCancel': {
      const j = S.joins[o.jid]; if (!j || j.p !== p || j.status !== 'asked') return 'demande introuvable';
      await S.dst.doc('joins/' + o.jid).delete(); await dropNews(`join:${o.jid}`); return 'ok';
    }
    case 'joinAnswer': {   // réponse du joueur de la fiche d'origine (l'ajout est déjà fait sur sa fiche dans Journée RP)
      const j = S.joins[o.jid]; if (!j || j.host !== carrier || j.status !== 'asked') return 'demande introuvable';
      const ok = !!o.ok; await S.dst.doc('joins/' + o.jid).update({ status: ok ? 'ok' : 'no' }); await dropNews(`join:${o.jid}`);
      await news(j.p, p, `join:${o.jid}:${ok ? 'ok' : 'no'}`, ok ? `${nameOf(carrier)} accepte : ${andList((j.chars || []).map(nameOf))} ${(j.chars || []).length > 1 ? 'sont ajoutés' : 'est ajouté·e'} à « ${j.act} ».`
        : `${nameOf(carrier)} n'a pas retenu la participation de ${andList((j.chars || []).map(nameOf))} à « ${j.act} ».`, (j.chars || [])[0] || null);
      return 'ok';
    }
    case 'joinApplied': {   // ajoutée sur la fiche (dans Journée RP) du personnage qui s'est joint
      const j = S.joins[o.jid]; if (!j || j.p !== p || j.status !== 'ok') return 'demande introuvable';
      await S.dst.doc('joins/' + o.jid).update({ applied: true }); return 'ok';
    }
    default: return 'geste inconnu';
  }
}
let opsBusy = Promise.resolve();
const opsOf = (id, month) => { const e = month?.[S.day]; return e && typeof e.ilohOps === 'object' ? e.ilohOps : {}; };
function onJrpMonth(id, month) {
  const ops = opsOf(id, month);
  for (const [opId, o] of Object.entries(ops).sort((a, b) => (a[1]?.at || 0) - (b[1]?.at || 0))) {
    if (opId in S.done || S.running.has(opId)) continue;
    S.running.add(opId);
    opsBusy = opsBusy.then(async () => {
      let r; try { r = await runOp(id, opId, o); } catch (e) { r = 'erreur : ' + (e.message || e); }
      S.done[opId] = r; S.running.delete(opId);
      await S.dst.doc(`pont/ops-${S.iso}`).set({ [opId]: r }, { merge: true }).catch(() => {});
      log(`${nameOf(id)} : ${o?.op} → ${r}`); pushDigest();
    });
  }
}

// ---------- Écoute ----------
function start(src, dst, today) {
  stop();
  const iso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`, ym = iso.slice(0, 7), day = String(today.getDate());
  S = { src, dst, iso, ym, day, events: {}, joins: {}, days: {}, extras: {}, mailNew: 0, logiOpen: 0, done: {}, running: new Set(), subs: [] };
  const sub = (label, ref, fn) => S.subs.push(ref.onSnapshot(s => { try { fn(s); } catch (e) { console.error('pont,', label, e.message || e); } pushDigest(); },
    e => console.error('pont,', label, e.message || e)));
  sub('événements', dst.doc('shared/events'), s => { S.events = s.data() || {}; });
  sub('participations', dst.collection('joins').where('day', '==', iso), s => { S.joins = Object.fromEntries(s.docs.map(x => [x.id, x.data()])); });
  sub('boîte', dst.collection('mailbox').where('status', '==', 'new'), s => { S.mailNew = s.size; });
  sub('logistique', dst.collection('requests').where('status', 'in', ['pending', 'preparing']), s => { S.logiOpen = s.size; });
  for (const id of T.ILOH) sub('fiche ' + id, dst.doc(`days/${id}/months/${ym}`), s => { S.days[id] = (s.data() || {})[day] || null; });
  for (const id of T.MIRROR) sub('compléments ' + id, dst.doc(`extras/${id}/months/${ym}`), s => { S.extras[id] = (s.data() || {})[day] || null; });
  // Gestes notés dans Journée RP (d'abord ceux déjà traités, pour ne rien refaire après un redémarrage).
  dst.doc(`pont/ops-${iso}`).get().then(s => {
    Object.assign(S.done, s.data() || {});
    for (const id of T.MIRROR) S.subs.push(src.doc(`days/${id}/months/${ym}`).onSnapshot(s => onJrpMonth(id, s.data()), e => console.error('pont, gestes', id, e.message || e)));
  }).catch(e => console.error('pont, démarrage', e.message || e));
  log(`journée du ${iso}`);
}
function stop() { if (S) S.subs.forEach(u => { try { u(); } catch {} }); S = null; lastDigest = ''; }

module.exports = { start, stop, digest: () => S && digest(), _state: () => S };
