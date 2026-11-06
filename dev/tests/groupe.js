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
  // Bibliothèque d'image servie en local, webhook Discord simulé (on note ce que montre la fiche au moment de l'envoi)
  const H2I = path.join(require.resolve('html-to-image/package.json'), '..', 'dist', 'html-to-image.js');
  await ctx.route('https://cdn.jsdelivr.net/npm/html-to-image@*/**', r => r.fulfill({ body: fs.readFileSync(H2I), contentType: 'application/javascript' }));
  const posts = [];
  await ctx.route('https://discord.com/api/webhooks/**', async (r, req) => {
    if (req.method() === 'GET') return r.fulfill({ status: 200, body: '{}' });
    const pg = req.frame().page(); posts.push(await pg.evaluate(() => document.querySelector('#view .recap')?.textContent || ''));
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'm' + posts.length }) });
  });
  const errs = [];
  // Journée RP en cours (elle commence à 5 h), comme dans l'appli.
  const rp = new Date(Date.now() - 5 * 3600e3), ym = `${rp.getFullYear()}-${String(rp.getMonth() + 1).padStart(2, '0')}`, day = String(rp.getDate());
  // Base de départ : l'admin et deux joueuses invités (comme dans la console Firebase).
  const seed = { 'access/nono@test.fr': { player: 'nono', role: 'admin' }, 'access/jynette@test.fr': { player: 'jynette', role: 'joueur' },
    'access/eden@test.fr': { player: 'eden', role: 'joueur' }, 'access/sheyla@test.fr': { player: 'sheyla', role: 'joueur' },
    'access/idriss@test.fr': { player: 'idriss', role: 'joueur' },
    'shared/discord': { webhook: 'https://discord.com/api/webhooks/1/test' },
    // « Contrat de chasse » coché sans contrat en cours : l'affichage le retire (cas qui faisait renvoyer la fiche à chaque lancement)
    [`days/tamachag/months/${ym}`]: { [day]: { mood: 'Recopié de Journée RP.', done: true, checked: { $set: ['Travail du bois', 'Contrat de chasse'] } } },
    [`couples/taiga-tamachag/months/${ym}`]: { [day]: { nights: { tamachag: { hot: true, with: 'taiga' }, taiga: { hot: true, with: 'tamachag' } } } } };
  const open = async (name, email, first = false) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); });
    await p.addInitScript(([n, e, s, IDS]) => { try { localStorage.setItem('rp-night-open', JSON.stringify(IDS.flatMap(i => [i + ':data-next-night', i + ':data-prev-night']))); } catch {} window.name = n; window.MOCK_EMAIL = e; window.MOCK_WRITES = []; if (s && !localStorage.getItem('mockdb')) localStorage.setItem('mockdb', JSON.stringify(s)); }, [name, email, first ? seed : null, IDS]);
    await p.goto('http://localhost:8765/'); await p.waitForTimeout(400);
    if (await p.isVisible('#login-btn')) await p.click('#login-btn');   // session déjà ouverte : pas de bouton
    await p.waitForTimeout(1200);
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
  await nono.waitForTimeout(3500);
  const tam = posts.filter(t => t.includes('Recopié de Journée RP.'));
  ok(tam.length === 1, 'fiche recopiée de Tamachag envoyée sur le salon commun à l\'ouverture');
  ok(!tam[0]?.includes('Nuit chaude'), 'sans la nuit chaude, même ouverte par un joueur du couple');
  ok(!/Nuit (à venir|précédente)/.test(tam[0] || ''), 'ni nuit à venir ni nuit précédente dans l\'image');
  d = await db(nono);
  ok(!!d[`shared/recaps-${ym}-${String(rp.getDate()).padStart(2, '0')}`]?.tamachag?.msg, 'envoi noté (verrou partagé)');
  ok((await nono.textContent('#view header .kicker')).includes('Iloh Khurdan'), 'retour à l\'écran d\'avant après l\'envoi');
  // Relance de l'appli (et reprise automatique) : pas de nouvel envoi sans changement
  await nono.evaluate(() => go('tamachag')); await nono.waitForTimeout(300); await nono.evaluate(() => go('home'));
  await nono.evaluate(() => window.RP_DISCORD.sendMirrors()); await nono.waitForTimeout(2500);
  const nono2 = await open('nono', 'nono@test.fr'); await nono2.waitForTimeout(3500); await nono2.close();
  ok(posts.filter(t => t.includes('Recopié de Journée RP.')).length === 1, 'relance de l\'appli : la fiche n\'est pas renvoyée');
  // Filtre Eden
  await nono.click('#f-eden'); await nono.waitForTimeout(150);
  ok(await nono.locator('.grid .card').count() === 3, 'filtre Eden : 3 personnages');
  await nono.click('#g-invites'); await nono.waitForTimeout(150);
  ok(await nono.locator('.grid .card').count() === 0, 'Eden + Invités : aucun');
  await nono.click('#f-all'); await nono.click('#g-all'); await nono.waitForTimeout(150);

  // Tamachag : fiche recopiée de Journée RP → lecture seule, même pour Nono
  await nono.evaluate(() => go('tamachag')); await nono.waitForTimeout(200);
  ok((await nono.textContent('#view h1')).includes('Tamachag'), 'fiche de Tamachag');
  ok(await nono.locator('#mood-tamachag').count() === 0 && (await nono.textContent('#view')).includes('Journée RP'), 'Tamachag en lecture seule (tenu dans Journée RP)');
  // Tengis : pas de couple → pas de nuit chaude ; Vie intime absente
  ok(await nono.locator('#hot-tengis').count() === 0, 'pas de nuit chaude pour Tengis (hors couple)');
  ok(await nono.locator('text=Vie intime').count() === 0, 'plus de section Vie intime');

  console.log('Joueuse (Sheyla) : couple Oldaghar & Reaksa');
  const sh = await open('sheyla', 'sheyla@test.fr');
  await sh.evaluate(() => go('oldaghar')); await sh.waitForTimeout(200);
  ok(await sh.locator('#hot-oldaghar').count() === 1, 'case nuit chaude présente (couple)');
  await sh.fill('#mood-oldaghar', 'Serein ce matin.'); await sh.dispatchEvent('#mood-oldaghar', 'input');
  await sh.click('#hot-oldaghar'); await sh.waitForTimeout(150);
  ok(await sh.isChecked('#protect-oldaghar') === false, 'protection proposée');
  // Amant : un autre personnage du groupe est refusé, un PNJ accepté
  await sh.fill('#lover-new-oldaghar', 'Ogloo'); await sh.click('#lover-add-oldaghar'); await sh.waitForTimeout(150);
  ok((await sh.textContent('#view')).includes('seul un PNJ'), 'un personnage du groupe ne peut pas être ajouté comme amant');
  await sh.fill('#lover-new-oldaghar', 'Une voyageuse'); await sh.click('#lover-add-oldaghar'); await sh.waitForTimeout(300);
  await sh.click('#done-oldaghar'); await sh.waitForTimeout(1500);
  d = await db(sh);
  ok(d[`days/oldaghar/months/${ym}`]?.[day]?.mood === 'Serein ce matin.', 'journée d\'Oldaghar enregistrée');
  const old = posts.filter(t => t.includes('Serein ce matin.'));
  ok(!/Nuit (à venir|précédente)/.test(old[0] || ''), 'image d\'Oldaghar : ni nuit à venir ni nuit précédente');
  ok(old.length === 1, 'récap d\'Oldaghar envoyé sur le salon commun');
  ok(!old[0].includes('Nuit chaude') && !old[0].includes('voyageuse'), 'image Discord sans nuit chaude, même envoyée par la joueuse du couple');
  await sh.waitForTimeout(300);
  ok((await sh.textContent('#view')).includes('Nuit chaude'), 'après l\'envoi, Sheyla revoit la nuit chaude dans l\'appli');
  const news = Object.entries(d).filter(([k]) => k.startsWith('news/')).map(([, v]) => v);
  ok(news.some(n => n.to === 'idriss' && n.from === 'sheyla'), 'nouvelle pour Idriss (nuit chaude), auteur noté');
  ok(news.every(n => n.to !== n.from), 'aucune nouvelle vers soi-même');
  // Confidentialité : la nuit chaude n'est que dans l'espace du couple
  ok(d['couples/oldaghar-reaksa']?.players?.length === 2, 'espace du couple Oldaghar & Reaksa créé (2 joueurs)');
  ok(Object.keys(d).filter(k => /^couples\/[^/]+$/.test(k)).length === 4, '4 espaces de couple créés');
  ok(d[`couples/oldaghar-reaksa/months/${ym}`]?.[day]?.nights?.oldaghar?.hot === true, 'nuit chaude rangée dans l\'espace du couple');
  ok(JSON.stringify(d['couples/oldaghar-reaksa/state/main'] || {}).includes('Une voyageuse'), 'amant PNJ rangé dans l\'espace du couple');
  ok(!JSON.stringify(Object.entries(d).filter(([k]) => k.startsWith('shared/') || k.startsWith('days/') || k.startsWith('today/'))).match(/"hot"|Une voyageuse/),
    'ni nuit chaude ni amant dans les données lues par tout le groupe');

  console.log('Joueur (Idriss)');
  const idr = await open('idriss', 'idriss@test.fr');
  ok((await idr.textContent('.news')).match(/Reaksa|Oldaghar/) !== null, 'Idriss voit la nouvelle de la nuit');
  await idr.evaluate(() => go('reaksa')); await idr.waitForTimeout(200);
  ok((await idr.textContent('#view')).includes('Nuit chaude'), 'Reaksa : nuit chaude reportée depuis la fiche d\'Oldaghar');
  ok(await idr.locator('text=Monsieur se protège').count() === 0, 'Reaksa : pas de case « Monsieur se protège » (fiche féminine)');

  console.log('Joueuse (Jynette) : couple recopié de Journée RP');
  const jy = await open('jynette', 'jynette@test.fr');
  ok((await jy.textContent('.session')).includes('Jynette'), 'session : Jynette');
  ok(await jy.locator('.discord-set').count() === 0, 'pas de réglage Discord (pas admin)');
  await jy.evaluate(() => go('taiga')); await jy.waitForTimeout(200);
  ok((await jy.textContent('#view')).includes('Nuit chaude'), 'Taiga : nuit chaude recopiée visible pour Jynette');
  await jy.evaluate(() => go('shiruun')); await jy.waitForTimeout(200);
  ok(await jy.locator('#mood-shiruun').count() === 1, 'Shiruun (absent de Journée RP) se remplit dans Iloh');

  console.log('Joueuse (Eden)');
  const before = posts.filter(t => t.includes('Recopié de Journée RP.')).length;
  const ed = await open('eden', 'eden@test.fr');
  await ed.evaluate(() => go('buyan')); await ed.waitForTimeout(200);
  ok(await ed.locator('#mood-buyan').count() === 1, 'Eden remplit Buyan');
  ok(await ed.locator('#hot-buyan').count() === 0, 'pas de nuit chaude pour Buyan');
  ok((await ed.textContent('#view h1')).includes('Buyan'), 'nom de Buyan');
  await ed.evaluate(() => go('oldaghar')); await ed.waitForTimeout(200);
  ok((await ed.textContent('#view')).includes('lecture seule'), 'Eden lit Oldaghar en lecture seule');
  ok(!(await ed.textContent('#view')).includes('Nuit chaude'), 'Eden ne voit pas la nuit chaude d\'Oldaghar');
  await ed.evaluate(() => go('taiga')); await ed.waitForTimeout(200);
  ok(!(await ed.textContent('#view')).includes('Nuit chaude'), 'Eden ne voit pas la nuit chaude de Taiga');
  ok(await ed.evaluate(() => Object.keys(nightsBy).length) === 0, 'aucune nuit chaude chargée chez Eden');
  await ed.waitForTimeout(2500);
  ok(posts.filter(t => t.includes('Recopié de Journée RP.')).length === before, 'pas de second envoi de la fiche recopiée (verrou)');

  console.log('Administration');
  ok(await jy.locator('.admin-set').count() === 0, 'pas d\'administration pour une joueuse');
  await nono.evaluate(() => go('home')); await nono.waitForTimeout(400);
  ok(await nono.locator('.admin-set').count() === 1, 'administration visible pour l\'admin');
  await nono.click('.admin-set summary'); await nono.waitForTimeout(200);
  ok(await nono.locator('.admin-row').count() === 6, '6 joueurs listés');
  ok(await nono.locator('#invite-eden').count() === 0 && await nono.locator('#invite-lou').count() === 1, 'Eden déjà invitée, Lou à inviter');
  await nono.fill('#invite-lou', 'pas-une-adresse'); await nono.click('[data-invite="lou"]'); await nono.waitForTimeout(200);
  ok((await nono.textContent('#admin-msg')).includes('ne ressemble pas'), 'adresse invalide refusée');
  await nono.fill('#invite-lou', 'Lou@Test.fr'); await nono.click('[data-invite="lou"]'); await nono.waitForTimeout(600);
  d = await db(nono);
  ok(d['access/lou@test.fr']?.player === 'lou' && d['access/lou@test.fr']?.role === 'joueur', 'accès de Lou créé (adresse en minuscules)');
  ok(d['players/lou']?.name === 'Lou', 'fiche joueur de Lou créée');
  const lou = await open('lou', 'lou@test.fr');
  ok((await lou.textContent('.session')).includes('Lou'), 'Lou se connecte après l\'invitation');
  await nono.click('[data-revoke="lou@test.fr"]'); await nono.waitForTimeout(200);
  await nono.click('[data-revoke-ok="lou@test.fr"]'); await nono.waitForTimeout(600);
  d = await db(nono);
  ok(!d['access/lou@test.fr'], 'accès de Lou retiré');
  const lou2 = await open('lou2', 'lou@test.fr');
  ok((await lou2.textContent('#login-msg')).includes("n'a pas accès"), 'Lou ne peut plus se connecter');
  ok(await nono.locator('[data-revoke="nono@test.fr"]').count() === 0, 'l\'admin ne peut pas retirer son propre accès');

  console.log('Compte non invité');
  const x = await open('x', 'inconnu@test.fr');
  ok((await x.textContent('#login-msg')).includes("n'a pas accès"), 'accès refusé à une adresse non invitée');

  console.log('Erreurs JavaScript :', errs.length); [...new Set(errs)].forEach(e => console.log('   ', e));
  if (errs.length) process.exitCode = 1;
  await b.close();
})();
