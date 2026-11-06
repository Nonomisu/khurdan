// pm2 : « pm2 start ecosystem.config.js » depuis ~/iloh-sauvegarde. Une sauvegarde part tout de suite,
// puis chaque dimanche à 4 h (heure du serveur). Entre deux, le service apparaît « stopped » : c'est normal.
module.exports = { apps: [{
  name: 'iloh-sauvegarde',
  script: 'sauvegarde.js',
  cwd: __dirname,
  env: { DST_KEY: process.env.HOME + '/secrets/khurdans-cle.json', TZ: 'Europe/Paris' },
  cron_restart: '0 4 * * 0',
  autorestart: false,
}] };
