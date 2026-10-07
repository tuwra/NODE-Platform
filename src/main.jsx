import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link, NavLink, Route, Routes, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Beaker, CalendarDays, CheckCircle2, ChevronDown, Clock3,
  FlaskConical, Globe2, GraduationCap, LayoutDashboard, LogIn, LogOut, Mail,
  Menu, Network, Search, Settings2, ShieldCheck, Sparkles, Users, X, Wrench,
  Cpu, Atom, BookOpen, Trophy, MapPin, UserRound, Plus, Trash2, Edit3, Lock, UserPlus, Download, TrendingUp,
  PlayCircle, Award, ListChecks, Video, Printer
} from "lucide-react";
import "./styles.css";
import { supabase } from "./lib/supabase";
import {
  signUp, signIn, signOut, requestPasswordReset, updatePassword, verifySignupOtp, resendSignupOtp, getProfile, fetchAllContent, fetchTable,
  registerForWorkshop, getMyRegistrations, joinCommunity, getMyCommunityMembership,
  adminListUsers, adminSetUserRole, adminCreateRow, adminUpdateRow, adminDeleteRow,
  adminFetchRegistrationsJoined, adminFetchCommunityJoined, adminFetchCourseEnrollmentsJoined,
  enrollInCourse, updateLessonProgress, completeCourse, getMyCourseEnrollment, verifyCertificate,
  fetchSiteSettings, updateSiteSetting,
  submitContactMessage, adminFetchContactMessages, adminMarkContactMessageRead, adminDeleteContactMessage,
} from "./lib/api";
import { exportAllDataToExcel } from "./lib/exportExcel";

const BRAND = { navy:"#2D3B52", cream:"#F6F2EC", amber:"#C17F3A", border:"#E3DDD2" };

/* ===================================================================== */
/* AUTH — real Supabase session + profile (role comes from the server,   */
/* enforced by RLS — this replaces the old localStorage "node-admin"     */
/* flag, which any visitor could set from the browser console).          */
/* ===================================================================== */

const AuthContext = createContext(null);
export function useAuth(){ return useContext(AuthContext) }

