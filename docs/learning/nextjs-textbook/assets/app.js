
/* ---------- syntax highlighter (dependency-free) ---------- */
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
var TS_KW = "const|let|var|function|return|if|else|for|while|do|await|async|import|from|export|default|type|interface|class|new|extends|implements|public|private|protected|readonly|static|as|satisfies|typeof|keyof|infer|instanceof|try|catch|finally|throw|void|null|undefined|true|false|this|super|switch|case|break|continue|enum|namespace|yield|delete|abstract|declare";
var reTS = new RegExp("(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*)|(`(?:\\\\[\\s\\S]|[^`\\\\])*`|\"(?:\\\\.|[^\"\\\\])*\"|'(?:\\\\.|[^'\\\\])*')|\\b(?:"+TS_KW+")\\b|\\b(?:0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b|\\b[A-Z][A-Za-z0-9_]*","g");
var reBASH = /(#[^\n]*)|("(?:\\.|[^"\\])*"|'[^']*')|(?:^|\s)(--?[A-Za-z][A-Za-z0-9-]*)|\b(?:pnpm|npm|npx|node|cd|git|export|run|filter|dev|build|start|curl)\b/g;
function classify(m){
  if(m[1]) return "tok-c";
  if(m[2]) return "tok-s";
  return null;
}
function hlTS(code){
  var out="",last=0,m;
  reTS.lastIndex=0;
  while((m=reTS.exec(code))){
    out += esc(code.slice(last,m.index));
    var tok=m[0], cls;
    if(m[1]) cls="tok-c"; else if(m[2]) cls="tok-s";
    else if(/^\d|^0x/.test(tok)) cls="tok-n";
    else if(/^[A-Z@]/.test(tok)) cls="tok-t";
    else cls="tok-k";
    out += '<span class="'+cls+'">'+esc(tok)+"</span>";
    last=reTS.lastIndex;
  }
  out += esc(code.slice(last));
  return out;
}
function hlBASH(code){
  var out="",last=0,m;
  reBASH.lastIndex=0;
  while((m=reBASH.exec(code))){
    out += esc(code.slice(last,m.index));
    var tok=m[0], cls;
    if(m[1]) cls="tok-c"; else if(m[2]) cls="tok-s"; else if(m[3]!==undefined){cls="tok-n";}
    else cls="tok-k";
    /* keep leading whitespace of flag matches outside the span */
    if(m[3]!==undefined){
      var lead=tok.slice(0,tok.length-m[3].length);
      out += esc(lead)+'<span class="tok-n">'+esc(m[3])+"</span>";
    } else {
      out += '<span class="'+cls+'">'+esc(tok)+"</span>";
    }
    last=reBASH.lastIndex;
  }
  out += esc(code.slice(last));
  return out;
}
function buildCode(node){
  var lang=node.getAttribute("data-lang")||"ts";
  var file=node.getAttribute("data-file")||"";
  var raw=node.textContent.replace(/^\n+/,"").replace(/\s+$/,"");
  var html=(lang==="bash")?hlBASH(raw):hlTS(raw);
  var fig=document.createElement("figure");
  fig.className="code";
  var cap=file?('<figcaption><span class="dot">▍</span><span>'+esc(file)+'</span><button class="copy" type="button">copy</button></figcaption>'):"";
  fig.innerHTML=cap+'<pre><code>'+html+'</code></pre>';
  var btn=fig.querySelector(".copy");
  if(btn){btn.addEventListener("click",function(){
    navigator.clipboard.writeText(raw).then(function(){btn.textContent="copied";setTimeout(function(){btn.textContent="copy";},1200);});
  });}
  node.replaceWith(fig);
}
document.querySelectorAll("script.src").forEach(buildCode);

/* ---------- theme toggle ---------- */
var root=document.documentElement;
var saved=null; try{saved=localStorage.getItem("nt-theme");}catch(e){}
if(saved) root.setAttribute("data-theme",saved);
document.getElementById("themeBtn").addEventListener("click",function(){
  var cur=root.getAttribute("data-theme")==="dark"?"light":"dark";
  root.setAttribute("data-theme",cur);
  try{localStorage.setItem("nt-theme",cur);}catch(e){}
});

/* ---------- mobile nav ---------- */
var menuBtn=document.getElementById("menuBtn");
menuBtn.addEventListener("click",function(){document.body.classList.toggle("nav-open");});
document.querySelectorAll("#sidebar a").forEach(function(a){
  a.addEventListener("click",function(){document.body.classList.remove("nav-open");});
});


/* ---------- 現在の章をサイドバーでハイライト ---------- */
(function(){
  var here = location.pathname.split("/").pop() || "index.html";
  if(here === "") here = "index.html";
  document.querySelectorAll("#sidebar a").forEach(function(a){
    if(a.getAttribute("href") === here) a.classList.add("active");
  });
})();

