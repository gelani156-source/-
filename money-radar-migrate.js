// Money Radar 5-7.x -> Stack, lossless source preserved in transfer JSON.
// This function only changes a cloned Stack state; caller commits atomically.
const clean=(x,max=120)=>String(x??'').trim().slice(0,max);
const cash=x=>{if(typeof x==='string')x=x.replace(/[\s\u00a0₽]/g,'').replace(',','.');const n=Number(x);if(!Number.isFinite(n)||Math.abs(n)>1e10)throw Error('Некорректная сумма Money Radar: '+String(x));return Math.round(n*100);};
const key=x=>clean(x,300).toLowerCase();
const uuid=()=>crypto.randomUUID();
const sourceID=(kind,x,i)=>'mr-'+kind+'-'+clean(x?.id??i,110);
const date=x=>{const s=clean(x,40).slice(0,10);if(!/^\d{4}-\d\d-\d\d$/.test(s)||Number.isNaN(Date.parse(s)))throw Error('Некорректная дата: '+s);return s;};
function section(s){const v=key(s);if(/обяз|жиль|кредит/.test(v))return 0;if(/повседнев|продукт|транспорт/.test(v))return 1;if(/образ|разов|досуг|отдых/.test(v))return 2;return 1;}
function array(x){return Array.isArray(x)?x:[];}
export function inspectMoneyRadar(raw){
 const d=raw?.moneyRadarOriginal?.data||raw?.moneyRadarOriginal||raw?.data||raw;
 if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Неверная база Money Radar');
 if(!Array.isArray(d.transactions)&&!Array.isArray(d.entries)&&!Array.isArray(d.operations))throw Error('Не найден список операций Money Radar');
 return {data:d,counts:{transactions:array(d.transactions||d.entries||d.operations).length,loans:array(d.loans).length,goals:array(d.goals).length,recurring:array(d.recurring).length,templates:array(d.templates).length},hasBudget:d.sectionBudgets!=null||d.monthlyBudget!=null,hasInitial:d.initialBalance!=null,unmappedFields:Object.keys(d).filter(k=>!['version','initialBalance','sectionBudgets','monthlyBudget','transactions','entries','operations','loans','goals','recurring','templates','data'].includes(k))};
}
export function mergeMoneyRadar(base, raw, opts){
 const {data:d}=inspectMoneyRadar(raw);const s=structuredClone(base);let report={transactions:0,duplicates:0,loans:0,goals:0,recurring:0,templates:0,categories:0,budget:false,initial:false,skipped:[]};
 const account=s.accounts.find(a=>a.id===opts.accountId&&a.currency==='RUB');if(!account)throw Error('Выберите рублёвый счёт');
 function category(name,sect){const n=clean(name,60)||'Прочее';let c=s.categories.find(c=>key(c.name)===key(n));if(!c){c={id:uuid(),name:n,section:sect??1,icon:'dots',hidden:false};s.categories.push(c);report.categories++;}return c.id;}
 const tx=array(d.transactions||d.entries||d.operations);
 for(let i=0;i<tx.length;i++){
  const x=tx[i],type=key(x.type);if(!['income','expense','доход','расход'].includes(type)){report.skipped.push('Операция '+(i+1)+': неизвестный тип');continue;}
  const kind=type==='income'||type==='доход'?'income':'expense',day=date(x.date),n=Math.abs(cash(x.amount));if(!n){report.skipped.push('Нулевая операция '+(i+1));continue;}
  const note=clean(x.note??x.comment??x.description,500),catName=clean(x.category||'Прочее'),id=sourceID('tx',x,i);
  const dup=s.transactions.some(t=>!t.deleted&&(t.id===id||t.date===day&&t.type===kind&&t.note===note&&t.splits?.length===1&&t.splits[0].accountId===account.id&&Math.abs(t.splits[0].amount)===n));
  if(dup){report.duplicates++;continue;}
  s.transactions.push({id,date:day,type:kind,note,categoryId:category(catName,section(x.section)),splits:[{accountId:account.id,amount:kind==='expense'?-n:n}],created:new Date().toISOString()});report.transactions++;
 }
 for(let i=0;i<array(d.loans).length;i++){
  const x=d.loans[i],id=sourceID('loan',x,i);const name=clean(x.name,80);const remaining=cash(x.remainingAmount??x.remaining??x.amount??0),original=cash(x.originalAmount??x.original??x.remainingAmount??0);
  if(!name||remaining<0||original<0){report.skipped.push('Долг '+(i+1)+': неверные поля');continue;}
  const direction=['owe','я должен'].includes(key(x.direction))?'owe':'owed';
  if(s.loans.some(l=>l.id===id||key(l.name)===key(name)&&l.direction===direction&&l.remaining===remaining)){continue;}
  const out={id,name,direction,remaining,original:Math.max(original,remaining),date:/^\d{4}-\d\d-\d\d/.test(x.date||'')?String(x.date).slice(0,10):new Date().toISOString().slice(0,10),moneyRadarLegacy:{isOld:!!x.isOld,sourceTransactionId:x.transactionId??null}};
  s.loans.push(out);report.loans++;
 }
 for(let i=0;i<array(d.goals).length;i++){
  const x=d.goals[i],name=clean(x.name,80),target=cash(x.target),saved=cash(x.saved??0),id=sourceID('goal',x,i);
  if(!name||target<=0||saved<0){report.skipped.push('Цель '+(i+1)+': неверные поля');continue;}
  if(s.goals.some(g=>g.id===id||key(g.name)===key(name)&&g.target===target&&g.saved===saved))continue;
  s.goals.push({id,name,target,saved});report.goals++;
 }
 for(const [kind,arr] of [['recurring',array(d.recurring)],['templates',array(d.templates)]])for(let i=0;i<arr.length;i++){
  const x=arr[i],name=clean(x.name,80),amount=cash(x.amount),id=sourceID(kind,x,i);
  if(!name||amount<=0){report.skipped.push(kind+' '+(i+1)+': неверные поля');continue;}
  const day=Number(x.day??1);if(kind==='recurring'&&(!Number.isInteger(day)||day<1||day>31)){report.skipped.push('Регулярный платёж '+(i+1)+': неверный день');continue;}
  const item={id,name,amount,accountId:account.id,categoryId:category(x.category||'Прочее',section(x.section))};
  if(kind==='recurring'){item.day=day;item.before=1;}
  if(s[kind].some(t=>t.id===id||key(t.name)===key(name)&&t.amount===amount&&t.accountId===account.id))continue;
  s[kind].push(item);report[kind]++;
 }
 if(opts.budgetMonth){
  let b=null;const sb=d.sectionBudgets;
  if(Array.isArray(sb)&&sb.length>=3)b=sb.slice(0,3).map(v=>cash(v));
  else if(sb&&typeof sb==='object'){
   b=[0,0,0];for(const [k,v]of Object.entries(sb)){
    const n=Number(k);if(/^\d+$/.test(k)&&n>=0&&n<3)b[n]=cash(v);
    else if(typeof v==='number'||typeof v==='string')b[section(k)]+=cash(v);
   }
  }else if(d.monthlyBudget!=null)b=[0,cash(d.monthlyBudget),0];
  if(b){if(b.some(n=>n<0))throw Error('Отрицательный бюджет Money Radar');s.budgets[opts.budgetMonth]=b;report.budget=true;}
 }
 if(opts.importInitial&&d.initialBalance!=null){if(s.settings.moneyRadarInitialImported)throw Error('Начальный баланс Money Radar уже переносился — повторное добавление запрещено');account.initial+=cash(d.initialBalance);s.settings.moneyRadarInitialImported=true;report.initial=true;}
 return {state:s,report};
}
