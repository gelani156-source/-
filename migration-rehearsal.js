import {validateBackup, balance} from './domain.js?v=2.2.12';

// Offline rehearsal only. This module never opens IndexedDB or commits data.
// A migration must preserve the complete v1 snapshot until a new schema and
// its explicit equivalence rules have been agreed and tested.
export function rehearseMigration(source, migrate = value => value) {
  const original = structuredClone(source);
  validateBackup(original);
  const expected = snapshot(original);
  const working = structuredClone(original);
  const candidate = migrate(working);
  if (!candidate || typeof candidate !== 'object' || typeof candidate.then === 'function') {
    throw Error('Миграция должна синхронно вернуть снимок');
  }
  validateBackup(candidate);
  if (!equalData(original, candidate)) throw Error('Миграция изменила данные: правила преобразования не утверждены');
  const actual = snapshot(candidate);
  for (let i = 0; i < expected.length; i++) {
    if (expected[i].id !== actual[i].id || expected[i].minor !== actual[i].minor)
      throw Error('Баланс после миграции отличается');
  }
  return {candidate: structuredClone(candidate), balances: actual};
}

function snapshot(state) {
  const totals = new Map(state.accounts.map(a => [a.id, 0n]));
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const safe = n => n >= -max && n <= max;
  // The existing balance() sums transaction deltas before the opening balance.
  // Reject unsafe intermediate values even when the final result is in range.
  for (const t of state.transactions) if (!t.deleted) {
    for (const p of t.splits) {
      const n = totals.get(p.accountId) + BigInt(p.amount);
      if (!safe(n)) throw Error('Небезопасный промежуточный баланс');
      totals.set(p.accountId, n);
    }
  }
  return state.accounts.map(a => {
    const exact = totals.get(a.id) + BigInt(a.initial);
    if (!safe(exact) || balance(state, a.id) !== Number(exact))
      throw Error('Небезопасный или несогласованный баланс');
    return {id: a.id, currency: a.currency, minor: Number(exact)};
  });
}

// Compare the full structured-cloneable state, including fields unknown to v1.
// Only plain JSON-like backup data is accepted; fail closed on exotic objects.
function equalData(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const aa = Array.isArray(a), ba = Array.isArray(b);
  if (aa !== ba || (!aa && (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype))) return false;
  const ak = Object.keys(a).sort(), bk = Object.keys(b).sort();
  if (ak.length !== bk.length || ak.some((k, i) => k !== bk[i])) return false;
  return ak.every(k => equalData(a[k], b[k]));
}
