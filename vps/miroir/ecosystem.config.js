// pm2 : lancer avec « pm2 start ecosystem.config.js » depuis ~/iloh-miroir.
// Les chemins des clés de service sont à adapter si les fichiers portent un autre nom dans ~/secrets.
module.exports = { apps: [{
  name: 'iloh-miroir',
  script: 'miroir.js',
  cwd: __dirname,
  env: {
    SRC_KEY: process.env.HOME + '/secrets/journal-rp-service-account.json',
    DST_KEY: process.env.HOME + '/secrets/khurdans-service-account.json',
  },
  max_memory_restart: '200M',
  restart_delay: 10000,
}] };
