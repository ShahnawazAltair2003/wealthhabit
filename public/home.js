const{useState,useEffect}=React,h=React.createElement;
const USER=JSON.parse(localStorage.getItem('u')||'null'),LOGGED=!!(USER&&localStorage.getItem('t'));
const inr=n=>'\u20B9'+Math.round(n).toLocaleString('en-IN');
function useRoute(){const g=()=>location.hash.slice(2)||'home',[r,s]=useState(g());useEffect(()=>{const f=()=>{s(g());scrollTo(0,0)};addEventListener('hashchange',f);return()=>removeEventListener('hashchange',f)},[]);return r}
function Count({to}){const[v,s]=useState(0);useEffect(()=>{let t0,id;const st=t=>{t0??=t;const k=Math.min(1,(t-t0)/1200);s(Math.round(to*k));if(k<1)id=requestAnimationFrame(st)};id=requestAnimationFrame(st);return()=>cancelAnimationFrame(id)},[to]);return v.toLocaleString('en-IN')}
const Nav=({r})=>h('header',{className:'hn'},h('a',{href:'#/',className:'logo'},'\uD83D\uDCB0 WealthHabit'),
 [['home','Home'],['vision','Our Vision'],['contact','Contact']].map(([k,t])=>h('a',{key:k,href:'#/'+(k==='home'?'':k),className:r===k?'on':''},t)),
 LOGGED?h('a',{href:'app.html',className:'btn',style:{padding:'7px 16px'}},'Go to dashboard'):[h('a',{key:'l',href:'login.html'},'Log in'),h('a',{key:'r',href:'register.html',className:'btn',style:{padding:'7px 16px'}},'Sign up free')]);
const Foot=()=>h('footer',{className:'foot'},h('div',null,h('a',{href:'#/'},'Home'),h('a',{href:'#/vision'},'Vision'),h('a',{href:'#/contact'},'Contact'),h('a',{href:LOGGED?'app.html':'login.html'},LOGGED?'Dashboard':'Log in')),h('p',null,'\u00A9 '+new Date().getFullYear()+' WealthHabit - Build habits. Grow wealth.'));
const Sec=({t,s,children,bg})=>h('section',{style:bg?{background:'#fff'}:null},h('div',{className:'sec'},t&&h('h2',null,t),s&&h('p',{className:'sub'},s),children));

function Stats(){const[d,s]=useState(null);useEffect(()=>{fetch('/api/public/stats').then(r=>r.json()).then(s).catch(()=>{})},[]);if(!d)return null;
 return h('div',{className:'stats'},[['members','Members'],['checkins','Habit check-ins'],['transactions','Transactions tracked'],['goals','Savings goals set']].map(([k,l])=>h('div',{className:'card',key:k},h('div',{className:'v'},h(Count,{to:d[k]})),h('div',{className:'k'},l))))}

function Calc(){const[m,setM]=useState(5000),[rt,setR]=useState(12),[y,setY]=useState(10);
 const r=rt/1200,val=n=>r?m*((Math.pow(1+r,n*12)-1)/r)*(1+r):m*n*12,total=val(y),put=m*y*12,pts=Array.from({length:y+1},(_,i)=>val(i)),mx=Math.max(...pts,1);
 const path=pts.map((v,i)=>`${(i/y)*300},${110-(v/mx)*100}`).join(' ');
 return h('div',{className:'calc'},h('div',null,
  h('label',null,'Monthly investment: ',h('b',null,inr(m)),h('input',{type:'range',min:500,max:100000,step:500,value:m,onChange:e=>setM(+e.target.value)})),
  h('label',null,'Expected annual return: ',h('b',null,rt+'%'),h('input',{type:'range',min:1,max:20,value:rt,onChange:e=>setR(+e.target.value)})),
  h('label',null,'Time period: ',h('b',null,y+' years'),h('input',{type:'range',min:1,max:30,value:y,onChange:e=>setY(+e.target.value)}))),
  h('div',{className:'card'},h('div',{className:'k'},'Projected wealth in '+y+' years'),h('div',{className:'v',style:{color:'var(--pd)'}},inr(total)),
   h('p',{className:'k'},'You invest '+inr(put)+' and growth adds '+inr(total-put)),
   h('svg',{viewBox:'0 0 300 115',style:{width:'100%'},role:'img','aria-label':'Growth projection'},h('polyline',{points:path+' 300,110 0,110',fill:'#0f9d7533',stroke:'none'}),h('polyline',{points:path,fill:'none',stroke:'#0f9d75',strokeWidth:2.5})),
   h('p',{className:'hint'},'Illustration only - not financial advice. Returns are not guaranteed.')))}

