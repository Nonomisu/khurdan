// Test de bout en bout d'Iloh Khurdan (Firestore simulé, plusieurs joueurs dans le même navigateur).
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/groupe.js [largeur]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const MOCK = path.join(__dirname, 'mockfb');
const W = +(process.argv[2] || 420);
// Sections de nuit dépliées d'office (sinon les cases sont repliées sous « Comment va se passer la nuit ? »).
const IDS = ["tamachag", "khokkutsai", "ankhbayar", "tengis", "taiga", "inkaraa", "khubunjin", "ogloo", "javkhaanhun", "shiruun", "djokhodthai", "buyan", "cheyenne", "taivan", "altan", "henbilee", "shuna", "oldaghar", "nehsundheigei", "boroo", "reaksa", "davaajav", "tsewang"];
const ok = (cond, label) => { console.log((cond ? '  ok  ' : '  ÉCHEC ') + label); if (!cond) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
  await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ body: fs.readFileSync(path.join(MOCK, r.request().url().split('/').pop())), contentType: 'application/javascript' }));
  await ctx.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route('**fonts.gstatic.com**', r => r.fulfill({ body: '' }));
  const errs = [];
  // Base de départ : l'admin et deux joueuses invités (comme dans la console Firebase).
  const seed = { 'access/nono@test.fr': { player: 'nono', role: 'admin' }, 'access/jynette@test.fr': { player: 'jynette', role: 'joueur' },
    'access/eden@test.fr': { player: 'eden', role: 'joueur' } };
  const open = async (name, email, first = false) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); });
    await p.addInitScript(([n, e, s, IDS]) => { try { localStorage.setItem('rp-night-open', JSON.stringify(IDS.flatMap(i => [i + ':data-next-night', i + ':data-prev-night']))); } catch {} window.name = n; window.MOCK_EMAIL = e; window.MOCK_WRITES = []; if (s && !localStorage.getItem('mockdb')) localStorage.setItem('mockdb', JSON.stringify(s)); }, [name, email, first ? seed : null, IDS]);
    await p.goto('http://localhost:8765/'); await p.waitForTimeout(400);
    await p.click('#login-btn'); await p.waitForTimeout(1200);
    return p;
  };
  const db = p => p.evaluate(() => JSON.parse(localStorage.getItem('mockdb')));

  console.log('Admin (Nono)');
  const nono = await open('nono', 'nono@test.fr', true);
  ok(await nono.isHidden('#login'), 'connexion réussie');
  ok((await nono.textContent('.session')).includes('Nono'), 'session : Nono');
  ok(await nono.locator('.grid .card').count() === 23, '23 cartes sur l\'accueil');
  ok((await nono.textContent('#view header .kicker')).includes('Iloh Khurdan'), 'nom de l\'appli sur l\'accueil');
  ok(await nono.locator('#nav-players button').count() === 7, 'filtre par joueur : Tous + 6 joueurs');
  ok(await nono.locator('#nav-groups button').count() === 3, 'filtre par groupe : Tous, Khurdans, Invités');
  ok(await nono.evaluate(() => document.documentElement.className) === 't-khurdan', 'thème khurdan sur l\'accueil');
  let d = await db(nono);
  ok(Object.keys(d).filter(k => k.startsWith('characters/')).length === 23, 'fiches des 23 personnages créées par l\'admin');
  ok(d['characters/buyan']?.player === 'eden' && d['characters/tsewang']?.player === 'jynette', 'joueurs des fiches repris de la config');
  ok(await nono.locator('.discord-set').count() === 1, 'réglage Discord visible pour l\'admin');
  // Filtre Eden
  await nono.click('#f-eden'); await nono.waitForTimeout(150);
  ok(await nono.locator('.grid .card').count() === 3, 'filtre Eden : 3 personnages');
  await nono.click('#g-invites'); await nono.waitForTimeout(150);
  ok(await nono.locator('.grid .card').count() === 0, 'Eden + Invités : aucun');
  await nono.click('#f-all'); await nono.click('#g-all'); await nono.waitForTimeout(150);

  // Tamachag : journée, nuit chaude avec Taiga, validation
  await nono.evaluate(() => go('tamachag')); await nono.waitForTimeout(200);
  ok((await nono.textContent('#view h1')).includes('Tamachag'), 'fiche de Tamachag');
  ok(await nono.locator('#hot-tamachag').count() === 1, 'case nuit chaude présente (couple)');
  await nono.fill('#mood-tamachag', 'Serein ce matin.'); await nono.dispatchEvent('#mood-tamachag', 'input');
  await nono.click('[data-act="Travail du bois"]'); await nono.waitForTimeout(150);
  await nono.click('#hot-tamachag'); await nono.waitForTimeout(150);
  ok(await nono.isChecked('#protect-tamachag') === false, 'protection proposée');
  await nono.click('#done-tamachag'); await nono.waitForTimeout(1500);
  d = await db(nono);
  const ym = await nono.evaluate(() => RP_APP.ym), day = await nono.evaluate(() => RP_APP.day);
  ok(d[`days/tamachag/months/${ym}`]?.[day]?.mood === 'Serein ce matin.', 'journée de Tamachag enregistrée');
  const news = Object.entries(d).filter(([k]) => k.startsWith('news/')).map(([, v]) => v);
  ok(news.some(n => n.to === 'jynette' && n.from === 'nono'), 'nouvelle pour Jynette (nuit chaude), auteur noté');
  ok(news.every(n => n.to !== 'nono'), 'aucune nouvelle vers soi-même');
  // Confidentialité : la nuit chaude n'est que dans l'espace du couple
  ok(d['couples/taiga-tamachag']?.players?.length === 2, 'espace du couple Taiga & Tamachag créé (2 joueurs)');
  ok(Object.keys(d).filter(k => /^couples\/[^/]+$/.test(k)).length === 4, '4 espaces de couple créés');
  ok(d[`couples/taiga-tamachag/months/${ym}`]?.[day]?.nights?.tamachag?.hot === true, 'nuit chaude rangée dans l\'espace du couple');
  ok(!JSON.stringify(Object.entries(d).filter(([k]) => k.startsWith('shared/') || k.startsWith('days/') || k.startsWith('today/'))).includes('"hot"'),
    'aucune nuit chaude dans les données lues par tout le groupe');
  // Amant : un autre personnage du groupe est refusé, un PNJ accepté
  await nono.evaluate(() => go('tamachag')); await nono.waitForTimeout(200);
  await nono.click('#edit-tamachag'); await nono.waitForTimeout(300);
  await nono.fill('#lover-new-tamachag', 'Ogloo'); await nono.click('#lover-add-tamachag'); await nono.waitForTimeout(150);
  ok((await nono.textContent('#view')).includes('seul un PNJ'), 'un personnage du groupe ne peut pas être ajouté comme amant');
  await nono.fill('#lover-new-tamachag', 'Une voyageuse'); await nono.click('#lover-add-tamachag'); await nono.waitForTimeout(900);
  d = await db(nono);
  ok(JSON.stringify(d['couples/taiga-tamachag/state/main'] || {}).includes('Une voyageuse'), 'amant PNJ rangé dans l\'espace du couple');
  ok(!JSON.stringify(d['shared/global'] || {}).includes('Une voyageuse'), 'amant absent des données partagées');
  // Tengis : pas de couple → pas de nuit chaude
  await nono.evaluate(() => go('tengis')); await nono.waitForTimeout(200);
  ok(await nono.locator('#hot-tengis').count() === 0, 'pas de nuit chaude pour Tengis (hors couple)');
  ok(await nono.locator('text=Vie intime').count() === 0, 'plus de section Vie intime');

  console.log('Joueuse (Jynette)');
  const jy = await open('jynette', 'jynette@test.fr');
  ok((await jy.textContent('.session')).includes('Jynette'), 'session : Jynette');
  ok(await jy.locator('.discord-set').count() === 0, 'pas de réglage Discord (pas admin)');
  ok((await jy.textContent('.news')).match(/Taiga|Tamachag/) !== null, 'Jynette voit la nouvelle de la nuit');
  await jy.evaluate(() => go('taiga')); await jy.waitForTimeout(200);
  ok((await jy.textContent('#view')).includes('Nuit chaude'), 'Taiga : nuit chaude reportée depuis la fiche de Tamachag');
  ok(await jy.locator('text=Monsieur se protège').count() === 0, 'Taiga : pas de case « Monsieur se protège » (fiche féminine)');

  console.log('Joueuse (Eden)');
  const ed = await open('eden', 'eden@test.fr');
  await ed.evaluate(() => go('tamachag')); await ed.waitForTimeout(200);
  ok((await ed.textContent('#view')).includes('lecture seule'), 'Eden lit Tamachag en lecture seule');
  await ed.evaluate(() => go('buyan')); await ed.waitForTimeout(200);
  ok(await ed.locator('#mood-buyan').count() === 1, 'Eden remplit Buyan');
  ok(await ed.locator('#hot-buyan').count() === 0, 'pas de nuit chaude pour Buyan');
  ok((await ed.textContent('#view h1')).includes('Buyan'), 'nom de Buyan');
  await ed.evaluate(() => go('tamachag')); await ed.waitForTimeout(200);
  ok(!(await ed.textContent('#view')).includes('Nuit chaude'), 'Eden ne voit pas la nuit chaude de Tamachag');
  ok(await ed.evaluate(() => Object.keys(nightsBy).length) === 0, 'aucune nuit chaude chargée chez Eden');

  console.log('Compte non invité');
  const x = await open('x', 'inconnu@test.fr');
  ok((await x.textContent('#login-msg')).includes("n'a pas accès"), 'accès refusé à une adresse non invitée');

  console.log('Erreurs JavaScript :', errs.length); [...new Set(errs)].forEach(e => console.log('   ', e));
  if (errs.length) process.exitCode = 1;
  await b.close();
})();
