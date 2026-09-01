import express from "express";
import OpenAI from "openai";
import "dotenv/config";
import crypto from "crypto";

const app=express(), openai=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
const PORT=process.env.PORT||3000, MODEL=process.env.OPENAI_MODEL||"gpt-5.4";
const ACCESS_PASSWORD=process.env.ACCESS_PASSWORD||"bitte-aendern";
const DAILY_LIMIT=Math.max(1,Number(process.env.DAILY_LIMIT||40));
const SESSION_SECRET=process.env.SESSION_SECRET||crypto.randomBytes(32).toString("hex");
const usage=new Map();
app.set("trust proxy",1);app.use(express.json({limit:"100kb"}));app.use(express.static("public"));
function sign(v){return crypto.createHmac("sha256",SESSION_SECRET).update(v).digest("hex")}
function cookies(req){return Object.fromEntries((req.headers.cookie||"").split(";").filter(Boolean).map(x=>x.trim().split(/=(.*)/s).slice(0,2).map(decodeURIComponent)))}
function authed(req){const c=cookies(req),v=c.phil_session;if(!v)return false;const [exp,sig]=v.split(".");return Number(exp)>Date.now()&&crypto.timingSafeEqual(Buffer.from(sig||""),Buffer.from(sign(exp)))}
function auth(req,res,next){if(!authed(req))return res.status(401).json({error:"Bitte neu anmelden."});next()}
function bucket(req){const day=new Date().toISOString().slice(0,10),key=`${day}:${req.ip}`;return {key,n:usage.get(key)||0}}
app.post("/api/login",(req,res)=>{if(String(req.body?.password||"")!==ACCESS_PASSWORD)return res.status(401).json({ok:false});const exp=String(Date.now()+12*60*60*1000),token=`${exp}.${sign(exp)}`;res.setHeader("Set-Cookie",`phil_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${process.env.NODE_ENV==="production"?"; Secure":""}`);res.json({ok:true})});

const schema={type:"object",additionalProperties:false,properties:{
 problem:{type:"string"},
 zugang:{type:"object",additionalProperties:false,properties:{einfach:{type:"string"},beispiel:{type:"string"},zuordnung:{type:"array",items:{type:"object",additionalProperties:false,properties:{im_beispiel:{type:"string"},im_text:{type:"string"},erklaerung:{type:"string"}},required:["im_beispiel","im_text","erklaerung"]}},grenze:{type:"string"}},required:["einfach","beispiel","zuordnung","grenze"]},
 glossar:{type:"array",items:{type:"object",additionalProperties:false,properties:{begriff:{type:"string"},einfach:{type:"string"},im_text:{type:"string"}},required:["begriff","einfach","im_text"]}},
 gedankenschritte:{type:"array",items:{type:"object",additionalProperties:false,properties:{nr:{type:"integer"},textstelle:{type:"string"},funktion:{type:"string"},erklaerung:{type:"string"}},required:["nr","textstelle","funktion","erklaerung"]}},
 konnektoren:{type:"array",items:{type:"object",additionalProperties:false,properties:{ausdruck:{type:"string"},beziehung:{type:"string"},erklaerung:{type:"string"}},required:["ausdruck","beziehung","erklaerung"]}},
 argumentationslogik:{type:"array",items:{type:"object",additionalProperties:false,properties:{rolle:{type:"string"},aussage:{type:"string"}},required:["rolle","aussage"]}},
 synthese:{type:"object",additionalProperties:false,properties:{problem:{type:"string"},antwort:{type:"string"},argumentationsweg:{type:"string"},philosophisch:{type:"string"},einfach:{type:"string"},merksatz:{type:"string"}},required:["problem","antwort","argumentationsweg","philosophisch","einfach","merksatz"]},
 fragen:{type:"array",items:{type:"object",additionalProperties:false,properties:{afb:{type:"string",enum:["I","II","III"]},frage:{type:"string"},erwartung:{type:"string"}},required:["afb","frage","erwartung"]}}
},required:["problem","zugang","glossar","gedankenschritte","konnektoren","argumentationslogik","synthese","fragen"]};

