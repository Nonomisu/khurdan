// Pas de nouvelle répétée : un autre joueur qui ajoute à sa fiche un événement, une action d'événement du jour ou une activité commune.
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/renotif.js [largeur]
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
  const rp = new Date(Date.now() - 5 * 3600e3), pad = n => String(n).padStart(2, '0'), iso = `${rp.getFullYear()}-${pad(rp.getMonth() + 1)}-${pad(rp.getDate())}`;
  seed['shared/events'] = { f: { type: 'fete', text: 'Fête du feu', date: iso, by: 'eden', at: 1, going: { taiga: 'jynette', boroo: 'idriss', tamachag: 'nono' } },
    d: { type: 'ceremonie', text: 'Funérailles', date: iso, daily: true, by: 'lou', at: 2, acts: { a: { text: 'Fleurs', by: 'taiga', p: 'jynette', at: 3, who: { taiga: 'jynette', boroo: 'idriss', tamachag: 'nono' } } } } };
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
  const news = async p => Object.values(await db(p)).filter(n => n && typeof n.key === 'string' && /^with:/.test(n.key));
  const jyn = await open('jynette', 'jynette@test.fr', true), idr = await open('idriss', 'idriss@test.fr');
  console.log('Taiga (Jynette) ajoute l\'événement et l\'action, valide ; Boroo (Idriss) fait de même');
  await jyn.evaluate(() => { go('sheyen'); state.sheyen.mood ||= 'Calme'; addEvAct('sheyen', 'f'); addEvDayToFiche('sheyen', 'd', 'a'); });
  await jyn.evaluate(() => { const s = state.sheyen; s.done = true; window.RP_SYNC?.save?.(); renderChar('sheyen'); }); await jyn.waitForTimeout(1200);
  await idr.waitForTimeout(800);
  await idr.evaluate(() => { go('boroo'); addEvAct('boroo', 'f'); addEvDayToFiche('boroo', 'd', 'a'); state.boroo.done = true; window.RP_SYNC?.save?.(); renderChar('boroo'); }); await idr.waitForTimeout(1200);
  const N = await news(idr);
  ok(N.length === 0, 'aucune nouvelle « avec » pour un événement ou une action ajoutés (' + N.map(n => n.key).join(', ') + ')');
  await jyn.waitForTimeout(800); await jyn.evaluate(() => go('taiga')); await jyn.waitForTimeout(300);
  const items = await jyn.evaluate(() => [...document.querySelectorAll('.shared-acts .shared-item span')].map(x => x.textContent));
  ok(items.filter(t => t.includes('Fête du feu')).length === 1 && items.filter(t => t.includes('Fleurs')).length === 1, 'pas de doublon dans « Activités communes du jour » (' + items.length + ' : ' + items.join(' | ') + ')');
  console.log('Activité commune reprise par un autre joueur');
  await jyn.evaluate(() => { const s = state.sheyen; s.checked.add('Cuisine'); s.specials.push('Cuisine'); setWith('sheyen', 'Cuisine', 'boroo', true); setWith('sheyen', 'Cuisine', 'tamachag', true); window.RP_SYNC?.save?.(); }); await jyn.waitForTimeout(1200);
  let before = (await news(jyn)).length;
  await idr.waitForTimeout(800); await idr.evaluate(() => { go('boroo'); joinAct('boroo', 'sheyen', 'Cuisine'); window.RP_SYNC?.save?.(); }); await idr.waitForTimeout(1200);
  const after = await news(idr), added = after.filter(n => /^with:[^:]+:boroo:/.test(n.key));
  ok(added.length === 1 && added[0].to === 'jynette', 'reprise : une seule nouvelle, pour le joueur de l\'auteur (' + added.map(n => n.key + '→' + n.to).join(', ') + ')');
  ok(!after.some(n => /^with:[^:]+:boroo:tamachag:/.test(n.key)), 'Tamachag (déjà proposé par Sheyen) n\'est pas re-notifié');
  console.log('erreurs :', errs.length ? errs : 'aucune'); if (errs.length) process.exitCode = 1;
  await b.close();
})();
