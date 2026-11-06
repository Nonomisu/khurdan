// Iloh Khurdan — service des notifications push, à lancer sur le VPS avec pm2.
//
// Il surveille la base Iloh Khurdan (projet khurdans-afc03) :
//   - chaque nouvelle (collection news) destinée à un joueur part en notification sur tous ses appareils abonnés ;
//   - chaque appareil qui vient d'activer les notifications (pushSubs/{joueur}/subs) reçoit une notification de bienvenue.
//
// Clés (jamais dans le dépôt) : DST_KEY = clé de service Firebase de khurdans-afc03,
// VAPID_KEY = fichier JSON { publicKey, privateKey } créé une fois avec « npx web-push generate-vapid-keys --json ».
// Le service ne touche qu'à Iloh Khurdan, jamais à Journée RP.
'use strict';
process.env.TZ = 'Europe/Paris';
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');
const webpush = require('web-push');

const need = k => { const v = process.env[k]; if (!v) { console.error(`Variable ${k} manquante.`); process.exit(1); } return v; };
const key = require(need('DST_KEY')), vapid = require(need('VAPID_KEY'));
if (key.project_id !== 'khurdans-afc03') { console.error(`Clé inattendue (${key.project_id}) : arrêt.`); process.exit(1); }
webpush.setVapidDetails('https://nonomisu.github.io/khurdan/', vapid.publicKey, vapid.privateKey);
const db = admin.initializeApp({ credential: admin.credential.cert(key) }, 'iloh-notifs').firestore();

const log = (...a) => console.log(new Date().toLocaleString('fr-FR'), ...a);
const WAIT = +(process.env.WAIT_MS || 30000);   // délai avant envoi : l'auteur peut encore corriger ou annuler sa nouvelle
const OLD = 24 * 3600e3;                         // au démarrage, les nouvelles de plus d'un jour ne sont pas envoyées
const APP = 'https://nonomisu.github.io/khurdan/';

// Envoie une notification à tous les appareils d'un joueur ; supprime les abonnements expirés.
async function sendTo(player, payload, only) {
  const subs = only ? [only] : (await db.collection(`pushSubs/${player}/subs`).get()).docs;
  let sent = 0;
  for (const s of subs) {
    const d = s.data();
    try { await webpush.sendNotification({ endpoint: d.endpoint, keys: d.keys }, JSON.stringify(payload), { TTL: 24 * 3600 }); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { await s.ref.delete(); log(`abonnement expiré supprimé (${player})`); }
      else log(`échec d'envoi à ${player} :`, e.statusCode || '', e.body || e.message);
    }
  }
  return sent;
}

// ---------- Nouvelles ----------
const timers = new Map();
async function pushNews(id) {
  timers.delete(id);
  const ref = db.doc(`news/${id}`);
  // Transaction : marque la nouvelle « envoyée » une seule fois (l'auteur ne peut plus la réécrire ensuite).
  const n = await db.runTransaction(async tx => {
    const s = await tx.get(ref); const d = s.exists ? s.data() : null;
    if (!d || d.pushedAt || d.read || !d.to || !d.text) return null;
    tx.update(ref, { pushedAt: FieldValue.serverTimestamp() });
    return d;
  });
  if (!n) return;
  const url = n.charId ? `${APP}?fiche=${encodeURIComponent(n.charId)}` : APP;
  const sent = await sendTo(n.to, { title: 'Iloh Khurdan', body: n.text, tag: 'news-' + id, url });
  log(`nouvelle pour ${n.to} : ${sent} appareil(s)`);
}
function watchNews() {
  let first = true;
  db.collection('news').onSnapshot(snap => {
    for (const ch of snap.docChanges()) {
      const id = ch.doc.id, d = ch.doc.data();
      if (ch.type === 'removed' || d.pushedAt || d.read) { clearTimeout(timers.get(id)); timers.delete(id); continue; }
      const at = d.createdAt?.toMillis?.() ?? Date.now();
      if (first && Date.now() - at > OLD) continue;          // vieilles nouvelles jamais envoyées : on les laisse
      clearTimeout(timers.get(id));                          // modifiée : on repart pour un délai complet
      timers.set(id, setTimeout(() => pushNews(id).catch(e => log('erreur nouvelle', id, e.message)), WAIT));
    }
    first = false;
  }, e => { log('écoute des nouvelles interrompue :', e.message); setTimeout(watchNews, 30000); });
}

// ---------- Bienvenue sur un nouvel appareil ----------
function watchSubs() {
  db.collectionGroup('subs').onSnapshot(snap => {
    for (const ch of snap.docChanges()) {
      if (ch.type !== 'added' || ch.doc.data().welcomedAt) continue;
      const player = ch.doc.ref.parent.parent?.id; if (!player) continue;
      (async () => {
        await ch.doc.ref.update({ welcomedAt: FieldValue.serverTimestamp() });
        const sent = await sendTo(player, { title: 'Iloh Khurdan', body: 'Notifications activées : tu seras prévenu des nouvelles de tes personnages.', tag: 'bienvenue', url: APP }, ch.doc);
        log(`bienvenue envoyée à ${player} (${sent})`);
      })().catch(e => log('erreur bienvenue', player, e.message));
    }
  }, e => { log('écoute des appareils interrompue :', e.message); setTimeout(watchSubs, 30000); });
}

log('Service des notifications Iloh Khurdan démarré.');
watchNews();
watchSubs();
