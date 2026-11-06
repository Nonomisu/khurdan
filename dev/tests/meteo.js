// Animation météo de l'accueil : particules, clics, réglage, animations réduites, aucun décalage.
// Usage : python3 -m http.server 8765 (à la racine), puis node dev/tests/meteo.js
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const MOCK = path.join(__dirname, 'mockfb'), OUT = process.env.SHOTS || '';
const ok = (c, l) => { console.log((c ? '  ok  ' : '  ÉCHEC ') + l); if (!c) process.exitCode = 1; };
(async () => {
  const b = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  for (const [W, H] of [[390, 844], [1280, 860]]) {
    console.log('largeur', W);
    const ctx = await b.newContext({ viewport: { width: W, height: H } });
    await ctx.route('https://www.gstatic.com/firebasejs/**', r => r.fulfill({ body: fs.readFileSync(path.join(MOCK, r.request().url().split('/').pop())), contentType: 'application/javascript' }));
    const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.addInitScript(() => { window.name = 'n'; window.MOCK_EMAIL = 'n@t.fr'; window.MOCK_WRITES = []; localStorage.setItem('mockdb', JSON.stringify({ 'access/n@t.fr': { player: 'eden', role: 'joueur' } })); window.FX_FORCE = 'snow'; });
    await p.goto('http://localhost:8765/'); await p.waitForTimeout(300); await p.click('#login-btn'); await p.waitForTimeout(1500);
    const pos = () => p.evaluate(() => { const r = document.querySelector('.grid .card').getBoundingClientRect(); return Math.round(r.top + scrollY) + ',' + Math.round(r.left) + ',' + document.documentElement.scrollHeight; });
    ok(await p.locator('canvas.wx-fx').count() === 1, 'canvas présent sur l\'accueil');
    const withFx = await pos();
    for (const k of ['snow', 'rain', 'storm', 'blizzard', 'wind', 'fog', 'fireflies']) {
      await p.evaluate(k => { window.FX_FORCE = k; go('home'); }, k); await p.waitForTimeout(1500);
      const n = await p.evaluate(() => FX.parts.length);
      ok(n > 0 && n <= 40, `${k} : ${n} particules (≤ 40)`);
      if (OUT && W === 390) await p.screenshot({ path: OUT + `fx-${k}.png` });
    }
    ok(await p.evaluate(() => getComputedStyle(document.querySelector('canvas.wx-fx')).pointerEvents) === 'none', 'le canvas ne capte aucun clic');
    await p.click('#card-buyan'); await p.waitForTimeout(300);
    ok(await p.evaluate(() => current) === 'buyan', 'clic sur une carte : la fiche s\'ouvre');
    ok(await p.locator('canvas.wx-fx').count() === 0 && await p.evaluate(() => FX.raf) === 0, 'hors de l\'accueil : animation arrêtée');
    await p.evaluate(() => go('home')); await p.waitForTimeout(300);
    await p.click('#fx-toggle'); await p.waitForTimeout(300);
    ok(await p.locator('canvas.wx-fx').count() === 0, 'case décochée : animation coupée');
    const noFx = await pos(); ok(noFx === withFx, 'aucun décalage de la page avec ou sans animation (' + withFx + ' / ' + noFx + ')');
    await p.reload(); await p.waitForTimeout(1500);
    ok(await p.locator('canvas.wx-fx').count() === 0 && !(await p.isChecked('#fx-toggle')), 'choix gardé sur l\'appareil');
    await p.click('#fx-toggle'); await p.waitForTimeout(300);
    await p.emulateMedia({ reducedMotion: 'reduce' }); await p.waitForTimeout(300);
    ok(await p.locator('canvas.wx-fx').count() === 0, 'appareil réglé pour réduire les animations : coupée d\'office');
    await p.evaluate(() => go('home')); await p.waitForTimeout(300);
    ok(await p.isDisabled('#fx-toggle') && (await p.textContent('.fx-toggle')).includes('moins d\'animations'), 'la case l\'indique');
    await p.emulateMedia({ reducedMotion: 'no-preference' }); await p.waitForTimeout(300);
    await p.evaluate(() => { window.FX_FORCE = null; go('home'); }); await p.waitForTimeout(300);
    ok(await p.locator('canvas.wx-fx').count() === 0, 'temps sans animation (nuageux) : rien');
    console.log('erreurs :', errs.length ? errs : 'aucune'); if (errs.length) process.exitCode = 1;
    await ctx.close();
  }
  await b.close();
})();
