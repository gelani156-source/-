// STACK WIDGET 1.8 — Scriptable · небольшой / средний / большой
// Сводка локально обновляется после нажатия «Ещё → Виджет Scriptable» внутри Stack.
const fm=FileManager.local();
const path=fm.joinPath(fm.documentsDirectory(),'stack-widget-v1.json');
const palette={bg:'#101214',panel:'#1e242a',text:'#f0f4f8',muted:'#a3adba',blue:'#0a84ff',green:'#4dd6a3',red:'#ff6873',bars:['#0a84ff','#50b7a7','#f0ad5c','#aa8fe7','#ee7b96']};
const num=x=>Number.isFinite(Number(x))?Number(x):0;
const money=x=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(num(x))+' ₽';
function line(parent,value,size=12,color=palette.text,bold=false){const t=parent.addText(String(value));t.font=bold?Font.boldSystemFont(size):Font.systemFont(size);t.textColor=new Color(color);t.lineLimit=1;return t;}
function section(w,label,value,color){const r=w.addStack();r.layoutHorizontally();r.centerAlignContent();line(r,label,11,palette.muted);r.addSpacer(5);line(r,value,12,color,true);w.addSpacer(6);}
function pbar(w,fraction,color){const outer=w.addStack();outer.layoutHorizontally();outer.backgroundColor=new Color(palette.panel);outer.cornerRadius=5;outer.size=new Size(0,7);outer.addSpacer();const pct=Math.min(100,Math.max(0,fraction*100));const ctx=new DrawContext();ctx.size=new Size(290,8);ctx.opaque=false;ctx.setFillColor(new Color(palette.panel));ctx.fillRect(new Rect(0,0,290,8));ctx.setFillColor(new Color(color));ctx.fillRect(new Rect(0,0,290*pct/100,8));const img=w.addImage(ctx.getImage());img.imageSize=new Size(290,8);img.cornerRadius=4;}
function bar(w,label,value,scale,color){const r=w.addStack();r.layoutHorizontally();r.centerAlignContent();line(r,label.slice(0,18),10,palette.muted);r.addSpacer(4);line(r,money(value),10,palette.text,true);w.addSpacer(3);const dc=new DrawContext();dc.size=new Size(280,7);dc.opaque=false;dc.setFillColor(new Color('#35404a'));dc.fillRect(new Rect(0,0,280,7));dc.setFillColor(new Color(color));dc.fillRect(new Rect(0,0,Math.max(1,280*Math.min(1,value/Math.max(1,scale))),7));const v=w.addImage(dc.getImage());v.imageSize=new Size(280,7);v.cornerRadius=3;w.addSpacer(7);}
let data=null;
const raw=args.queryParameters?.parameter||args.shortcutParameter||'';
if(raw){try{const parsed=typeof raw==='string'?JSON.parse(raw):raw;if(parsed.format!=='stack-widget-v1'||!Number.isFinite(parsed.balance))throw Error('Неверный формат');data={...parsed,categories:Array.isArray(parsed.categories)?parsed.categories.slice(0,5):[],recent:Array.isArray(parsed.recent)?parsed.recent.slice(0,3):[]};fm.writeString(path,JSON.stringify(data));if(!config.runsInWidget){const a=new Alert();a.title='Stack обновлён';a.message='Снимок сохранён для виджета.';a.addAction('Готово');await a.present()}}catch(err){if(!config.runsInWidget){const a=new Alert();a.title='Ошибка Stack Widget';a.message=String(err);a.addAction('Закрыть');await a.present()}}}
if(!data&&fm.fileExists(path)){try{data=JSON.parse(fm.readString(path))}catch{}}
const family=config.widgetFamily||'large';
const w=new ListWidget();w.backgroundColor=new Color(palette.bg);w.setPadding(15,16,14,16);
const head=w.addStack();head.layoutHorizontally();line(head,'▤  STACK',17,palette.text,true);head.addSpacer();line(head,'●',12,palette.blue,true);w.addSpacer(8);
if(!data){line(w,'Нет данных',14,palette.muted);w.addSpacer(8);line(w,'Stack → Ещё → Виджет Scriptable',10,palette.muted);}
else{
 const stamp=new Date(data.date);const stale=isNaN(stamp.getTime())||Date.now()-stamp.getTime()>36*3600*1000;
 line(w,'БАЛАНС',10,palette.muted,true);line(w,money(data.balance),family==='small'?22:26,palette.text,true);w.addSpacer(8);
 section(w,'Свободно',money(data.free),palette.green);
 if(family==='small'){
  section(w,'На сегодня',money(data.todayLimit),palette.blue);
 }else{
  section(w,'Сегодня можно',money(data.todayLimit),palette.blue);
  section(w,'Расходы · месяц',money(data.expense),palette.red);
  if(family==='large')section(w,'Доходы · месяц','+'+money(data.income),palette.green);
  w.addSpacer(5);line(w,'КУДА УХОДЯТ ДЕНЬГИ',10,palette.blue,true);w.addSpacer(6);
  const categories=(data.categories||[]).filter(x=>num(x.amount)>0);const peak=Math.max(1,...categories.map(x=>num(x.amount)));
  if(!categories.length)line(w,'За месяц расходов нет',11,palette.muted);
  else for(const [i,x] of categories.slice(0,family==='medium'?3:5).entries())bar(w,x.name,num(x.amount),peak,palette.bars[i%palette.bars.length]);
 }
 w.addSpacer();line(w,(stale?'⚠ Данные устарели · ':'Обновлено · ')+(isNaN(stamp.getTime())?'—':stamp.toLocaleString('ru-RU',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})),9,stale?palette.red:palette.muted);
 if(/^https:\/\//i.test(data.url||''))w.url=data.url;
}
Script.setWidget(w);
if(!config.runsInWidget){if(family==='small')await w.presentSmall();else if(family==='medium')await w.presentMedium();else await w.presentLarge();}
Script.complete();