function FAQ(){const Q=[['Is WealthHabit free?','Yes. Creating an account and using every tracker is free.'],['How are streaks calculated?','Daily habits count consecutive days, weekly habits count consecutive weeks and monthly habits count consecutive months. Miss a period and the streak restarts.'],['Is my financial data private?','Your data is only visible to your account. Passwords are hashed and sessions are protected with signed tokens.'],['Do I need to link my bank?','No. You log income and spending yourself, which also makes you more aware of every rupee.']],[o,s]=useState(0);
 return h('div',{className:'faq'},Q.map(([q,a],i)=>h('div',{key:i},h('button',{onClick:()=>s(o===i?-1:i),'aria-expanded':o===i},(o===i?'\u2212 ':'+ ')+q),o===i&&h('p',null,a))))}

const F=[['\uD83D\uDCB8','Expense & income tracker','Log every rupee, see category breakdowns and print monthly reports.'],['\uD83D\uDD25','Habit streaks','Daily, weekly and monthly money habits with streaks and completion rates.'],['\uD83C\uDFAF','Savings goals','Set targets and deadlines, add savings and watch progress bars fill up.'],['\uD83D\uDCC8','Wealth analytics','Net worth over time, asset allocation, savings, investments and loans.'],['\uD83D\uDD14','Smart reminders','Browser notifications nudge you when habits are still pending today.'],['\uD83D\uDEE1\uFE0F','Private & secure','Hashed passwords, signed sessions and per-user data isolation.']];
const Home=()=>h('div',null,
 h('section',{className:'hero'},h('h1',null,'Small money habits.',h('br'),'Big wealth.'),h('p',null,'WealthHabit turns saving, budgeting and investing into daily habits you actually stick to - and shows your net worth growing as a result.'),
  h('a',{href:LOGGED?'app.html':'register.html',className:'btn'},LOGGED?'Open my dashboard':'Get started free'),!LOGGED&&h('a',{href:'login.html',className:'btn o'},'Log in')),
 h(Stats),
 h(Sec,{t:'Everything you need in one place',s:'Seven connected tools that work together to improve your financial life.'},h('div',{className:'grid'},F.map(([i,t,d])=>h('div',{className:'card',key:t},h('div',{className:'ic'},i),h('h3',null,t),h('p',{className:'k'},d))))),
 h(Sec,{t:'How it works',bg:1},h('div',{className:'grid'},[['Create your profile','Sign up and set your monthly budget.'],['Track & build habits','Log spending and tick off daily money habits.'],['Watch wealth grow','Dashboards turn your effort into clear insights.']].map(([t,d],i)=>h('div',{className:'step',key:t},h('div',{className:'num'},i+1),h('div',null,h('b',null,t),h('p',{className:'k',style:{margin:'4px 0'}},d)))))),
 h(Sec,{t:'See the power of consistency',s:'Move the sliders to see what a steady monthly habit can become.'},h(Calc)),
 h(Sec,{t:'Frequently asked questions',bg:1},h(FAQ)),
 h(Sec,null,h('div',{className:'card',style:{textAlign:'center'}},h('h2',null,'Ready to build your wealth habit?'),h('p',{className:'k'},'Join in under a minute. No bank linking required.'),h('a',{href:LOGGED?'app.html':'register.html',className:'btn'},LOGGED?'Open dashboard':'Create free account'))));

