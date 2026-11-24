// Compte à rebours de l'accueil : 23 jours au 24 novembre, baisse chaque jour, retiré ou relancé par l'admin seulement.
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/compte.js [largeur]
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
  const nono = await open('nono', 'nono@test.fr', true), jyn = await open('jynette', 'jynette@test.fr');
  await nono.evaluate(() => go('home')); await jyn.evaluate(() => go('home')); await nono.waitForTimeout(300);
  const left = await nono.evaluate(() => cdLeft(COUNTDOWN_START));
  ok((await nono.textContent('.countdown')).includes(`${left} jour${left > 1 ? 's' : ''} avant que la tribu ne manque de ressources`), `affiché sur l'accueil : ${left} jours`);
  ok(await nono.evaluate(() => { const d = new Date(rpDay); rpDay.setDate(rpDay.getDate() + 1); const n = cdLeft(COUNTDOWN_START); rpDay.setTime(d.getTime()); return n; }) === left - 1, 'le lendemain : un jour de moins');
  ok(await nono.evaluate(() => cdLeft(COUNTDOWN_START) === Math.round((new Date('2026-12-17T12:00') - new Date(isoDay(rpDay) + 'T12:00')) / 864e5)), '0 le 17 décembre (23 au 24 novembre)');
  ok(await jyn.locator('.countdown').count() === 1 && await jyn.locator('.cd-tools').count() === 0, 'Jynette le voit, sans pouvoir le retirer');
  if (process.env.SHOT) await nono.locator('.countdown').screenshot({ path: process.env.SHOT });
  await click(nono, '[data-cd-del="1"]'); await nono.waitForTimeout(200);
  ok(await nono.locator('#cd-off').count() === 1 && await nono.locator('.countdown').count() === 1, 'retrait : confirmation demandée');
  await click(nono, '#cd-off'); await nono.waitForTimeout(800);
  ok(!(await nono.locator('.countdown').count()) && (await db(nono))['shared/countdown']?.off === true, 'retiré (enregistré)');
  await jyn.waitForTimeout(800); ok(!(await jyn.locator('.countdown').count()), 'disparu chez Jynette');
  await click(nono, '[data-cd-form="1"]'); await nono.waitForTimeout(150);
  await nono.fill('#cd-days', '5'); await nono.fill('#cd-text', 'avant la grande migration'); await click(nono, '#cd-start'); await nono.waitForTimeout(800);
  ok((await nono.textContent('.countdown')).includes('5 jours avant la grande migration'), 'admin : nouveau compte à rebours lancé');
  await jyn.waitForTimeout(800); ok((await jyn.textContent('.countdown')).includes('5 jours avant la grande migration'), 'visible chez Jynette');
  ok(await nono.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pas de débordement horizontal');
  console.log('erreurs :', errs.length ? errs : 'aucune'); if (errs.length) process.exitCode = 1;
  await b.close();
})();