const instructions=`Du bist ein didaktischer Assistent für den Philosophieunterricht. Analysiere ausschließlich den vorgelegten Originaltext und bleibe textnah.
Die Ausgabe bildet einen Lernweg ab, nicht bloß eine fertige Musteranalyse.
1. problem: Benenne die philosophische Frage oder Schwierigkeit knapp und verständlich in 2–4 Sätzen.
2. zugang: Schaffe einen ersten Zugang für Lernende. "einfach" erklärt den Grundgedanken mit kurzen Sätzen auf Niveau Klasse 9/10. "beispiel" ist eine konkrete Alltagssituation. "zuordnung" ordnet in 2–5 Punkten Elemente des Beispiels dem Text zu. "grenze" erklärt, wo die Analogie nicht mehr trägt. Noch keine ausführliche fachsprachliche Gesamtauslegung.
3. glossar: 3–8 zentrale Begriffe als Hilfsmittel. Erkläre normale Bedeutung und die konkrete Funktion/Bedeutung im vorliegenden Text. Das Glossar ist kein eigener Argumentationsschritt.
4. gedankenschritte: Gliedere den Originaltext in sinnvolle Gedankenschritte. "textstelle" soll eine kurze, eindeutig auffindbare Passage aus dem Original nennen, nicht den ganzen Text wiederholen. "funktion" z.B. Ausgangspunkt, Definition, Begründung, Unterscheidung, Einwand, Folgerung, Einschränkung. "erklaerung" erklärt den Schritt verständlich.
5. konnektoren: Untersuche ausdrückliche oder implizite logische Verbindungen. Nenne Konnektoren wie weil, denn, aber, wenn–dann, daher, also usw. Wenn kein ausdrücklicher Konnektor vorhanden ist, schreibe bei "ausdruck": "implizit" und erkläre die erschlossene Beziehung.
6. argumentationslogik: Rekonstruiere erst jetzt die Gesamtargumentation. Verwende Rollen wie Ausgangspunkt, P1, P2, Zwischenfolgerung, Einwand, Einschränkung, Schlussfolgerung, These – nur soweit textlich gerechtfertigt.
7. synthese: Führe Problem und Argumentationslogik zusammen. "philosophisch" ist fachsprachlich präzise auf Oberstufenniveau; "einfach" formuliert denselben Gedankengang in wirklich einfacher Sprache. Keine neuen Gedanken hinzufügen.
8. fragen: genau 6 Fragen, 2 AFB I, 2 AFB II, 2 AFB III. AFB III verlangt begründetes Urteil, Vergleich, Anwendung oder Problematisierung. "erwartung" nennt knapp Kriterien einer guten Antwort.
Erfinde keine Positionen, die im Ausschnitt nicht enthalten sind.`;

app.post("/api/analyse",auth,async(req,res)=>{const started=Date.now();console.log(`[Analyse V3] gestartet (${String(req.body?.text||"").length} Zeichen)`);try{const {key,n}=bucket(req);if(n>=DAILY_LIMIT)return res.status(429).json({error:"Das Tageslimit für diesen Zugang ist erreicht."});const text=String(req.body?.text||"").trim();if(!text)return res.status(400).json({error:"Kein Text eingegeben."});if(text.length>20000)return res.status(400).json({error:"Bitte einen kürzeren Textabschnitt verwenden (max. 20.000 Zeichen)."});const response=await openai.responses.create({model:MODEL,instructions,input:text,store:false,text:{format:{type:"json_schema",name:"philosophie_analyse_v3",strict:true,schema}}});usage.set(key,n+1);const data=JSON.parse(response.output_text);data._meta={remaining:Math.max(0,DAILY_LIMIT-(n+1)),version:"3.0"};console.log(`[Analyse V3] erfolgreich nach ${Math.round((Date.now()-started)/1000)} s`);res.json(data)}catch(e){console.error("[Analyse V3] Fehler:",e?.message||e);res.status(500).json({error:`Die KI-Analyse konnte nicht abgeschlossen werden${e?.code?" ("+e.code+")":""}.`})}});
app.listen(PORT,()=>console.log(`Textmikroskop V3 läuft auf Port ${PORT}`));
