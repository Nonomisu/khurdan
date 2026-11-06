// pm2 : lancer avec « pm2 start ecosystem.config.js » depuis ~/iloh-notifs.
module.exports = { apps: [{
  name: 'iloh-notifs',
  script: 'notifs.js',
  cwd: __dirname,
  env: {
    DST_KEY: process.env.HOME + '/secrets/khurdans-cle.json',
    VAPID_KEY: process.env.HOME + '/secrets/iloh-vapid.json',
  },
  max_memory_restart: '150M',
  restart_delay: 10000,
}] };
