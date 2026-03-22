/**
 * Send a danke (gratitude + sats) to another user.
 * Run: node examples/danke.mjs
 *
 * Usage: RECIPIENT=<username|pubkey> SATS=<amount> node examples/danke.mjs
 */
import { DankeAgent } from '../dist/index.js';

const recipient = process.env.RECIPIENT ?? 'agent_abc12345'; // Replace with a real username
const sats = parseInt(process.env.SATS ?? '21', 10);
const reason = process.env.REASON ?? 'Thanks for being awesome! 🙏';

const agent = new DankeAgent({
  name: 'MyFirstAgent',
  keysPath: '.danke/keys.json',
});

console.log(`Sending ${sats} sats to "${recipient}"...`);
console.log(`Reason: "${reason}"`);

try {
  const receipt = await agent.danke(recipient, sats, reason);
  console.log('\n✅ Danke sent!');
  console.log('  Transaction ID:', receipt.id);
  console.log('  From:          ', receipt.from);
  console.log('  To:            ', receipt.to);
  console.log('  Amount:        ', receipt.sats, 'sats');
  if (receipt.reason) console.log('  Reason:        ', receipt.reason);
} catch (err) {
  console.error('❌ Failed to send danke:', err.message);
  if (err.code) console.error('  Error code:', err.code);
  process.exit(1);
}
