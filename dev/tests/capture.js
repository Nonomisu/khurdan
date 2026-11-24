// Capture du jour d'une fiche recopiée de Journée RP (recopiée par le service du VPS) : affichée dans la fiche, fiche republiée sur Discord.
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/capture.js [largeur]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const W = +(process.argv[2] || 420), EMAIL = 'nono@test.fr';
const ok = (c, l) => { console.log((c ? '  ok  ' : '  ÉCHEC ') + l); if (!c) process.exitCode = 1; };
(async () => { const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: 900 } });
  await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ body: fs.readFileSync(path.join(__dirname, 'mockfb', r.request().url().split('/').pop())), contentType: 'application/javascript' }));
  await ctx.route('**fonts.g*.com**', r => r.fulfill({ body: '' }));
  await ctx.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ body: 'window.htmlToImage={toBlob:async()=>new Blob(["png"])};', contentType: 'application/javascript' }));
  const calls = []; let patchStatus = 200, n = 0;
  await ctx.route('https://discord.com/api/webhooks/**', async r => { const m = r.request().method(); calls.push(m);
    await new Promise(x => setTimeout(x, 300));
    if (m === 'PATCH' && patchStatus !== 200) return r.fulfill({ status: patchStatus, body: '{}' });
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: m === 'POST' ? 'msg' + (++n) : 'msg' + n }) }); });
  const errs = [];
  const open = async nm => { const p = await ctx.newPage(); p.on('pageerror', x => errs.push(nm + ': ' + x.message));
    await p.addInitScript(([a, c]) => { window.name = a; window.MOCK_EMAIL = c; }, [nm, EMAIL]);
    await p.goto('http://localhost:8765/'); await p.waitForTimeout(400); if (await p.isVisible('#login-btn')) await p.click('#login-btn'); return p; };
  // Jour RP en cours, calculé par l'appli elle-même, puis base simulée : fiche de Tamachag validée (recopiée), webhook relié.
  const s = await ctx.newPage(); await s.goto('http://localhost:8765/icon.svg');
  const { ym, day } = await s.evaluate(() => { const d = new Date(); if (d.getHours() < 5) d.setDate(d.getDate() - 1);
    return { ym: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, day: String(d.getDate()) }; });
  await s.evaluate(([ym, day, e]) => localStorage.setItem('mockdb', JSON.stringify({ ['access/' + e]: { player: 'nono', role: 'admin' },
    'shared/discord': { webhook: 'https://discord.com/api/webhooks/1/abc' },
    ['days/tamachag/months/' + ym]: { [day]: { done: true, doneAt: Date.now(), mood: 'Calme', checked: { $set: ['Cuisine'] } } } })), [ym, day, EMAIL]);
  await s.close();
  const pc = await open('pc'); await pc.waitForTimeout(6000);
  ok(calls.filter(m => m === 'POST').length === 1, 'fiche de Tamachag publiée (' + calls + ')');
  calls.length = 0;
  // Le service du VPS recopie la capture du jour.
  const iso = `${ym}-${String(day).padStart(2, '0')}`;
  await pc.evaluate(([k, img]) => { const db = JSON.parse(localStorage.getItem('mockdb')); db[k] = { img, at: Date.now() }; localStorage.setItem('mockdb', JSON.stringify(db)); window.dispatchEvent(new StorageEvent('storage', { key: 'mockdb' })); },
    [`days/tamachag/months/${iso}~shot`, 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==']);
  await pc.waitForTimeout(5000);
  ok(await pc.evaluate(() => !!SHOTS.tamachag), 'capture reçue');
  ok(calls.includes('PATCH') && !calls.includes('POST'), 'fiche republiée sur Discord (même message) : ' + calls);
  await pc.evaluate(() => go('tamachag')); await pc.waitForTimeout(400);
  ok(await pc.locator('.recap-shot').count() === 1, 'affichée dans la fiche publiée');
  console.log('erreurs :', errs.length ? errs : 'aucune'); if (errs.length) process.exitCode = 1;
  await b.close();
})();
