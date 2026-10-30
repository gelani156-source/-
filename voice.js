export function recognitionAvailable(){return !!(window.SpeechRecognition||window.webkitSpeechRecognition);}
export function startRecognition({onResult,onError,onEnd}){
 const API=window.SpeechRecognition||window.webkitSpeechRecognition;
 if(!API)throw Error('Этот браузер не поддерживает встроенное распознавание. Используйте диктовку клавиатуры.');
 const recognition=new API(); recognition.lang='ru-RU';recognition.continuous=false;recognition.interimResults=false;
 recognition.onresult=event=>{const text=[...event.results].map(r=>r[0]?.transcript||'').join(' ').trim();if(text)onResult(text);else onError('Речь не распознана');};
 recognition.onerror=event=>onError(({notAllowed:'Нет доступа к микрофону', 'not-allowed':'Нет доступа к микрофону',network:'Сеть недоступна', 'no-speech':'Речь не обнаружена'})[event.error]||'Не удалось распознать речь');
 recognition.onend=()=>onEnd?.();recognition.start();return recognition;
}