const Vision=()=>h('div',null,h('section',{className:'hero',style:{padding:'50px 20px'}},h('h1',null,'Our vision'),h('p',null,'A world where every person - not just the wealthy - has the habits, clarity and confidence to build lasting financial security.')),
 h(Sec,{t:'Why we exist',s:'Most people know they should save more. The gap is not knowledge - it is consistency. WealthHabit closes that gap.'},h('div',{className:'grid'},[['\uD83C\uDFAF','Mission','Make good money habits simple, visible and rewarding through streaks, goals and clear analytics.'],['\uD83D\uDD2D','Vision','Financial wellbeing as a daily practice that anyone can maintain, at any income level.'],['\uD83E\uDD1D','Values','Privacy first, honest numbers, no jargon, and no pressure to buy anything.']].map(([i,t,d])=>h('div',{className:'card',key:t},h('div',{className:'ic'},i),h('h3',null,t),h('p',{className:'k'},d))))),
 h(Sec,{t:'Our roadmap',bg:1},h('div',{className:'grid'},[['Now','Expense, habit, goal and net-worth tracking with admin insights.'],['Next','Recurring transactions, CSV import and shareable monthly reports.'],['Later','Family budgets, accountability partners and AI-guided saving tips.']].map(([t,d])=>h('div',{className:'card',key:t},h('span',{className:'tag'},t),h('p',null,d))))),
 h(Sec,{t:'Inspired by'},h('p',{className:'sub'},'We learn from great products: ',h('a',{href:'https://www.ynab.com',target:'_blank',rel:'noopener'},'YNAB'),' for budgeting, ',h('a',{href:'https://www.empower.com',target:'_blank',rel:'noopener'},'Empower'),' for net worth tracking and ',h('a',{href:'https://habitica.com',target:'_blank',rel:'noopener'},'Habitica'),' for habit motivation.')));

function Contact(){const[f,setF]=useState({name:USER?.name||'',email:USER?.email||'',type:'query',subject:'',message:'',website:''}),[st,setSt]=useState(null),[busy,setBusy]=useState(false);
 const set=k=>e=>setF({...f,[k]:e.target.value});
 const send=async e=>{e.preventDefault();setBusy(true);setSt(null);try{const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(f)}),d=await r.json();if(!r.ok)throw new Error(d.error);setSt({ok:1,m:d.emailed?'Thank you! Your message was sent to our team and we will reply by email.':'Thank you! Your message has been received by our team.'});setF({...f,subject:'',message:''})}catch(x){setSt({m:x.message})}setBusy(false)};
 const L=(t,el)=>h('label',null,t,el);
 return h('div',null,h('section',{className:'hero',style:{padding:'50px 20px'}},h('h1',null,'Contact us'),h('p',null,'Have a question, a complaint or an idea? Send it below - we read every message.')),
  h(Sec,null,h('form',{className:'cform card',onSubmit:send},
   L('Your name',h('input',{required:1,maxLength:60,value:f.name,onChange:set('name')})),L('Email',h('input',{type:'email',required:1,value:f.email,onChange:set('email')})),
   L('This is a',h('select',{value:f.type,onChange:set('type')},h('option',{value:'query'},'Query / question'),h('option',{value:'complaint'},'Complaint'),h('option',{value:'feedback'},'Feedback'))),
   L('Subject',h('input',{required:1,maxLength:100,value:f.subject,onChange:set('subject')})),L('Message',h('textarea',{required:1,maxLength:1000,value:f.message,onChange:set('message')})),
   h('input',{className:'hp',tabIndex:-1,autoComplete:'off',name:'website',value:f.website,onChange:set('website'),'aria-hidden':true}),
   h('button',{disabled:busy,style:{width:'100%'}},busy?'Sending...':'Send message'),
   st&&h('div',{className:st.ok?'ok':'er',role:'alert',style:{flexBasis:'100%'}},st.m),
   LOGGED&&h('p',{className:'hint',style:{flexBasis:'100%'}},'Already a member? You can also use ',h('a',{href:'app.html#/support'},'Support inside your dashboard'),' and track replies.'))))}

function App(){const r=useRoute();return h('div',null,h(Nav,{r}),r==='vision'?h(Vision):r==='contact'?h(Contact):h(Home),h(Foot))}
ReactDOM.createRoot(document.getElementById('root')).render(h(App));
