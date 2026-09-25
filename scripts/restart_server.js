const { execSync } = require('child_process');

console.log('--- RESTARTING APPLICATION ON PLESK ---');
try {
  console.log('1. Checking PM2 processes...');
  try {
    const pm2List = execSync('npx pm2 list || pm2 list', { encoding: 'utf8' });
    console.log(pm2List);
    console.log('Restarting PM2...');
    execSync('npx pm2 restart all || pm2 restart all', { stdio: 'inherit' });
    console.log('PM2 restarted successfully.');
  } catch (e) {
    console.log('PM2 restart notice:', e.message);
  }

  console.log('2. Touching tmp/restart.txt for Passenger...');
  try {
    execSync('mkdir -p tmp && touch tmp/restart.txt', { stdio: 'inherit' });
    console.log('tmp/restart.txt touched.');
  } catch (e) {
    console.log('Passenger restart notice:', e.message);
  }

  console.log('--- DONE ---');
} catch (err) {
  console.error('Error during restart:', err);
}
