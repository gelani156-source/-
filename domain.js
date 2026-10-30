// All amounts are integer minor units (kopecks). No stored account balances.
export const sections=['Обязательные','Повседневные','Образ жизни'];
export const uid=()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;return Array.from(b,(n,i)=>([4,6,8,10].includes(i)?'-':'')+n.toString(16).padStart(2,'0')).join('');};
export const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export function cents(value){const s=String(value).trim().replace(/\s/g,'').replace(',','.');if(!/^-?\d+(\.\d{1,2})?$/.test(s))throw Error('Введите сумму с точностью до копеек');const n=Math.round(Number(s)*100);if(!Number.isSafeInteger(n)||Math.abs(n)>1e12)throw Error('Сумма слишком велика');return n;}
export function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s;}
export function fresh(){return {format:'stack',version:1,revision:0,accounts:[],transactions:[],categories:[['Продукты',1,'basket'],['Кафе',1,'cup'],['Транспорт',1,'car'],['Покупки',2,'bag'],['Жильё',0,'home'],['Связь',0,'phone'],['Здоровье',1,'heart'],['Отдых',2,'sun'],['Зарплата',2,'wallet'],['Прочее',1,'dots']].map(([name,section,icon])=>({id:uid(),name,section,icon,hidden:false})),budgets:{},goals:[],loans:[],recurring:[],templates:[],settings:{theme:'system',lastBackup:null,pin:null,rates:{RUB:1,USD:100,EUR:110},ratesDate:null}};}
export const balance=(s,id)=>s.accounts.find(a=>a.id===id).initial+s.transactions.filter(t=>!t.deleted).reduce((n,t)=>n+t.splits.filter(p=>p.accountId===id).reduce((v,p)=>v+p.amount,0),0);
export const amount=t=>t.type==='transfer'?t.splits.filter(p=>p.amount>0).reduce((n,p)=>n+p.amount,0):Math.abs(t.splits.reduce((n,p)=>n+p.amount,0));
export const rub=(s,n,currency)=>Math.round(n*s.settings.rates[currency]);
export const txRub=(s,t)=>t.splits.reduce((n,p)=>n+rub(s,Math.abs(p.amount),s.accounts.find(a=>a.id===p.accountId).currency),0);
export function validateTx(s,t){
 if(!['expense','income','transfer'].includes(t.type)||!validDate(t.date))throw Error('Некорректный тип или дата');
 if(!Array.isArray(t.splits)||!t.splits.length||t.splits.length>30)throw Error('Выберите счёт');
 const used=new Set();
 for(const p of t.splits){const a=s.accounts.find(a=>a.id===p.accountId);if(!a||!Number.isSafeInteger(p.amount)||Math.abs(p.amount)>1e12||p.amount===0||used.has(a.id))throw Error('Проверьте счета и суммы сплита');used.add(a.id);}
 if(t.type==='transfer'){if(t.splits.length!==2||t.splits[0].amount>=0||t.splits[1].amount<=0)throw Error('Укажите два разных счёта перевода');const [a,b]=t.splits.map(p=>s.accounts.find(a=>a.id===p.accountId));if(a.currency===b.currency&&t.splits[0].amount+t.splits[1].amount!==0)throw Error('Суммы перевода должны совпадать');}
 else{if(!s.categories.some(c=>c.id===t.categoryId))throw Error('Выберите категорию');if(t.splits.some(p=>t.type==='expense'?p.amount>=0:p.amount<=0))throw Error('Неверный знак суммы');if(new Set(t.splits.map(p=>s.accounts.find(a=>a.id===p.accountId).currency)).size!==1)throw Error('Сплит доступен только для счетов в одной валюте');}
 return t;
}
export function stats(s,month,date=today()){
 const tx=s.transactions.filter(t=>!t.deleted&&t.date.startsWith(month)&&t.type!=='transfer');
 const spent=[0,0,0],cats={};let income=0,expense=0,before=0,todaySpent=0;
 for(const t of tx){const v=txRub(s,t);if(t.type==='income'){income+=v;continue;}expense+=v;const section=s.categories.find(c=>c.id===t.categoryId)?.section??1;spent[section]+=v;cats[t.categoryId]=(cats[t.categoryId]||0)+v;if(section===1&&t.date<date)before+=v;if(section===1&&t.date===date)todaySpent+=v;}
 const budget=s.budgets[month]||[0,0,0],d=new Date(date+'T12:00:00'),days=new Date(d.getFullYear(),d.getMonth()+1,0).getDate()-d.getDate()+1;
 const limit=Math.floor((budget[1]-before)/days);
 return {income,expense,spent,cats,budget,days,limit,todaySpent,leftToday:limit-todaySpent};
}
export function dueDate(r,month){const [y,m]=month.split('-').map(Number);return `${month}-${String(Math.min(r.day,new Date(y,m,0).getDate())).padStart(2,'0')}`;}
export function unpaid(s,month){return s.recurring.filter(r=>!s.transactions.some(t=>!t.deleted&&t.recurringId===r.id&&t.recurringMonth===month));}
export function total(s){return s.accounts.reduce((n,a)=>n+rub(s,balance(s,a.id),a.currency),0);}
export function free(s,month){return total(s)-s.goals.reduce((n,g)=>n+g.saved,0)-unpaid(s,month).reduce((n,r)=>n+rub(s,r.amount,s.accounts.find(a=>a.id===r.accountId).currency),0);}
export function parseText(text){
 const q=new URLSearchParams(text.trim().replace(/^.*\?/,''));let value,date=today();
 if(q.has('s')&&q.has('t')){value=q.get('s');const d=q.get('t');date=`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;}
 else{const clean=text.replace(/(?:остаток|баланс|доступно)[\s\S]*$/i,'');const m=clean.match(/(?:покупка|оплата|списание|зачисление|перевод|сумма|итого|потратил[аи]?|получил[аи]?)\D{0,25}(\d[\d ]*(?:[.,]\d{1,2})?)/i)||clean.match(/(\d[\d ]*(?:[.,]\d{1,2})?)\s*(?:₽|руб|RUB)/i);if(m)value=m[1];
  if(!value){const candidate=clean.match(/(?:^|\s)(\d[\d ]*(?:[.,]\d{1,2})?)(?:\s*(?:тысяч(?:а|и|у)?|тыс\.?|руб(?:лей|ля|ль)?|₽))?(?:\s|$)/i);if(candidate)value=candidate[1];}
  if(value&&new RegExp('(?:'+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')\\s*(?:тысяч(?:а|и|у)?|тыс\.?)','i').test(clean))value=String(Math.round(Number(value.replace(/\s/g,'').replace(',','.'))*1000));
  if(/вчера/i.test(clean)){const d=new Date(today()+'T12:00:00');d.setDate(d.getDate()-1);date=[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');}
 }
 if(!value)throw Error('Не удалось выделить сумму. Введите её вручную.');
 return {amount:cents(value),date:validDate(date)?date:today(),type:/зачислен|поступлен|зарплата|преми[яюи]|получил/i.test(text)?'income':'expense',note:text.slice(0,500)};
}
export function parseCSV(text){
 text=text.replace(/^\uFEFF/,'');const first=text.split(/\r?\n/)[0],sep=(first.match(/;/g)||[]).length>=(first.match(/,/g)||[]).length?';':',';
 const rows=[];let row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){field+='"';i++;}else quoted=!quoted;}else if(c===sep&&!quoted){row.push(field);field='';}else if(c==='\n'&&!quoted){row.push(field.replace(/\r$/,''));rows.push(row);row=[];field='';}else field+=c;}if(quoted)throw Error('Незакрытые кавычки в CSV');if(field||row.length){row.push(field.replace(/\r$/,''));rows.push(row);}return rows.filter(r=>r.some(Boolean));
}
export function csvCandidates(text){const rows=parseCSV(text),h=rows.shift().map(x=>x.trim().toLowerCase());const col=(names)=>h.findIndex(x=>names.includes(x));const di=col(['date','дата','дата операции']),ai=col(['amount','сумма','сумма операции']),ni=col(['note','описание','назначение платежа']),ti=col(['type','тип']);if(di<0||ai<0)throw Error('CSV: нужны столбцы date/дата и amount/сумма. Смотрите пример в архиве.');return rows.map((r,i)=>{let date=r[di]?.trim().split(' ')[0];if(/^\d{2}\.\d{2}\.\d{4}$/.test(date))date=date.split('.').reverse().join('-');const n=cents(r[ai]);if(!n||!validDate(date))throw Error(`CSV: проверьте строку ${i+2}`);let type=ti>=0?r[ti]?.trim().toLowerCase():n<0?'expense':'income';if(type==='расход')type='expense';if(type==='доход')type='income';if(!['expense','income'].includes(type))throw Error(`CSV: неизвестный тип в строке ${i+2}`);return {date,type,amount:Math.abs(n),note:ni>=0?r[ni]:'Импорт CSV'};});}
export function legacyCandidates(raw){const data=raw.data||raw;const items=data.entries||data.transactions||data.operations;if(!Array.isArray(items))throw Error('Не найдены entries, transactions или operations Money Radar');return items.map((t,i)=>{const type=({expense:'expense',income:'income','расход':'expense','доход':'income'})[String(t.type).toLowerCase()];const date=String(t.date||'').slice(0,10);if(!type||!validDate(date))throw Error(`Money Radar: неподдерживаемая запись ${i+1}. Импорт остановлен без изменений.`);const n=cents(t.amount);if(!n)throw Error(`Нулевая сумма в записи ${i+1}`);return {type,date,amount:Math.abs(n),note:String(t.note||t.comment||t.description||''),categoryName:String(t.category||'Прочее')};});}
export function validateBackup(s){
 if(s?.format!=='stack'||s.version!==1)throw Error('Это не резервная копия Stack 1');
 for(const k of ['accounts','transactions','categories','goals','loans','recurring','templates'])if(!Array.isArray(s[k])||s[k].length>100000)throw Error('Повреждён раздел '+k);
 const str=x=>typeof x==='string'&&x.length<=2000,num=x=>Number.isSafeInteger(x)&&Math.abs(x)<=1e12;
 for(const k of ['accounts','transactions','categories','goals','loans','recurring','templates']){const ids=new Set();for(const x of s[k]){if(!str(x.id)||!x.id||ids.has(x.id))throw Error('Некорректные ID: '+k);ids.add(x.id);}}
 for(const a of s.accounts)if(!str(a.name)||!['RUB','USD','EUR'].includes(a.currency)||!num(a.initial)||!['debit','cash','credit','savings'].includes(a.type))throw Error('Повреждён счёт');
 for(const c of s.categories)if(!str(c.name)||![0,1,2].includes(c.section))throw Error('Повреждена категория');
 if(s.settings?.pin&&(!/^[a-f0-9]{64}$/.test(s.settings.pin.hash)||typeof s.settings.pin.salt!=='string'||s.settings.pin.salt.length>100))throw Error('Повреждён PIN');
 if(!s.settings||!['system','dark','light'].includes(s.settings.theme)||!s.settings.rates||s.settings.rates.RUB!==1)throw Error('Повреждены настройки');
 for(const c of ['USD','EUR'])if(!Number.isFinite(s.settings.rates[c])||s.settings.rates[c]<=0||s.settings.rates[c]>1000000)throw Error('Некорректный курс');
 if(!s.budgets||typeof s.budgets!=='object')throw Error('Повреждены бюджеты');
 for(const [k,v]of Object.entries(s.budgets))if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(k)||!Array.isArray(v)||v.length!==3||v.some(n=>!num(n)||n<0))throw Error('Повреждён бюджет');
 for(const t of s.transactions){validateTx(s,t);if(t.note!==undefined&&!str(t.note))throw Error('Повреждена заметка');if(t.created!==undefined&&!str(t.created))throw Error('Повреждена дата создания');if(t.recurringMonth!==undefined&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(t.recurringMonth))throw Error('Повреждён месяц платежа');}
 for(const g of s.goals)if(!str(g.name)||!num(g.target)||g.target<=0||!num(g.saved)||g.saved<0)throw Error('Повреждена цель');
 for(const l of s.loans)if(!str(l.name)||!num(l.remaining)||l.remaining<0||!['owed','owe'].includes(l.direction))throw Error('Повреждён долг');
 for(const k of ['recurring','templates'])for(const r of s[k])if(!str(r.name)||!num(r.amount)||r.amount<=0||!s.accounts.some(a=>a.id===r.accountId)||!s.categories.some(c=>c.id===r.categoryId)||(k==='recurring'&&(!Number.isInteger(r.day)||r.day<1||r.day>31||![0,1,3,7].includes(r.before))))throw Error('Повреждён платёж или шаблон');
 return s;
}
export function ics(s){const esc=x=>String(x).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');const month=today().slice(0,7);const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Stack//Payments//RU','CALSCALE:GREGORIAN'];for(const r of s.recurring){const date=dueDate(r,month).replaceAll('-','');lines.push('BEGIN:VEVENT',`UID:${r.id}@stack.local`,`DTSTAMP:${today().replaceAll('-','')}T000000Z`,`DTSTART;VALUE=DATE:${date}`,`RRULE:FREQ=MONTHLY;BYMONTHDAY=${r.day>=29?r.day+',-1;BYSETPOS=1':r.day}`,`SUMMARY:${esc(r.name)}`,`DESCRIPTION:${esc('Плановый платёж: '+(r.amount/100)+' '+s.accounts.find(a=>a.id===r.accountId).currency+'. Отметьте оплату в Stack.')}`,'BEGIN:VALARM',`TRIGGER:-P${r.before||0}D`,'ACTION:DISPLAY',`DESCRIPTION:${esc(r.name)}`,'END:VALARM','END:VEVENT');}lines.push('END:VCALENDAR');return lines.map(line=>{let out='',len=0;for(const char of line){const n=new TextEncoder().encode(char).length;if(len+n>75){out+='\r\n ';len=1;}out+=char;len+=n;}return out;}).join('\r\n')+'\r\n';}
