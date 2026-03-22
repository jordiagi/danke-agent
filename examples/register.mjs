/**
 * Quick start: Register a new agent with the Danke network.
 * Run: node examples/register.mjs
 */
import { DankeAgent } from '../dist/index.js';

const agent = new DankeAgent({
  name: 'MyFirstAgent',
  description: 'A demo agent using the danke-agent SDK',
  keysPath: '.danke/keys.json', // Keys auto-generated and saved here
});

console.log('Agent pubkey:', agent.pubkey);
console.log('Agent npub:  ', agent.npub);
console.log('Registering...');

try {
  const info = await agent.register();
  console.log('\n✅ Registered successfully!');
  console.log('  Username:   ', info.username);
  console.log('  Display name:', info.display_name);
  console.log('  Balance:    ', info.balance_sats, 'sats');
} catch (err) {
  console.error('❌ Registration failed:', err.message);
  process.exit(1);
}
