// Événement du jour : annonce, page à part, actions proposées et rejointes, nouvelles, ajout à la fiche le jour J.
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/evjour.js [largeur]
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
  const noJump = async (p, sel, label) => { const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
    const y0 = (await el.boundingBox())?.y; await el.click(); await p.waitForTimeout(400);
    const y1 = (await p.locator(sel).first().boundingBox().catch(() => null))?.y; ok(y1 === undefined || Math.abs(y1 - y0) < 4, label + ' (sans saut de page)'); };
  const wide = p => p.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const nono = await open('nono', 'nono@test.fr', true);
  const jyn = await open('jynette', 'jynette@test.fr'), idr = await open('idriss', 'idriss@test.fr');

  console.log('Annonce (Nono)');
  await click(nono, '.ev-announce summary'); await nono.waitForTimeout(150);
  await nono.fill('#ev-text', 'Grandes Funérailles');
  await nono.check('#ev-daily'); await nono.waitForTimeout(100);
  ok(await nono.evaluate(() => document.getElementById('ev-until').closest('label').hidden), 'événement du jour : pas de date de fin');
  await click(nono, '#ev-add'); await nono.waitForTimeout(600);
  ok(await nono.evaluate(() => current === 'evjour') && (await nono.textContent('#view h1')).includes('Grandes Funérailles'), 'page de l\'événement ouverte');
  ok(await nono.evaluate(() => document.querySelector('.evd-new')?.open), 'formulaire ouvert (aucune action)');
  const evId = await nono.evaluate(() => evDay.id);
  await nono.fill('#evd-text', 'Nettoyer la yourte');
  await click(nono, '[data-evd-by="tamachag"]'); await click(nono, '#evd-add'); await nono.waitForTimeout(800);
  ok((await nono.textContent('#view')).includes('Proposée par Tamachag'), 'action proposée par Tamachag');
  ok(await wide(nono), 'pas de débordement horizontal');
  let d = await db(nono);
  const acts = d['shared/events'][evId].acts, aid1 = Object.keys(acts)[0];
  ok(d['shared/events'][evId].daily && acts[aid1].text === 'Nettoyer la yourte' && acts[aid1].who.tamachag === 'nono', 'enregistré : action et Tamachag inscrit');
  ok(Object.values(d).some(x => x?.key === `evday:${evId}:${aid1}:jynette`) || JSON.stringify(d).includes(`evday:${evId}:${aid1}:jynette`), 'nouvelle pour Jynette');

  console.log('Jynette rejoint et propose');
  await jyn.waitForTimeout(1500); await jyn.evaluate(() => go('home')); await jyn.waitForTimeout(300);
  ok((await jyn.textContent('.group-events')).includes('Événement du jour') && (await jyn.textContent('.group-events')).includes('1 action'), 'accueil : carte avec résumé');
  await click(jyn, '[data-evday-open]'); await jyn.waitForTimeout(300);
  ok(await jyn.evaluate(() => current === 'evjour'), 'page ouverte depuis l\'accueil');
  await noJump(jyn, `[data-evd-go="${aid1}:taiga"]`, 'Taiga rejoint « Nettoyer la yourte »');
  ok(await jyn.evaluate(() => evDayWho(Object.values(GROUP_EVENTS[evDay.id].acts)[0]).join() === 'tamachag,taiga'), 'participants : Tamachag, Taiga');
  await click(jyn, '.evd-new summary'); await jyn.waitForTimeout(150);
  await jyn.fill('#evd-text', 'Apporter les fleurs'); await click(jyn, '[data-evd-by="taiga"]'); await click(jyn, '#evd-add'); await jyn.waitForTimeout(800);
  await idr.waitForTimeout(1200); await idr.evaluate(id => openEvDay(id), evId); await idr.waitForTimeout(300);
  ok((await idr.locator('.evd-act').count()) === 2, 'Idriss voit les deux actions');
  const aid2 = await idr.evaluate(() => evDayActs(GROUP_EVENTS[evDay.id])[1][0]);
  await click(idr, `[data-evd-go="${aid2}:boroo"]`); await idr.waitForTimeout(800);
  ok(await idr.evaluate(() => myNews().some(n => n.key.startsWith('evday:') && /propose « Apporter les fleurs »/.test(n.text))), 'Idriss : nouvelle de la proposition de Taiga');
  await nono.waitForTimeout(1500);
  ok(await nono.evaluate(() => myNews().some(n => n.key.startsWith('evday:') && n.text.includes('Taiga rejoint l\'action « Nettoyer la yourte »'))), 'Nono : Taiga a rejoint son action');
  await jyn.waitForTimeout(500);
  ok(await jyn.evaluate(() => myNews().some(n => n.text.includes('Boroo rejoint l\'action « Apporter les fleurs »'))), 'Jynette : Boroo a rejoint son action');
  ok(await jyn.evaluate(() => document.querySelector('.news [data-evday-open]') !== null || myNews().some(n => newsKind(n) === 'k-with' && n.key.startsWith('evday:'))), 'nouvelle verte, cliquable');

  console.log('Fiche de Taiga, le jour J');
  await jyn.evaluate(() => go('taiga')); await jyn.waitForTimeout(400);
  const sh = await jyn.textContent('.shared-acts');
  ok(sh.includes('Nettoyer la yourte avec Tamachag') && sh.includes('Apporter les fleurs avec Boroo'), 'activités communes : les deux actions');
  await click(jyn, `[data-evd-fiche="${evId}:${aid1}"]`); await jyn.waitForTimeout(800);
  ok(await jyn.evaluate(() => { const l = 'Nettoyer la yourte (Grandes Funérailles)'; return state.taiga.checked.has(l) && JSON.stringify(state.taiga.withActs?.[l]) === '["tamachag"]'; }), 'ajoutée à la fiche avec Tamachag');

  if (process.env.SHOT) { await idr.evaluate(id => openEvDay(id), evId); await idr.waitForTimeout(300); await idr.screenshot({ path: process.env.SHOT + '-page.png', fullPage: true });
    await idr.evaluate(() => go('home')); await idr.waitForTimeout(300); await idr.locator('.group-events').first().screenshot({ path: process.env.SHOT + '-accueil.png' }); }
  console.log('Retrait');
  await idr.evaluate(id => openEvDay(id), evId); await idr.waitForTimeout(300);
  ok(await idr.locator('[data-evd-del]').count() === 0, 'Idriss ne peut retirer les actions des autres');
  await nono.evaluate(id => openEvDay(id), evId); await nono.waitForTimeout(300);
  ok(await nono.locator('[data-evd-del]').count() === 2, 'Nono (auteur et admin) peut retirer les deux');
  await click(nono, `[data-evd-del="${aid2}"]`); await nono.waitForTimeout(200); await click(nono, `[data-evd-del-ok="${aid2}"]`); await nono.waitForTimeout(800);
  d = await db(nono); ok(!d['shared/events'][evId].acts[aid2] && d['shared/events'][evId].acts[aid1], 'action retirée, l\'autre reste');
  ok(await wide(nono) && await wide(jyn) && await wide(idr), 'pas de débordement horizontal');
  console.log('erreurs :', errs.length ? errs : 'aucune'); if (errs.length) process.exitCode = 1;
  await b.close();
})();
