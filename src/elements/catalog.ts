import type { ThemeId } from "../../brand/themes";
import type { ElementCategory } from "../../brand/elements/types";

export type CatalogData = {
  themes: { id: ThemeId; nameAr: string; domainAr: string; colors: Record<string, string>; style: string }[];
  categories: { id: ElementCategory; nameAr: string }[];
  elements: {
    id: string;
    nameAr: string;
    category: ElementCategory;
    tags: string[];
    note?: string;
    kind: "prop" | "backdrop";
    svg: Record<ThemeId, string>;
    svgPortrait?: Record<ThemeId, string>;
  }[];
  characters: { variant: string; pose: string; nameAr: string; poseAr: string; svg: Record<ThemeId, string> }[];
  logos: Record<ThemeId, string>;
  sfx: { id: string; nameAr: string; category: string; categoryAr: string; useAr: string; seconds: number; prompt: string; guard?: string }[];
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** صفحة واحدة مكتفية بذاتها: كل عناصر الهوية من الألف إلى الياء، بكل الثيمات. */
export const buildCatalogHtml = (data: CatalogData): string => {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  const props = data.elements.filter((e) => e.kind === "prop").length;
  const backs = data.elements.length - props;
  const files = data.elements.reduce((n, e) => n + (e.kind === "backdrop" ? 8 : 4), 0) + data.characters.length * 4;
  return `<title>مكتبة عناصر بالإسلام</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=El+Messiri:wght@500;700&family=IBM+Plex+Sans+Arabic:wght@400;500;600&family=Amiri&family=Readex+Pro:wght@500;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* التخطيط: شريط تحكم لاصق (الثيم + البحث + الفئات) ثم أقسام الهوية من الألف إلى الياء بشبكات بطاقات بمسرح ملوّن بالثيم المختار */
:root{
  --bg:#EFE4D3; --panel:#FBF6EE; --ink:#2E3A2A; --muted:#5d6658; --line:#d9cbb4; --accent:#B4532F; --accent-ink:#FBF6EE; --gold:#D9A441;
  --f-head:'El Messiri','IBM Plex Sans Arabic',serif; --f-body:'IBM Plex Sans Arabic',system-ui,sans-serif; --f-mono:'IBM Plex Mono',ui-monospace,monospace; --f-word:'Readex Pro','IBM Plex Sans Arabic',sans-serif; --f-scr:'Amiri',serif;
  --stage:#F4F1EA;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){--bg:#0E1A2B;--panel:#16263D;--ink:#F3EEE3;--muted:#A9B4C6;--line:#26395a;--accent:#E2B24C;--accent-ink:#0E1A2B;--gold:#E2B24C;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#0E1A2B;--panel:#16263D;--ink:#F3EEE3;--muted:#A9B4C6;--line:#26395a;--accent:#E2B24C;--accent-ink:#0E1A2B;--gold:#E2B24C;color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--f-body);font-size:15px;line-height:1.7;direction:rtl;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:0 64px}
body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--bg)}
.wrap{max-width:1240px;margin:0 auto;display:flex;flex-direction:column;gap:44px}
header.top{display:flex;gap:20px;align-items:center;flex-wrap:wrap;padding-top:32px}
header.top .mark svg{width:72px;height:72px;display:block}
header.top h1{font-family:var(--f-head);font-weight:700;font-size:clamp(28px,4vw,42px);line-height:1.2;margin:0;text-wrap:balance}
header.top p{margin:4px 0 0;color:var(--muted);max-width:62ch}
.stats{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
.stat{font-variant-numeric:tabular-nums;border:1px solid var(--line);border-radius:999px;padding:2px 12px;font-size:13px;color:var(--muted)}
.stat b{color:var(--ink);font-weight:600}
.bar{position:sticky;top:env(safe-area-inset-top,0px);z-index:5;background:var(--bg);padding-block:12px;border-bottom:1px solid var(--line);display:flex;gap:12px;flex-wrap:wrap;align-items:center}
.themes{display:flex;gap:6px;flex-wrap:wrap}
.themes button{font:inherit;font-size:14px;display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:10px;padding:6px 12px;cursor:pointer}
.themes button[aria-pressed="true"]{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}
.themes .dot{width:14px;height:14px;border-radius:4px;border:1px solid rgba(0,0,0,.15)}
.bar input,.bar select{font:inherit;font-size:14px;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:7px 12px;min-width:0}
.bar input{flex:1 1 220px}
:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.wrap>*,section>*{min-width:0;max-width:100%}
section{display:flex;flex-direction:column;gap:16px;scroll-margin-top:90px}
section>h2{font-family:var(--f-head);font-size:26px;font-weight:700;margin:0;display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}
section>h2 small{font-family:var(--f-body);font-size:13px;font-weight:500;color:var(--muted)}
.lead{color:var(--muted);margin:-8px 0 0;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-width:0}
.stage{background:var(--stage);aspect-ratio:1;display:grid;place-items:center;padding:14px;max-width:100%}
.stage svg{width:100%;height:100%;display:block}
.meta{padding:8px 10px 10px;display:flex;flex-direction:column;gap:2px;min-width:0}
.meta .n{font-weight:600;font-size:14px}
.id{font-family:var(--f-mono);font-size:12px;color:var(--muted);direction:ltr;text-align:right;background:none;border:0;padding:0;cursor:copy;overflow-wrap:anywhere}
.id:hover{color:var(--accent)}
.note{font-size:12px;color:var(--muted)}
.chars{grid-template-columns:repeat(auto-fill,minmax(120px,1fr))}
.chars .stage{aspect-ratio:3/4}
.backs{grid-template-columns:repeat(auto-fill,minmax(320px,1fr))}
.backs .pair{display:grid;grid-template-columns:3fr 1fr;gap:8px;padding:8px;background:var(--stage)}
.backs .pair>div{border-radius:6px;overflow:hidden;max-width:100%}
.backs .pair svg{width:100%;height:auto;display:block}
.swatches{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
.sw{border:1px solid var(--line);border-radius:10px;overflow:hidden;background:var(--panel)}
.sw i{display:block;height:56px}
.sw div{padding:6px 10px;font-size:13px}
.sw code{font-family:var(--f-mono);font-size:12px;color:var(--muted);direction:ltr;display:block;text-align:right}
.fonts{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px}
.font{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:14px 16px;min-width:0}
.font .s{font-size:30px;line-height:1.5}
.font .r{font-size:13px;color:var(--muted)}
.tablewrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--panel)}
table{border-collapse:collapse;width:100%;min-width:760px;font-size:14px}
th,td{text-align:right;padding:8px 12px;border-bottom:1px solid var(--line);vertical-align:top}
th{font-weight:600;color:var(--muted);font-size:13px;background:var(--panel);position:sticky;top:0}
td.p{font-family:var(--f-mono);font-size:12px;direction:ltr;text-align:left;color:var(--muted)}
.pill{display:inline-block;border-radius:999px;padding:0 8px;font-size:12px;background:var(--bg);border:1px solid var(--line)}
.guard{color:var(--accent);font-size:12px}
.code{font-family:var(--f-mono);font-size:13px;direction:ltr;text-align:left;background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:12px 14px;overflow-x:auto;white-space:pre}
.empty{color:var(--muted)}
.toast{position:fixed;bottom:calc(16px + env(safe-area-inset-bottom,0px));left:50%;transform:translateX(-50%);background:var(--ink);color:var(--bg);padding:6px 14px;border-radius:999px;font-size:13px}
@media (prefers-reduced-motion:no-preference){.card{transition:transform .15s}.card:hover{transform:translateY(-2px)}}
</style>
<div class="wrap">
  <header class="top">
    <div class="mark" id="mark"></div>
    <div style="min-width:0;flex:1">
      <h1>مكتبة عناصر بالإسلام</h1>
      <p>كل ما تُبنى منه مشاهد القناة، من الألوان والخطوط إلى الشخصيات والرموز والخلفيات والمؤثرات. كل عنصر يتبدل شكله مع الثيم، وكل اسم إنجليزي تحت البطاقة هو المعرّف الذي يُستخدم في الكود؛ اضغطه لنسخه.</p>
      <div class="stats">
        <span class="stat"><b>${props}</b> عنصرًا</span>
        <span class="stat"><b>${backs}</b> خلفية</span>
        <span class="stat"><b>${data.characters.length}</b> وضعية شخصية</span>
        <span class="stat"><b>${data.sfx.length}</b> مؤثرًا صوتيًا</span>
        <span class="stat"><b>${files}</b> ملف SVG</span>
      </div>
    </div>
  </header>
  <div class="bar" role="toolbar" aria-label="أدوات الكتالوج">
    <div class="themes" id="themes" role="group" aria-label="الثيم"></div>
    <input id="q" type="search" placeholder="ابحث: كتاب، قلب، coin…" aria-label="بحث">
    <select id="jump" aria-label="اذهب إلى قسم"></select>
  </div>
  <main id="main" class="wrap" style="gap:56px"></main>
</div>
<script type="application/json" id="data">${json}</script>
<script>
(function(){
  var D=JSON.parse(document.getElementById('data').textContent);
  var cur='paper', q='';
  try{var s=localStorage.getItem('bal-theme'); if(s&&D.themes.some(function(t){return t.id===s})) cur=s;}catch(e){}
  var main=document.getElementById('main');
  function h(tag,attrs,html){var el=document.createElement(tag);for(var k in attrs||{}){el.setAttribute(k,attrs[k])}if(html!=null)el.innerHTML=html;return el}
  function E(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;')}
  function theme(){return D.themes.filter(function(t){return t.id===cur})[0]}
  function match(e){if(!q)return true;var hay=(e.nameAr+' '+e.id+' '+(e.tags||[]).join(' ')).toLowerCase();return hay.indexOf(q)>=0}
  function toast(m){var t=h('div',{class:'toast',role:'status'},E(m));document.body.appendChild(t);setTimeout(function(){t.remove()},1300)}
  function copy(id){var done=function(){toast('نُسخ: '+id)};try{navigator.clipboard.writeText(id).then(done,function(){toast(id)})}catch(e){toast(id)}}
  document.addEventListener('click',function(ev){var b=ev.target.closest('.id');if(b)copy(b.dataset.id)});
  function card(e){return '<div class="card"><div class="stage">'+e.svg[cur]+'</div><div class="meta"><span class="n">'+E(e.nameAr)+'</span><button class="id" data-id="'+e.id+'">'+e.id+'</button>'+(e.note?'<span class="note">'+E(e.note)+'</span>':'')+'</div></div>'}
  function render(){
    var t=theme();
    document.documentElement.style.setProperty('--stage',t.colors.bg);
    document.getElementById('mark').innerHTML=D.logos[cur];
    var themesEl=document.getElementById('themes');
    themesEl.innerHTML=D.themes.map(function(x){return '<button type="button" data-t="'+x.id+'" aria-pressed="'+(x.id===cur)+'"><span class="dot" style="background:'+x.colors.primary+'"></span>'+E(x.nameAr)+'</button>'}).join('');
    var out=[], nav=[];
    if(!q){
      nav.push(['identity','الألوان والخطوط']);
      var sw=[['الخلفية','bg'],['البطاقات','surface'],['النص','ink'],['نص ثانوي','inkSoft'],['الأساسي','primary'],['الثانوي','secondary'],['التمييز','highlight'],['شريط الترجمة','captionBg']];
      out.push('<section id="identity"><h2>الألوان والخطوط <small>'+E(t.nameAr)+' · '+E(t.domainAr)+' · أسلوب '+(t.style==='line'?'خطي بالحبر':'مسطح ملوّن')+'</small></h2><div class="swatches">'+sw.map(function(s){return '<div class="sw"><i style="background:'+t.colors[s[1]]+'"></i><div>'+s[0]+'<code>'+t.colors[s[1]]+'</code></div></div>'}).join('')+'</div><div class="fonts">'+
      '<div class="font"><div class="s" style="font-family:var(--f-head);font-weight:700">لماذا نؤجّل؟</div><div class="r">العناوين · El Messiri</div></div>'+
      '<div class="font"><div class="s" style="font-family:var(--f-body);font-weight:500;font-size:22px">التأجيل هروب من شعور، لا كسل.</div><div class="r">النص والترجمة · IBM Plex Sans Arabic</div></div>'+
      '<div class="font"><div class="s" style="font-family:var(--f-scr)">وَأَن لَّيْسَ لِلْإِنسَٰنِ إِلَّا مَا سَعَىٰ</div><div class="r">الآيات والأحاديث فقط · Amiri</div></div>'+
      '<div class="font"><div class="s" style="font-family:var(--f-word);font-weight:700">بالإسلام</div><div class="r">اسم القناة بجوار الشعار فقط · Readex Pro</div></div>'+
      '</div></section>');
      nav.push(['characters','الشخصيات']);
      out.push('<section id="characters"><h2>الشخصيات <small>بلا ملامح وجه · لا تمثل نبيًا ولا صحابيًا ولا ملَكًا</small></h2><div class="grid chars">'+D.characters.map(function(c){return '<div class="card"><div class="stage">'+c.svg[cur]+'</div><div class="meta"><span class="n">'+E(c.nameAr)+' · '+E(c.poseAr)+'</span><button class="id" data-id="'+c.variant+'/'+c.pose+'">'+c.variant+' · '+c.pose+'</button></div></div>'}).join('')+'</div></section>');
    }
    D.categories.forEach(function(c){
      var items=D.elements.filter(function(e){return e.category===c.id&&match(e)});
      if(!items.length)return;
      nav.push([c.id,c.nameAr]);
      if(c.id==='backdrops'){
        out.push('<section id="'+c.id+'"><h2>'+E(c.nameAr)+' <small>'+items.length+' · أفقي 16:9 وعمودي 9:16</small></h2><div class="grid backs">'+items.map(function(e){return '<div class="card"><div class="pair"><div>'+e.svg[cur]+'</div><div>'+e.svgPortrait[cur]+'</div></div><div class="meta"><span class="n">'+E(e.nameAr)+'</span><button class="id" data-id="'+e.id+'">'+e.id+'</button>'+(e.note?'<span class="note">'+E(e.note)+'</span>':'')+'</div></div>'}).join('')+'</div></section>');
      } else {
        out.push('<section id="'+c.id+'"><h2>'+E(c.nameAr)+' <small>'+items.length+'</small></h2><div class="grid">'+items.map(card).join('')+'</div></section>');
      }
    });
    var sfx=D.sfx.filter(function(s){return !q||(s.nameAr+' '+s.id+' '+s.useAr).toLowerCase().indexOf(q)>=0});
    if(sfx.length){
      nav.push(['sfx','المؤثرات الصوتية']);
      out.push('<section id="sfx"><h2>المؤثرات الصوتية والآهات <small>'+sfx.length+' · لا موسيقى ولا آلات</small></h2><p class="lead">في السكريبت: <span class="code" style="display:inline;padding:2px 8px">[صوت: page-turn]</span>. الملف النهائي لكل مؤثر يُعتمد بالسماع ثم يُحفظ في assets/sfx.</p><div class="tablewrap"><table><thead><tr><th>المؤثر</th><th>المعرّف</th><th>الفئة</th><th>متى يُستخدم</th><th>ث</th><th>وصف التوليد</th></tr></thead><tbody>'+sfx.map(function(s){return '<tr><td>'+E(s.nameAr)+(s.guard?'<div class="guard">'+E(s.guard)+'</div>':'')+'</td><td><button class="id" data-id="'+s.id+'">'+s.id+'</button></td><td><span class="pill">'+E(s.categoryAr)+'</span></td><td>'+E(s.useAr)+'</td><td style="font-variant-numeric:tabular-nums">'+s.seconds+'</td><td class="p">'+E(s.prompt)+'</td></tr>'}).join('')+'</tbody></table></div></section>');
    }
    if(!q){
      nav.push(['usage','طريقة الاستخدام']);
      out.push('<section id="usage"><h2>طريقة الاستخدام</h2><p class="lead">العنصر يأخذ ألوانه من ثيم الحلقة تلقائيًا، فلا يُلوَّن يدويًا. ملفات SVG الجاهزة لكل ثيم موجودة في assets/elements داخل المستودع، والقائمة الكاملة في manifest.json.</p><div class="code">&lt;Element id="book-open" theme={theme} size={240} /&gt;\\n&lt;Element id="night-sky" theme={theme} width={1920} height={1080} /&gt;\\n&lt;Character theme={theme} variant="narrator-f" pose="think" height={520} /&gt;\\n\\nnpx bal elements   # يعيد تصدير المكتبة والكتالوج</div></section>');
    }
    if(!out.length) out.push('<p class="empty">لا نتائج لـ «'+E(q)+'». جرّب كلمة أخرى أو معرّفًا إنجليزيًا.</p>');
    main.innerHTML=out.join('');
    var j=document.getElementById('jump');
    j.innerHTML='<option value="">اذهب إلى قسم…</option>'+nav.map(function(n){return '<option value="'+n[0]+'">'+E(n[1])+'</option>'}).join('');
  }
  document.getElementById('themes').addEventListener('click',function(ev){var b=ev.target.closest('button[data-t]');if(!b)return;cur=b.dataset.t;try{localStorage.setItem('bal-theme',cur)}catch(e){}render()});
  document.getElementById('q').addEventListener('input',function(ev){q=ev.target.value.trim().toLowerCase();render()});
  document.getElementById('jump').addEventListener('change',function(ev){var el=document.getElementById(ev.target.value);if(el)el.scrollIntoView({behavior:'smooth'});ev.target.value=''});
  render();
})();
</script>
`;
};

export { esc };