function AuthProvider({ children }){
  const [session, setSession] = useState(undefined); // undefined = not checked yet
  const [profile, setProfile] = useState(null);
  const [myRegistrations, setMyRegistrations] = useState(new Set());
  const [myMembership, setMyMembership] = useState(null);

  async function loadUserData(uid){
    const [p, regs, member] = await Promise.all([
      getProfile(uid), getMyRegistrations(uid), getMyCommunityMembership(uid),
    ]);
    setProfile(p); setMyRegistrations(regs); setMyMembership(member);
  }

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      setSession(data.session||null);
      if(data.session) loadUserData(data.session.user.id);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession)=>{
      setSession(newSession||null);
      if(newSession) loadUserData(newSession.user.id);
      else { setProfile(null); setMyRegistrations(new Set()); setMyMembership(null); }
    });
    return ()=>sub.subscription.unsubscribe();
  },[]);

  const value = {
    session, profile, loading: session===undefined,
    isAdmin: profile?.role==="admin",
    myRegistrations, myMembership,
    async refresh(){ if(session) await loadUserData(session.user.id) },
    async signUp(args){ return signUp(args) },
    async signIn(args){ return signIn(args) },
    async signOut(){ await signOut() },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ===================================================================== */
/* DATA — content loaded from the database instead of hardcoded arrays.  */
/* ===================================================================== */

const DataContext = createContext(null);
function useData(){ return useContext(DataContext) }

function DataProvider({ children }){
  const [state, setState] = useState({ loading:true, error:null,
    workshops:[], projects:[], events:[], articles:[], labs:[], team:[], sections:[], courses:[], booked:{}, settings:{}, labExperiments:[] });

  async function refetch(){
    try{
      setState(s=>({...s, loading:true, error:null}));
      const data = await fetchAllContent();
      setState({ loading:false, error:null, ...data });
    }catch(e){
      setState(s=>({...s, loading:false, error:e.message||String(e)}));
    }
  }
  useEffect(()=>{ refetch() },[]);

  return <DataContext.Provider value={{...state, refetch}}>{children}</DataContext.Provider>;
}

function seatsLeft(w, booked){ return Math.max(0, (w.seats||0) - (booked[w.id]||0)) }
function effectiveStatus(w, booked){
  if(w.status==="ended") return "ended";
  if(seatsLeft(w,booked)<=0) return "full";
  return w.status;
}

/* ===================================================================== */

function useLang(){
  const [lang,setLang]=useState(()=>localStorage.getItem("node-lang")||"ar");
  useEffect(()=>{document.documentElement.lang=lang; document.documentElement.dir=lang==="ar"?"rtl":"ltr"; localStorage.setItem("node-lang",lang)},[lang]);
  return {lang, ar:lang==="ar", toggle:()=>setLang(v=>v==="ar"?"en":"ar")};
}

function Layout(){
  const {lang,ar,toggle}=useLang();
  const [open,setOpen]=useState(false);
  const { session, profile, isAdmin } = useAuth();
  const { sections, settings } = useData();
  const brand = settings.brand || {};
  const brandVars = [brand.navy&&`--navy:${brand.navy}`,brand.cream&&`--cream:${brand.cream}`,brand.amber&&`--amber:${brand.amber}`].filter(Boolean).join(";");
  const nav=[
    ["/",ar?"الرئيسية":"Home"],["/about",ar?"عن نـــود":"About"],["/workshops",ar?"الورش":"Workshops"],
    ["/courses",ar?"الدورات":"Courses"],
    ["/projects",ar?"المشاريع":"Projects"],["/events",ar?"الفعاليات":"Events"],["/knowledge",ar?"المعرفة":"Knowledge"],
    ["/community",ar?"المجتمع":"Community"],["/team",ar?"الفريق":"Team"],["/contact",ar?"تواصل معنا":"Contact"],
    ...sections.filter(s=>s.is_published).sort((a,b)=>a.sort_order-b.sort_order).map(s=>[`/s/${s.slug}`, ar?s.nav_label_ar:s.nav_label_en]),
  ];
  return <div className="app">
    {!!brandVars && <style>{`:root{${brandVars}}`}</style>}
    <header className="navbar">
      <Link to="/" className="brand" onClick={()=>setOpen(false)}>
        <Logo/><span className="brand-name">NODE</span>
      </Link>
      <button className="mobile-menu" onClick={()=>setOpen(v=>!v)} aria-label="menu">{open?<X/>:<Menu/>}</button>
      <nav className={"nav-links "+(open?"open":"")}>
        {nav.map(([to,label])=><NavLink key={to} to={to} onClick={()=>setOpen(false)} className={({isActive})=>isActive?"active":""}>{label}</NavLink>)}
        <button className="lang-btn" onClick={toggle}><Globe2 size={16}/>{ar?"EN":"عربي"}</button>
        {isAdmin
          ? <Link className="nav-cta" to="/admin" onClick={()=>setOpen(false)}><LayoutDashboard size={16}/>{ar?"لوحة التحكم":"Dashboard"}</Link>
          : session
            ? <Link className="nav-cta" to="/community" onClick={()=>setOpen(false)}><UserRound size={16}/>{profile?.full_name || (ar?"حسابي":"My account")}</Link>
            : <Link className="nav-cta" to="/signup" onClick={()=>setOpen(false)}>{ar?"انضم إلى نـــود":"Join NODE"}</Link>}
      </nav>
    </header>
    <main><Routes>
      <Route path="/" element={<Home ar={ar}/>}/>
      <Route path="/about" element={<About ar={ar}/>}/>
      <Route path="/workshops" element={<Workshops ar={ar}/>}/>
      <Route path="/workshops/:id" element={<WorkshopDetails ar={ar}/>}/>
      <Route path="/courses" element={<Courses ar={ar}/>}/>
      <Route path="/courses/:id" element={<CourseDetails ar={ar}/>}/>
      <Route path="/certificate/:code" element={<CertificatePage ar={ar}/>}/>
      <Route path="/projects" element={<Projects ar={ar}/>}/>
      <Route path="/projects/:id" element={<ProjectDetails ar={ar}/>}/>
      <Route path="/events" element={<Events ar={ar}/>}/>
      <Route path="/knowledge" element={<Knowledge ar={ar}/>}/>
      <Route path="/community" element={<Community ar={ar}/>}/>
      <Route path="/team" element={<Team ar={ar}/>}/>
      <Route path="/achievements" element={<Achievements ar={ar}/>}/>
      <Route path="/labs" element={<Labs ar={ar}/>}/>
      <Route path="/labs/experiment/:id" element={<LabExperimentView ar={ar}/>}/>
      <Route path="/contact" element={<Contact ar={ar}/>}/>
      <Route path="/login" element={<Login ar={ar}/>}/>
      <Route path="/signup" element={<Signup ar={ar}/>}/>
      <Route path="/forgot-password" element={<ForgotPassword ar={ar}/>}/>
      <Route path="/reset-password" element={<ResetPassword ar={ar}/>}/>
      <Route path="/admin" element={<Admin ar={ar}/>}/>
      <Route path="/s/:slug" element={<SectionPage ar={ar}/>}/>
      <Route path="*" element={<NotFound ar={ar}/>}/>
    </Routes></main>
    <Footer ar={ar}/>
  </div>
}

function Logo({small=false}){return <svg className={"logo "+(small?"small":"")} viewBox="0 0 46 46" aria-label="NODE logo">
  <circle cx="12" cy="12" r="6"/><circle cx="34" cy="12" r="6"/><circle cx="23" cy="34" r="6" className="accent"/>
  <line x1="12" y1="12" x2="34" y2="12"/><line x1="12" y1="12" x2="23" y2="34"/><line x1="34" y1="12" x2="23" y2="34"/>
</svg>}

function SectionTitle({eyebrow,title,text,ar}){return <div className="section-head"><span className="eyebrow">{eyebrow}</span><h2>{title}</h2>{text&&<p>{text}</p>}</div>}

function NodeField(){return <div className="node-field" aria-hidden="true">
  {Array.from({length:16}).map((_,i)=><span key={i} className={"node-dot n"+i}/>)}
  <svg viewBox="0 0 700 500" preserveAspectRatio="none"><path d="M60 80 L250 180 L420 90 L620 210 L470 390 L250 300 L60 410 L250 180 L470 390" /><path d="M250 300 L420 90" /></svg>
</div>}

function Home({ar}){
 const { workshops, labs, booked, settings } = useData();
 const home = settings.home||{};
 const heroTitle = home[ar?"hero_title_ar":"hero_title_en"];
 const heroText = home[ar?"hero_text_ar":"hero_text_en"];
 return <div>
  <section className="hero">
    <NodeField/>
    <div className="hero-copy">
      <div className="hero-mark"><Logo/><span>نـــود <b>|</b> NODE</span></div>
      <div className="pill"><Network size={15}/>{ar?"Physics × Technology × Application":"Physics × Technology × Application"}</div>
      <h1>{heroTitle || (ar?<>نحوّل <em>الفكرة العلمية</em><br/>إلى تجربة ملموسة.</>:<>Turning <em>scientific ideas</em><br/>into tangible experiences.</>)}</h1>
      <p>{heroText || (ar?"نـــود مبادرة علمية وتقنية تربط الفيزياء بالتقنية والتطبيقات العملية، وتقدم المعرفة بأسلوب مبسط وتفاعلي.":"NODE is a scientific and technology initiative connecting physics with technology and practical applications through simple, interactive learning.")}</p>
      <div className="actions"><Link className="btn primary" to="/workshops">{ar?"استكشف الورش":"Explore Workshops"} <ArrowLeft size={18}/></Link><Link className="btn ghost" to="/community">{ar?"انضم إلى مجتمع نـــود":"Join NODE Community"} <ArrowLeft size={18}/></Link></div>
      <div className="hero-stats"><span><b>03</b>{ar?"مسارات مترابطة":"Connected paths"}</span><span><b>02</b>{ar?"معامل تطبيقية":"Hands-on labs"}</span><span><b>∞</b>{ar?"أفكار قابلة للتجربة":"Ideas to explore"}</span></div>
    </div>
  </section>

  <section className="section intro"><div className="intro-grid"><div><span className="eyebrow">{ar?"لماذا نـــود؟":"WHY NODE?"}</span><h2>{ar?"كل عُقدة تصنع اتصالًا جديدًا.":"Every node creates a new connection."}</h2></div><p>{ar?"اسم نـــود مستوحى من مفهوم العُقدة في الشبكات: نقطة اتصال والتقاء. نمثل هذا المعنى في التعليم، فنربط المفاهيم الفيزيائية بالتقنيات الحديثة ونحوّلها إلى مشاريع وتجارب يمكن رؤيتها وقياسها وتطويرها.":"NODE takes its name from the network node: a point of connection. We apply that idea to learning by connecting physics concepts with modern technology and turning them into measurable, tangible projects and experiments."}</p></div></section>

  <section className="section"><SectionTitle ar={ar} eyebrow={ar?"ما نقدمه":"WHAT WE DO"} title={ar?"من المعرفة إلى التطبيق.":"From knowledge to application."} text={ar?"مسارات عملية تساعد المتعلم على فهم الفكرة، بناء التجربة، ثم رؤية أثرها.":"Practical paths that help learners understand an idea, build an experiment, and see its impact."}/>
   <div className="feature-grid">
    <Feature icon={<Beaker/>} n="01" title={ar?"ورش وتجارب":"Workshops & Experiments"} text={ar?"ورش علمية وتقنية تفاعلية تربط المفاهيم بالتطبيق.":"Interactive scientific and technical workshops that connect concepts to practice."}/>
    <Feature icon={<Wrench/>} n="02" title={ar?"مشاريع ونماذج":"Projects & Prototypes"} text={ar?"نبني نماذج أولية ونوثق الرحلة من الفكرة إلى النتيجة.":"We build prototypes and document the journey from idea to result."}/>
    <Feature icon={<BookOpen/>} n="03" title={ar?"معرفة مبسطة":"Accessible Knowledge"} text={ar?"محتوى علمي وتقني بلغة واضحة ومناسبة للمجتمع والطلاب.":"Clear scientific and technology content for students and the wider community."}/>
   </div>
  </section>

  <section className="section dark-section"><div className="section-head light"><span className="eyebrow">{ar?"منهج نـــود":"THE NODE METHOD"}</span><h2>{ar?"Physics → Technology → Application":"Physics → Technology → Application"}</h2></div>
    <div className="method"><MethodStep n="01" title="Physics" text={ar?"نفهم الظاهرة والمبدأ العلمي.":"Understand the phenomenon and scientific principle."}/><div className="method-line"/><MethodStep n="02" title="Technology" text={ar?"نختار الأداة ونبني الحل.":"Choose the tools and build the solution."}/><div className="method-line"/><MethodStep n="03" title="Application" text={ar?"نحوّل الحل إلى تجربة ذات أثر.":"Turn the solution into an impactful experience."}/></div>
  </section>

  <section className="section"><SectionTitle ar={ar} eyebrow={ar?"الورش القادمة":"UPCOMING WORKSHOPS"} title={ar?"تعلم بالتجربة.":"Learn by doing."}/><WorkshopGrid ar={ar} items={workshops.slice(0,3)} booked={booked}/><div className="center"><Link className="text-link" to="/workshops">{ar?"عرض جميع الورش":"View all workshops"} <ArrowLeft size={16}/></Link></div></section>

  <section className="section labs-home"><SectionTitle ar={ar} eyebrow={ar?"المعامل":"THE LABS"} title={ar?"مكان تتحول فيه الفكرة إلى تجربة.":"Where ideas become experiments."}/><div className="lab-grid">{labs.map((l)=><LabCard key={l.id} lab={l} ar={ar}/>)}</div></section>

  <section className="section cta"><div className="cta-box"><Logo/><div><span className="eyebrow">{ar?"مجتمع نـــود":"NODE COMMUNITY"}</span><h2>{ar?"كن جزءًا من الشبكة.":"Become part of the network."}</h2><p>{ar?"انضم إلى مجتمع يهتم بالعلم والتقنية، وشارك في الورش والتجارب والمشاريع.":"Join a community interested in science and technology and take part in workshops, experiments and projects."}</p></div><Link className="btn primary" to="/community">{ar?"انضم الآن":"Join now"} <ArrowLeft size={18}/></Link></div></section>
 </div>
}

function Feature({icon,n,title,text}){return <div className="feature"><span className="feature-no">{n}</span><div className="icon-box">{icon}</div><h3>{title}</h3><p>{text}</p></div>}
function MethodStep({n,title,text}){return <div className="method-step"><span>{n}</span><div><h3>{title}</h3><p>{text}</p></div></div>}
function LabCard({lab,ar}){const Icon = lab.id==="tech"?Cpu:Atom; return <Link to="/labs" className="lab-card"><div className="card-art"><Icon size={28}/></div><div className="card-body"><h3>{ar?lab.title_ar:lab.title_en}</h3><p>{ar?lab.text_ar:lab.text_en}</p></div></Link>}

function About({ar}){
 const { settings } = useData(); const about = settings.about||{};
 const aboutIntro = about[ar?"intro_ar":"intro_en"];
 return <PageShell ar={ar} eyebrow={ar?"عن نـــود":"ABOUT NODE"} title={ar?"نربط العلم بما يمكن صنعه.":"Connecting science to what can be built."} intro={aboutIntro || (ar?"نـــود مبادرة علمية وتقنية تهدف إلى نشر الوعي بالتقنيات الحديثة وتبسيطها للمجتمع، من خلال ربطها بأساسها العلمي في الفيزياء.":"NODE is a scientific and technology initiative that makes modern technology easier to understand by connecting it to its scientific foundation in physics.")}>
 <div className="story-grid"><div className="story-visual"><Logo/><div className="orbit o1"/><div className="orbit o2"/><span>NODE</span></div><div className="prose"><h3>{ar?"قصة الاسم":"The name"}</h3><p>{ar?"العُقدة في الشبكات هي نقطة اتصال والتقاء. اخترناها لتكون استعارة لطريقتنا: كل مشروع نـــود يمثل عقدة تربط نظرية فيزيائية بتقنية وتطبيق عملي، فتتشكل شبكة معرفية متكاملة.":"A node is a point of connection in a network. We chose it as a metaphor for our approach: each NODE project connects a physics principle to a technology and a practical application, forming a connected knowledge network."}</p></div></div>
 <div className="vision-grid"><InfoBlock title={ar?"الرؤية":"Vision"} text={about[ar?"vision_ar":"vision_en"] || (ar?"أن نكون مبادرة تسهم في نشر الوعي بالتقنيات الحديثة وتبسيطها للمجتمع، من خلال ربطها بأساسها العلمي (الفيزياء)، بما يخدم تطوير المجتمع وتحفيز اهتمامه بالعلم والتقنية.":"To contribute to technology awareness by simplifying modern technologies through their scientific foundation in physics, supporting society and encouraging interest in science and technology.")}/><InfoBlock title={ar?"الرسالة":"Mission"} text={about[ar?"mission_ar":"mission_en"] || (ar?"نشر تقنيات وتطبيقات عملية حديثة مبنية على مفاهيم فيزيائية وتقنية، وتقديمها للمجتمع بأسلوب مبسط وتفاعلي، إسهامًا في نشر الأثر التقني الإيجابي وتنمية الوعي العلمي والتقني.":"To share modern practical technologies and applications based on physics and technology concepts through simple, interactive experiences that grow positive technology impact and awareness.")}/></div>
 <section className="section compact"><SectionTitle ar={ar} eyebrow={ar?"أهدافنا":"OUR GOALS"} title={ar?"أثر يبدأ من سؤال.":"Impact starts with a question."}/><div className="goal-grid">{["نشر الوعي بالتقنيات الحديثة وتبسيطها لمختلف فئات المجتمع.","تقديم ورش وتجارب تقنية وعلمية تفاعلية.","تبسيط المفاهيم الفيزيائية للطلاب من خلال التقنية والمشاريع الواقعية.","تحفيز اهتمام الطلاب بمجالات العلوم والتقنية والهندسة والرياضيات (STEM).","بناء مجتمع مهتم بالعلم والتقنية وتبادل المعرفة."].map((g,i)=><div className="goal" key={g}><b>0{i+1}</b><p>{ar?g:["Increase awareness of modern technologies and simplify them for the community.","Offer interactive scientific and technology workshops and experiments.","Simplify physics concepts through technology and real projects.","Encourage interest in STEM fields.","Build a community interested in science, technology and knowledge sharing."][i]}</p></div>)}</div></section>
 </PageShell>}

function InfoBlock({title,text}){return <div className="info-block"><span className="eyebrow">{title}</span><p>{text}</p></div>}

function Workshops({ar}){
 const { workshops, booked, loading } = useData();
 const [q,setQ]=useState("");const [cat,setCat]=useState("all");
 const filtered=workshops.filter(w=>(cat==="all"||w.cat===cat)&&(`${w.title_ar} ${w.title_en} ${w.desc_ar}`.toLowerCase().includes(q.toLowerCase())));
 return <PageShell ar={ar} eyebrow={ar?"التعلم بالتجربة":"LEARN BY DOING"} title={ar?"ورش نـــود":"NODE Workshops"} intro={ar?"تجارب علمية وتقنية مصممة لتربط الفكرة بالتطبيق.":"Scientific and technology experiences designed to connect ideas with practice."}>
 <div className="filters"><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={ar?"ابحث عن ورشة...":"Search workshops..."}/></div><select value={cat} onChange={e=>setCat(e.target.value)}><option value="all">{ar?"كل التصنيفات":"All categories"}</option>{["فيزياء","تقنية","برمجة","ذكاء اصطناعي","إلكترونيات","STEM"].map(x=><option key={x} value={x}>{ar?x:x}</option>)}</select></div>
 {loading?<Loading ar={ar}/>:<><WorkshopGrid ar={ar} items={filtered} booked={booked}/>{!filtered.length&&<Empty ar={ar} text={ar?"لا توجد ورش مطابقة":"No matching workshops"}/>}</>}
 </PageShell>}

function WorkshopGrid({ar,items,booked}){return <div className="workshop-grid">{items.map(w=><Link className="workshop-card" to={`/workshops/${w.id}`} key={w.id}><div className="card-art"><span>{w.cat}</span><Logo small/></div><div className="card-body"><div className="status-row"><Status status={effectiveStatus(w,booked)} ar={ar}/><span>{w.level}</span></div><h3>{ar?w.title_ar:w.title_en}</h3><p>{ar?w.desc_ar:w.desc_en}</p><div className="meta"><span><CalendarDays size={15}/>{w.workshop_date}</span><span><Clock3 size={15}/>{w.duration}</span></div><div className="seats"><div><span>{ar?"المقاعد":"Seats"}</span><b>{seatsLeft(w,booked)} {ar?"متبقي":"left"}</b></div><div className="bar"><i style={{width:`${Math.min(100,((booked[w.id]||0)/(w.seats||1))*100)}%`}}/></div></div></div></Link>)}</div>}

function Status({status,ar}){const t={open:ar?"التسجيل مفتوح":"Registration open",soon:ar?"قريبًا":"Coming soon",full:ar?"مكتملة":"Full",ended:ar?"انتهت":"Ended"}[status]||status;return <span className={`status ${status}`}>{t}</span>}

function Loading({ar}){return <div className="empty"><p>{ar?"جاري التحميل...":"Loading..."}</p></div>}

function WorkshopDetails({ar}){
 const {id}=useParams();
 const { workshops, booked, refetch } = useData();
 const { session, myRegistrations, refresh } = useAuth();
 const [busy,setBusy]=useState(false);
 const [err,setErr]=useState("");
 const w=workshops.find(x=>x.id===id);
 if(!w)return <NotFound ar={ar}/>;
 const already = myRegistrations.has(w.id);
 const status = effectiveStatus(w,booked);
 async function register(){
   setBusy(true); setErr("");
   try{ await registerForWorkshop(w.id, session.user.id); await Promise.all([refetch(), refresh()]) }
   catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }
 return <PageShell ar={ar} eyebrow={w.cat} title={ar?w.title_ar:w.title_en} intro={ar?w.desc_ar:w.desc_en}><div className="detail-layout"><div className="detail-main"><div className="large-art"><Logo/><span>{w.lab}</span></div><h2>{ar?"ماذا سيتعلم المشارك؟":"What will you learn?"}</h2><ul className="check-list">{(ar?["فهم المفهوم العلمي وراء التجربة.","التعامل مع الأدوات والتقنيات المستخدمة.","بناء تجربة عملية وقراءة نتائجها.","ربط الملاحظة بالنموذج العلمي."]:["Understand the scientific concept behind the experiment.","Work with the tools and technologies used.","Build a practical experiment and interpret its results.","Connect observations to a scientific model."]).map(x=><li key={x}><CheckCircle2/>{x}</li>)}</ul><h2>{ar?"المتطلبات":"Requirements"}</h2><p>{ar?"لا توجد متطلبات مسبقة للورش المبتدئة. يُفضل إحضار جهاز لابتوب عند الحاجة.":"No prerequisites for beginner workshops. A laptop is recommended when required."}</p></div><aside className="detail-side"><Status status={status} ar={ar}/><div className="detail-facts"><span><CalendarDays/>{w.workshop_date}</span><span><Clock3/>{w.workshop_time} · {w.duration}</span><span><MapPin/>{w.lab}</span><span><Users/>{seatsLeft(w,booked)} {ar?"مقعد متبقي":"seats left"}</span></div>
  {already?<div className="success"><CheckCircle2/><b>{ar?"تم تسجيلك بنجاح":"Registration successful"}</b><span>{ar?"يظهر تسجيلك في حسابك ولوحة الإدارة.":"Your registration is saved to your account and visible to admins."}</span></div>
  : !session ? <div className="success"><Lock size={18}/><b>{ar?"سجّل حساب مجاني للتسجيل":"Create a free account to register"}</b><Link className="btn primary full" style={{marginTop:10}} to="/signup">{ar?"إنشاء حساب":"Sign up"} <ArrowLeft size={18}/></Link></div>
  : <>{err&&<div className="form-error">{err}</div>}<button className="btn primary full" disabled={status!=="open"||busy} onClick={register}>{busy?(ar?"جارٍ التسجيل...":"Registering...") : status==="open"?(ar?"سجل في الورشة":"Register for workshop"):(ar?"التسجيل غير متاح":"Registration unavailable")} <ArrowLeft size={18}/></button></>}
 </aside></div></PageShell>}

/* ===================================================================== */
/* COURSES — video lessons + quiz + certificate on passing.              */
/* ===================================================================== */

function Courses({ar}){
 const { courses, loading } = useData();
 const list = courses.filter(c=>c.is_published!==false);
 if(loading) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>;
 return <PageShell ar={ar} eyebrow={ar?"تعلّم بعمق":"LEARN IN DEPTH"} title={ar?"دورات نـــود":"NODE Courses"} intro={ar?"دورات فيديو منظمة مع اختبار وشهادة إتمام عند اجتيازها.":"Structured video courses with a quiz and a completion certificate once you pass."}>
  {!list.length ? <Empty ar={ar} text={ar?"لا توجد دورات منشورة بعد":"No published courses yet"}/> :
  <div className="project-grid">{list.map(c=><Link className="project-card" to={`/courses/${c.id}`} key={c.id}>
    <div className="project-art"><span>{ar?"دورة":"Course"} / {c.id}</span><PlayCircle/></div>
    <div><span className="eyebrow">{c.cat}{c.level?` · ${c.level}`:""}</span><h3>{ar?c.title_ar:c.title_en}</h3><p>{ar?c.desc_ar:c.desc_en}</p>
    <div className="tag"><ListChecks size={14} style={{verticalAlign:"middle",marginInlineEnd:4}}/>{(c.lessons||[]).length} {ar?"دروس":"lessons"} · {(c.quiz||[]).length} {ar?"أسئلة":"quiz Qs"}</div></div>
  </Link>)}</div>}
 </PageShell>
}

function VideoPlayer({url}){
 if(!url) return null;
 const isFile = /\.(mp4|webm|ogg)(\?.*)?$/i.test(url);
 if(isFile) return <video controls style={{width:"100%",borderRadius:12,background:"#000"}} src={url}/>;
 return <div style={{position:"relative",paddingTop:"56.25%",borderRadius:12,overflow:"hidden",background:"#000"}}>
   <iframe src={url} title="lesson video" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen
     style={{position:"absolute",inset:0,width:"100%",height:"100%",border:0}}/>
 </div>
}

function CourseDetails({ar}){
 const {id}=useParams();
 const { courses, loading } = useData();
 const { session } = useAuth();
 const course = courses.find(c=>c.id===id);
 const [enrollment,setEnrollment] = useState(null);
 const [busy,setBusy] = useState(false);
 const [err,setErr] = useState("");
 const [answers,setAnswers] = useState({});
 const [result,setResult] = useState(null);

 useEffect(()=>{
   if(!session || !course) return;
   (async()=>{
     try{
       await enrollInCourse(course.id, session.user.id);
       setEnrollment(await getMyCourseEnrollment(course.id, session.user.id));
     }catch(e){ setErr(e.message||String(e)) }
   })();
 },[session?.user?.id, course?.id]);

 if(loading) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>;
 if(!course) return <NotFound ar={ar}/>;
 const lessons = course.lessons||[]; const quiz = course.quiz||[];
 const completed = new Set(enrollment?.completed_lessons||[]);

 async function toggleLesson(i){
   const next = new Set(completed); next.has(i)?next.delete(i):next.add(i);
   const arr=[...next];
   setEnrollment(e=>({...(e||{}),completed_lessons:arr}));
   try{ await updateLessonProgress(course.id, session.user.id, arr) }catch(e){ setErr(e.message||String(e)) }
 }
 async function submitQuiz(){
   setBusy(true); setErr("");
   try{
     let correct=0;
     quiz.forEach((q,i)=>{ if(answers[i]===q.correct) correct++ });
     const score = quiz.length ? Math.round((correct/quiz.length)*100) : 0;
     const row = await completeCourse(course.id, score);
     setEnrollment(row); setResult({score, passed: row.passed});
   }catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }

 return <PageShell ar={ar} eyebrow={course.cat} title={ar?course.title_ar:course.title_en} intro={ar?course.desc_ar:course.desc_en}>
  <div className="detail-layout">
   <div className="detail-main">
    {!session ? <div className="success"><Lock size={18}/><b>{ar?"سجّل حساب لمتابعة الدروس":"Create an account to watch the lessons"}</b><Link className="btn primary full" style={{marginTop:10}} to="/signup">{ar?"إنشاء حساب":"Sign up"} <ArrowLeft size={18}/></Link></div>
    : <>
      <h2>{ar?"دروس الدورة":"Course lessons"}</h2>
      {!lessons.length && <p style={{color:"var(--muted)"}}>{ar?"لا توجد دروس مضافة بعد.":"No lessons added yet."}</p>}
      {lessons.map((l,i)=><div key={i} className="form-card" style={{marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10,gap:10}}>
          <h3 style={{margin:0}}><Video size={16} style={{verticalAlign:"middle",marginInlineEnd:6}}/>{ar?l.title_ar:l.title_en}</h3>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,whiteSpace:"nowrap"}}>
            <input type="checkbox" checked={completed.has(i)} onChange={()=>toggleLesson(i)}/>{ar?"تمت المشاهدة":"Watched"}
          </label>
        </div>
        <VideoPlayer url={l.video_url}/>
      </div>)}

      {!!quiz.length && <div className="form-card">
        <h2 style={{marginTop:0}}><ListChecks size={18} style={{verticalAlign:"middle",marginInlineEnd:6}}/>{ar?"اختبار الدورة":"Course quiz"}</h2>
        {enrollment?.passed ? <div className="success"><Award/><b>{ar?"اجتزت الاختبار!":"You passed!"}</b><span>{ar?`نتيجتك: ${enrollment.quiz_score}%`:`Your score: ${enrollment.quiz_score}%`}</span>
          {enrollment.certificate_code && <Link className="btn primary full" style={{marginTop:10}} to={`/certificate/${enrollment.certificate_code}`}><Award size={18}/>{ar?"عرض الشهادة":"View certificate"}</Link>}
        </div> : <>
          {quiz.map((q,i)=><div key={i} style={{marginBottom:16}}>
            <b>{i+1}. {ar?q.q_ar:q.q_en}</b>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:8}}>
              {(q.options||[]).map((opt,oi)=><label key={oi} style={{display:"flex",alignItems:"center",gap:8,fontSize:14}}>
                <input type="radio" name={`q${i}`} checked={answers[i]===oi} onChange={()=>setAnswers({...answers,[i]:oi})}/>{opt}
              </label>)}
            </div>
          </div>)}
          {result && !result.passed && <div className="form-error">{ar?`لم تجتز الاختبار (${result.score}%). حاول مرة أخرى.`:`You did not pass (${result.score}%). Try again.`}</div>}
          {err && <div className="form-error">{err}</div>}
          <button className="btn primary full" disabled={busy||Object.keys(answers).length<quiz.length} onClick={submitQuiz}>{busy?(ar?"جارٍ التصحيح...":"Grading..."):(ar?"إرسال الاختبار":"Submit quiz")}</button>
        </>}
      </div>}
    </>}
   </div>
   <aside className="detail-side">
    <div className="detail-facts">
      <span><ListChecks/>{lessons.length} {ar?"دروس فيديو":"video lessons"}</span>
      <span><Award/>{quiz.length} {ar?"أسئلة اختبار":"quiz questions"}</span>
      <span><Trophy/>{ar?`درجة النجاح: ${course.passing_score}%`:`Passing score: ${course.passing_score}%`}</span>
      {session && <span><CheckCircle2/>{completed.size}/{lessons.length} {ar?"مكتمل":"completed"}</span>}
    </div>
    {session && lessons.length>0 && <div className="seats" style={{marginTop:6}}>
      <div><span>{ar?"تقدمك في الدورة":"Your progress"}</span><b>{Math.round((completed.size/lessons.length)*100)}%</b></div>
      <div className="bar"><i style={{width:`${Math.round((completed.size/lessons.length)*100)}%`}}/></div>
    </div>}
   </aside>
  </div>
 </PageShell>
}

