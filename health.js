import {validateBackup} from './domain.js?v=2.2.12';

// Read-only diagnostic for the current Stack 2.x snapshot, not a repair tool.
export function inspectHealth(state) {
  try { validateBackup(state); }
  catch { return {valid: false, unsafeBalances: 0}; }
  const balances = new Map(state.accounts.map(a => [a.id, 0n]));
  const unsafe = new Set(), max = BigInt(Number.MAX_SAFE_INTEGER);
  const check = (id, n) => { if (n > max || n < -max) unsafe.add(id); };
  for (const tx of state.transactions) if (!tx.deleted) {
    const sums = new Map();
    for (const p of tx.splits) {
      const n = (sums.get(p.accountId) || 0n) + BigInt(p.amount);
      sums.set(p.accountId, n); check(p.accountId, n);
    }
    for (const [id, n] of sums) {
      const total = balances.get(id) + n;
      balances.set(id, total); check(id, total);
    }
  }
  for (const a of state.accounts) check(a.id, balances.get(a.id) + BigInt(a.initial));
  return {valid: true, unsafeBalances: unsafe.size};
}
