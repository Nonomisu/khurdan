// Diagnostic en lecture seule : état de validation des fiches du jour (et de la veille), dans Journée RP et dans Iloh Khurdan.
// N'écrit rien nulle part.
//   cd ~/iloh-miroir && node diagnostic.js            journée RP en cours
//   cd ~/iloh-miroir && node diagnostic.js 2026-11-11 une journée précise
'use strict';
process.env.TZ = 'Europe/Paris';
const admin = require('firebase-admin');
const T = require('./transform');
const home = process.env.HOME;
const src = admin.initializeApp({ credential: admin.credential.cert(require(home + '/secrets/journee-rp-cle.json')) }, 'jrp').firestore();
const dst = admin.initializeApp({ credential: admin.credential.cert(require(home + '/secrets/khurdans-cle.json')) }, 'iloh').firestore();
const pad = n => String(n).padStart(2, '0');
const rpDate = () => { const d = new Date(); if (d.getHours() < 5) d.setDate(d.getDate() - 1); d.setHours(12, 0, 0, 0); return d; };
const arg = process.argv[2];
const day = arg ? new Date(arg + 'T12:00:00') : rpDate();
const ym = `${day.getFullYear()}-${pad(day.getMonth() + 1)}`, k = String(day.getDate());
const hhmm = t => t ? new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '—';
(async () => {
  console.log(`Journée du ${day.toLocaleDateString('fr-FR')} (lecture seule)\n`);
  console.log('Personnage      | Journée RP          | Iloh Khurdan | Discord | Rouverte (« Modifier la journée »)');
  console.log('----------------|---------------------|--------------|---------|-----------------------------------');
  for (const id of T.MIRROR) {
    const [a, b] = await Promise.all([src.doc(`days/${id}/months/${ym}`).get(), dst.doc(`days/${id}/months/${ym}`).get()]);
    const e = a.data()?.[k], f = b.data()?.[k];
    const jrp = !e ? 'vide' : e.done ? `validée (${hhmm(e.doneAt)})` : (e.doneAt ? `EN COURS (validée à ${hhmm(e.doneAt)})` : 'en cours');
    const iloh = !f ? 'vide' : f.done ? 'validée' : 'en cours';
    const re = Array.isArray(e?.reopens) && e.reopens.length ? e.reopens.map(hhmm).join(', ') : '—';
    console.log(`${id.padEnd(15)} | ${jrp.padEnd(19)} | ${iloh.padEnd(12)} | ${(e?.discordMsg ? 'envoyée' : '—').padEnd(7)} | ${re}`);
  }
  process.exit(0);
})().catch(e => { console.error(e.message || e); process.exit(1); });
