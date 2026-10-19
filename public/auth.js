const $=s=>document.querySelector(s);
(async()=>{const t=localStorage.getItem('t');if(!t)return;
 try{const r=await fetch('/api/me',{headers:{Authorization:'Bearer '+t}});if(!r.ok)throw 0;const u=await r.json();
  const b=document.createElement('div');b.className='card';b.style.cssText='background:#e8f7f1;margin-bottom:12px';
  b.innerHTML='You are already logged in as <b></b>. <a href="app.html">Continue</a> or <a href="#" id="sw">log out to switch account</a>.';b.querySelector('b').textContent=u.name+' ('+u.role+')';
  $('.auth').prepend(b);$('#sw').onclick=e=>{e.preventDefault();localStorage.clear();location.reload()}}
 catch{localStorage.clear()}})();
function msg(t,e){const m=$('#msg');m.textContent=t;m.style.color=e?'var(--r)':'var(--pd)'}
$('form').addEventListener('submit',async e=>{e.preventDefault();const f=e.target,b=Object.fromEntries(new FormData(f));
 if(b.confirm!==undefined&&b.confirm!==b.password)return msg('Passwords do not match',1);delete b.confirm;
 const btn=f.querySelector('button');btn.disabled=true;
 try{const r=await fetch('/api/auth/'+f.dataset.mode,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}),d=await r.json();
  if(!r.ok)throw new Error(d.error||'Something went wrong');
  localStorage.setItem('t',d.token);localStorage.setItem('u',JSON.stringify(d.user));location.href='app.html'}
 catch(x){msg(x.message,1);btn.disabled=false}});
