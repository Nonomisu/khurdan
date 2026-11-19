// Shagaï d'Henbilee : demande, acceptation (activité sur la fiche), tirage en direct, rejeu unique, confidentialité.
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/shagai.js [largeur]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const MOCK = path.join(__dirname, 'mockfb');
const W = +(process.argv[2] || 420);
const ok = (cond, label) => { console.log((cond ? '  ok  ' : '  ÉCHEC ') + label); if (!cond) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
  await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ body: fs.readFileSync(path.join(MOCK, r.request().url().split('/').pop())), contentType: 'application/javascript' }));
  await ctx.route('**fonts.googleapis.com**', r => r.fulfill({ body: '', contentType: 'text/css' }));
  await ctx.route('**fonts.gstatic.com**', r => r.fulfill({ body: '' }));
  await ctx.route('https://discord.com/api/webhooks/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"m"}' }));
  const errs = [];
  const seed = { 'access/nono@test.fr': { player: 'nono', role: 'admin' }, 'access/jynette@test.fr': { player: 'jynette', role: 'joueur' },
    'access/eden@test.fr': { player: 'eden', role: 'joueur' }, 'access/idriss@test.fr': { player: 'idriss', role: 'joueur' }, 'access/lou@test.fr': { player: 'lou', role: 'joueur' } };
  const open = async (name, email, first = false) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(name + ' console: ' + m.text()); });
    await p.addInitScript(([n, e, s]) => { window.name = n; window.MOCK_EMAIL = e; if (s && !localStorage.getItem('mockdb')) localStorage.setItem('mockdb', JSON.stringify(s)); }, [name, email, first ? seed : null]);
    await p.goto('http://localhost:8765/'); await p.waitForTimeout(400);
    if (await p.isVisible('#login-btn')) await p.click('#login-btn');
    await p.waitForTimeout(1200);
    await p.waitForFunction(() => !document.getElementById('mirror-update'), null, { timeout: 60000 }); await p.waitForTimeout(300);
    return p;
  };
  const db = p => p.evaluate(() => JSON.parse(localStorage.getItem('mockdb')));
  const click = (p, sel) => p.evaluate(s => document.querySelector(s).click(), sel);
  const wide = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const nono = await open('nono', 'nono@test.fr', true);
  const jyn = await open('jynette', 'jynette@test.fr'), lou = await open('lou', 'lou@test.fr'), eden = await open('eden', 'eden@test.fr');
  await nono.close();

  console.log('Demande (Jynette, pour Taiga)');
  await jyn.evaluate(() => go('henbilee')); await jyn.waitForTimeout(300);
  ok(await jyn.locator('.tabs [data-shagai-open]').count() === 1, 'fiche d\'Henbilee : onglet « Shagaï »');
  ok(await eden.evaluate(() => { go('taiga'); return !document.querySelector('.tabs [data-shagai-open]'); }), 'pas d\'onglet sur les autres fiches');
  await click(jyn, '.tabs [data-shagai-open]'); await jyn.waitForTimeout(300);
  ok(await jyn.evaluate(() => current === 'shagai') && (await jyn.textContent('#view h1')).includes('shagaï'), 'page du shagaï');
  await click(jyn, '[data-sh-by="taiga"]'); await jyn.fill('#sh-q', 'La chasse de demain sera-t-elle bonne ?'); await click(jyn, '#sh-ask'); await jyn.waitForTimeout(900);
  let d = await db(jyn); const sid = Object.keys(d).find(k => k.startsWith('shagai/')).split('/')[1];
  ok(d['shagai/' + sid].by === 'taiga' && d['shagai/' + sid].p === 'jynette' && d['shagai/' + sid].status === 'asked', 'demande enregistrée');
  ok(JSON.stringify(d).includes(`shagai:${sid}:ask`) && d[Object.keys(d).find(k => k.includes(`shagai:${sid}:ask`))]?.to === 'lou', 'nouvelle pour le joueur d\'Henbilee');
  ok(await jyn.locator('#sh-ask').count() === 1 && !(await jyn.locator('[data-sh-by="taiga"]').count()), 'Taiga ne peut pas redemander tant que la demande est en cours');

  console.log('Henbilee accepte (Lou)');
  await lou.waitForTimeout(800); await lou.evaluate(() => go('shagai')); await lou.waitForTimeout(300);
  await click(lou, `[data-sh-ok="${sid}"]`); await lou.waitForTimeout(900);
  ok(await lou.evaluate(() => state.henbilee.checked.has('Tirage du shagaï') && JSON.stringify(state.henbilee.withActs?.['Tirage du shagaï']) === '["taiga"]'), 'activité « Tirage du shagaï » avec Taiga sur la fiche d\'Henbilee');
  ok(await lou.locator('[data-sh-throw]').count() === 1 && await lou.locator('[data-sh-model]').count() === 3, 'Lou : choix des osselets et bouton « Lancer »');
  await jyn.waitForTimeout(800);
  ok(await jyn.evaluate(() => myNews().some(n => n.text.includes('Henbilee accepte'))), 'Jynette : nouvelle « Henbilee accepte »');
  await jyn.evaluate(() => go('shagai')); await jyn.waitForTimeout(300);
  ok((await jyn.textContent('#sh-stage')).includes('Reste sur cette page'), 'Jynette : en attente du lancer');

  if (process.env.SHOT) await lou.screenshot({ path: process.env.SHOT + '-pret.png', fullPage: true });
  console.log('Tirage en direct');
  await click(lou, '[data-sh-model="ocre"]'); await lou.waitForTimeout(200);
  await click(lou, `[data-sh-throw="${sid}"]`); await lou.waitForTimeout(400);
  ok(await lou.evaluate(() => document.getElementById('sh-aug').hidden), 'Lou : l\'augure attend la fin de la chute');
  await lou.waitForTimeout(3200);
  ok(await lou.evaluate(() => !document.getElementById('sh-aug').hidden && !!document.querySelector('.sh-aug h3')?.textContent), 'Lou : augure affiché');
  d = await db(lou); const vals = d['shagai/' + sid].vals;
  ok(Array.isArray(vals) && vals.length === 4 && vals.every(v => v >= 0 && v <= 999) && d['shagai/' + sid].model === 'ocre', 'un tirage de 000 à 999 par osselet, modèle enregistré');
  ok(await lou.evaluate(() => [0, 1, 2, 3].every(i => document.getElementById('sh-roll' + i).textContent.includes(String(SHAGAI[shView.focus].vals[i]).padStart(3, '0')))), 'nombres affichés sous les osselets');
  ok(await jyn.evaluate(() => shAnimating || !document.getElementById('sh-aug').hidden), 'Jynette : le tirage joue en direct');
  await jyn.waitForTimeout(3500);
  const augL = await lou.textContent('.sh-aug h3'), augJ = await jyn.textContent('.sh-aug h3');
  ok(augL === augJ, 'même augure des deux côtés (' + augJ + ')');
  d = await db(jyn); ok(d['shagai/' + sid].seen === true, 'tirage marqué comme vu');
  ok(await wide(jyn) && await wide(lou), 'pas de débordement horizontal');

  console.log('Rejeu une seule fois');
  ok(await jyn.evaluate(() => document.getElementById('sh-q').value === ''), 'question effacée après la demande');
  await click(jyn, '.sh-new summary'); await jyn.waitForTimeout(150); await click(jyn, '[data-sh-by="sheyen"]'); await click(jyn, '#sh-ask'); await jyn.waitForTimeout(800);
  await jyn.evaluate(() => go('home')); await jyn.waitForTimeout(200);
  await lou.waitForTimeout(800);
  const sid2 = await lou.evaluate(() => Object.keys(SHAGAI).find(k => SHAGAI[k].by === 'sheyen'));
  await lou.evaluate(() => go('shagai')); await lou.waitForTimeout(200);
  await click(lou, `[data-sh-ok="${sid2}"]`); await lou.waitForTimeout(500); await click(lou, `[data-sh-throw="${sid2}"]`); await lou.waitForTimeout(3800);
  await jyn.waitForTimeout(800);
  ok(await jyn.evaluate(() => myNews().some(n => n.text.includes('a lancé les osselets pour Sheyen'))), 'nouvelle « Henbilee a lancé les osselets »');
  await jyn.evaluate(() => go('sheyen')); await jyn.waitForTimeout(300);
  ok((await jyn.textContent('.sh-fiche')).includes('Les osselets sont lancés'), 'fiche de Sheyen : résultat caché avant le tirage');
  await click(jyn, '.sh-fiche [data-shagai-open]'); await jyn.waitForTimeout(400);
  ok(await jyn.evaluate(sid2 => shView.focus === sid2 && document.getElementById('sh-aug').hidden, sid2), 'en arrivant : le tirage est rejoué');
  await jyn.waitForTimeout(3500);
  ok(await jyn.evaluate(() => !document.getElementById('sh-aug').hidden), 'augure affiché après le rejeu');
  await jyn.reload(); await jyn.waitForTimeout(400); if (await jyn.isVisible('#login-btn')) await jyn.click('#login-btn'); await jyn.waitForTimeout(1500);
  await jyn.evaluate(sid2 => { shView.focus = sid2; go('shagai'); }, sid2); await jyn.waitForTimeout(400);
  ok(await jyn.evaluate(() => !shAnimating && !document.getElementById('sh-aug').hidden), 'deuxième visite : pas de rejeu, augure affiché');

  if (process.env.SHOT) await jyn.screenshot({ path: process.env.SHOT + '-augure.png', fullPage: true });
  console.log('Fiches et confidentialité');
  await lou.evaluate(() => go('henbilee')); await lou.waitForTimeout(300);
  ok((await lou.textContent('.sh-fiche')).includes('Pour Taiga') && (await lou.textContent('.sh-fiche')).includes('Pour Sheyen'), 'fiche d\'Henbilee : les deux augures');
  ok(await lou.evaluate(() => !document.querySelector('.recap .sh-fiche')), 'hors du récap (rien sur Discord)');
  await jyn.evaluate(() => go('taiga')); await jyn.waitForTimeout(300);
  ok(await jyn.locator('.sh-fiche .sh-pill').count() === 1, 'fiche de Taiga : son augure');
  await eden.waitForTimeout(500);
  ok(await eden.evaluate(() => Object.keys(SHAGAI).length === 0), 'Eden ne reçoit aucune demande');
  ok(await eden.evaluate(() => { go('henbilee'); return !document.querySelector('.sh-fiche'); }), 'Eden : rien sur la fiche d\'Henbilee');
  ok(await eden.evaluate(() => !myNews().some(n => n.key.startsWith('shagai:'))), 'Eden : aucune nouvelle');
  for (const [n, p] of [['lou', lou], ['jyn', jyn], ['eden', eden]]) { const w = await p.evaluate(() => { const W = innerWidth; return document.documentElement.scrollWidth <= W ? '' : [...document.querySelectorAll('#view *')].filter(e => e.getBoundingClientRect().right > W + 1).slice(0, 3).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right)).join(' | '); });
    ok(!w, n + ' : pas de débordement horizontal ' + w); }
  if (process.env.SHOT) { await lou.evaluate(() => go('henbilee')); await lou.waitForTimeout(300); await lou.locator('.sh-fiche').screenshot({ path: process.env.SHOT + '-fiche.png' }); }
  console.log('erreurs :', errs.length ? errs : 'aucune'); if (errs.length) process.exitCode = 1;
  await b.close();
})();
