// Nuit chaude de Davaajav (invité) avec Taiga, recopiée de Journée RP : jamais sur les images Discord envoyées par Iloh.
// Les données de départ sont celles qu'écrit le service de recopie (vps/miroir, testé dans test-miroir.js).
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/davaajav.js [largeur]
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
    // Telles que recopiées : fiches sans nuit ni activité intime ; la nuit de Taiga avec Davaajav dans l'espace du couple Taiga-Tamachag.
    [`days/davaajav/months/${ym}`]: { [day]: { mood: 'Invité comblé', done: true, checked: { $set: ['Travail du bois'] }, slots: {}, nightNotes: {} } },
    [`days/taiga/months/${ym}`]: { [day]: { mood: 'Rêveuse', done: true, checked: { $set: [] }, nightNotes: {} } },
    [`couples/taiga-tamachag/months/${ym}`]: { [day]: { nights: { taiga: { hot: true, with: 'davaajav' } } },
      [String(rp.getDate() - 1 || 1)]: { nights: { taiga: { hot: true, with: 'davaajav' } } } } };
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

  // Nono joue Davaajav ET Tamachag (couple Taiga-Tamachag) : il voit la nuit dans l'appli, c'est le cas le plus exposé.
  console.log('Nono ouvre Iloh (envoi des fiches recopiées sur Discord)');
  const nono = await open('nono', 'nono@test.fr', true);
  await nono.evaluate(() => go('taiga')); await nono.waitForTimeout(300);
  ok((await nono.textContent('#view')).includes('Nuit chaude'), 'dans l\'appli, Nono (joueur du couple) voit la nuit chaude de Taiga');
  const sent = posts.filter(t => t.titles?.length && t.method === 'POST');
  const caps = sent.flatMap(t => t.caps);
  ok(sent.length >= 1 && caps.length === 2, 'images Discord envoyées pour Davaajav et Taiga');
  const dav = caps.find(t => t.includes('Invité comblé')), tai = caps.find(t => t.includes('Rêveuse'));
  ok(!!dav && !!tai, 'une image par fiche');
  ok(!/nuit chaude|Sexe avec|Taiga/i.test(dav), 'image de Davaajav : ni nuit chaude ni mention de Taiga');
  ok(!/nuit chaude|Sexe avec|Davaajav/i.test(tai), 'image de Taiga : ni nuit chaude ni mention de Davaajav');
  ok(caps.every(t => !/Nuit (à venir|précédente)/.test(t)), 'ni nuit à venir ni nuit précédente');
  // Fiche validée de nouveau (modification dans Journée RP) : l'image remplacée reste propre
  await nono.evaluate(([ym, day]) => { const m = JSON.parse(localStorage.getItem('mockdb')); m[`days/davaajav/months/${ym}`][day].mood = 'Invité comblé, encore'; localStorage.setItem('mockdb', JSON.stringify(m)); }, [ym, day]);
  const n2 = await open('nono', 'nono@test.fr');
  const later = posts.filter(t => t.method === 'PATCH' || t.method === 'POST').flatMap(t => t.caps).filter(t => t.includes('encore'));
  ok(later.length >= 1 && later.every(t => !/nuit chaude|Taiga/i.test(t)), 'fiche revalidée : nouvelle image sans la nuit');
  await n2.close();
  console.log(errs.length ? 'Erreurs JavaScript :\n' + errs.join('\n') : 'Erreurs JavaScript : 0');
  await b.close();
})();