function CertificatePage({ar}){
 const {code}=useParams();
 const [cert,setCert]=useState(undefined);
 useEffect(()=>{ verifyCertificate(code).then(setCert).catch(()=>setCert(null)) },[code]);
 if(cert===undefined) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>;
 if(!cert) return <PageShell ar={ar} eyebrow="CERTIFICATE" title={ar?"شهادة غير موجودة":"Certificate not found"} intro={ar?"تأكد من صحة رمز الشهادة.":"Check the certificate code and try again."}/>;
 return <PageShell ar={ar} eyebrow="NODE CERTIFICATE" title={ar?"شهادة إتمام":"Certificate of Completion"} intro="">
  <div className="form-card" style={{maxWidth:700,margin:"0 auto",textAlign:"center",padding:"50px 30px",border:`2px solid ${BRAND.amber}`}}>
   <Logo/>
   <p style={{color:"var(--muted)",marginTop:20}}>{ar?"تشهد نـــود بأن":"NODE certifies that"}</p>
   <h1 style={{margin:"10px 0"}}>{cert.full_name}</h1>
   <p style={{color:"var(--muted)"}}>{ar?"قد أتم بنجاح دورة":"has successfully completed the course"}</p>
   <h2 style={{margin:"10px 0"}}>{ar?cert.course_title_ar:cert.course_title_en}</h2>
   <p>{ar?`بنتيجة ${cert.score}%`:`with a score of ${cert.score}%`}</p>
   <p style={{color:"var(--muted)",fontSize:13,marginTop:20}}>{new Date(cert.issued_at).toLocaleDateString(ar?"ar-SA":"en-US")} · {code}</p>
   <button className="btn primary" style={{marginTop:20}} onClick={()=>window.print()}><Printer size={16}/>{ar?"طباعة":"Print"}</button>
  </div>
 </PageShell>
}

function Projects({ar}){const {projects,loading}=useData(); if(loading) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>; return <PageShell ar={ar} eyebrow={ar?"من الفكرة إلى النموذج":"FROM IDEA TO PROTOTYPE"} title={ar?"مشاريع نـــود":"NODE Projects"} intro={ar?"مشاريع تحول المفاهيم إلى نماذج وتجارب قابلة للرؤية والاختبار.":"Projects that turn concepts into visible, testable experiments and prototypes."}><div className="project-grid">{projects.map(p=><Link className="project-card" to={`/projects/${p.id}`} key={p.id}><div className="project-art"><span>NODE / {p.id}</span><Logo/></div><div><span className="eyebrow">{p.concept}</span><h3>{ar?p.title_ar:p.title_en}</h3><p>{p.result}</p><div className="tag">{p.tech}</div></div></Link>)}</div></PageShell>}

function ProjectDetails({ar}){const {id}=useParams();const {projects}=useData();const p=projects.find(x=>x.id===id);if(!p)return <NotFound ar={ar}/>;return <PageShell ar={ar} eyebrow={ar?"مشروع نـــود":"NODE PROJECT"} title={ar?p.title_ar:p.title_en} intro={p.result}><div className="journey"><Journey n="01" title="Physics" text={p.concept}/><Journey n="02" title="Idea" text={ar?"نحدد سؤالًا أو مشكلة يمكن تحويلها إلى تجربة.":"Define a question or problem that can become an experiment."}/><Journey n="03" title="Technology" text={p.tech}/><Journey n="04" title="Prototype" text={ar?"نبني ونختبر نموذجًا أوليًا.":"Build and test a prototype."}/><Journey n="05" title="Impact" text={p.result}/></div></PageShell>}
function Journey({n,title,text}){return <div className="journey-item"><b>{n}</b><div><h3>{title}</h3><p>{text}</p></div></div>}

function Events({ar}){const {events,loading}=useData(); if(loading) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>; return <PageShell ar={ar} eyebrow={ar?"اللقاءات والفعاليات":"EVENTS"} title={ar?"فعاليات نـــود":"NODE Events"} intro={ar?"لقاءات وتجارب تجمع المهتمين بالعلم والتقنية.":"Meetups and experiences that bring science and technology enthusiasts together."}><div className="event-list">{events.map(e=><article className="event-row" key={e.id}><div className="date-block"><b>{new Date(e.event_date).getDate()}</b><span>{new Date(e.event_date).toLocaleString(ar?"ar-SA":"en-US",{month:"short"})}</span></div><div><span className="eyebrow">{e.place}</span><h3>{ar?e.title_ar:e.title_en}</h3><p>{e.description}</p></div><ArrowLeft className="row-arrow"/></article>)}</div></PageShell>}

