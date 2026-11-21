// Événements du jour archivés trois jours après leur date : plus sur l'accueil, consultables dans les archives du calendrier.
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/evarchives.js [largeur]
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
  const rp = new Date(Date.now() - 5 * 3600e3), pad = n => String(n).padStart(2, '0');
  const day = k => { const d = new Date(rp); d.setDate(d.getDate() - k); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  seed['shared/events'] = { d0: { type: 'fete', text: 'Fête du jour', date: day(0), daily: true, by: 'nono', at: 1, acts: {} },
    d2: { type: 'ceremonie', text: 'Avant-hier', date: day(2), daily: true, by: 'nono', at: 2, acts: { a: { text: 'Fleurs', by: 'taiga', p: 'jynette', at: 3, who: { taiga: 'jynette', boroo: 'idriss' } } } },
    d3: { type: 'ceremonie', text: 'Il y a trois jours', date: day(3), daily: true, by: 'nono', at: 4, acts: { a: { text: 'Chants', by: 'taiga', p: 'jynette', at: 5, who: { taiga: 'jynette' } } } },
    d9: { type: 'autre', text: 'Vieille cérémonie', date: day(9), daily: true, by: 'nono', at: 6, acts: {} },
    n9: { type: 'info', text: 'Annonce sans fin', date: day(9), by: 'nono', at: 7 } };
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
  const nono = await open('nono', 'nono@test.fr', true);
  await nono.evaluate(() => go('home')); await nono.waitForTimeout(300);
  const home = await nono.textContent('.group-events');
  ok(home.includes('Fête du jour') && home.includes('Avant-hier'), 'accueil : événements du jour et d\'avant-hier');
  ok(!home.includes('Il y a trois jours') && !home.includes('Vieille cérémonie'), 'accueil : archivés à partir du 3e jour');
  ok(home.includes('Annonce sans fin'), 'les autres événements ne bougent pas');
  await nono.evaluate(() => go('events')); await nono.waitForTimeout(300);
  ok((await nono.textContent('.ev-archives summary')).includes('(2)'), 'calendrier : archives (2)');
  await nono.evaluate(() => { document.querySelector('.ev-archives').open = true; }); await nono.waitForTimeout(100);
  const arch = await nono.textContent('.ev-archives');
  ok(arch.indexOf('Il y a trois jours') < arch.indexOf('Vieille cérémonie') && arch.includes('1 action · 1 personnage'), 'du plus récent au plus ancien, avec leurs actions');
  await click(nono, '.ev-arch [data-evday-open="d3"]'); await nono.waitForTimeout(300);
  ok(await nono.evaluate(() => current === 'evjour') && (await nono.textContent('#view')).includes('Événement archivé') && (await nono.textContent('#view')).includes('Chants'), 'page de l\'événement archivé, actions consultables');
  ok(!(await nono.locator('[data-evd-go], #evd-add').count()), 'plus rien ne bouge');
  ok(await nono.evaluate(() => !!GROUP_EVENTS.d3 && !!GROUP_EVENTS.d9), 'rien n\'est supprimé');
  ok(await nono.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'pas de débordement horizontal');
  console.log('erreurs :', errs.length ? errs : 'aucune'); if (errs.length) process.exitCode = 1;
  await b.close();
})();
