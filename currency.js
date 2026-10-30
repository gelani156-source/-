// Public CBR daily exchange rates, with no API keys or financial data transmitted.
export async function fetchCBR(signal){
 const response=await fetch('https://www.cbr-xml-daily.ru/daily_json.js',{signal,cache:'no-store'});
 if(!response.ok)throw Error('Сервис курсов недоступен ('+response.status+')');
 const json=await response.json();
 const rates={RUB:1};
 for(const code of ['USD','EUR']){
  const v=json?.Valute?.[code];const n=Number(v?.Value)/Number(v?.Nominal);
  if(!Number.isFinite(n)||n<=0||n>1e6)throw Error('Сервис вернул некорректный курс '+code);
  rates[code]=Math.round(n*10000)/10000;
 }
 const date=new Date(json.Date);
 if(!Number.isFinite(date.getTime())||date.getTime()>Date.now()+86400000)throw Error('Некорректная дата валютного курса');
 return {rates,rateDate:date.toISOString().slice(0,10),fetchedAt:new Date().toISOString(),source:'ЦБ РФ (публичное зеркало cbr-xml-daily.ru)'};
}