function Knowledge({ar}){const {articles,loading}=useData(); const [q,setQ]=useState(""); const list=articles.filter(a=>(a.title_ar+" "+a.title_en+" "+a.excerpt).toLowerCase().includes(q.toLowerCase()));if(loading) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>; return <PageShell ar={ar} eyebrow={ar?"المعرفة":"KNOWLEDGE HUB"} title={ar?"افهم. جرّب. شارك.":"Understand. Experiment. Share."} intro={ar?"محتوى علمي وتقني مبسط يساعدك على الانتقال من الفضول إلى التجربة.":"Accessible science and technology content that moves you from curiosity to experimentation."}><div className="filters"><div className="search"><Search size={18}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder={ar?"ابحث في المعرفة...":"Search knowledge..."}/></div></div><div className="article-grid">{list.map(a=><article className="article-card" key={a.id}><div className="article-art"><BookOpen/></div><span className="eyebrow">{a.cat}</span><h3>{ar?a.title_ar:a.title_en}</h3><p>{a.excerpt}</p></article>)}</div></PageShell>}

function Community({ar}){
 const { session, myMembership, refresh } = useAuth();
 return <PageShell ar={ar} eyebrow={ar?"مجتمع نـــود":"NODE COMMUNITY"} title={ar?"انضم إلى الشبكة.":"Join the network."} intro={ar?"مجتمع للطلاب والمهتمين بالعلم والتقنية، للمشاركة في الورش والتجارب والمحتوى والمشاريع.":"A community for students and people interested in science and technology to take part in workshops, experiments, content and projects."}><div className="community-grid"><div className="community-points"><InfoBlock title={ar?"لمن؟":"Who is it for?"} text={ar?"للطلاب والمهتمين بالعلوم والتقنية وكل من يريد التعلم بالممارسة.":"Students and anyone interested in science, technology and hands-on learning."}/><InfoBlock title={ar?"ماذا ستستفيد؟":"What do you get?"} text={ar?"الوصول إلى الورش، التجارب، المحتوى، والفرص المستقبلية للمشاركة في مشاريع نـــود.":"Access to workshops, experiments, content and future opportunities to participate in NODE projects."}/></div>
 {!session
   ? <div className="form-card narrow"><div className="login-icon"><Lock/></div><h3>{ar?"سجّل حساب للانضمام":"Sign up to join"}</h3><p style={{color:"var(--muted)",fontSize:13}}>{ar?"التصفح مفتوح للجميع، لكن الانضمام للمجتمع يحتاج حساب مجاني.":"Browsing is open to everyone, but joining the community needs a free account."}</p><Link className="btn primary full" to="/signup">{ar?"إنشاء حساب":"Create account"} <ArrowLeft size={18}/></Link></div>
   : <JoinForm ar={ar} session={session} membership={myMembership} onDone={refresh}/>}
 </div></PageShell>}

function JoinForm({ar,onDone,done,session,membership}){
 const [f,setF]=useState({age:"",interest:""});
 const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
 async function submit(e){
   e.preventDefault();
   if(!f.interest){setErr(ar?"يرجى اختيار مجال الاهتمام.":"Please choose an interest.");return}
   setBusy(true); setErr("");
   try{ await joinCommunity({ userId: session.user.id, age:f.age, interest:f.interest }); await onDone() }
   catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }
 if(membership)return <div className="success large"><CheckCircle2/><h3>{ar?"أهلًا بك في مجتمع نـــود!":"Welcome to NODE Community!"}</h3><p>{ar?"أنت عضو مسجّل بالفعل.":"You're already a registered member."}</p></div>;
 return <form className="form-card" onSubmit={submit}><h3>{ar?"طلب الانضمام":"Join request"}</h3><label>{ar?"العمر / الفئة":"Age / group"}<input value={f.age} onChange={e=>setF({...f,age:e.target.value})}/></label><label>{ar?"مجال الاهتمام *":"STEM interest *"}<select value={f.interest} onChange={e=>setF({...f,interest:e.target.value})}><option value="">{ar?"اختر":"Select"}</option>{["فيزياء","برمجة","ذكاء اصطناعي","إلكترونيات","STEM","أخرى"].map(x=><option key={x}>{x}</option>)}</select></label>{err&&<div className="form-error">{err}</div>}<button className="btn primary full" disabled={busy}>{busy?(ar?"جارٍ الإرسال...":"Submitting..."):(ar?"انضم إلى نـــود":"Join NODE")} <ArrowLeft size={18}/></button><small>{ar?"بالإرسال أنت توافق على شروط المجتمع.":"By submitting, you agree to the community terms."}</small></form>}

function Team({ar}){const {team,loading}=useData(); if(loading) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>; return <PageShell ar={ar} eyebrow={ar?"من يقف خلف نـــود":"THE TEAM"} title={ar?"فريق يصنع مساحة للتجربة.":"A team building a space for experimentation."} intro={ar?"أدوار مختلفة تعمل حول هدف واحد: ربط العلم بالتقنية والتطبيق.":"Different roles working around one goal: connecting science with technology and application."}><div className="team-grid">{team.map(t=><article className="team-card" key={t.id}><div className="avatar"><UserRound/></div><span className="eyebrow">{ar?t.role_ar:t.role_en}</span><h3>{t.name}</h3><p>{t.bio}</p></article>)}</div></PageShell>}

function Achievements({ar}){return <PageShell ar={ar} eyebrow={ar?"أثر نـــود":"NODE IMPACT"} title={ar?"إنجازات تُقاس بالأثر.":"Impact worth measuring."} intro={ar?"قسم قابل للتوسع لتوثيق الجوائز والمشاركات والشهادات والإحصائيات.":"A scalable section for awards, participation, certificates and impact statistics."}><div className="achievement-stats"><div><b>01</b><span>{ar?"مجتمع معرفي":"Knowledge community"}</span></div><div><b>02</b><span>{ar?"معامل تطبيقية":"Hands-on labs"}</span></div><div><b>05+</b><span>{ar?"أهداف أثر":"Impact goals"}</span></div></div><div className="timeline"><div><b>2026</b><p>{ar?"إطلاق هوية وموقع نـــود وبناء مسارات المعامل والورش.":"NODE identity and platform launch, with lab and workshop paths."}</p></div><div><b>Future</b><p>{ar?"إضافة إنجازات المبادرة ومؤشرات الأثر الفعلية من لوحة التحكم.":"Add real achievements and impact metrics from the admin dashboard."}</p></div></div></PageShell>}

function Labs({ar}){
 const {labs,labExperiments,loading}=useData();
 if(loading) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>;
 const published = (labExperiments||[]).filter(e=>e.is_published!==false);
 return <PageShell ar={ar} eyebrow={ar?"المعامل":"LABS"} title={ar?"تجربتان، شبكة واحدة.":"Two labs, one network."} intro={ar?"في كل معمل نأخذ سؤالًا علميًا ونبني حوله تجربة قابلة للتعلم والتطوير.":"In each lab, we take a scientific question and build a learnable, improvable experiment around it."}><div className="lab-detail-grid">{labs.map(l=>{const Icon=l.id==="tech"?Cpu:Atom;return <div className="lab-detail" key={l.id}><div className="lab-icon"><Icon/></div><span className="eyebrow">LAB / {l.id.toUpperCase()}</span><h2>{ar?l.title_ar:l.title_en}</h2><p>{ar?l.text_ar:l.text_en}</p><div className="lab-list">{(l.id==="tech"?["Arduino & microcontrollers","Sensors & IoT","Programming & automation","AI & data experiments"]:["Motion & measurement","Forces & gravity","Waves & optics","Experimental modeling"]).map(x=><span key={x}><CheckCircle2/> {x}</span>)}</div>
  {l.id==="tech" && <div className="experiment-grid">{published.length ? published.map(e=><Link key={e.id} to={`/labs/experiment/${e.id}`} className="experiment-card"><span className="tag">{e.board||(ar?"دائرة":"Circuit")}</span><h4>{ar?e.title_ar:e.title_en}</h4><p>{ar?e.desc_ar:e.desc_en}</p><span className="text-link">{ar?"جرّب المحاكاة":"Try the simulation"} {ar?<ArrowLeft size={14}/>:<ArrowRight size={14}/>}</span></Link>) : <p style={{color:"var(--muted)",fontSize:12}}>{ar?"لا توجد تجارب تفاعلية بعد — تُضاف من لوحة تحكم الأدمن.":"No interactive experiments yet — added from the admin dashboard."}</p>}</div>}
 </div>})}</div></PageShell>}

function LabExperimentView({ar}){
 const {id}=useParams();
 const {labExperiments,loading}=useData();
 if(loading) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>;
 const exp=(labExperiments||[]).find(e=>e.id===id);
 if(!exp) return <NotFound ar={ar}/>;
 return <PageShell ar={ar} eyebrow={exp.board||(ar?"المعمل التقني":"TECH LAB")} title={ar?exp.title_ar:exp.title_en} intro={ar?exp.desc_ar:exp.desc_en}>
  <div className="wokwi-shell">
   {exp.wokwi_url
     ? <iframe className="wokwi-frame" src={exp.wokwi_url} title={ar?exp.title_ar:exp.title_en} allow="clipboard-write" loading="lazy"/>
     : <div className="empty"><Wrench/><p>{ar?"المحاكاة غير جاهزة بعد لهذه التجربة.":"This experiment's simulation isn't ready yet."}</p></div>}
  </div>
  <p style={{maxWidth:1200,margin:"18px auto 0",padding:"0 25px",color:"var(--muted)",fontSize:11}}>{ar?"المحاكاة تعمل عبر منصة Wokwi المجانية — اضغط زر التشغيل (▶) داخل الإطار لبدء المحاكاة.":"The simulation runs on the free Wokwi platform — press the play (▶) button inside the frame to start it."}</p>
 </PageShell>
}

function Contact({ar}){
 const [sent,setSent]=useState(false);
 const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
 const [name,setName]=useState(""); const [email,setEmail]=useState(""); const [subject,setSubject]=useState(""); const [message,setMessage]=useState("");
 const { settings } = useData(); const contact = settings.contact||{};
 const contactEmail = contact.email || "hello@node.sa";
 const contactIntro = contact[ar?"intro_ar":"intro_en"];
 async function submit(e){
   e.preventDefault(); setBusy(true); setErr("");
   try{ await submitContactMessage({name,email,subject,message}); setSent(true) }
   catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }
 return <PageShell ar={ar} eyebrow={ar?"تواصل":"CONTACT"} title={ar?"لنبنِ العقدة التالية.":"Let's build the next node."} intro={contactIntro || (ar?"للاستفسارات والشراكات والورش والتعاون، أرسل لنا رسالة.":"For questions, partnerships, workshops and collaboration, send us a message.")}><div className="contact-grid"><div className="contact-aside"><InfoBlock title={ar?"البريد":"Email"} text={contactEmail}/><InfoBlock title={ar?"المجتمع":"Community"} text={ar?"انضم إلى مجتمع نـــود وشارك في الفعاليات والورش.":"Join NODE Community and take part in events and workshops."}/></div>{sent?<div className="success large"><CheckCircle2/><h3>{ar?"وصلت رسالتك!":"Message received!"}</h3><p>{ar?"شكرًا لتواصلك مع نـــود.":"Thank you for contacting NODE."}</p></div>:<form className="form-card" onSubmit={submit}><label>{ar?"الاسم":"Name"}<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>{ar?"البريد الإلكتروني":"Email"}<input value={email} onChange={e=>setEmail(e.target.value)} required type="email"/></label><label>{ar?"الموضوع":"Subject"}<input value={subject} onChange={e=>setSubject(e.target.value)} required/></label><label>{ar?"الرسالة":"Message"}<textarea value={message} onChange={e=>setMessage(e.target.value)} required rows="6"/></label>{err&&<div className="form-error">{err}</div>}<button className="btn primary full" disabled={busy}>{busy?(ar?"جارٍ الإرسال...":"Sending..."):(ar?"إرسال":"Send")} <ArrowLeft size={18}/></button></form>}</div></PageShell>}

/* ===================================================================== */
/* AUTH PAGES — real accounts (Supabase Auth), not localStorage flags.    */
/* ===================================================================== */

function Login({ar}){
 const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);
 const nav=useNavigate(); const { signIn } = useAuth();
 async function login(e){
   e.preventDefault(); setBusy(true); setErr("");
   try{ await signIn({email,password:pass}); nav("/") }
   catch(e){ setErr(ar?"بيانات الدخول غير صحيحة.":"Invalid email or password.") }
   setBusy(false);
 }
 return <PageShell ar={ar} eyebrow="ACCOUNT" title={ar?"تسجيل الدخول":"Log in"} intro={ar?"ادخل لحسابك في نـــود.":"Log in to your NODE account."}><form className="form-card narrow" onSubmit={login}><div className="login-icon"><ShieldCheck/></div><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label><label>{ar?"كلمة المرور":"Password"}<input value={pass} onChange={e=>setPass(e.target.value)} type="password" required/></label><small><Link to="/forgot-password">{ar?"نسيت كلمة المرور؟":"Forgot password?"}</Link></small>{err&&<div className="form-error">{err}</div>}<button className="btn primary full" disabled={busy}><LogIn size={18}/>{busy?(ar?"جارٍ الدخول...":"Logging in..."):(ar?"دخول":"Login")}</button><small>{ar?"ما عندك حساب؟":"No account yet?"} <Link to="/signup">{ar?"سجّل الآن":"Sign up"}</Link></small></form></PageShell>}

