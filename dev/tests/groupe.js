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
    const pg = req.frame().page(), body = (req.postDataBuffer() || Buffer.from('')).toString('latin1');
    const pj = body.match(/name="payload_json"\r\n\r\n([\s\S]*?)\r\n--/); const payload = pj ? JSON.parse(Buffer.from(pj[1], 'latin1').toString('utf8')) : {};
    const dom = await pg.evaluate(() => document.querySelector('#view .recap')?.textContent || '');
    // Texte de chaque fiche photographiée pour ce message (noté au moment de la capture)
    const caps = await pg.evaluate(() => (window.__captures || []).splice(0));
    posts.push(Object.assign(new String(dom + ' ' + caps.join(' ')), { method: req.method(), files: (body.match(/filename="recap/g) || []).length,
      titles: (payload.embeds || []).map(e => e.title), caps }));
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
    [`days/tamachag/months/${ym}`]: { [day]: { mood: 'Recopié de Journée RP.', done: true, checked: { $set: ['Travail du bois', 'Contrat de chasse'] }, nightStates: { $set: ['Cauchemar'] } } },
    [`days/tengis/months/${ym}`]: { [day]: { mood: 'Tengis aussi.', done: true } },
    [`couples/taiga-tamachag/months/${ym}`]: { [day]: { nights: { tamachag: { hot: true, with: 'taiga' }, taiga: { hot: true, with: 'tamachag' } } } } };
  const open = async (name, email, first = false) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); });
    await p.addInitScript(() => {
      // Note le texte de chaque récap au moment où il est photographié pour Discord.
      window.__captures = [];
      new MutationObserver(ms => ms.forEach(m => { if (m.target.classList?.contains('capturing')) window.__captures.push(m.target.textContent); }))
        .observe(document, { attributes: true, attributeFilter: ['class'], subtree: true });
    });
    await p.addInitScript(([n, e, s, IDS]) => { try { localStorage.setItem('rp-night-open', JSON.stringify(IDS.flatMap(i => [i + ':data-next-night', i + ':data-prev-night']))); } catch {} window.name = n; window.MOCK_EMAIL = e; window.MOCK_WRITES = []; if (s && !localStorage.getItem('mockdb')) localStorage.setItem('mockdb', JSON.stringify(s)); }, [name, email, first ? seed : null, IDS]);
    await p.goto('http://localhost:8765/'); await p.waitForTimeout(400);
    if (await p.isVisible('#login-btn')) await p.click('#login-btn');   // session déjà ouverte : pas de bouton
    await p.waitForTimeout(1200);
    // « Mise à jour des fiches » : l'appli rend la main une fois les fiches recopiées envoyées
    await p.waitForFunction(() => !document.getElementById('mirror-update'), null, { timeout: 60000 }); await p.waitForTimeout(300);
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
  const mir = () => posts.filter(t => t.titles?.length && t.method === 'POST');
  ok(mir().length === 1, 'fiches recopiées : un seul message Discord à l\'ouverture');
  ok(mir()[0]?.files === 2 && mir()[0].titles.some(t => t.includes('Tamachag')) && mir()[0].titles.some(t => t.includes('Tengis')), 'le message contient les 2 fiches (Tamachag et Tengis), une image chacune');
  ok(mir()[0]?.caps.length === 2 && mir()[0].caps.every(t => !t.includes('Nuit chaude')), 'aucune image avec la nuit chaude, même ouverte par un joueur du couple');
  ok(mir()[0]?.caps.every(t => !/Nuit (à venir|précédente)/.test(t)), 'ni nuit à venir ni nuit précédente dans les images');
  ok(await nono.locator('#mirror-update').count() === 0, 'écran « Mise à jour des fiches » refermé');
  d = await db(nono);
  ok(!!d[`shared/recaps-${ym}-${String(rp.getDate()).padStart(2, '0')}`]?._batch?.msg, 'envoi noté (verrou partagé)');
  ok((await nono.textContent('#view header .kicker')).includes('Iloh Khurdan'), 'retour à l\'écran d\'avant après l\'envoi');
  // Relance de l'appli (et reprise automatique) : pas de nouvel envoi sans changement
  await nono.evaluate(() => go('tamachag')); await nono.waitForTimeout(300); await nono.evaluate(() => go('home'));
  await nono.evaluate(() => window.RP_DISCORD.sendMirrors()); await nono.waitForTimeout(2500);
  const nono2 = await open('nono', 'nono@test.fr'); await nono2.waitForTimeout(3500); await nono2.close();
  ok(mir().length === 1 && !posts.some(t => t.method === 'PATCH'), 'relance de l\'appli : rien n\'est renvoyé');
  // Filtre Eden
  await nono.click('#f-eden'); await nono.waitForTimeout(150);
  ok(await nono.locator('.grid .card').count() === 3, 'filtre Eden : 3 personnages');
  await nono.click('#g-invites'); await nono.waitForTimeout(150);
  ok(await nono.locator('.grid .card').count() === 0, 'Eden + Invités : aucun');
  await nono.click('#f-all'); await nono.click('#g-all'); await nono.waitForTimeout(150);

  // Tamachag : fiche recopiée de Journée RP → lecture seule, même pour Nono
  await nono.evaluate(() => go('tamachag')); await nono.waitForTimeout(200);
  ok((await nono.textContent('#view h1')).includes('Tamachag'), 'fiche de Tamachag');
  ok((await nono.textContent('#view')).includes('Cauchemar'), 'le joueur du personnage voit ses lignes de nuit');
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
  // Activité commune : plusieurs personnages sur une même activité
  await sh.evaluate(() => { C.find(x => x.id === 'oldaghar').acts.quotidien = ['Chasse au faucon']; go('oldaghar'); }); await sh.waitForTimeout(150);
  const act = await sh.evaluate(() => [...document.querySelectorAll('#view [data-act]')].map(x => x.dataset.act).find(l => l !== 'Voyage' && l !== 'Contrat de chasse'));
  await sh.click(`[data-act="${act}"]`); await sh.waitForTimeout(150);
  const y0 = await sh.evaluate(() => scrollY);
  await sh.click(`details[data-with-fold="${act}"] summary`); await sh.waitForTimeout(100);
  for (const w of ['buyan', 'tengis', 'shuna']) { await sh.click(`[data-share-act="${act}"][data-share="${w}"]`); await sh.waitForTimeout(120); }
  await sh.click(`[data-share-act="${act}"][data-share="tengis"]`); await sh.waitForTimeout(150);
  ok(Math.abs(await sh.evaluate(() => scrollY) - y0) < 5, 'choisir des personnages ne fait pas sauter la page');
  ok(await sh.isVisible(`[data-share-act="${act}"][data-share="buyan"]`), 'le sélecteur reste ouvert après un choix');
  ok((await sh.textContent(`details[data-with-fold="${act}"] summary`)).includes('Avec Buyan et Shuna'), 'résumé : « Avec Buyan et Shuna »');
  ok(await sh.locator(`[data-share-act="${act}"][data-share="oldaghar"]`).count() === 0, 'on ne peut pas se choisir soi-même');
  ok(await sh.evaluate(() => NEWS.filter(n => n.key.startsWith('with:')).length) === 1, 'une seule nouvelle en attente : Eden (Buyan) ; ni Tengis retiré, ni Shuna (même joueuse)');
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
  ok(news.some(n => n.to === 'eden' && n.charId === 'buyan' && n.text.includes('Oldaghar') && n.text.includes(act)), 'activité commune : nouvelle pour Eden (Buyan)');
  ok(!news.some(n => n.key?.startsWith('with:') && n.to !== 'eden'), 'aucune nouvelle d\'activité pour Nono (Tengis retiré) ni pour Sheyla');
  ok(JSON.stringify(d[`days/oldaghar/months/${ym}`]?.[day]?.withActs?.[act]) === '["buyan","shuna"]', 'personnages de l\'activité enregistrés');
  ok(old[0]?.includes(act + ' avec Buyan et Shuna'), 'récap et image Discord : « avec Buyan et Shuna »');
  // Confidentialité : la nuit chaude n'est que dans l'espace du couple
  ok(d['couples/oldaghar-reaksa']?.players?.length === 2, 'espace du couple Oldaghar & Reaksa créé (2 joueurs)');
  ok(Object.keys(d).filter(k => /^couples\/[^/]+$/.test(k)).length === 4, '4 espaces de couple créés');
  ok(d[`couples/oldaghar-reaksa/months/${ym}`]?.[day]?.nights?.oldaghar?.hot === true, 'nuit chaude rangée dans l\'espace du couple');
  ok(JSON.stringify(d['couples/oldaghar-reaksa/state/main'] || {}).includes('Une voyageuse'), 'amant PNJ rangé dans l\'espace du couple');
  ok(!JSON.stringify(Object.entries(d).filter(([k]) => k.startsWith('shared/') || k.startsWith('days/') || k.startsWith('today/'))).match(/"hot"|Une voyageuse/),
    'ni nuit chaude ni amant dans les données lues par tout le groupe');

  console.log('Événement du groupe (Nono)');
  await nono.evaluate(() => go('home')); await nono.waitForTimeout(200);
  ok((await nono.textContent('.group-events h2')).includes('Événements sur l\'Iloh'), 'titre « Événements sur l\'Iloh »');
  ok((await nono.textContent('.group-events')).includes('Aucun événement'), 'aucun événement au départ');
  await nono.click('.ev-new summary'); await nono.click('[data-ev-type="chasse"]');
  await nono.fill('#ev-text', 'Inscrivez-vous'); await nono.click('#ev-add'); await nono.waitForTimeout(1500);
  ok((await nono.textContent('.group-events')).includes('Grand événement de chasse') && (await nono.textContent('.group-events')).includes('Inscrivez-vous'), 'annonce affichée sur l\'accueil');
  d = await db(nono);
  const evs = Object.values(d['shared/events'] || {});
  ok(evs.length === 1 && evs[0].by === 'nono' && evs[0].type === 'chasse', 'annonce enregistrée pour tout le groupe');
  const evNews = Object.values(d).filter(v => v?.key?.startsWith?.('event:'));
  ok(evNews.length === 5 && evNews.every(n => n.from === 'nono' && n.to !== 'nono' && n.text === 'Grand événement de chasse : Inscrivez-vous'), 'une nouvelle pour chacun des 5 autres joueurs');
  ok(await nono.locator('[data-ev-del]').count() === 1, 'l\'auteur peut retirer son annonce');
  // Calendrier : annonce datée dans 3 jours depuis la page du calendrier
  await nono.click('.ev-cal-btn'); await nono.waitForTimeout(200);
  ok((await nono.textContent('#view h1')).includes('Événements sur l\'Iloh') && await nono.locator('.cal .cal-day').count() >= 28, 'icône calendrier : page du calendrier');
  ok(await nono.locator('.cal-day.today.ev-day').count() === 1, 'le jour de l\'annonce est marqué');
  const later = await nono.evaluate(() => { const d = new Date(rpDay); d.setDate(d.getDate() + 3); return isoDay(d); });
  await nono.evaluate(() => { const d = new Date(rpDay); d.setDate(d.getDate() + 3); if (d.getMonth() !== rpDay.getMonth()) document.querySelector('[data-ev-month="1"]').click(); });
  await nono.click(`[data-ev-day="${later}"]`); await nono.waitForTimeout(100);
  ok((await nono.textContent('.day-detail')).includes('Aucun événement'), 'jour sans événement');
  ok(await nono.inputValue('#ev-date') === later, 'formulaire prérempli avec le jour choisi');
  await nono.click('.ev-new summary'); await nono.click('[data-ev-type="fete"]'); await nono.fill('#ev-text', 'Naadam');
  await nono.waitForTimeout(800); await nono.hover('#ev-add'); await nono.waitForTimeout(100);   // (après le garde-fou de position)
  const y1 = await nono.evaluate(() => scrollY);
  await nono.click('#ev-add'); await nono.waitForTimeout(1200);
  ok((await nono.textContent('.day-detail')).includes('Naadam'), 'annonce affichée sous le jour choisi');
  ok(Math.abs(await nono.evaluate(() => scrollY) - y1) < 40, 'la page ne saute pas');
  d = await db(nono);
  ok(Object.values(d['shared/events']).some(e => e.text === 'Naadam' && e.date === later), 'date enregistrée');
  ok(Object.values(d).some(v => v?.key?.startsWith?.('event:') && v.text.startsWith('Fête ou rassemblement : Naadam (le ')), 'nouvelle avec la date de l\'événement');
  await nono.click('[data-go="home"]'); await nono.waitForTimeout(150);
  ok((await nono.textContent('.group-events')).includes('Naadam'), 'événement à venir aussi sur l\'accueil');

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
  await jy.evaluate(() => go('tamachag')); await jy.waitForTimeout(200);
  ok((await jy.textContent('#view')).includes('Cauchemar'), 'la joueuse du couple voit les lignes de nuit de Tamachag');
  await jy.evaluate(() => go('shiruun')); await jy.waitForTimeout(200);
  ok(await jy.locator('#mood-shiruun').count() === 1, 'Shiruun (absent de Journée RP) se remplit dans Iloh');

  console.log('Joueuse (Eden)');
  const before = posts.length;
  const ed = await open('eden', 'eden@test.fr');
  ok((await ed.textContent('.news')).includes('a noté'), 'Eden voit la nouvelle de l\'activité commune');
  ok((await ed.textContent('.news')).includes('Grand événement de chasse : Inscrivez-vous'), 'Eden reçoit la nouvelle de l\'événement');
  ok((await ed.textContent('.group-events')).toLowerCase().includes('annoncé par nono'), 'Eden voit l\'annonce sur l\'accueil');
  ok(await ed.locator('[data-ev-del]').count() === 0, 'Eden ne peut pas retirer l\'annonce de Nono');
  await ed.evaluate(() => go('buyan')); await ed.waitForTimeout(200);
  ok((await ed.textContent('.shared-acts')).includes('Oldaghar a noté « Chasse au faucon » avec Buyan et Shuna'), 'fiche de Buyan : activité commune notée par Oldaghar');
  await ed.click('[data-join-from="oldaghar"]'); await ed.waitForTimeout(200);
  ok(await ed.evaluate(() => state.buyan.checked.has('Chasse au faucon') && state.buyan.specials.includes('Chasse au faucon')), 'activité ajoutée à la fiche de Buyan (activité spéciale du jour)');
  ok(await ed.evaluate(() => JSON.stringify(state.buyan.withActs['Chasse au faucon'])) === '["oldaghar","shuna"]', 'avec Oldaghar et Shuna');
  ok(await ed.evaluate(() => NEWS.filter(n => n.key.startsWith('with:') && n.to === 'sheyla').length) === 1, 'une seule nouvelle pour Sheyla (Oldaghar et Shuna sont à elle)');
  ok((await ed.textContent('.shared-acts')).includes('Sur la fiche'), 'repère « Sur la fiche » à la place du bouton');
  await ed.evaluate(() => go('buyan')); await ed.waitForTimeout(200);
  ok(await ed.locator('#mood-buyan').count() === 1, 'Eden remplit Buyan');
  ok(await ed.locator('#hot-buyan').count() === 0, 'pas de nuit chaude pour Buyan');
  ok((await ed.textContent('#view h1')).includes('Buyan'), 'nom de Buyan');
  await ed.evaluate(() => go('oldaghar')); await ed.waitForTimeout(200);
  ok((await ed.textContent('#view')).includes('lecture seule'), 'Eden lit Oldaghar en lecture seule');
  ok(!(await ed.textContent('#view')).includes('Nuit chaude'), 'Eden ne voit pas la nuit chaude d\'Oldaghar');
  await ed.evaluate(() => go('taiga')); await ed.waitForTimeout(200);
  ok(!(await ed.textContent('#view')).includes('Nuit chaude'), 'Eden ne voit pas la nuit chaude de Taiga');
  await ed.evaluate(() => go('tamachag')); await ed.waitForTimeout(200);
  ok(!/Cauchemar|Nuit (à venir|précédente)/.test(await ed.textContent('#view')), 'Eden ne voit aucune ligne de nuit sur la fiche de Tamachag');
  await ed.evaluate(() => { const c = C.find(x => x.id === 'tamachag'); state.tamachag.view = 'history'; go('tamachag'); }); await ed.waitForTimeout(300);
  ok(!/Cauchemar|Nuit chaude/.test(await ed.textContent('#view')), 'ni dans son historique');
  ok(await ed.evaluate(() => Object.keys(nightsBy).length) === 0, 'aucune nuit chaude chargée chez Eden');
  await ed.waitForTimeout(2500);
  ok(posts.length === before, 'pas de second envoi des fiches recopiées (verrou)');

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
