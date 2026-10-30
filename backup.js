import {validateBackup} from './domain.js';
const enc=new TextEncoder();const dec=new TextDecoder();
const b64=b=>btoa(String.fromCharCode(...b));
const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export function backupSnapshot(state){const value=structuredClone(state);value.settings.pin=null;return validateBackup(value);}
export function backupSummary(value){validateBackup(value);return {accounts:value.accounts.length,transactions:value.transactions.filter(t=>!t.deleted).length,categories:value.categories.length};}
export async function encryptBackup(value,password){
 if(!password||password.length<10)throw Error('Для шифрования нужен пароль минимум из 10 символов');
 validateBackup(value);const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const passwordKey=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},passwordKey,{name:'AES-GCM',length:256},false,['encrypt']);
 const data=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,enc.encode(JSON.stringify(value))));
 return {format:'stack-encrypted',version:1,algorithm:'AES-256-GCM',kdf:'PBKDF2-SHA256',iterations:310000,salt:b64(salt),iv:b64(iv),data:b64(data)};
}
export async function decryptBackup(container,password){
 if(container?.format!=='stack-encrypted'||container.version!==1||container.algorithm!=='AES-256-GCM'||container.iterations!==310000||typeof container.data!=='string'||container.data.length>30000000)throw Error('Неподдерживаемый формат зашифрованной копии');
 try{const salt=unb64(container.salt),iv=unb64(container.iv);if(salt.length!==16||iv.length!==12)throw Error('Некорректные параметры');
 const passKey=await crypto.subtle.importKey('raw',enc.encode(password),'PBKDF2',false,['deriveKey']);
 const key=await crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},passKey,{name:'AES-GCM',length:256},false,['decrypt']);
 const raw=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,unb64(container.data));return validateBackup(JSON.parse(dec.decode(raw)));
 }catch{throw Error('Неверный пароль или повреждённый файл');}
}