function Signup({ar}){
 const [name,setName]=useState("");const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);
 const { signUp } = useAuth(); const nav=useNavigate();
 async function submit(e){
   e.preventDefault(); setBusy(true); setErr("");
   try{
     const { session } = await signUp({email,password:pass,fullName:name});
     if(session) nav("/"); else setDone(true);
   }catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }
 if(done)return <PageShell ar={ar} eyebrow="ACCOUNT" title={ar?"تحقق من بريدك":"Check your email"} intro=""><div className="success large narrow"><CheckCircle2/><h3>{ar?"تم إنشاء الحساب":"Account created"}</h3><p>{ar?"أرسلنا رابط تفعيل إلى بريدك — افتحه لتفعيل حسابك ثم سجّل الدخول.":"We sent a confirmation link to your email — open it to activate your account, then log in."}</p></div></PageShell>;
 return <PageShell ar={ar} eyebrow="ACCOUNT" title={ar?"إنشاء حساب":"Create an account"} intro={ar?"حساب مجاني للتسجيل بالورش والانضمام للمجتمع.":"A free account to register for workshops and join the community."}><form className="form-card narrow" onSubmit={submit}><div className="login-icon"><UserPlus/></div><label>{ar?"الاسم":"Name"}<input value={name} onChange={e=>setName(e.target.value)} required/></label><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label><label>{ar?"كلمة المرور":"Password"}<input value={pass} onChange={e=>setPass(e.target.value)} type="password" minLength={6} required/></label>{err&&<div className="form-error">{err}</div>}<button className="btn primary full" disabled={busy}><UserPlus size={18}/>{busy?(ar?"جارٍ الإنشاء...":"Creating..."):(ar?"إنشاء حساب":"Create account")}</button><small>{ar?"عندك حساب؟":"Already have an account?"} <Link to="/login">{ar?"سجّل الدخول":"Log in"}</Link></small></form></PageShell>}

function ForgotPassword({ar}){
 const [email,setEmail]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const [sent,setSent]=useState(false);
 async function submit(e){
   e.preventDefault(); setBusy(true); setErr("");
   try{
     await requestPasswordReset(email, window.location.origin + "/reset-password");
     setSent(true);
   }catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }
 if(sent) return <PageShell ar={ar} eyebrow="ACCOUNT" title={ar?"تحقق من بريدك":"Check your email"} intro=""><div className="success large narrow"><CheckCircle2/><h3>{ar?"أرسلنا رابط الاستعادة":"Reset link sent"}</h3><p>{ar?"افتح بريدك واضغط على الرابط لتعيين كلمة مرور جديدة.":"Open your email and click the link to set a new password."}</p></div></PageShell>;
 return <PageShell ar={ar} eyebrow="ACCOUNT" title={ar?"نسيت كلمة المرور؟":"Forgot password?"} intro={ar?"أدخل بريدك وراح نرسل لك رابط لتعيين كلمة مرور جديدة.":"Enter your email and we'll send you a link to reset your password."}><form className="form-card narrow" onSubmit={submit}><div className="login-icon"><Lock/></div><label>Email<input value={email} onChange={e=>setEmail(e.target.value)} type="email" required/></label>{err&&<div className="form-error">{err}</div>}<button className="btn primary full" disabled={busy}><Mail size={18}/>{busy?(ar?"جارٍ الإرسال...":"Sending..."):(ar?"إرسال رابط الاستعادة":"Send reset link")}</button><small><Link to="/login">{ar?"رجوع لتسجيل الدخول":"Back to login"}</Link></small></form></PageShell>}

function ResetPassword({ar}){
 const [pass,setPass]=useState("");const [confirm,setConfirm]=useState("");const [err,setErr]=useState("");const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);
 const [ready,setReady]=useState(null);
 const nav=useNavigate();
 useEffect(()=>{
   // Only trust a session that Supabase itself flags as PASSWORD_RECOVERY (from the
   // reset-link token in the URL) — never a session that was already active in this
   // browser (e.g. someone else's account), which would silently change the wrong
   // account's password.
   let settled=false;
   const { data: sub } = supabase.auth.onAuthStateChange((event, newSession)=>{
     if(event==="PASSWORD_RECOVERY" && newSession){ settled=true; setReady(true) }
   });
   const t=setTimeout(()=>{ if(!settled) setReady(false) }, 6000);
   return ()=>{ sub.subscription.unsubscribe(); clearTimeout(t) };
 },[]);
 async function submit(e){
   e.preventDefault(); setErr("");
   if(pass.length<6){ setErr(ar?"كلمة المرور يجب أن تكون 6 أحرف على الأقل.":"Password must be at least 6 characters."); return }
   if(pass!==confirm){ setErr(ar?"كلمتا المرور غير متطابقتين.":"Passwords do not match."); return }
   setBusy(true);
   try{
     await updatePassword(pass);
     setDone(true);
     setTimeout(()=>nav("/login"), 2000);
   }catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }
 if(done) return <PageShell ar={ar} eyebrow="ACCOUNT" title={ar?"تم":"Done"} intro=""><div className="success large narrow"><CheckCircle2/><h3>{ar?"تم تغيير كلمة المرور":"Password updated"}</h3><p>{ar?"جارٍ تحويلك لصفحة الدخول...":"Redirecting you to login..."}</p></div></PageShell>;
 if(ready===null) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>;
 if(ready===false) return <PageShell ar={ar} eyebrow="ACCOUNT" title={ar?"رابط غير صالح":"Invalid link"} intro=""><div className="form-error" style={{maxWidth:600,margin:"0 auto"}}>{ar?"الرابط منتهي أو غير صالح. اطلب رابط استعادة جديد.":"This link is invalid or expired. Please request a new reset link."}</div><div style={{textAlign:"center",marginTop:16}}><Link to="/forgot-password">{ar?"طلب رابط جديد":"Request a new link"}</Link></div></PageShell>;
 return <PageShell ar={ar} eyebrow="ACCOUNT" title={ar?"تعيين كلمة مرور جديدة":"Set a new password"} intro=""><form className="form-card narrow" onSubmit={submit}><div className="login-icon"><Lock/></div><label>{ar?"كلمة المرور الجديدة":"New password"}<input value={pass} onChange={e=>setPass(e.target.value)} type="password" minLength={6} required/></label><label>{ar?"تأكيد كلمة المرور":"Confirm password"}<input value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" minLength={6} required/></label>{err&&<div className="form-error">{err}</div>}<button className="btn primary full" disabled={busy}><Lock size={18}/>{busy?(ar?"جارٍ الحفظ...":"Saving..."):(ar?"حفظ كلمة المرور":"Save password")}</button></form></PageShell>}

/* ===================================================================== */
/* ADMIN — protected by a REAL session + role check (RLS-backed), with   */
/* real user list, real content CRUD, and the no-code "sections" builder.*/
/* ===================================================================== */

function Admin({ar}){
 const nav=useNavigate();
 const { session, loading, isAdmin, signOut } = useAuth();
 const [tab,setTab]=useState("overview");
 useEffect(()=>{ if(!loading && !session) nav("/login") },[loading,session]);
 if(loading) return <PageShell ar={ar} eyebrow="" title="" intro=""><Loading ar={ar}/></PageShell>;
 if(!session) return null;
 if(!isAdmin) return <PageShell ar={ar} eyebrow="ADMIN" title={ar?"غير مصرح":"Not authorized"} intro=""><div className="form-error" style={{maxWidth:600,margin:"0 auto"}}>{ar?"حسابك ليس لديه صلاحية الوصول للوحة التحكم. إذا كان يفترض أنك أدمن، اطلب من أدمن آخر ترقية حسابك.":"Your account does not have dashboard access. If you should be an admin, ask an existing admin to promote your account."}</div></PageShell>;

 const tabs=[["overview",ar?"نظرة عامة":"Overview"],["users",ar?"المستخدمون":"Users"],["registrations",ar?"التسجيلات":"Registrations"],["community",ar?"المجتمع":"Community"],["courses",ar?"الدورات":"Courses"],["content",ar?"المحتوى":"Content"],["sections",ar?"الأقسام":"Sections"],["messages",ar?"الرسائل":"Messages"],["settings",ar?"إعدادات الموقع":"Site settings"]];
 return <PageShell ar={ar} eyebrow="ADMIN DASHBOARD" title={ar?"لوحة تحكم نـــود":"NODE Admin Dashboard"} intro={ar?"إدارة المستخدمين والمحتوى — متصلة بقاعدة بيانات حقيقية.":"Manage users and content — backed by a real database."}>
   <div className="admin-top">{tabs.map(([k,l])=><button key={k} className={`tab ${tab===k?"selected":""}`} onClick={()=>setTab(k)}>{l}</button>)}<button className="btn ghost" onClick={async()=>{await signOut();nav("/")}}><LogOut size={16}/>{ar?"خروج":"Logout"}</button></div>
   {tab==="overview"&&<AdminOverview ar={ar}/>}
   {tab==="users"&&<AdminUsers ar={ar}/>}
   {tab==="registrations"&&<AdminRegistrations ar={ar}/>}
   {tab==="community"&&<AdminCommunityMembers ar={ar}/>}
   {tab==="courses"&&<AdminCourses ar={ar}/>}
   {tab==="content"&&<AdminContent ar={ar}/>}
   {tab==="sections"&&<AdminSections ar={ar}/>}
   {tab==="messages"&&<AdminContactMessages ar={ar}/>}
   {tab==="settings"&&<AdminSiteSettings ar={ar}/>}
 </PageShell>
}

function AdminOverview({ar}){
 const { workshops, projects, events, courses, booked } = useData();
 const totalRegs = Object.values(booked).reduce((a,b)=>a+b,0);
 const [engagement,setEngagement] = useState(null);
 const [busy,setBusy] = useState(false);
 const [err,setErr] = useState("");

 useEffect(()=>{ (async()=>{
   try{
     const [users, regs, community, enrollments] = await Promise.all([
       adminListUsers(), adminFetchRegistrationsJoined(), adminFetchCommunityJoined(), adminFetchCourseEnrollmentsJoined(),
     ]);
     const active = new Set([...regs.map(r=>r.user_id), ...community.map(c=>c.user_id), ...enrollments.map(e=>e.user_id)]);
     setEngagement({
       totalUsers: users.length,
       activeUsers: active.size,
       rate: users.length ? Math.round((active.size/users.length)*100) : 0,
       certified: enrollments.filter(e=>e.passed).length,
     });
   }catch(e){ setErr(e.message||String(e)) }
 })() },[]);

 async function doExport(){
   setBusy(true); setErr("");
   try{ await exportAllDataToExcel() }catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }

 const stats=[[ar?"ورش":"Workshops",workshops.length],[ar?"دورات":"Courses",courses.length],[ar?"مشاريع":"Projects",projects.length],[ar?"فعاليات":"Events",events.length],[ar?"إجمالي التسجيلات":"Total registrations",totalRegs]];
 return <><div className="admin-stats">{stats.map(([x,n])=><div key={x}><span>{x}</span><b>{n}</b></div>)}</div>
  <div className="admin-grid">
   <AdminPanel title={ar?"نسبة التفاعل":"Engagement rate"} icon={<TrendingUp/>}>
     {err && <div className="form-error">{err}</div>}
     {!engagement ? <Loading ar={ar}/> : <>
       <p style={{fontSize:32,fontWeight:800,margin:"4px 0"}}>{engagement.rate}%</p>
       <p style={{color:"var(--muted)",fontSize:13}}>{ar?`${engagement.activeUsers} من ${engagement.totalUsers} حساب تفاعلوا فعليًا (تسجيل ورشة، انضمام مجتمع، أو دورة).`:`${engagement.activeUsers} of ${engagement.totalUsers} accounts engaged (workshop, community, or a course).`}</p>
       <p style={{color:"var(--muted)",fontSize:13}}>{ar?`${engagement.certified} شهادة صادرة.`:`${engagement.certified} certificates issued.`}</p>
     </>}
   </AdminPanel>
   <AdminPanel title={ar?"تصدير البيانات":"Export data"} icon={<Download/>}>
     <p>{ar?"صدّر كل بيانات المنصة (المستخدمون، التسجيلات، المجتمع، الدورات، الشهادات، المحتوى) كملف Excel واحد.":"Export all platform data (users, registrations, community, courses, certificates, content) as one Excel file."}</p>
     <button className="btn primary" onClick={doExport} disabled={busy}><Download size={16}/>{busy?(ar?"جارٍ التصدير...":"Exporting..."):(ar?"تصدير Excel":"Export Excel")}</button>
   </AdminPanel>
   <AdminPanel title={ar?"عن هذه اللوحة":"About this dashboard"} icon={<ShieldCheck/>}><p>{ar?"كل بيانات هذه اللوحة (المستخدمون، التسجيلات، المحتوى) محفوظة فعليًا بقاعدة بيانات، ومحمية بصلاحيات على مستوى السيرفر — مو بالمتصفح.":"Everything here (users, registrations, content) lives in a real database and is protected by server-side permissions, not the browser."}</p></AdminPanel>
  <AdminPanel title={ar?"المعامل":"Labs"} icon={<FlaskConical/>}><p>{ar?"المعمل التقني والمعمل الفيزيائي جاهزان للتوسع بإضافة تجارب جديدة من تبويب المحتوى.":"The technology and physics labs are ready to grow — edit them from the Content tab."}</p></AdminPanel></div></>
}

