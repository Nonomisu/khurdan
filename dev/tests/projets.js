// Projets de l'Iloh : étapes à la suite ou ensemble, actions liées à une étape ou à tout le projet, catégorie « Projet » sur les fiches,
// étapes verrouillées, fin, ancien format, modification et suppression.
// Usage : python3 -m http.server 8765 (à la racine du dépôt), puis node dev/tests/projets.js [largeur]
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
    'access/eden@test.fr': { player: 'eden', role: 'joueur' }, 'access/idriss@test.fr': { player: 'idriss', role: 'joueur' },
    'shared/projects': { old1: { title: 'Ancien puits', by: 'eden', at: 1, goal: 4, acts: ['Puiser'], steps: ['Creuser', 'Murer'], done: null, contrib: { 'buyan:2020-01-01': { c: 'buyan', l: 'Puiser', p: 'eden' } } } } };
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
  const jyn = await open('jynette', 'jynette@test.fr'), eden = await open('eden', 'eden@test.fr');
  await nono.close();
  const fillStep = async (p, i, name, goal, acts) => { await p.fill(`[data-proj-step-name="${i}"]`, name); await p.fill(`[data-proj-step-goal="${i}"]`, String(goal));
    for (const a of acts) { await p.fill(`.proj-step-act[data-pstep="${i}"]`, a); await p.press(`.proj-step-act[data-pstep="${i}"]`, 'Enter'); await p.waitForTimeout(120); } };
  const cat = (p, title) => p.locator('.proj-cat', { hasText: title });
  const box = (p, title, act) => cat(p, title).locator(`input[data-proj-act="${act}"]`);

  console.log('Ancien projet (étapes réparties sur l\'objectif)');
  await click(jyn, '.home-links [data-go="projets"]'); await jyn.waitForTimeout(300);
  ok((await jyn.textContent('#proj-old1')).includes('1 / 4 participations') && await jyn.locator('#proj-old1 .proj-steps li.on').count() === 1, 'ancien projet lu : 1/4, première étape en cours');

  console.log('Création à la suite (Jynette)');
  await click(jyn, '.proj-new summary'); await jyn.waitForTimeout(150);
  await jyn.fill('#proj-title', 'Construire la nouvelle yourte');
  await click(jyn, '#proj-save'); await jyn.waitForTimeout(200);
  ok((await jyn.textContent('#proj-err')).includes('au moins une activité'), 'il faut au moins une activité liée');
  await click(jyn, '#proj-step-add'); await jyn.waitForTimeout(150); await click(jyn, '#proj-step-add'); await jyn.waitForTimeout(150);
  ok(await jyn.locator('[data-proj-mode]').count() === 2 && await jyn.getAttribute('[data-proj-mode="suite"]', 'aria-pressed') === 'true', 'deux étapes : choix « l\'une après l\'autre » / « ensemble » (à la suite par défaut)');
  ok(await jyn.inputValue('#proj-title') === 'Construire la nouvelle yourte', 'le titre tapé reste après l\'ajout d\'une étape');
  await fillStep(jyn, 0, 'Matériaux', 2, ['Couper du bois', 'Danse']);
  await click(jyn, '[data-proj-act-del="0:1"]'); await jyn.waitForTimeout(150);
  ok(JSON.stringify(await jyn.evaluate(() => projView.steps[0])) === '{"name":"Matériaux","goal":2,"acts":["Couper du bois"]}', 'étape 1 : nom, objectif, action (ajout et retrait)');
  await jyn.fill('[data-proj-step-name="1"]', 'Charpente');
  await click(jyn, '#proj-save'); await jyn.waitForTimeout(200);
  ok((await jyn.textContent('#proj-err')).includes('« Charpente » n\'a aucune action'), 'une étape sans action est refusée');
  await fillStep(jyn, 1, 'Charpente', 1, ['Tanner les peaux']);
  ok((await jyn.textContent('.proj-form')).includes('Objectif total : 3 participations'), 'objectif total = somme des étapes');
  await click(jyn, '#proj-save'); await jyn.waitForTimeout(1200);
  let d = await db(jyn); const [pid, P] = Object.entries(d['shared/projects'] || {}).find(([k]) => k !== 'old1') || [];
  ok(P?.v === 2 && P.mode === 'suite' && P.goal === 3 && P.steps[1].acts[0] === 'Tanner les peaux' && P.by === 'jynette' && !P.done, 'projet enregistré (étapes, mode, total)');
  ok(d[`news/proj:${pid}:new:eden`]?.text === 'Jynette lance un projet pour l\'Iloh : « Construire la nouvelle yourte ».' && !d[`news/proj:${pid}:new:jynette`], 'nouvelle pour les autres joueurs');
  const card = await jyn.textContent(`#proj-${pid}`);
  ok(card.includes('0 / 3 participations') && card.includes('étapes l\'une après l\'autre') && card.includes('Charpente 0/1 · verrouillée'), 'carte : étapes, la 2e verrouillée');
  ok(await wide(jyn), 'page des projets : pas de débordement horizontal');

  console.log('Fiche de Buyan (Eden) : catégorie du projet, étape verrouillée');
  await eden.reload(); await eden.waitForTimeout(1500);
  await eden.evaluate(() => go('buyan')); await eden.waitForTimeout(300);
  ok(await cat(eden, 'Construire la nouvelle yourte').count() === 1 && (await cat(eden, 'Construire').textContent()).includes('Étape en cours : « Matériaux » (0/2)'), 'catégorie « Projet · Construire la nouvelle yourte » avec l\'étape en cours');
  ok(await box(eden, 'Construire', 'Tanner les peaux').isDisabled() && (await cat(eden, 'Construire').textContent()).includes('Étape 2 verrouillée'), 'action de l\'étape 2 impossible à cocher');
  ok(await eden.locator('.chrono-part .cat.fold').first().evaluate(e => e.classList.contains('proj-cat')), 'la catégorie du projet passe avant les autres');
  await noJump(eden, '.proj-cat label:has(input[data-proj-act="Couper du bois"])', 'participation avec « Couper du bois »');
  ok(await eden.evaluate(() => state.buyan.checked.has('Couper du bois')), 'activité cochée sur la fiche');
  await eden.waitForTimeout(800); d = await db(eden);
  const iso = await eden.evaluate(() => isoDay(rpDay));
  ok(d['shared/projects'][pid].contrib[`buyan:${iso}`]?.s === 0, 'participation enregistrée pour l\'étape 1');
  ok(await box(eden, 'Construire', 'Couper du bois').isChecked() && (await cat(eden, 'Construire').textContent()).includes('Buyan a fait avancer le projet aujourd\'hui'), 'participation affichée');
  await click(eden, '.proj-cat input[data-proj-act="Couper du bois"]'); await eden.waitForTimeout(800);
  d = await db(eden); ok(!d['shared/projects'][pid].contrib[`buyan:${iso}`], 'décochée : participation annulée');
  await click(eden, '.proj-cat input[data-proj-act="Couper du bois"]'); await eden.waitForTimeout(300);
  await eden.evaluate(() => { const cb = [...document.querySelectorAll('.cat:not(.proj-cat) input[data-act="Couper du bois"]')][0]; cb.checked = false; cb.dispatchEvent(new Event('change')); }); await eden.waitForTimeout(800);
  d = await db(eden); ok(!d['shared/projects'][pid].contrib[`buyan:${iso}`], 'activité décochée ailleurs sur la fiche : participation retirée aussi');
  await click(eden, '.proj-cat input[data-proj-act="Couper du bois"]'); await eden.waitForTimeout(800);
  await click(eden, '.proj-cat input[data-proj-act="Couper du bois"]'); await eden.waitForTimeout(0);
  await click(eden, '.proj-cat input[data-proj-act="Couper du bois"]'); await eden.waitForTimeout(800);
  ok(await eden.evaluate(pid => Object.keys(PROJECTS[pid].contrib).length === 1, pid), 'une seule participation par jour et par personnage');

  console.log('Étape 1 terminée (Shiruun) : étape 2 débloquée');
  await jyn.evaluate(() => go('shiruun')); await jyn.waitForTimeout(400);
  await click(jyn, '.proj-cat input[data-proj-act="Couper du bois"]'); await jyn.waitForTimeout(800);
  d = await db(jyn);
  ok(d[`news/proj:${pid}:etape0:eden`]?.text === 'Projet « Construire la nouvelle yourte » : étape « Matériaux » terminée, l\'étape « Charpente » est débloquée (2/3).', 'nouvelle : étape terminée, la suivante débloquée');
  const nono2 = await open('nono', 'nono@test.fr'); await eden.close();
  await nono2.evaluate(() => go('tamachag')); await nono2.waitForTimeout(400);
  ok(await box(nono2, 'Construire', 'Couper du bois').isDisabled() && !(await box(nono2, 'Construire', 'Tanner les peaux').isDisabled()) && (await cat(nono2, 'Construire').textContent()).includes('Étape 1 terminée'), 'fiche recopiée (Tamachag) : étape 1 fermée, étape 2 ouverte');

  console.log('Fin du projet (Tamachag)');
  await click(nono2, '.proj-cat input[data-proj-act="Tanner les peaux"]'); await nono2.waitForTimeout(1000);
  d = await db(nono2);
  ok(d['shared/projects'][pid].done > 0 && d[`news/proj:${pid}:fin:jynette`]?.text === 'Projet « Construire la nouvelle yourte » terminé grâce à Buyan, Shiruun et Tamachag !', 'projet terminé, nouvelle de fin');
  ok(!d[`news/proj:${pid}:etape1:jynette`], 'pas de nouvelle d\'étape en double avec la fin');
  ok(await cat(nono2, 'Construire').count() === 0 && await nono2.evaluate(() => state.tamachag.checked.has('Tanner les peaux')), 'la catégorie disparaît de la fiche, l\'activité reste cochée');

  console.log('Projet aux étapes menées ensemble (Nono), action pour tout le projet');
  await nono2.evaluate(() => go('projets')); await nono2.waitForTimeout(300);
  await click(nono2, '.proj-new summary'); await nono2.waitForTimeout(150);
  await nono2.fill('#proj-title', 'Préparer la fête');
  await click(nono2, '#proj-step-add'); await nono2.waitForTimeout(120); await click(nono2, '#proj-step-add'); await nono2.waitForTimeout(120);
  await fillStep(nono2, 0, 'Repas', 1, ['Cuisine']); await fillStep(nono2, 1, 'Musique', 2, ['Danse']);
  await click(nono2, '[data-proj-mode="ensemble"]'); await nono2.waitForTimeout(150);
  ok(await nono2.inputValue('[data-proj-step-name="1"]') === 'Musique' && (await nono2.textContent('.proj-form')).includes('avancent en même temps'), 'mode « ensemble » choisi, champs gardés');
  await nono2.fill('#proj-act', 'Chant'); await click(nono2, '#proj-act-add'); await nono2.waitForTimeout(150);
  await click(nono2, '#proj-save'); await nono2.waitForTimeout(1000);
  d = await db(nono2); const [pid2, P2] = Object.entries(d['shared/projects']).find(([, p]) => p.title === 'Préparer la fête');
  ok(P2.mode === 'ensemble' && P2.acts[0] === 'Chant' && P2.goal === 3, 'enregistré : ensemble, action pour tout le projet');
  await nono2.evaluate(() => go('tamachag')); await nono2.waitForTimeout(400);
  ok(!(await box(nono2, 'fête', 'Cuisine').isDisabled()) && !(await box(nono2, 'fête', 'Danse').isDisabled()) && (await cat(nono2, 'fête').textContent()).includes('Étapes en cours'), 'les deux étapes sont ouvertes');
  ok((await cat(nono2, 'fête').textContent()).includes('Tout le projet'), 'l\'action « Chant » est marquée « Tout le projet »');
  await click(nono2, '.proj-cat input[data-proj-act="Chant"]'); await nono2.waitForTimeout(800);
  d = await db(nono2); ok(d['shared/projects'][pid2].contrib[`tamachag:${iso}`]?.s === 0, '« Chant » fait avancer l\'étape la moins avancée (Repas)');
  ok(d[`news/proj:${pid2}:etape0:jynette`]?.text === 'Projet « Préparer la fête » : étape « Repas » terminée (1/3).', 'étape terminée (sans déblocage en mode ensemble)');
  await jyn.reload(); await jyn.waitForTimeout(1500); await jyn.evaluate(() => go('shiruun')); await jyn.waitForTimeout(400);
  ok(await box(jyn, 'fête', 'Cuisine').isDisabled() && !(await box(jyn, 'fête', 'Chant').isDisabled()), 'étape « Repas » terminée : « Cuisine » fermée, « Chant » toujours possible');
  await click(jyn, '.proj-cat input[data-proj-act="Chant"]'); await jyn.waitForTimeout(800);
  d = await db(jyn); ok(d['shared/projects'][pid2].contrib[`shiruun:${iso}`]?.s === 1, '« Chant » va maintenant à l\'étape « Musique »');
  ok(await wide(jyn), 'fiche : pas de débordement horizontal');
  await jyn.close();

  console.log('Modification et suppression (admin)');
  await nono2.evaluate(() => go('projets')); await nono2.waitForTimeout(300);
  await click(nono2, '#proj-done-fold summary'); await nono2.waitForTimeout(150);
  await click(nono2, `[data-proj-edit="${pid}"]`); await nono2.waitForTimeout(300);
  ok(await nono2.inputValue('#proj-title') === 'Construire la nouvelle yourte' && await nono2.inputValue('[data-proj-step-goal="0"]') === '2', 'formulaire prérempli avec les étapes');
  await nono2.fill('[data-proj-step-goal="1"]', '3'); await nono2.fill('#proj-title', 'Construire deux yourtes');
  await click(nono2, '#proj-save'); await nono2.waitForTimeout(1000);
  d = await db(nono2); const Pe = d['shared/projects'][pid];
  ok(Pe.goal === 5 && Pe.title === 'Construire deux yourtes' && !Pe.done && Object.keys(Pe.contrib).length === 3, 'objectif relevé : projet rouvert, participations gardées');
  ok((await nono2.textContent(`#proj-${pid}`)).includes('3 / 5 participations · 60 %'), 'carte : 3 / 5');
  await nono2.evaluate(() => go('tamachag')); await nono2.waitForTimeout(400);
  ok(await cat(nono2, 'deux yourtes').count() === 1, 'projet rouvert : la catégorie revient sur la fiche');
  await nono2.evaluate(() => go('projets')); await nono2.waitForTimeout(300);
  await click(nono2, `[data-proj-del="${pid}"]`); await nono2.waitForTimeout(200);
  await click(nono2, `[data-proj-del-ok="${pid}"]`); await nono2.waitForTimeout(1000);
  d = await db(nono2); ok(!d['shared/projects'][pid], 'projet supprimé par l\'admin');
  ok(await wide(nono2), 'pas de débordement horizontal');
  console.log('erreurs :', errs.length ? errs : 'aucune'); if (errs.length) process.exitCode = 1;
  await b.close();
})();
