// A temporary what-if calculation. Inputs and outputs are integer minor units.
// No state, storage, network, exchange rates or transaction writes are involved.
export function simulatePurchase({balance, price, income, expenses, reserve}) {
  for (const [name, n] of Object.entries({balance, price, income, expenses, reserve})) {
    if (!Number.isSafeInteger(n) || Math.abs(n) > 1e12) throw Error('Проверьте суммы');
    if (name !== 'balance' && n < 0) throw Error('Суммы не могут быть отрицательными');
  }
  if (price === 0) throw Error('Сумма покупки должна быть больше нуля');
  const now = balance - price;
  const beforeLater = balance + income - expenses;
  const end = beforeLater - price;
  if (![now, beforeLater, end].every(Number.isSafeInteger)) throw Error('Сумма слишком велика');
  return {
    now, beforeLater, end,
    nowBelowReserve: now < reserve,
    laterBeforeBelowReserve: beforeLater < reserve,
    endBelowReserve: end < reserve
  };
}
