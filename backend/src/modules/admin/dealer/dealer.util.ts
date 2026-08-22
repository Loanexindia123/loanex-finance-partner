import { randomUUID } from 'node:crypto';

/** Mirrors freelancer-agent.util.ts's generateAgentId() exactly, for Dealer. */
export function generateDealerCode(): string {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase();
  return `DLR-${suffix}`;
}