function AdminUsers({ar}){
 const { profile: myProfile } = useAuth();
 const [users,setUsers]=useState(null); const [err,setErr]=useState("");
 async function load(){ try{ setUsers(await adminListUsers()) }catch(e){ setErr(e.message||String(e)) } }
 useEffect(()=>{ load() },[]);
 async function toggleRole(u){
   const next = u.role==="admin" ? "member" : "admin";
   try{ await adminSetUserRole(u.id,next); await load() }catch(e){ setErr(e.message||String(e)) }
 }
 if(err) return <div className="form-error" style={{maxWidth:900,margin:"0 auto"}}>{err}</div>;
 if(!users) return <Loading ar={ar}/>;
 return <div className="admin-panel" style={{maxWidth:1250,margin:"0 auto"}}>
  <div className="panel-title"><Users/><h3>{ar?`كل الحسابات (${users.length})`:`All accounts (${users.length})`}</h3></div>
  <div className="mini-list">{users.map(u=>
    <div key={u.id}>
      <span><b>{u.full_name||"—"}</b> · {u.email} · <span className="tag">{u.role}</span></span>
      <button onClick={()=>toggleRole(u)} disabled={u.id===myProfile?.id} title={u.id===myProfile?.id?(ar?"لا يمكنك تغيير دورك بنفسك":"You can't change your own role"):""} className="btn ghost" style={{padding:"6px 10px"}}>
        {u.role==="admin" ? (ar?"إلغاء صلاحية الأدمن":"Revoke admin") : (ar?"ترقية لأدمن":"Make admin")}
      </button>
    </div>)}
  </div>
 </div>
}

function AdminRegistrations({ar}){
 const { workshops } = useData();
 const [rows,setRows]=useState(null); const [err,setErr]=useState("");
 useEffect(()=>{ (async()=>{
   try{
     const regs = await adminFetchRegistrationsJoined();
     setRows(regs.map(r=>({ ...r, workshop: workshops.find(w=>w.id===r.workshop_id) })));
   }catch(e){ setErr(e.message||String(e)) }
 })() },[workshops]);
 if(err) return <div className="form-error" style={{maxWidth:900,margin:"0 auto"}}>{err}</div>;
 if(!rows) return <Loading ar={ar}/>;
 return <div className="admin-panel" style={{maxWidth:1250,margin:"0 auto"}}>
  <div className="panel-title"><CalendarDays/><h3>{ar?`كل التسجيلات (${rows.length})`:`All registrations (${rows.length})`}</h3></div>
  <div className="mini-list">{rows.length? rows.map((r,i)=>
    <div key={i}><span>{r.user?.full_name||r.user?.email||r.user_id} → <b>{r.workshop ? (ar?r.workshop.title_ar:r.workshop.title_en) : r.workshop_id}</b></span><small>{new Date(r.created_at).toLocaleDateString(ar?"ar-SA":"en-US")}</small></div>
  ) : <div>{ar?"لا توجد تسجيلات بعد.":"No registrations yet."}</div>}</div>
 </div>
}

function AdminCommunityMembers({ar}){
 const [rows,setRows]=useState(null); const [err,setErr]=useState("");
 useEffect(()=>{ (async()=>{
   try{ setRows(await adminFetchCommunityJoined()) }catch(e){ setErr(e.message||String(e)) }
 })() },[]);
 if(err) return <div className="form-error" style={{maxWidth:900,margin:"0 auto"}}>{err}</div>;
 if(!rows) return <Loading ar={ar}/>;
 return <div className="admin-panel" style={{maxWidth:1250,margin:"0 auto"}}>
  <div className="panel-title"><Users/><h3>{ar?`أعضاء المجتمع (${rows.length})`:`Community members (${rows.length})`}</h3></div>
  <div className="mini-list">{rows.length? rows.map((r,i)=>
    <div key={i}><span><b>{r.user?.full_name||r.user?.email||r.user_id}</b> · {r.interest||"—"}{r.age?` · ${r.age}`:""}</span><small>{new Date(r.created_at).toLocaleDateString(ar?"ar-SA":"en-US")}</small></div>
  ) : <div>{ar?"لا يوجد أعضاء بعد.":"No members yet."}</div>}</div>
 </div>
}

function AdminContactMessages({ar}){
 const [rows,setRows]=useState(null); const [err,setErr]=useState("");
 const [open,setOpen]=useState(null);

 async function reload(){ try{ setRows(await adminFetchContactMessages()) }catch(e){ setErr(e.message||String(e)) } }
 useEffect(()=>{ reload() },[]);

 async function openMsg(r){
   setOpen(open===r.id ? null : r.id);
   if(r.status==="new"){
     try{ await adminMarkContactMessageRead(r.id); setRows(rs=>rs.map(x=>x.id===r.id?{...x,status:"read"}:x)) }catch(e){}
   }
 }
 async function remove(id){
   if(!window.confirm(ar?"حذف هذه الرسالة؟":"Delete this message?")) return;
   try{ await adminDeleteContactMessage(id); setRows(rs=>rs.filter(r=>r.id!==id)) }catch(e){ setErr(e.message||String(e)) }
 }

 if(err) return <div className="form-error" style={{maxWidth:900,margin:"0 auto"}}>{err}</div>;
 if(!rows) return <Loading ar={ar}/>;
 const unread = rows.filter(r=>r.status==="new").length;
 return <div className="admin-panel" style={{maxWidth:1250,margin:"0 auto"}}>
  <div className="panel-title"><Mail/><h3>{ar?`رسائل التواصل (${rows.length}${unread?` — ${unread} جديدة`:""})`:`Contact messages (${rows.length}${unread?`, ${unread} new`:""})`}</h3></div>
  <div className="mini-list">{rows.length? rows.map(r=>
    <div key={r.id} style={{flexDirection:"column",alignItems:"stretch",gap:6}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,cursor:"pointer"}} onClick={()=>openMsg(r)}>
        <span>{r.status==="new" && <b style={{color:"var(--amber, #C17F3A)"}}>{ar?"● جديد":"● New"}</b>} <b>{r.name}</b> — {r.subject}</span>
        <span style={{display:"flex",gap:10,alignItems:"center"}}>
          <small>{new Date(r.created_at).toLocaleDateString(ar?"ar-SA":"en-US")}</small>
          <button onClick={(e)=>{e.stopPropagation();remove(r.id)}} aria-label="delete"><Trash2 size={15}/></button>
        </span>
      </div>
      {open===r.id && <div style={{padding:"8px 0",lineHeight:1.7}}>
        <div><b>{ar?"من":"From"}:</b> {r.name} — <a href={`mailto:${r.email}`}>{r.email}</a></div>
        <div style={{marginTop:6,whiteSpace:"pre-wrap"}}>{r.message}</div>
      </div>}
    </div>
  ) : <div>{ar?"لا توجد رسائل بعد.":"No messages yet."}</div>}</div>
 </div>
}

/* --- courses: video lessons + quiz builder (own editor — lessons/quiz are
   nested lists, not flat fields, so this doesn't reuse ContentCRUD) --- */

function emptyCourseRow(){
 return { id:"", title_ar:"", title_en:"", cat:"", level:"", desc_ar:"", desc_en:"", lessons:[], quiz:[], passing_score:60, is_published:true };
}

function AdminCourses({ar}){
 const { items, err, reload } = useAdminRows("courses");
 const { refetch: refetchPublic } = useData();
 const [editing,setEditing]=useState(null);
 const [saveErr,setSaveErr]=useState(""); const [busy,setBusy]=useState(false);
 const [certs,setCerts]=useState(null);

 useEffect(()=>{ adminFetchCourseEnrollmentsJoined().then(rows=>setCerts(rows.filter(r=>r.passed))).catch(()=>{}) },[items]);

 async function refetchBoth(){ await Promise.all([reload(), refetchPublic()]) }

 function startNew(){ setEditing({ row: emptyCourseRow(), isNew:true }) }
 function startEdit(item){ setEditing({ row: { ...item, lessons:[...(item.lessons||[])], quiz:(item.quiz||[]).map(q=>({...q,options:[...(q.options||[])]})) }, isNew:false }) }
 function updateRow(patch){ setEditing(e=>({...e,row:{...e.row,...patch}})) }
 function updateLesson(i,patch){ const lessons=[...editing.row.lessons]; lessons[i]={...lessons[i],...patch}; updateRow({lessons}) }
 function addLesson(){ updateRow({lessons:[...editing.row.lessons,{title_ar:"",title_en:"",video_url:""}]}) }
 function removeLesson(i){ updateRow({lessons: editing.row.lessons.filter((_,x)=>x!==i)}) }
 function updateQuestion(i,patch){ const quiz=[...editing.row.quiz]; quiz[i]={...quiz[i],...patch}; updateRow({quiz}) }
 function addQuestion(){ updateRow({quiz:[...editing.row.quiz,{q_ar:"",q_en:"",options:["",""],correct:0}]}) }
 function removeQuestion(i){ updateRow({quiz: editing.row.quiz.filter((_,x)=>x!==i)}) }
 function updateOption(qi,oi,val){ const quiz=[...editing.row.quiz]; const options=[...quiz[qi].options]; options[oi]=val; quiz[qi]={...quiz[qi],options}; updateRow({quiz}) }
 function addOption(qi){ const quiz=[...editing.row.quiz]; quiz[qi]={...quiz[qi],options:[...quiz[qi].options,""]}; updateRow({quiz}) }
 function removeOption(qi,oi){ const quiz=[...editing.row.quiz]; const options=quiz[qi].options.filter((_,x)=>x!==oi); const correct = quiz[qi].correct>=options.length?0:quiz[qi].correct; quiz[qi]={...quiz[qi],options,correct}; updateRow({quiz}) }

 async function save(){
   setBusy(true); setSaveErr("");
   try{
     const { row, isNew } = editing;
     if(isNew){
       if(!row.id){ setSaveErr(ar?"المعرف (id) مطلوب":"id is required"); setBusy(false); return }
       await adminCreateRow("courses", row);
     } else {
       const { id, ...patch } = row;
       await adminUpdateRow("courses", id, patch);
     }
     setEditing(null); await refetchBoth();
   }catch(e){ setSaveErr(e.message||String(e)) }
   setBusy(false);
 }
 async function remove(id){
   setBusy(true); setSaveErr("");
   try{ await adminDeleteRow("courses", id); await refetchBoth() }
   catch(e){ setSaveErr(e.message||String(e)) }
   setBusy(false);
 }

 if(err) return <div className="form-error" style={{maxWidth:900,margin:"0 auto"}}>{err}</div>;

 return <div style={{maxWidth:1250,margin:"0 auto",padding:"0 25px"}}>
  <p style={{color:"var(--muted)",fontSize:13,marginBottom:20}}>{ar?"أضف دورة بفيديوهات ودروس واختبار — تصدر شهادة تلقائيًا لكل من يجتاز الاختبار. بدون كتابة أي كود.":"Add a course with video lessons and a quiz — a certificate is issued automatically to anyone who passes. No code required."}</p>

  <div className="manager-row"><div><span className="eyebrow">COURSES</span><h2>{ar?"إدارة الدورات":"Manage courses"}</h2></div>
   <button className="btn primary" onClick={startNew}><Plus size={17}/>{ar?"إضافة دورة":"Add course"}</button></div>

  {saveErr && <div className="form-error" style={{marginBottom:15}}>{saveErr}</div>}

  {editing && <div className="form-card" style={{marginBottom:25}}>
    <label>id (slug){editing.isNew?null:<small> — {ar?"غير قابل للتعديل":"not editable"}</small>}
      <input value={editing.row.id||""} disabled={!editing.isNew} onChange={e=>updateRow({id:e.target.value})}/>
    </label>
    <label>{ar?"العنوان (عربي)":"Title (AR)"}<input value={editing.row.title_ar} onChange={e=>updateRow({title_ar:e.target.value})}/></label>
    <label>{ar?"العنوان (EN)":"Title (EN)"}<input value={editing.row.title_en} onChange={e=>updateRow({title_en:e.target.value})}/></label>
    <label>{ar?"التصنيف":"Category"}<input value={editing.row.cat} onChange={e=>updateRow({cat:e.target.value})}/></label>
    <label>{ar?"المستوى":"Level"}<input value={editing.row.level} onChange={e=>updateRow({level:e.target.value})}/></label>
    <label>{ar?"الوصف (عربي)":"Description (AR)"}<textarea rows={2} value={editing.row.desc_ar} onChange={e=>updateRow({desc_ar:e.target.value})}/></label>
    <label>{ar?"الوصف (EN)":"Description (EN)"}<textarea rows={2} value={editing.row.desc_en} onChange={e=>updateRow({desc_en:e.target.value})}/></label>
    <label>{ar?"درجة النجاح (%)":"Passing score (%)"}<input type="number" min={0} max={100} value={editing.row.passing_score} onChange={e=>updateRow({passing_score:Number(e.target.value)})}/></label>
    <label style={{display:"flex",flexDirection:"row",alignItems:"center",gap:8}}><input type="checkbox" checked={!!editing.row.is_published} onChange={e=>updateRow({is_published:e.target.checked})}/>{ar?"منشور":"Published"}</label>

    <h3 style={{marginTop:20}}>{ar?"الدروس (فيديو)":"Lessons (video)"}</h3>
    {editing.row.lessons.map((l,i)=><div key={i} style={{border:"1px solid #e3ddd2",borderRadius:10,padding:12,marginBottom:10}}>
      <label>{ar?"عنوان الدرس (عربي)":"Lesson title (AR)"}<input value={l.title_ar} onChange={e=>updateLesson(i,{title_ar:e.target.value})}/></label>
      <label>{ar?"عنوان الدرس (EN)":"Lesson title (EN)"}<input value={l.title_en} onChange={e=>updateLesson(i,{title_en:e.target.value})}/></label>
      <label>{ar?"رابط الفيديو (YouTube embed أو رابط mp4)":"Video URL (YouTube embed or mp4 link)"}<input value={l.video_url} onChange={e=>updateLesson(i,{video_url:e.target.value})} placeholder="https://www.youtube.com/embed/..."/></label>
      <button className="btn ghost" onClick={()=>removeLesson(i)}><Trash2 size={14}/>{ar?"حذف الدرس":"Remove lesson"}</button>
    </div>)}
    <button className="btn ghost" onClick={addLesson}><Plus size={14}/>{ar?"إضافة درس":"Add lesson"}</button>

    <h3 style={{marginTop:20}}>{ar?"أسئلة الاختبار":"Quiz questions"}</h3>
    {editing.row.quiz.map((q,qi)=><div key={qi} style={{border:"1px solid #e3ddd2",borderRadius:10,padding:12,marginBottom:10}}>
      <label>{ar?"السؤال (عربي)":"Question (AR)"}<input value={q.q_ar} onChange={e=>updateQuestion(qi,{q_ar:e.target.value})}/></label>
      <label>{ar?"السؤال (EN)":"Question (EN)"}<input value={q.q_en} onChange={e=>updateQuestion(qi,{q_en:e.target.value})}/></label>
      {q.options.map((opt,oi)=><div key={oi} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6}}>
        <input type="radio" name={`correct${qi}`} checked={q.correct===oi} onChange={()=>updateQuestion(qi,{correct:oi})} title={ar?"الإجابة الصحيحة":"Correct answer"}/>
        <input style={{flex:1}} value={opt} onChange={e=>updateOption(qi,oi,e.target.value)} placeholder={ar?`خيار ${oi+1}`:`Option ${oi+1}`}/>
        <button onClick={()=>removeOption(qi,oi)} aria-label="remove option"><Trash2 size={14}/></button>
      </div>)}
      <button className="btn ghost" onClick={()=>addOption(qi)}><Plus size={14}/>{ar?"إضافة خيار":"Add option"}</button>
      <div style={{marginTop:8}}><button className="btn ghost" onClick={()=>removeQuestion(qi)}><Trash2 size={14}/>{ar?"حذف السؤال":"Remove question"}</button></div>
    </div>)}
    <button className="btn ghost" onClick={addQuestion}><Plus size={14}/>{ar?"إضافة سؤال":"Add question"}</button>

    <div style={{display:"flex",gap:10,marginTop:20}}>
      <button className="btn primary" onClick={save} disabled={busy}>{busy?(ar?"جارٍ الحفظ...":"Saving..."):(ar?"حفظ":"Save")}</button>
      <button className="btn ghost" onClick={()=>setEditing(null)}>{ar?"إلغاء":"Cancel"}</button>
    </div>
  </div>}

  {!items ? <Loading ar={ar}/> : <div className="mini-list">{items.map(item=>
    <div key={item.id}>
      <span>{item.title_ar||item.id} {item.is_published===false && <small>({ar?"مسودة":"draft"})</small>} · {(item.lessons||[]).length} {ar?"دروس":"lessons"}</span>
      <span style={{display:"flex",gap:10}}>
        <button onClick={()=>startEdit(item)} aria-label="edit"><Edit3 size={15}/></button>
        <button onClick={()=>remove(item.id)} aria-label="delete"><Trash2 size={15}/></button>
      </span>
    </div>)}
  </div>}

  <h3 style={{marginTop:30}}>{ar?"الشهادات الصادرة":"Issued certificates"}</h3>
  {!certs ? <Loading ar={ar}/> : <div className="mini-list">{certs.length? certs.map((c,i)=>
    <div key={i}><span>{c.user?.full_name||c.user?.email} → <b>{c.course?(ar?c.course.title_ar:c.course.title_en):c.course_id}</b> · {c.quiz_score}%</span><small>{c.certificate_code}</small></div>
  ) : <div>{ar?"لا توجد شهادات بعد.":"No certificates yet."}</div>}</div>}
 </div>
}

