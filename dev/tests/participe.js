// « J'y participe aussi » : se joindre à l'activité d'une fiche validée (recopiée de Journée RP ou propre à l'Iloh), acceptation, Discord, tirages inchangés.
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/participe.js [largeur]
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
    'access/eden@test.fr': { player: 'eden', role: 'joueur' }, 'access/idriss@test.fr': { player: 'idriss', role: 'joueur' } };
  const rp = new Date(Date.now() - 5 * 3600e3), ym = `${rp.getFullYear()}-${String(rp.getMonth() + 1).padStart(2, '0')}`, dd = String(rp.getDate());
  Object.assign(seed, { 'shared/discord': { webhook: 'https://discord.com/api/webhooks/1/abc' },
    ['days/taiga/months/' + ym]: { [dd]: { done: true, doneAt: Date.now(), mood: 'Calme', checked: { $set: ['Chasse en groupe', 'Cuisine'] }, slots: { 'Chasse en groupe': ['matin'] } } },
    ['days/sheyen/months/' + ym]: { [dd]: { done: true, doneAt: Date.now(), mood: 'Calme', checked: { $set: ['Chasse en groupe'] }, specials: [], slots: {} } } });
  const hooks = [];
  await ctx.route('https://discord.com/api/webhooks/**', r => { hooks.push(r.request().method()); r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":"m1"}' }); });
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: 'window.htmlToImage={toBlob:async()=>new Blob(["png"])};', contentType: 'application/javascript' }));
  const open = async (name, email, first = false) => {
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(name + ': ' + e.message)); p.on('console', m => { if (/error|warn/.test(m.type())) console.log('[console]', name, m.text().slice(0, 300)); });
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
  const wide = async p => { const w = await p.evaluate(() => { const W = innerWidth; return document.documentElement.scrollWidth <= W ? '' : [...document.querySelectorAll('#view *')].filter(e => e.getBoundingClientRect().right > W + 1).slice(0, 3).map(e => e.tagName + '.' + e.className).join(' | '); }); return w; };
  let nono = await open('nono', 'nono@test.fr', true); const jyn = await open('jynette', 'jynette@test.fr');
  const huntOf = (p, id) => p.evaluate(id => huntText(huntFor(id, 'Chasse en groupe')), id);

  console.log('Fiche recopiée de Journée RP (Taiga)');
  await nono.evaluate(() => go('taiga')); await nono.waitForTimeout(400);
  ok(await nono.locator('.join-me').count() === 1, 'fiche validée de Taiga : « J\'y participe aussi »');
  const taigaHunt = await huntOf(jyn, 'taiga');
  await nono.evaluate(() => { document.querySelector('.join-me').open = true; }); await click(nono, '[data-join-pick="Chasse en groupe"]'); await nono.waitForTimeout(250);
  ok(await nono.locator('[data-join-who]').count() >= 2 && await nono.locator('[data-join-who="taiga"]').count() === 0, 'choix parmi les personnages de Nono');
  await click(nono, '[data-join-who="tamachag"]'); await click(nono, '[data-join-who="ankhbayar"]'); await nono.waitForTimeout(150);
  await click(nono, '[data-join-send="Chasse en groupe"]'); await nono.waitForTimeout(900);
  let d = await db(nono); const j1 = Object.keys(d).find(k => k.startsWith('joins/'));
  ok(j1 && d[j1].host === 'taiga' && d[j1].act === 'Chasse en groupe' && JSON.stringify(d[j1].chars) === '["tamachag","ankhbayar"]' && d[j1].status === 'asked', 'demande enregistrée (deux personnages)');
  ok((await nono.textContent('.join-me')).includes('En attente : Tamachag et Ankhbayar'), 'Nono : en attente, annulable');
  await jyn.waitForTimeout(800); await jyn.evaluate(() => go('taiga')); await jyn.waitForTimeout(400);
  ok(await jyn.evaluate(() => myNews().some(n => n.key.startsWith('join:') && n.text.includes('Tamachag et Ankhbayar ont aussi participé à « Chasse en groupe »'))), 'Jynette : nouvelle à accepter');
  ok(await jyn.locator('[data-join-ok]').count() === 1, 'fiche de Taiga : bouton « Accepter »');
  await nono.close();   // base simulée partagée entre onglets : un seul appareil écrit à la fois
  await click(jyn, '[data-join-ok]'); await jyn.waitForTimeout(2500);
  ok(await jyn.evaluate(() => state.taiga.done && JSON.stringify(state.taiga.withActs['Chasse en groupe']) === '["tamachag","ankhbayar"]'), 'Taiga : fiche toujours validée, avec Tamachag et Ankhbayar');
  ok(await jyn.evaluate(() => JSON.stringify(state.taiga.huntCrew?.['Chasse en groupe']) === '[]' && huntWith('taiga', 'Chasse en groupe', rpDay).length === 0), 'chasseurs d\'origine figés (Ankhbayar, expert, ne change pas le tirage)');
  ok(await huntOf(jyn, 'taiga') === taigaHunt, 'tirage de Taiga inchangé (' + taigaHunt + ')');
  d = await db(jyn); ok(JSON.stringify(d['extras/taiga/months/' + ym]?.[dd]?.withActs?.['Chasse en groupe']) === '["tamachag","ankhbayar"]', 'enregistré dans les compléments Iloh de Taiga');
  nono = await open('nono', 'nono@test.fr'); await nono.waitForTimeout(1500);
  ok(await nono.evaluate(() => ['tamachag', 'ankhbayar'].every(c => state[c].checked.has('Chasse en groupe') && state[c].joinedOf?.['Chasse en groupe'] === 'taiga' && state[c].withActs['Chasse en groupe'].includes('taiga'))), 'ajoutée sur les fiches de Tamachag et Ankhbayar, avec Taiga');
  ok(await nono.evaluate(() => huntFor('tamachag', 'Chasse en groupe') === null && huntFor('ankhbayar', 'Chasse en groupe') === null), 'aucun tirage pour eux');
  ok(await nono.evaluate(() => JSON.stringify(state.tamachag.slots['Chasse en groupe']) === '["matin"]'), 'même moment que Taiga');
  ok(await nono.evaluate(() => myNews().some(n => n.text.includes('Taiga accepte'))), 'Nono : nouvelle « accepte »');
  d = await db(nono); ok(d[j1].applied === true && d[j1].status === 'ok', 'participation appliquée');
  await nono.evaluate(() => go('taiga')); await nono.waitForTimeout(300);
  ok(await nono.locator('[data-join-pick="Chasse en groupe"]').count() === 1 && !(await nono.locator('[data-join-who]').count()), 'Taiga : plus de demande en attente');

  console.log('Fiche de l\'Iloh (Sheyen) : republiée sur Discord, refus');
  const sheyenHunt = await huntOf(jyn, 'sheyen');
  await nono.evaluate(() => { go('sheyen'); }); await nono.waitForTimeout(300);
  await nono.evaluate(() => { document.querySelector('.join-me').open = true; }); await click(nono, '[data-join-pick="Chasse en groupe"]'); await nono.waitForTimeout(200);
  await click(nono, '[data-join-who="ankhbayar"]'); await click(nono, '[data-join-send="Chasse en groupe"]'); await nono.waitForTimeout(300);
  await click(nono, '[data-join-pick="Chasse en groupe"]'); await nono.waitForTimeout(200);
  ok(await nono.locator('[data-join-who="ankhbayar"]').count() === 0, 'personnage déjà en attente : plus proposé');
  await click(nono, '[data-join-who="tamachag"]'); await click(nono, '[data-join-send="Chasse en groupe"]'); await nono.waitForTimeout(900);
  await jyn.evaluate(() => go('sheyen')); await jyn.waitForTimeout(800);
  ok(await jyn.locator('[data-join-ok]').count() === 2, 'deux demandes sur la fiche de Sheyen');
  hooks.length = 0;
  await nono.close();
  await click(jyn, '[data-join-ok]'); await jyn.waitForTimeout(2500);
  ok(hooks.length >= 1, 'fiche de Sheyen republiée sur Discord (' + hooks + ')');
  ok(await jyn.evaluate(() => state.sheyen.done && state.sheyen.withActs['Chasse en groupe'].includes('ankhbayar')) && await huntOf(jyn, 'sheyen') === sheyenHunt, 'Sheyen : toujours validée, tirage inchangé');
  await click(jyn, '[data-join-no]'); await jyn.waitForTimeout(800);
  ok(await jyn.evaluate(() => !state.sheyen.withActs['Chasse en groupe'].includes('tamachag')), 'refus : Tamachag non ajouté');
  nono = await open('nono', 'nono@test.fr'); await nono.waitForTimeout(1500);
  ok(await nono.evaluate(() => myNews().some(n => n.text.includes('pas retenu la participation de Tamachag'))), 'Nono : nouvelle de refus');
  ok(await nono.evaluate(() => ['taiga', 'sheyen'].every(h => state.ankhbayar.withActs['Chasse en groupe'].includes(h)) && huntFor('ankhbayar', 'Chasse en groupe') === null), 'Ankhbayar : chasse avec Taiga et Sheyen, toujours sans tirage');
  ok(!(await wide(nono)) && !(await wide(jyn)), 'pas de débordement horizontal ' + (await wide(nono)) + (await wide(jyn)));
  if (process.env.SHOT) { await nono.evaluate(() => { go('sheyen'); }); await nono.waitForTimeout(300); await nono.evaluate(() => { document.querySelector('.join-me').open = true; }); await click(nono, '[data-join-pick="Chasse en groupe"]'); await nono.waitForTimeout(300); await nono.locator('.join-me').screenshot({ path: process.env.SHOT }); }
  console.log('erreurs :', errs.length ? errs : 'aucune'); if (errs.length) process.exitCode = 1;
  await b.close();
})();
