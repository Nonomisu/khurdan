// Iloh Khurdan — recopie de Journée RP : règles de transformation (sans Firebase, testables seules).
// Sens unique : Journée RP → Iloh Khurdan. Rien d'intime ne sort de l'espace privé des couples ;
// la Vie intime et les fonctions propres au couple ne sont pas reprises.
'use strict';

// Personnages tenus dans Journée RP et recopiés (mêmes identifiants des deux côtés).
const MIRROR = ['tamachag', 'khokkutsai', 'ankhbayar', 'tengis', 'taiga', 'inkaraa', 'khubunjin', 'ogloo', 'javkhaanhun', 'davaajav'];
// Couples d'Iloh Khurdan concernés (identifiant = les deux personnages triés, séparés par un tiret).
const COUPLES = [['tamachag', 'taiga'], ['khokkutsai', 'inkaraa'], ['ankhbayar', 'khubunjin']]
  .map(p => { const chars = [...p].sort(); return { id: chars.join('-'), chars }; });
const coupleOf = id => COUPLES.find(k => k.chars.includes(id)) || null;
// Tous les personnages d'Iloh Khurdan : un identifiant de Journée RP absent d'ici devient un nom (PNJ).
const ILOH = [...MIRROR, 'shiruun', 'djokhodthai', 'buyan', 'cheyenne', 'taivan', 'altan', 'henbilee', 'boroo', 'reaksa', 'tsewang'];
const JRP_NAMES = { eoor: 'Eoor', unegen: 'Unegen', yasmeen: 'Yasmeen', hokkyoku: 'Hokkyoku', viggo: 'Viggo', khopses: 'Khopses', echo: 'Echo', prism: 'Prism' };
const who = x => typeof x !== 'string' || ILOH.includes(x) ? x : (JRP_NAMES[x] || x);

// Champs de la journée qui ne sont pas repris.
const DROP_KEYS = ['intime', 'intimeWith', 'jais', 'set', 'setLate', 'lateAt', 'wait', 'door', 'callPartner', 'returnHour',
  'discordMsg', 'film', 'nefaste', 'night', 'hideIloh'];
const isPrivateAct = a => typeof a === 'string' && /^Sexe avec /i.test(a);
const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
const setList = v => Array.isArray(v?.$set) ? v.$set : Array.isArray(v) ? v : null;
// Activités masquées dans Iloh Khurdan depuis Journée RP : ce jour-là (entrée hideIloh) ou toujours (shared/global hideIloh).
const hiddenOf = (e, always) => new Set([...(setList(e?.hideIloh) || []), ...(setList(always) || [])]);
const filterSet = (v, hid = new Set()) => { const l = setList(v); if (!l) return v; const f = l.filter(a => !isPrivateAct(a) && !hid.has(a)); return Array.isArray(v?.$set) ? { $set: f } : f; };
const filterKeys = (o, hid = new Set()) => o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([k]) => !isPrivateAct(k) && !hid.has(k))) : o;

// Journée d'un personnage (champ « jour » d'un document days/{id}/months/{AAAA-MM}), sans rien d'intime
// ni les activités masquées pour Iloh Khurdan. always : activités toujours masquées pour ce personnage.
function publicEntry(e, always) {
  if (!e || typeof e !== 'object') return null;
  const hid = hiddenOf(e, always);
  const o = clone(e);
  DROP_KEYS.forEach(k => delete o[k]);
  if (o.checked) o.checked = filterSet(o.checked, hid);
  if (o.specials) o.specials = filterSet(o.specials, hid);
  if (o.slots) o.slots = filterKeys(o.slots, hid);
  if (o.details) o.details = filterKeys(o.details, hid);
  if (o.huntSet) o.huntSet = filterKeys(o.huntSet, hid);
  if (o.nightNotes && typeof o.nightNotes === 'object') { delete o.nightNotes['Nuit chaude']; }
  if (o.rp) o.rp = who(o.rp);
  if (o.calmWith) o.calmWith = who(o.calmWith);
  return o;
}

// Nuit chaude d'une journée (pour l'espace du couple), ou null.
function hotNight(n) {
  return n && n.hot ? { hot: true, with: n.with ? who(n.with) : null } : null;
}

// Liste d'amants : seulement des PNJ (un personnage du groupe autre que le partenaire n'a pas sa place ici).
function lovers(list, id) {
  const k = coupleOf(id), partner = k && k.chars.find(x => x !== id);
  return (Array.isArray(list) ? list : []).map(who).filter(x => x !== partner && !ILOH.includes(x));
}

// « Se protège » retenu : clés du personnage (« tamachag ») et de ses PNJ (« pnj:tamachag:Nom »).
function protectFor(protect, chars) {
  return Object.fromEntries(Object.entries(protect || {}).filter(([key]) => chars.some(x => key === x || key.startsWith('pnj:' + x + ':'))));
}

// Fiche d'un personnage : listes d'activités, régions et lieux ajoutés.
function charDoc(d) {
  if (!d) return null;
  return {
    addedActs: (d.addedActs || []).filter(a => !isPrivateAct(a)),
    removedActs: d.removedActs || [],
    addedRegions: d.addedRegions || [],
    customPlaces: d.customPlaces || [],
    customCats: d.customCats || [],
    actCat: filterKeys(d.actCat || {}),
    catNames: d.catNames || {},
  };
}

// Encart public « Aujourd'hui » (entry : journée du jour, pour les activités masquées ce jour-là).
function todayDoc(t, entry, always) {
  if (!t) return null;
  const hid = hiddenOf(entry, always), o = clone(t);
  if (Array.isArray(o.activities)) o.activities = o.activities.filter(a => !isPrivateAct(a) && !hid.has(a));
  return o;
}

// ---------- Retour vers Journée RP : compléments acceptés dans Iloh (extras/{id}/months) ----------
// Seulement les activités communes : activités ajoutées dans Iloh et personnages présents sur une activité.
// Personnages connus de Journée RP : identifiant ; personnages propres à Iloh : leur nom.
const backName = x => MIRROR.includes(x) ? x : typeof x === 'string' && x ? x[0].toUpperCase() + x.slice(1) : null;
function ilohBack(x) {
  if (!x || typeof x !== 'object') return null;
  const added = (Array.isArray(x.added) ? x.added : []).filter(a => typeof a === 'string' && a && !isPrivateAct(a)).slice(0, 30);
  const w = {};
  for (const [l, ids] of Object.entries(x.withActs || {})) {
    if (isPrivateAct(l) || !Array.isArray(ids)) continue;
    const names = ids.map(backName).filter(Boolean);
    if (names.length) w[l] = names;
  }
  return added.length || Object.keys(w).length ? { added, with: w } : null;
}
const ilohBackMonth = data => { const out = {}; for (const [d, x] of Object.entries(data || {})) { const b = ilohBack(x); if (b) out[d] = b; } return out; };

module.exports = { MIRROR, COUPLES, ILOH, coupleOf, who, publicEntry, hotNight, lovers, protectFor, charDoc, todayDoc, isPrivateAct, hiddenOf, ilohBack, ilohBackMonth };
