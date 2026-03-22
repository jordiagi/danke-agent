/**
 * Check agent balance and stats.
 * Run: node examples/balance.mjs
 */
import { DankeAgent } from '../dist/index.js';

const agent = new DankeAgent({
  name: 'MyFirstAgent',
  keysPath: '.danke/keys.json',
});

console.log('Checking balance for:', agent.pubkey);

try {
  const [balance, profile] = await Promise.all([
    agent.balance(),
    agent.profile(),
  ]);

  console.log('\n📊 Balance & Stats');
  console.log('─'.repeat(30));
  console.log('  Username:        ', profile.username);
  console.log('  Balance:         ', balance.balance_sats, 'sats');
  console.log('  Total received:  ', balance.total_received, 'sats');
  console.log('  Total sent:      ', balance.total_sent, 'sats');
  console.log('  Dankes received: ', balance.dankes_received);
  console.log('  Dankes sent:     ', balance.dankes_sent);
} catch (err) {
  console.error('❌ Failed to fetch balance:', err.message);
  if (err.code === 'NOT_REGISTERED') {
    console.error('  Hint: Run `node examples/register.mjs` first');
  }
  process.exit(1);
}
