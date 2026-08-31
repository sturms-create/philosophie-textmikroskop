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

app.set("trust proxy",1); app.use(express.json({limit:"100kb"})); app.use(express.static("public"));

function sign(v){return crypto.createHmac("sha256",SESSION_SECRET).update(v).digest("hex")}
function cookies(req){return Object.fromEntries((req.headers.cookie||"").split(";").filter(Boolean).map(x=>x.trim().split(/=(.*)/s).slice(0,2).map(decodeURIComponent)))}
function authed(req){const c=cookies(req),v=c.phil_session;if(!v)return false;const [exp,sig]=v.split(".");return Number(exp)>Date.now()&&crypto.timingSafeEqual(Buffer.from(sig||""),Buffer.from(sign(exp)))}
function auth(req,res,next){if(!authed(req))return res.status(401).json({error:"Bitte neu anmelden."});next()}
function bucket(req){const day=new Date().toISOString().slice(0,10), key=`${day}:${req.ip}`;const n=usage.get(key)||0;return {key,n}}
app.post("/api/login",(req,res)=>{if(String(req.body?.password||"")!==ACCESS_PASSWORD)return res.status(401).json({ok:false});
 const exp=String(Date.now()+12*60*60*1000), token=`${exp}.${sign(exp)}`;
 res.setHeader("Set-Cookie",`phil_session=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=43200${process.env.NODE_ENV==="production"?"; Secure":""}`);res.json({ok:true});
});

const schema={type:"object",additionalProperties:false,properties:{
problem:{type:"string"},begriffe:{type:"array",items:{type:"object",additionalProperties:false,properties:{begriff:{type:"string"},einfache_erklaerung:{type:"string"},funktion_im_text:{type:"string"}},required:["begriff","einfache_erklaerung","funktion_im_text"]}},
sinneinheiten:{type:"array",items:{type:"object",additionalProperties:false,properties:{funktion:{type:"string"},textaussage:{type:"string"}},required:["funktion","textaussage"]}},
beziehungen:{type:"array",items:{type:"string"}},argument:{type:"array",items:{type:"object",additionalProperties:false,properties:{typ:{type:"string"},aussage:{type:"string"}},required:["typ","aussage"]}},
einfach_gesagt:{type:"string"},alltagsbeispiel:{type:"string"},
beispiel_zuordnung:{type:"array",items:{type:"object",additionalProperties:false,properties:{im_beispiel:{type:"string"},im_text:{type:"string"},erklaerung:{type:"string"}},required:["im_beispiel","im_text","erklaerung"]}},
grenze_des_beispiels:{type:"string"},philosophisch_genauer:{type:"string"},merksatz:{type:"string"},
fragen:{type:"array",items:{type:"object",additionalProperties:false,properties:{afb:{type:"string",enum:["I","II","III"]},frage:{type:"string"},erwartung:{type:"string"}},required:["afb","frage","erwartung"]}}
},required:["problem","begriffe","sinneinheiten","beziehungen","argument","einfach_gesagt","alltagsbeispiel","beispiel_zuordnung","grenze_des_beispiels","philosophisch_genauer","merksatz","fragen"]};

const instructions=`Du bist ein didaktischer Assistent für Philosophieunterricht.
Analysiere ausschließlich den vorgelegten Text und bleibe textnah.
"einfach_gesagt" ist für Schülerinnen und Schüler, die den Originaltext noch nicht verstehen:
- sehr kurze Sätze, möglichst ein Gedanke pro Satz;
- alltägliche Wörter;
- schwierige Begriffe zuerst in normalen Worten erklären;
- keine bloße Umformulierung des Originals;
- ungefähr Niveau Klasse 9/10.
Das Alltagsbeispiel ist didaktisch zentral. Es beginnt gedanklich mit "Stell dir vor ...". Verwende eine konkrete Situation mit handelnden oder erlebenden Personen. Das Beispiel muss die logische Struktur des Gedankens abbilden, nicht nur ein Schlagwort illustrieren.
"beispiel_zuordnung" erklärt danach in 2 bis 5 Punkten ausdrücklich, was im Beispiel welchem Begriff, Verhältnis oder Gedankenschritt des Textes entspricht.
"grenze_des_beispiels" erklärt in 1 bis 3 einfachen Sätzen, wo die Analogie nicht mehr trägt oder was der Text genauer meint.
"philosophisch_genauer" führt in 3 bis 6 verständlichen Sätzen auf Oberstufenniveau zurück zum Originaltext und verwendet die wichtigen Begriffe des Autors.
Erzeuge genau 6 Fragen: 2 AFB I, 2 AFB II, 2 AFB III.
AFB III verlangt ein begründetes philosophisches Urteil, einen Vergleich oder eine Problematisierung, nicht bloß persönliche Meinung.
"erwartung" beschreibt knapp Kriterien einer guten Antwort.
Erfinde keine Positionen, die im Ausschnitt nicht enthalten sind.`;

app.post("/api/analyse",auth,async(req,res)=>{
 try{
  const {key,n}=bucket(req);if(n>=DAILY_LIMIT)return res.status(429).json({error:"Das Tageslimit für diesen Zugang ist erreicht."});
  const text=String(req.body?.text||"").trim();if(!text)return res.status(400).json({error:"Kein Text eingegeben."});
  if(text.length>20000)return res.status(400).json({error:"Bitte einen kürzeren Textabschnitt verwenden (max. 20.000 Zeichen)."});
  const response=await openai.responses.create({model:MODEL,instructions,input:text,store:false,text:{format:{type:"json_schema",name:"philosophie_analyse",strict:true,schema}}});
  usage.set(key,n+1);const data=JSON.parse(response.output_text);data._meta={remaining:Math.max(0,DAILY_LIMIT-(n+1))};res.json(data);
 }catch(e){console.error(e);res.status(500).json({error:"Die KI-Analyse konnte nicht abgeschlossen werden."})}
});
app.listen(PORT,()=>console.log(`Textmikroskop läuft auf Port ${PORT}`));