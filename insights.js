import {txRub,validDate} from './domain.js?v=2.2.12';

// Read-only snapshot: two equal consecutive 30-day windows and current-month budgets.
export function localInsights(state, asOf) {
  if (!validDate(asOf)) throw Error('Некорректная дата отчёта');
  const shift = days => { const d = new Date(asOf+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+days); return d.toISOString().slice(0,10); };
  const current = {from:shift(-29),to:asOf,income:0,expense:0,count:0};
  const previous = {from:shift(-59),to:shift(-30),income:0,expense:0,count:0};
  const month = asOf.slice(0,7), spent = [0,0,0], categorySections = new Map(state.categories.map(c=>[c.id,c.section]));
  const categoryExpenses = new Map();
  for (const t of state.transactions) {
    if (t.deleted || !['income','expense'].includes(t.type) || t.date>asOf) continue;
    const window = t.date>=current.from ? current : t.date>=previous.from ? previous : null;
    const inMonth = t.type==='expense' && t.date.startsWith(month);
    if (!window && !inMonth) continue;
    const value = txRub(state,t);
    if (window) { window[t.type] += value; window.count++; }
    if (window === current && t.type === 'expense') categoryExpenses.set(t.categoryId, (categoryExpenses.get(t.categoryId) || 0) + value);
    if (inMonth) spent[categorySections.get(t.categoryId) ?? 1] += value;
  }
  const budgets = state.budgets[month] || [0,0,0];
  return {current,previous,month,categoryExpenses:[...categoryExpenses].map(([categoryId,amount])=>({categoryId,amount})).sort((a,b)=>b.amount-a.amount),overspent:spent.map((amount,section)=>({section,amount,budget:budgets[section]||0})).filter(x=>x.budget>0 && x.amount>x.budget)};
}