/* --- generic content CRUD, reused for workshops/projects/events/articles/labs/team --- */

const CONTENT_FIELD_CONFIGS = {
  workshops: { hasTextId:true, fields:[
    {name:"title_ar",label:{ar:"العنوان (عربي)",en:"Title (AR)"}},
    {name:"title_en",label:{ar:"العنوان (EN)",en:"Title (EN)"}},
    {name:"cat",label:{ar:"التصنيف",en:"Category"}},
    {name:"level",label:{ar:"المستوى",en:"Level"}},
    {name:"duration",label:{ar:"المدة",en:"Duration"}},
    {name:"workshop_date",label:{ar:"التاريخ",en:"Date"},type:"date"},
    {name:"workshop_time",label:{ar:"الوقت",en:"Time"}},
    {name:"seats",label:{ar:"عدد المقاعد",en:"Seats"},type:"number"},
    {name:"lab",label:{ar:"المعمل",en:"Lab"}},
    {name:"desc_ar",label:{ar:"الوصف (عربي)",en:"Description (AR)"},type:"textarea"},
    {name:"desc_en",label:{ar:"الوصف (EN)",en:"Description (EN)"},type:"textarea"},
    {name:"status",label:{ar:"الحالة",en:"Status"},type:"select",options:["open","soon","full","ended"]},
    {name:"is_published",label:{ar:"منشور",en:"Published"},type:"checkbox"},
  ]},
  projects: { hasTextId:true, fields:[
    {name:"title_ar",label:{ar:"العنوان (عربي)",en:"Title (AR)"}},
    {name:"title_en",label:{ar:"العنوان (EN)",en:"Title (EN)"}},
    {name:"concept",label:{ar:"الفكرة العلمية",en:"Concept"}},
    {name:"tech",label:{ar:"التقنية",en:"Tech"}},
    {name:"result",label:{ar:"النتيجة",en:"Result"},type:"textarea"},
    {name:"is_published",label:{ar:"منشور",en:"Published"},type:"checkbox"},
  ]},
  events: { hasTextId:true, fields:[
    {name:"title_ar",label:{ar:"العنوان (عربي)",en:"Title (AR)"}},
    {name:"title_en",label:{ar:"العنوان (EN)",en:"Title (EN)"}},
    {name:"event_date",label:{ar:"التاريخ",en:"Date"},type:"date"},
    {name:"place",label:{ar:"المكان",en:"Place"}},
    {name:"description",label:{ar:"الوصف",en:"Description"},type:"textarea"},
    {name:"is_published",label:{ar:"منشور",en:"Published"},type:"checkbox"},
  ]},
  articles: { hasTextId:true, fields:[
    {name:"title_ar",label:{ar:"العنوان (عربي)",en:"Title (AR)"}},
    {name:"title_en",label:{ar:"العنوان (EN)",en:"Title (EN)"}},
    {name:"cat",label:{ar:"التصنيف",en:"Category"}},
    {name:"excerpt",label:{ar:"الملخص",en:"Excerpt"},type:"textarea"},
    {name:"is_published",label:{ar:"منشور",en:"Published"},type:"checkbox"},
  ]},
  labs: { hasTextId:true, fields:[
    {name:"title_ar",label:{ar:"العنوان (عربي)",en:"Title (AR)"}},
    {name:"title_en",label:{ar:"العنوان (EN)",en:"Title (EN)"}},
    {name:"text_ar",label:{ar:"الوصف (عربي)",en:"Text (AR)"},type:"textarea"},
    {name:"text_en",label:{ar:"الوصف (EN)",en:"Text (EN)"},type:"textarea"},
    {name:"is_published",label:{ar:"منشور",en:"Published"},type:"checkbox"},
  ]},
  team: { hasTextId:false, fields:[
    {name:"name",label:{ar:"الاسم",en:"Name"}},
    {name:"role_ar",label:{ar:"الدور (عربي)",en:"Role (AR)"}},
    {name:"role_en",label:{ar:"الدور (EN)",en:"Role (EN)"}},
    {name:"bio",label:{ar:"نبذة",en:"Bio"},type:"textarea"},
    {name:"is_published",label:{ar:"منشور",en:"Published"},type:"checkbox"},
  ]},
  lab_experiments: { hasTextId:false, fields:[
    {name:"title_ar",label:{ar:"عنوان التجربة (عربي)",en:"Experiment title (AR)"}},
    {name:"title_en",label:{ar:"عنوان التجربة (EN)",en:"Experiment title (EN)"}},
    {name:"board",label:{ar:"اللوحة (Arduino Uno / ESP32 / ...)",en:"Board (Arduino Uno / ESP32 / ...)"}},
    {name:"desc_ar",label:{ar:"الوصف (عربي)",en:"Description (AR)"},type:"textarea"},
    {name:"desc_en",label:{ar:"الوصف (EN)",en:"Description (EN)"},type:"textarea"},
    {name:"wokwi_url",label:{ar:"رابط مشروع Wokwi",en:"Wokwi project URL"}},
    {name:"is_published",label:{ar:"منشور",en:"Published"},type:"checkbox"},
  ]},
};

// Admins must see drafts too (the public DataContext only ever holds
// published rows), so the editor loads its own admin-scoped copy that
// includes unpublished rows, and also nudges the public feed to refresh
// after any change so visitors see updates immediately.
function useAdminRows(key){
 const [items,setItems]=useState(null);
 const [err,setErr]=useState("");
 async function load(){
   try{ setItems(await fetchTable(key,{includeUnpublished:true})) }
   catch(e){ setErr(e.message||String(e)) }
 }
 useEffect(()=>{ setItems(null); load() },[key]);
 return { items, err, reload: load };
}

function AdminContent({ar}){
 const [key,setKey]=useState("workshops");
 const { items, err, reload } = useAdminRows(key);
 const { refetch: refetchPublic } = useData();
 const config = CONTENT_FIELD_CONFIGS[key];
 async function refetchBoth(){ await Promise.all([reload(), refetchPublic()]) }
 return <div style={{maxWidth:1250,margin:"0 auto",padding:"0 25px"}}>
  <div className="filters" style={{margin:"0 0 20px",padding:0}}>
   <select value={key} onChange={e=>setKey(e.target.value)}>
     {Object.keys(CONTENT_FIELD_CONFIGS).map(k=><option key={k} value={k}>{k}</option>)}
   </select>
  </div>
  {err && <div className="form-error">{err}</div>}
  {!items ? <Loading ar={ar}/> : <ContentCRUD ar={ar} dataKey={key} config={config} items={items} refetch={refetchBoth}/>}
 </div>
}

function emptyRowFrom(config){
 const row={};
 for(const f of config.fields){ row[f.name] = f.type==="checkbox" ? true : f.type==="number" ? 0 : "" }
 if(config.hasTextId) row.id="";
 return row;
}

