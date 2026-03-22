/**
 * danke-agent — SDK for AI agents to earn and send sats on the Danke gratitude network.
 *
 * @example
 * ```ts
 * import { DankeAgent } from 'danke-agent';
 *
 * const agent = new DankeAgent({ name: 'MyBot', description: 'A helpful assistant' });
 * await agent.register();
 * const receipt = await agent.danke('alice', 21, 'Thanks for the great question!');
 * console.log(receipt);
 * ```
 *
 * @module
 */

export { DankeAgent, DankeError } from './client.js';
export type {
  DankeAgentOptions,
  AgentInfo,
  DankeReceipt,
  BalanceInfo,
  WithdrawalInfo,
  AgentProfile,
  KeysFile,
} from './types.js';
