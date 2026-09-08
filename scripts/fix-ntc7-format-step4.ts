/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
type Part={kind:"text"|"em"|"strong"|"math";value:string;latex?:string};
type Block={blockId:string;kind:string;listMarker?:"bullet"|"dash"|"none";text?:{raw?:string;normalized:string;inline?:Part[]};evidence?:{pdfPage?:number;normalizedSha256?:string;transformations?:any[]}};
type Unit={blocks:Block[]}; const root=fileURLToPath(new URL("../",import.meta.url)); const dir=join(root,"corpus","units","ntc2018"); const profile="ntc7-format-audit-step4-0.1.0";
function ok(v:unknown,m:string):asserts v{if(!v)throw new Error(m)}
function find(u:Unit,p:string){const b=u.blocks.find(x=>x.text?.normalized.startsWith(p));ok(b?.text,p);return b as Block&{text:NonNullable<Block["text"]>}}
const parts=(b:ReturnType<typeof find>)=>b.text.inline??[{kind:"text" as const,value:b.text.normalized}];
function set(b:ReturnType<typeof find>,xs:Part[]){xs=xs.filter(x=>x.value);ok(xs.map(x=>x.value).join("")===b.text.normalized,b.blockId);b.text.inline=xs}
function replace(b:ReturnType<typeof find>,target:string,part:Part,expected=1){const old=parts(b);const present=old.filter(x=>x.kind===part.kind&&x.value===part.value&&x.latex===part.latex).length;if(present===expected)return;ok(present===0,target);let n=0;const out:Part[]=[];for(const s of old){if(s.kind!=="text"){out.push(s);continue}let c=0;while(c<s.value.length){const i=s.value.indexOf(target,c);if(i<0||n===expected){out.push({kind:"text",value:s.value.slice(c)});break}out.push({kind:"text",value:s.value.slice(c,i)},part);n++;c=i+target.length}}ok(n===expected,`${target}:${n}`);set(b,out)}
const style=(b:ReturnType<typeof find>,kind:"em"|"strong",value:string,n=1)=>replace(b,value,{kind,value},n);
function markers(u:Unit){for(const b of u.blocks){if(b.kind!=="list-item"||!b.text||(b.evidence?.pdfPage??0)<240||(b.evidence?.pdfPage??0)>249)continue;const raw=(b.text.raw??"").trimStart(),norm=b.text.normalized.trimStart();b.listMarker=/^x\s/u.test(raw)?"bullet":(/^(?:-|ȭ)\s/u.test(raw)||/^[-ȭ]\s/u.test(norm)?"dash":"none")}}
function correctMarker(b:ReturnType<typeof find>){if(!b.text.normalized.startsWith("ȭ "))return;b.text.normalized=`- ${b.text.normalized.slice(2)}`;b.text.inline=parts(b).map(x=>({...x,value:x.value.replace(/^ȭ /u,"- ")}));set(b,b.text.inline);if(b.evidence){b.evidence.normalizedSha256=createHash("sha256").update(b.text.normalized).digest("hex");b.evidence.transformations??=[];b.evidence.transformations.push({operation:"manual-correction",ruleVersion:profile,note:"Sostituito il glifo corrotto del trattino di elenco con il marcatore verificato nel PDF ufficiale."})}}
async function edit(n:string,cb:(u:Unit)=>void=()=>undefined){const p=join(dir,`${n}.json`),u=JSON.parse(await readFile(p,"utf8")) as Unit;markers(u);cb(u);markers(u);await writeFile(p,`${JSON.stringify(u,null,2)}\n`)}

await edit("7.4.6.2.1",u=>{style(find(u,"Armature longitudinali"),"em","Armature longitudinali");style(find(u,"Armature trasversali"),"em","Armature trasversali")});
await edit("7.4.6.2.2",u=>{for(const v of ["Armature longitudinali","Armature trasversali","Dettagli costruttivi per la duttilità"])style(find(u,v),"em",v);style(find(u,"μ_φ è"),"em","SLC");style(find(u,"ν_d è"),"em","SLV");for(const m of ["a)","b)"])style(find(u,`${m} per`),"em",m)});
await edit("7.4.6.2.4",u=>{for(const v of ["Armature longitudinali","Armature trasversali","Armature inclinate","Dettagli costruttivi per la duttilità"])style(find(u,v),"em",v)});
await edit("7.5.2.1",u=>{const labels=["Strutture intelaiate","Strutture con controventi concentrici","controventi con diagonale tesa attiva","controventi a V","controventi a K","Strutture con controventi eccentrici","Strutture a mensola o a pendolo inverso","Strutture intelaiate con controventi concentrici","Strutture intelaiate con tamponature"];for(const label of labels){const b=u.blocks.find(x=>x.text?.normalized.includes(label));ok(b?.text,label);style(b as ReturnType<typeof find>,"strong",label)}for(const m of ["a)","b)","b1)","b2)","b3)","c)","d)","e)","f)"]){const b=u.blocks.find(x=>x.text?.normalized.startsWith(m));ok(b?.text,m);style(b as ReturnType<typeof find>,"em",m)}});
await edit("7.5.2.2");
await edit("7.5.3.2",u=>{for(const b of u.blocks.filter(x=>x.kind==="list-item"&&(x.evidence?.pdfPage??0)===246)){ok(b.text,b.blockId);correctMarker(b as ReturnType<typeof find>)}});
await edit("7.5.5");
for(const n of ["7.4.6.1.2","7.4.6.1.3","7.4.6.1.4","7.4.6.2.3","7.4.6.2.5","7.5.4.1","7.5.4.2","7.5.4.3","7.5.4.4","7.5.4.5"])await edit(n);

const assetPath=join(root,"corpus","assets","ntc2018","7.5-step1.json");const asset=JSON.parse(await readFile(assetPath,"utf8"));
for(const figure of asset.figures){const prefix=`Fig. ${figure.officialNumber} – `;ok(figure.caption.startsWith(prefix),figure.caption);figure.captionInline=[{kind:"strong",value:prefix},{kind:"em",value:figure.caption.slice(prefix.length)}]}
const table=asset.tables.find((x:any)=>x.officialNumber==="7.5.I");ok(table,"7.5.I");table.captionInline=[{kind:"em",value:"Classe della sezione trasversale di elementi dissipativi in funzione della classe di duttilità e di "},{kind:"math",value:"q_0",latex:"q_0"}];ok(table.captionInline.map((x:Part)=>x.value).join("")===table.caption,"caption 7.5.I");await writeFile(assetPath,`${JSON.stringify(asset,null,2)}\n`);
console.log("fix-ntc7-format-step4: pagine PDF 240-249 aggiornate");