function ContentCRUD({ar,dataKey,config,items,refetch}){
 const [editing,setEditing]=useState(null);
 const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);

 function startNew(){ setEditing({ row: emptyRowFrom(config), isNew:true }) }
 function startEdit(item){ setEditing({ row: {...item}, isNew:false }) }

 async function save(){
   setBusy(true); setErr("");
   try{
     const { row, isNew } = editing;
     if(isNew){
       if(config.hasTextId && !row.id){ setErr(ar?"المعرف (id) مطلوب":"id is required"); setBusy(false); return }
       await adminCreateRow(dataKey, row);
     } else {
       const { id, ...patch } = row;
       await adminUpdateRow(dataKey, id, patch);
     }
     setEditing(null); await refetch();
   }catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }
 async function remove(id){
   setBusy(true); setErr("");
   try{ await adminDeleteRow(dataKey, id); await refetch() }
   catch(e){ setErr(e.message||String(e)) }
   setBusy(false);
 }

 return <div>
  <div className="manager-row"><div><span className="eyebrow">{dataKey.toUpperCase()}</span><h2>{ar?`إدارة ${dataKey}`:`Manage ${dataKey}`}</h2></div>
   <button className="btn primary" onClick={startNew}><Plus size={17}/>{ar?"إضافة جديد":"Add new"}</button></div>

  {err&&<div className="form-error" style={{marginBottom:15}}>{err}</div>}

  {editing && <div className="form-card" style={{marginBottom:25}}>
    {config.hasTextId && <label>id (slug){editing.isNew?null:<small> — {ar?"غير قابل للتعديل":"not editable"}</small>}
      <input value={editing.row.id||""} disabled={!editing.isNew} onChange={e=>setEditing({...editing,row:{...editing.row,id:e.target.value}})}/>
    </label>}
    {config.fields.map(f=>{
      const val = editing.row[f.name];
      if(f.type==="checkbox") return <label key={f.name} style={{display:"flex",flexDirection:"row",alignItems:"center",gap:8}}><input type="checkbox" checked={!!val} onChange={e=>setEditing({...editing,row:{...editing.row,[f.name]:e.target.checked}})}/>{ar?f.label.ar:f.label.en}</label>;
      if(f.type==="select") return <label key={f.name}>{ar?f.label.ar:f.label.en}<select value={val||f.options[0]} onChange={e=>setEditing({...editing,row:{...editing.row,[f.name]:e.target.value}})}>{f.options.map(o=><option key={o} value={o}>{o}</option>)}</select></label>;
      if(f.type==="textarea") return <label key={f.name}>{ar?f.label.ar:f.label.en}<textarea rows={3} value={val||""} onChange={e=>setEditing({...editing,row:{...editing.row,[f.name]:e.target.value}})}/></label>;
      return <label key={f.name}>{ar?f.label.ar:f.label.en}<input type={f.type==="number"?"number":f.type==="date"?"date":"text"} value={val??""} onChange={e=>setEditing({...editing,row:{...editing.row,[f.name]: f.type==="number"?Number(e.target.value):e.target.value}})}/></label>;
    })}
    <div style={{display:"flex",gap:10}}>
      <button className="btn primary" onClick={save} disabled={busy}>{busy?(ar?"جارٍ الحفظ...":"Saving..."):(ar?"حفظ":"Save")}</button>
      <button className="btn ghost" onClick={()=>setEditing(null)}>{ar?"إلغاء":"Cancel"}</button>
    </div>
  </div>}

  <div className="mini-list">{items.map(item=>
    <div key={item.id}>
      <span>{item.title_ar||item.name||item.id} {item.is_published===false && <small>({ar?"مسودة":"draft"})</small>}</span>
      <span style={{display:"flex",gap:10}}>
        <button onClick={()=>startEdit(item)} aria-label="edit"><Edit3 size={15}/></button>
        <button onClick={()=>remove(item.id)} aria-label="delete"><Trash2 size={15}/></button>
      </span>
    </div>)}
  </div>
 </div>
}

/* --- sections: the "add a section without code" feature --- */

const SECTION_CONFIG = { hasTextId:false, fields:[
  {name:"slug",label:{ar:"الرابط (slug)",en:"Slug"}},
  {name:"nav_label_ar",label:{ar:"اسم القائمة (عربي)",en:"Nav label (AR)"}},
  {name:"nav_label_en",label:{ar:"اسم القائمة (EN)",en:"Nav label (EN)"}},
  {name:"title_ar",label:{ar:"العنوان (عربي)",en:"Title (AR)"}},
  {name:"title_en",label:{ar:"العنوان (EN)",en:"Title (EN)"}},
  {name:"body_ar",label:{ar:"المحتوى (عربي)",en:"Body (AR)"},type:"textarea"},
  {name:"body_en",label:{ar:"المحتوى (EN)",en:"Body (EN)"},type:"textarea"},
  {name:"sort_order",label:{ar:"الترتيب",en:"Sort order"},type:"number"},
  {name:"is_published",label:{ar:"منشور",en:"Published"},type:"checkbox"},
]};

/* --- site settings: home/about/contact/footer text + brand colors,
   editable from the admin dashboard with no code --- */

const SITE_SETTINGS_CONFIG = {
 home: { title:{ar:"الرئيسية",en:"Home"}, fields:[
   {name:"hero_title_ar",label:{ar:"العنوان الرئيسي (عربي)",en:"Hero title (AR)"},type:"textarea"},
   {name:"hero_title_en",label:{ar:"العنوان الرئيسي (EN)",en:"Hero title (EN)"},type:"textarea"},
   {name:"hero_text_ar",label:{ar:"النص تحت العنوان (عربي)",en:"Hero text (AR)"},type:"textarea"},
   {name:"hero_text_en",label:{ar:"النص تحت العنوان (EN)",en:"Hero text (EN)"},type:"textarea"},
 ]},
 about: { title:{ar:"عن نـــود",en:"About"}, fields:[
   {name:"intro_ar",label:{ar:"المقدمة (عربي)",en:"Intro (AR)"},type:"textarea"},
   {name:"intro_en",label:{ar:"المقدمة (EN)",en:"Intro (EN)"},type:"textarea"},
   {name:"vision_ar",label:{ar:"الرؤية (عربي)",en:"Vision (AR)"},type:"textarea"},
   {name:"vision_en",label:{ar:"الرؤية (EN)",en:"Vision (EN)"},type:"textarea"},
   {name:"mission_ar",label:{ar:"الرسالة (عربي)",en:"Mission (AR)"},type:"textarea"},
   {name:"mission_en",label:{ar:"الرسالة (EN)",en:"Mission (EN)"},type:"textarea"},
 ]},
 contact: { title:{ar:"تواصل معنا",en:"Contact"}, fields:[
   {name:"email",label:{ar:"البريد الإلكتروني",en:"Email"}},
   {name:"intro_ar",label:{ar:"نص الصفحة (عربي)",en:"Page text (AR)"},type:"textarea"},
   {name:"intro_en",label:{ar:"نص الصفحة (EN)",en:"Page text (EN)"},type:"textarea"},
 ]},
 footer: { title:{ar:"الفوتر",en:"Footer"}, fields:[
   {name:"tagline_ar",label:{ar:"الوصف (عربي)",en:"Tagline (AR)"},type:"textarea"},
   {name:"tagline_en",label:{ar:"الوصف (EN)",en:"Tagline (EN)"},type:"textarea"},
   {name:"email",label:{ar:"البريد الإلكتروني",en:"Email"}},
 ]},
 brand: { title:{ar:"الألوان",en:"Colors"}, fields:[
   {name:"navy",label:{ar:"اللون الأساسي (كحلي) — مثال #2D3B52",en:"Primary color (navy) — e.g. #2D3B52"}},
   {name:"cream",label:{ar:"لون الخلفية (كريمي) — مثال #F6F2EC",en:"Background color (cream) — e.g. #F6F2EC"}},
   {name:"amber",label:{ar:"لون التمييز (كهرماني) — مثال #C17F3A",en:"Accent color (amber) — e.g. #C17F3A"}},
 ]},
};

function AdminSiteSettings({ar}){
 const [key,setKey]=useState("home");
 const [all,setAll]=useState(null);
 const [draft,setDraft]=useState(null);
 const [err,setErr]=useState(""); const [busy,setBusy]=useState(false); const [saved,setSaved]=useState(false);
 const { refetch: refetchPublic } = useData();

 async function load(){ setErr(""); try{ setAll(await fetchSiteSettings()) }catch(e){ setErr(e.message||String(e)) } }
 useEffect(()=>{ load() },[]);
 useEffect(()=>{ if(all) setDraft(all[key]||{}) },[all,key]);

 const config = SITE_SETTINGS_CONFIG[key];

 async function save(){
   setBusy(true); setErr(""); setSaved(false);
   try{ await updateSiteSetting(key, draft); await load(); await refetchPublic(); setSaved(true) }
   catch(e){ setErr((ar?"تعذّر الحفظ — تأكد إنك شغّلت ملف supabase-patch-3-site-settings.sql في Supabase مرة وحدة. ":"Could not save — make sure you ran supabase-patch-3-site-settings.sql in Supabase once. ")+(e.message||String(e))) }
   setBusy(false);
 }

 return <div style={{maxWidth:900,margin:"0 auto",padding:"0 25px"}}>
  <p style={{color:"var(--muted)",fontSize:13,marginBottom:20}}>{ar?"عدّل نصوص وألوان الموقع من هنا — تتحدث فورًا على الموقع، بدون كتابة أي كود.":"Edit the site's text and colors here — changes go live right away, no code needed."}</p>
  <div className="filters" style={{margin:"0 0 20px",padding:0}}>
   <select value={key} onChange={e=>setKey(e.target.value)}>{Object.entries(SITE_SETTINGS_CONFIG).map(([k,c])=><option key={k} value={k}>{ar?c.title.ar:c.title.en}</option>)}</select>
  </div>
  {err && <div className="form-error" style={{marginBottom:15}}>{err}</div>}
  {!draft ? <Loading ar={ar}/> : <div className="form-card">
   {config.fields.map(f=><label key={f.name}>{ar?f.label.ar:f.label.en}{f.type==="textarea"?<textarea rows={3} value={draft[f.name]||""} onChange={e=>setDraft({...draft,[f.name]:e.target.value})}/>:<input value={draft[f.name]||""} onChange={e=>setDraft({...draft,[f.name]:e.target.value})}/>}</label>)}
   {saved && <div className="success" style={{padding:10}}>{ar?"تم الحفظ":"Saved"}</div>}
   <div style={{display:"flex",gap:10}}><button className="btn primary" onClick={save} disabled={busy}>{busy?(ar?"جارٍ الحفظ...":"Saving..."):(ar?"حفظ":"Save")}</button></div>
  </div>}
 </div>
}

function AdminSections({ar}){
 const { items, err, reload } = useAdminRows("sections");
 const { refetch: refetchPublic } = useData();
 async function refetchBoth(){ await Promise.all([reload(), refetchPublic()]) }
 return <div style={{maxWidth:1250,margin:"0 auto",padding:"0 25px"}}>
  <p style={{color:"var(--muted)",fontSize:13,marginBottom:20}}>{ar?"أضف قسمًا جديدًا هنا وبيظهر فورًا كصفحة على الموقع (على الرابط /s/الاسم) وبقائمة التنقل — بدون كتابة أي كود.":"Add a new section here and it appears immediately as a real page on the site (at /s/slug) and in the nav — no code required."}</p>
  {err && <div className="form-error">{err}</div>}
  {!items ? <Loading ar={ar}/> : <ContentCRUD ar={ar} dataKey="sections" config={SECTION_CONFIG} items={items} refetch={refetchBoth}/>}
 </div>
}

function SectionPage({ar}){
 const { slug } = useParams();
 const { sections } = useData();
 const s = sections.find(x=>x.slug===slug && x.is_published);
 if(!s) return <NotFound ar={ar}/>;
 return <PageShell ar={ar} eyebrow={ar?"قسم":"SECTION"} title={ar?s.title_ar:s.title_en} intro="">
   <div className="prose" style={{maxWidth:900,margin:"0 auto",padding:"0 25px",whiteSpace:"pre-wrap"}}>{ar?s.body_ar:s.body_en}</div>
 </PageShell>
}

function AdminPanel({title,icon,children}){return <div className="admin-panel"><div className="panel-title">{icon}<h3>{title}</h3></div>{children}</div>}
function PageShell({children,eyebrow,title,intro}){return <div className="page-shell"><div className="page-hero"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{intro}</p></div>{children}</div>}
function Empty({ar,text}){return <div className="empty"><Search/><h3>{text}</h3><p>{ar?"جرّب تغيير البحث أو التصنيف.":"Try changing your search or category."}</p></div>}
function NotFound({ar}){return <PageShell ar={ar} eyebrow="404" title={ar?"الصفحة غير موجودة":"Page not found"} intro={ar?"يبدو أن هذه العقدة غير موجودة.":"This node does not exist."}><div className="center"><Link className="btn primary" to="/">{ar?"العودة للرئيسية":"Back home"} <ArrowRight size={18}/></Link></div></PageShell>}

function Footer({ar}){
 const { settings } = useData(); const footerSet = settings.footer||{};
 const footerTagline = footerSet[ar?"tagline_ar":"tagline_en"];
 const footerEmail = footerSet.email || "hello@node.sa";
 return <footer><div className="footer-main"><div className="footer-brand"><Logo/><h3>نـــود <span>|</span> NODE</h3><p>{footerTagline || (ar?"مبادرة علمية وتقنية تربط الفيزياء بالتقنية والتطبيقات العملية.":"A scientific and technology initiative connecting physics, technology and practical applications.")}</p></div><div><b>{ar?"استكشف":"Explore"}</b><Link to="/about">{ar?"عن نـــود":"About"}</Link><Link to="/workshops">{ar?"الورش":"Workshops"}</Link><Link to="/labs">{ar?"المعامل":"Labs"}</Link><Link to="/knowledge">{ar?"المعرفة":"Knowledge"}</Link></div><div><b>{ar?"المجتمع":"Community"}</b><Link to="/community">{ar?"انضم":"Join"}</Link><Link to="/events">{ar?"الفعاليات":"Events"}</Link><Link to="/team">{ar?"الفريق":"Team"}</Link><Link to="/contact">{ar?"تواصل":"Contact"}</Link></div><div><b>{ar?"الحساب":"Account"}</b><Link to="/login">{ar?"تسجيل الدخول":"Log in"}</Link><span className="muted">{footerEmail}</span></div></div><div className="footer-bottom"><span>© 2026 NODE</span><span>{ar?"Physics × Technology × Application":"Physics × Technology × Application"}</span></div></footer>}

function App(){
  return <AuthProvider><DataProvider><BrowserRouter><Layout/></BrowserRouter></DataProvider></AuthProvider>;
}

createRoot(document.getElementById("root")).render(<App/>);
