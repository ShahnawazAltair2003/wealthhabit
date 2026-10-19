require('dotenv').config();
const express=require('express'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),path=require('path');
const SECRET=process.env.JWT_SECRET||require('crypto').randomBytes(32).toString('hex');
function openDb(file){ // Prefer Node's built-in SQLite (no native build needed); fall back to better-sqlite3 on older Node.
 if(process.env.DB_DRIVER!=='better'){try{const{DatabaseSync}=require('node:sqlite'),d=new DatabaseSync(file);d.pragma=x=>d.exec('PRAGMA '+x);return d}catch(e){if(process.env.DB_DRIVER==='builtin')throw e}}
 return new(require('better-sqlite3'))(file)}
const db=openDb(process.env.DB_PATH||path.join(__dirname,'data.db'));db.pragma('journal_mode=WAL');db.pragma('foreign_keys=ON');
const U='user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE';
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT,email TEXT UNIQUE,phone TEXT,password TEXT,role TEXT DEFAULT 'user',budget REAL DEFAULT 0,active INTEGER DEFAULT 1,created TEXT,last_login TEXT);
CREATE TABLE IF NOT EXISTS income(id INTEGER PRIMARY KEY,${U},source TEXT,amount REAL,date TEXT);
CREATE TABLE IF NOT EXISTS expenses(id INTEGER PRIMARY KEY,${U},category TEXT,amount REAL,note TEXT,date TEXT);
CREATE TABLE IF NOT EXISTS assets(id INTEGER PRIMARY KEY,${U},kind TEXT,name TEXT,amount REAL,date TEXT);
CREATE TABLE IF NOT EXISTS goals(id INTEGER PRIMARY KEY,${U},name TEXT,target REAL,saved REAL DEFAULT 0,deadline TEXT);
CREATE TABLE IF NOT EXISTS habits(id INTEGER PRIMARY KEY,${U},name TEXT,frequency TEXT);
CREATE TABLE IF NOT EXISTS habit_logs(habit_id INTEGER REFERENCES habits(id) ON DELETE CASCADE,date TEXT,UNIQUE(habit_id,date));
CREATE TABLE IF NOT EXISTS contacts(id INTEGER PRIMARY KEY,name TEXT,email TEXT,type TEXT,subject TEXT,message TEXT,status TEXT DEFAULT 'open',emailed INTEGER DEFAULT 0,created TEXT);
CREATE TABLE IF NOT EXISTS feedback(id INTEGER PRIMARY KEY,${U},type TEXT,message TEXT,status TEXT DEFAULT 'open',created TEXT);`);

try{db.exec('ALTER TABLE feedback ADD COLUMN subject TEXT')}catch{}
const CATS=['Food','Rent','Transport','Utilities','Entertainment','Health','Shopping','Education','Other'];
const iso=(d=new Date())=>d.toISOString().slice(0,10),dayN=d=>Math.floor(Date.parse(d)/864e5);
const V={str:(v,m=80)=>typeof v==='string'&&v.trim()&&v.length<=m?v.trim():null,
 num:(v,neg)=>{v=Number(v);return v!==''&&Number.isFinite(v)&&Math.abs(v)<1e10&&(neg?v!==0:v>0)?v:null},
 date:v=>/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))?v:null,
 oneOf:(...o)=>v=>o.includes(v)?v:null};
const RES={income:{source:v=>V.str(v),amount:V.num,date:V.date},
 expenses:{category:V.oneOf(...CATS),amount:V.num,note:v=>v?V.str(v,120):'',date:V.date},
 assets:{kind:V.oneOf('savings','investment','asset','liability'),name:v=>V.str(v),amount:v=>V.num(v,1),date:V.date},
 goals:{name:v=>V.str(v),target:V.num,saved:v=>Number(v||0)>=0?Number(v||0):null,deadline:v=>v?V.date(v):''},
 habits:{name:v=>V.str(v),frequency:V.oneOf('daily','weekly','monthly')}};
const clean=(f,b)=>{const o={};for(const k in f){const x=f[k](b?.[k]);if(x===null||x===undefined)return null;o[k]=x}return o};

const nm=require('nodemailer'),E=process.env;
const mailer=E.SMTP_HOST?nm.createTransport({host:E.SMTP_HOST,port:+E.SMTP_PORT||587,secure:+E.SMTP_PORT===465,auth:{user:E.SMTP_USER,pass:E.SMTP_PASS}}):null;
async function mail(subject,text,replyTo){if(!mailer||!E.CONTACT_TO){console.log('[email not configured] '+subject);return 0}
 try{await mailer.sendMail({from:E.MAIL_FROM||E.SMTP_USER,to:E.CONTACT_TO,replyTo,subject:'[WealthHabit] '+subject,text});return 1}catch(e){console.error('Email failed:',e.message);return 0}}
const app=express();app.set('trust proxy',1);app.use(helmet({contentSecurityPolicy:{directives:{upgradeInsecureRequests:null,scriptSrcAttr:["'unsafe-inline'"],defaultSrc:["'self'"],scriptSrc:["'self'","'unsafe-inline'","https://cdnjs.cloudflare.com"],styleSrc:["'self'","'unsafe-inline'"],imgSrc:["'self'","data:"]}}}));
app.use(express.json({limit:'50kb'}));app.use(express.static(path.join(__dirname,'public')));
const sign=u=>jwt.sign({id:u.id},SECRET,{expiresIn:'7d'});
const auth=(q,s,n)=>{try{const{id}=jwt.verify((q.headers.authorization||'').slice(7),SECRET);const u=db.prepare('SELECT * FROM users WHERE id=? AND active=1').get(id);if(!u)throw 0;q.u=u;n()}catch{s.status(401).json({error:'Please log in again'})}};
const admin=(q,s,n)=>q.u.role==='admin'?n():s.status(403).json({error:'Admins only'});
const pub=u=>({id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role,budget:u.budget});
const todayOf=q=>V.date(q.query.today)||iso();

app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:60,message:{error:'Too many attempts, try later'}}));
app.post('/api/auth/register',(q,s)=>{const b=q.body||{},name=V.str(b.name,60),email=String(b.email||'').toLowerCase().trim();
 if(!name||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return s.status(400).json({error:'Valid name and email required'});
 if(!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(b.password||''))return s.status(400).json({error:'Password needs 8+ characters with letters and numbers'});
 if(db.prepare('SELECT 1 FROM users WHERE email=?').get(email))return s.status(409).json({error:'Email already registered'});
 const id=db.prepare('INSERT INTO users(name,email,phone,password,budget,created,last_login) VALUES(?,?,?,?,?,?,?)').run(name,email,String(b.phone||'').slice(0,15),bcrypt.hashSync(b.password,10),Math.max(0,Number(b.budget)||0),iso(),iso()).lastInsertRowid;
 s.json({token:sign({id}),user:pub(db.prepare('SELECT * FROM users WHERE id=?').get(id))})});
app.post('/api/auth/login',(q,s)=>{const u=db.prepare('SELECT * FROM users WHERE email=?').get(String(q.body?.email||'').toLowerCase().trim());
 if(!u||!bcrypt.compareSync(String(q.body.password||''),u.password))return s.status(401).json({error:'Invalid email or password'});
 if(!u.active)return s.status(403).json({error:'Account disabled. Contact admin.'});
 db.prepare('UPDATE users SET last_login=? WHERE id=?').run(iso(),u.id);s.json({token:sign(u),user:pub(u)})});
app.get('/api/me',auth,(q,s)=>s.json(pub(q.u)));
app.put('/api/me',auth,(q,s)=>{const n=V.str(q.body.name,60);if(!n)return s.status(400).json({error:'Name required'});
 db.prepare('UPDATE users SET name=?,phone=?,budget=? WHERE id=?').run(n,String(q.body.phone||'').slice(0,15),Math.max(0,Number(q.body.budget)||0),q.u.id);s.json({ok:1})});

const per=(f,d)=>{const n=dayN(d);return f==='daily'?n:f==='weekly'?Math.floor((n+3)/7):+d.slice(0,4)*12+ +d.slice(5,7)};
function habitsFor(uid,t){const logs={};db.prepare('SELECT habit_id,date FROM habit_logs WHERE habit_id IN(SELECT id FROM habits WHERE user_id=?)').all(uid).forEach(l=>(logs[l.habit_id]??=[]).push(l.date));
 const since=iso(new Date(Date.parse(t)-29*864e5));
 return db.prepare('SELECT * FROM habits WHERE user_id=? ORDER BY id').all(uid).map(h=>{const d=logs[h.id]||[],set=new Set(d.map(x=>per(h.frequency,x)));
  const cur=per(h.frequency,t);let k=set.has(cur)?cur:cur-1,streak=0;while(set.has(k)){streak++;k--}
  const exp={daily:30,weekly:4,monthly:1}[h.frequency],done=new Set(d.filter(x=>x>=since&&x<=t).map(x=>per(h.frequency,x))).size;
  return{...h,dates:d.filter(x=>x>=iso(new Date(Date.parse(t)-20*864e5))),streak,doneNow:set.has(cur),rate:Math.min(1,done/exp),exp,done:Math.min(done,exp)}})}
app.get('/api/habits',auth,(q,s)=>s.json(habitsFor(q.u.id,todayOf(q))));
app.post('/api/habits/:id/toggle',auth,(q,s)=>{const d=V.date(q.body.date);if(!d||!db.prepare('SELECT 1 FROM habits WHERE id=? AND user_id=?').get(q.params.id,q.u.id))return s.status(400).json({error:'Invalid request'});
 const r=db.prepare('DELETE FROM habit_logs WHERE habit_id=? AND date=?').run(q.params.id,d);if(!r.changes)db.prepare('INSERT INTO habit_logs VALUES(?,?)').run(q.params.id,d);s.json({ok:1})});

for(const[t,f]of Object.entries(RES)){const hasDate='date'in f;
 if(t!=='habits')app.get('/api/'+t,auth,(q,s)=>s.json(db.prepare(`SELECT * FROM ${t} WHERE user_id=? ORDER BY ${hasDate?'date DESC,':''}id DESC`).all(q.u.id)));
 app.post('/api/'+t,auth,(q,s)=>{const r=clean(f,q.body);if(!r)return s.status(400).json({error:'Please check the form values'});const k=Object.keys(r);
  s.json({id:db.prepare(`INSERT INTO ${t}(user_id,${k}) VALUES(?,${k.map(()=>'?')})`).run(q.u.id,...k.map(x=>r[x])).lastInsertRowid})});
 app.put('/api/'+t+'/:id',auth,(q,s)=>{const r=clean(f,q.body);if(!r)return s.status(400).json({error:'Please check the form values'});const k=Object.keys(r);
  s.json({ok:db.prepare(`UPDATE ${t} SET ${k.map(x=>x+'=?')} WHERE id=? AND user_id=?`).run(...k.map(x=>r[x]),q.params.id,q.u.id).changes})});
 app.delete('/api/'+t+'/:id',auth,(q,s)=>s.json({ok:db.prepare(`DELETE FROM ${t} WHERE id=? AND user_id=?`).run(q.params.id,q.u.id).changes}))}

const months=(t,n)=>{const[y,m]=t.split('-').map(Number);return Array.from({length:n},(_,i)=>{const d=new Date(Date.UTC(y,m-1-(n-1-i),1));return iso(d).slice(0,7)})};
app.get('/api/summary',auth,(q,s)=>{const id=q.u.id,t=todayOf(q),m=t.slice(0,7),ms=months(m,12);
 const grp=tb=>Object.fromEntries(db.prepare(`SELECT substr(date,1,7) m,SUM(amount) v FROM ${tb} WHERE user_id=? GROUP BY m`).all(id).map(r=>[r.m,r.v]));
 const inc=grp('income'),exp=grp('expenses'),rows=db.prepare('SELECT kind,amount,substr(date,1,7) m FROM assets WHERE user_id=?').all(id);
 const sg=k=>k==='liability'?-1:1,nw=ms.map(x=>rows.filter(r=>r.m<=x).reduce((a,r)=>a+sg(r.kind)*r.amount,0));
 const bk=k=>rows.filter(r=>r.kind===k).reduce((a,r)=>a+r.amount,0);
 const habits=habitsFor(id,t),goals=db.prepare('SELECT * FROM goals WHERE user_id=?').all(id),ex=(inc[m]||0)-(exp[m]||0);
 s.json({month:m,income:inc[m]||0,expenses:exp[m]||0,saved:ex,savingsRate:inc[m]?Math.round(ex/inc[m]*100):0,budget:q.u.budget,
  months:ms,incSeries:ms.map(x=>inc[x]||0),expSeries:ms.map(x=>exp[x]||0),netWorth:nw,
  breakdown:{savings:bk('savings'),investment:bk('investment'),asset:bk('asset'),liability:bk('liability')},
  categories:db.prepare('SELECT category,SUM(amount) v FROM expenses WHERE user_id=? AND substr(date,1,7)=? GROUP BY category ORDER BY v DESC').all(id,m),
  habits:habits.map(h=>({id:h.id,name:h.name,frequency:h.frequency,doneNow:h.doneNow,streak:h.streak})),
  habitRate:habits.length?Math.round(habits.reduce((a,h)=>a+h.rate,0)/habits.length*100):0,
  goalRate:goals.length?Math.round(goals.reduce((a,g)=>a+Math.min(1,g.saved/g.target),0)/goals.length*100):0})});

app.post('/api/feedback',auth,async(q,s)=>{const type=V.oneOf('feedback','query','complaint')(q.body.type),sub=V.str(q.body.subject,100),m=V.str(q.body.message,500);
 if(!type||!sub||!m)return s.status(400).json({error:'Subject and message required'});db.prepare('INSERT INTO feedback(user_id,type,subject,message,created) VALUES(?,?,?,?,?)').run(q.u.id,type,sub,m,iso());
 await mail(`${type}: ${sub}`,`From: ${q.u.name} <${q.u.email}>\nType: ${type}\n\n${m}`,q.u.email);s.json({ok:1})});
app.get('/api/feedback/mine',auth,(q,s)=>s.json(db.prepare('SELECT id,type,subject,message,status,created FROM feedback WHERE user_id=? ORDER BY id DESC').all(q.u.id)));
app.get('/api/public/stats',(q,s)=>{const c=t=>db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;s.json({members:db.prepare("SELECT COUNT(*) c FROM users WHERE role='user'").get().c,checkins:c('habit_logs'),transactions:c('income')+c('expenses'),goals:c('goals')})});
app.use('/api/contact',rateLimit({windowMs:60*60*1000,limit:8,message:{error:'Too many messages. Please try again later.'}}));
app.post('/api/contact',async(q,s)=>{const b=q.body||{};if(b.website)return s.json({ok:1,emailed:0});
 const name=V.str(b.name,60),email=String(b.email||'').trim().toLowerCase(),type=V.oneOf('query','complaint','feedback')(b.type),sub=V.str(b.subject,100),m=V.str(b.message,1000);
 if(!name||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)||!type||!sub||!m)return s.status(400).json({error:'Please fill in all fields with valid details'});
 const em=await mail(`${type}: ${sub}`,`From: ${name} <${email}>\nType: ${type}\n\n${m}`,email);
 db.prepare('INSERT INTO contacts(name,email,type,subject,message,emailed,created) VALUES(?,?,?,?,?,?,?)').run(name,email,type,sub,m,em,iso());s.json({ok:1,emailed:em})});
const A=[auth,admin];
app.get('/api/admin/users',...A,(q,s)=>s.json(db.prepare(`SELECT id,name,email,role,active,created,last_login,(SELECT COUNT(*) FROM income i WHERE i.user_id=users.id)+(SELECT COUNT(*) FROM expenses e WHERE e.user_id=users.id) entries FROM users ORDER BY id`).all()));
app.put('/api/admin/users/:id',...A,(q,s)=>{if(+q.params.id===q.u.id)return s.status(400).json({error:'Cannot change your own account'});s.json({ok:db.prepare('UPDATE users SET active=? WHERE id=?').run(q.body.active?1:0,q.params.id).changes})});
app.delete('/api/admin/users/:id',...A,(q,s)=>{if(db.prepare("SELECT role FROM users WHERE id=?").get(q.params.id)?.role==='admin')return s.status(400).json({error:'Cannot delete admin'});s.json({ok:db.prepare('DELETE FROM users WHERE id=?').run(q.params.id).changes})});
app.get('/api/admin/stats',...A,(q,s)=>{const t=todayOf(q),since=iso(new Date(Date.parse(t)-30*864e5)),users=db.prepare("SELECT id,last_login FROM users WHERE role='user' AND active=1").all();
 const rates=users.map(u=>habitsFor(u.id,t)).filter(h=>h.length).map(h=>h.reduce((a,x)=>a+x.rate,0)/h.length);
 const g=db.prepare('SELECT AVG(MIN(1.0,saved/target)) v FROM goals').get().v||0;
 const act=db.prepare(`SELECT COUNT(DISTINCT user_id) c FROM(SELECT user_id FROM expenses WHERE date>=? UNION ALL SELECT user_id FROM income WHERE date>=? UNION ALL SELECT h.user_id FROM habits h JOIN habit_logs l ON l.habit_id=h.id WHERE l.date>=?)`).get(since,since,since).c;
 const ms=months(t.slice(0,7),6),cnt=Object.fromEntries(db.prepare('SELECT m,COUNT(*) c FROM(SELECT substr(date,1,7) m FROM expenses UNION ALL SELECT substr(date,1,7) FROM income) GROUP BY m').all().map(r=>[r.m,r.c]));
 s.json({totalUsers:users.length,activeUsers:users.filter(u=>u.last_login>=since).length,engagement:users.length?Math.round(act/users.length*100):0,
  habitRate:rates.length?Math.round(rates.reduce((a,b)=>a+b)/rates.length*100):0,goalRate:Math.round(g*100),months:ms,activity:ms.map(x=>cnt[x]||0),
  openFeedback:db.prepare("SELECT COUNT(*) c FROM feedback WHERE status='open'").get().c})});
app.get('/api/admin/feedback',...A,(q,s)=>s.json(db.prepare('SELECT f.*,u.name FROM feedback f JOIN users u ON u.id=f.user_id ORDER BY f.id DESC').all()));
app.put('/api/admin/feedback/:id',...A,(q,s)=>s.json({ok:db.prepare("UPDATE feedback SET status='resolved' WHERE id=?").run(q.params.id).changes}));
app.get('/api/admin/contacts',...A,(q,s)=>s.json(db.prepare('SELECT * FROM contacts ORDER BY id DESC').all()));
app.put('/api/admin/contacts/:id',...A,(q,s)=>s.json({ok:db.prepare("UPDATE contacts SET status='resolved' WHERE id=?").run(q.params.id).changes}));
app.use('/api',(q,s)=>s.status(404).json({error:'Not found'}));

// ---- Realistic seed data (first run only) ----
function seed(){if(db.prepare('SELECT COUNT(*) c FROM users').get().c)return;
 let sd=7;const r=()=>(sd=sd*16807%2147483647)/2147483647,pick=a=>a[Math.floor(r()*a.length)],between=(a,b)=>Math.round(a+r()*(b-a));
 const now=iso(),mk=(n,e,p,role,sal,bud)=>db.prepare('INSERT INTO users(name,email,phone,password,role,budget,created,last_login) VALUES(?,?,?,?,?,?,?,?)').run(n,e,p,bcrypt.hashSync(role==='admin'?'Admin@1234':'Demo@1234',10),role,bud,iso(new Date(Date.now()-150*864e5)),iso(new Date(Date.now()-between(0,12)*864e5))).lastInsertRowid;
 const E={Food:[['Swiggy order',250,550],['Groceries - D-Mart',600,1800],['Lunch with colleagues',200,450]],Transport:[['Metro card recharge',300,500],['Uber ride',150,400]],Utilities:[['Electricity bill',900,1600],['Jio recharge',299,299]],Entertainment:[['Netflix',199,199],['Movie - PVR',350,700]],Health:[['Pharmacy',150,600]],Shopping:[['Amazon order',400,2200]],Education:[['Udemy course',449,649]]};
 const fill=(uid,sal,rent)=>{const I=db.prepare('INSERT INTO income(user_id,source,amount,date) VALUES(?,?,?,?)'),X=db.prepare('INSERT INTO expenses(user_id,category,amount,note,date) VALUES(?,?,?,?,?)'),S=db.prepare('INSERT INTO assets(user_id,kind,name,amount,date) VALUES(?,?,?,?,?)');
  const ym=months(now.slice(0,7),6);ym.forEach((m,i)=>{const ok=d=>m+'-'+d<=now;
   ok('01')&&I.run(uid,'Salary',sal,m+'-01');ok('15')&&I.run(uid,'Freelance projects',between(sal*.1,sal*.2),m+'-15');
   ok('03')&&X.run(uid,'Rent',rent,'Monthly rent',m+'-03');
   for(let d=1;d<=31;d++){const ds=m+'-'+String(d).padStart(2,'0');if(ds>now||isNaN(Date.parse(ds))||ds.slice(0,7)!==m)continue;
    if(r()<.55){const c=pick(Object.keys(E)),[n,a,b]=pick(E[c]);X.run(uid,c,between(a,b),n,ds)}}
   if(i===0){S.run(uid,'savings','HDFC Savings (opening balance)',120000,m+'-01');S.run(uid,'liability','Education Loan',150000,m+'-01')}
   if(i===1)S.run(uid,'asset','Sovereign Gold Bond',10000,m+'-12');
   ok('05')&&(S.run(uid,'investment','Nifty 50 Index Fund SIP',Math.round(sal*.09/500)*500,m+'-05'),S.run(uid,'savings','HDFC Savings - Emergency Fund',Math.round(sal*.14/500)*500,m+'-05'));
   ok('10')&&S.run(uid,'liability','Education Loan EMI paid',-4000,m+'-10')});
  const G=db.prepare('INSERT INTO goals(user_id,name,target,saved,deadline) VALUES(?,?,?,?,?)');
  G.run(uid,'Emergency Fund (6 months)',sal*6,Math.round(sal*2.1),iso(new Date(Date.now()+240*864e5)));G.run(uid,'Goa Trip',30000,12500,iso(new Date(Date.now()+120*864e5)));G.run(uid,'New Laptop',80000,18000,iso(new Date(Date.now()+200*864e5)));
  const H=db.prepare('INSERT INTO habits(user_id,name,frequency) VALUES(?,?,?)'),L=db.prepare('INSERT OR IGNORE INTO habit_logs VALUES(?,?)');
  [['Save Rs 250 daily','daily',.8],['Log every expense','daily',.9],['Review weekly budget','weekly',.85],['Invest via monthly SIP','monthly',.95]].forEach(([n,f,p])=>{const h=H.run(uid,n,f).lastInsertRowid;
   if(f==='daily')for(let k=1;k<=60;k++)if(r()<p||(n==='Log every expense'&&k<=5))L.run(h,iso(new Date(Date.now()-k*864e5)));
   if(f==='weekly')for(let k=1;k<=10;k++)r()<p&&L.run(h,iso(new Date(Date.now()-k*7*864e5)));
   if(f==='monthly')ym.forEach(m=>r()<p&&m+'-05'<=now&&L.run(h,m+'-05'))})};
 mk('Platform Admin','admin@wealthhabit.com','9800000000','admin',0,0);
 [['Aarav Kapoor','demo@wealthhabit.com','9820011122',55000,18000,38000],['Priya Sharma','priya@example.com','9833322211',18000,6500,14000],['Rahul Mehta','rahul@example.com','9867788990',45000,14000,30000],['Ananya Iyer','ananya@example.com','9892233445',72000,22000,45000]].forEach(([n,e,p,sal,rent,bud])=>fill(mk(n,e,p,'user',sal,bud),sal,rent));
 const F=db.prepare('INSERT INTO feedback(user_id,type,message,created) VALUES(?,?,?,?)');F.run(2,'feedback','Streak tracker keeps me motivated. Please add a dark mode!',now);F.run(3,'complaint','Could not edit a wrongly entered expense amount.',now)}
seed();
(function ensureAdmin(){const e=(process.env.ADMIN_EMAIL||'admin@wealthhabit.com').toLowerCase(),p=bcrypt.hashSync(process.env.ADMIN_PASSWORD||'Admin@1234',10),a=db.prepare('SELECT id FROM users WHERE email=?').get(e);
 if(a)db.prepare("UPDATE users SET password=?,role='admin',active=1 WHERE id=?").run(p,a.id);
 else db.prepare("INSERT INTO users(name,email,password,role,created,last_login) VALUES('Platform Admin',?,?,'admin',?,?)").run(e,p,iso(),iso())})();
const port=process.env.PORT||3000;if(require.main===module)app.listen(port,()=>console.log('Running on http://localhost:'+port));
module.exports=app;
