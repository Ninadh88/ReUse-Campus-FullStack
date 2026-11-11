import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Search, Plus, BookOpen, Calculator, Laptop, Armchair, Shirt, Package,
  Heart, ArrowLeftRight, HandHeart, Clock3, LayoutDashboard, ShoppingBag,
  UserRound, SlidersHorizontal, X, MapPin, Check, ChevronDown, Sparkles,
  Menu, Leaf, ArrowUpRight, CalendarDays, CircleCheck, MessageCircle, LogOut,
  LockKeyhole, Mail, User, RefreshCw
} from "lucide-react";
import "./styles.css";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000";
const categories = ["All items", "Books", "Electronics", "Stationery", "Hostel essentials"];
const modes = ["All ways to reuse", "Sell", "Exchange", "Donate", "Borrow"];
const modeToApi = (s) => ({Sell:"SELL",Exchange:"EXCHANGE",Donate:"DONATE",Borrow:"BORROW"})[s] || s;
const modeFromApi = (s) => ({SELL:"Sell",EXCHANGE:"Exchange",DONATE:"Donate",BORROW:"Borrow"})[s] || s;
const conditionToApi = (s) => ({"Like new":"LIKE_NEW",Good:"GOOD",Used:"USED","Needs repair":"NEEDS_REPAIR"})[s] || "GOOD";
const conditionFromApi = (s) => ({"LIKE_NEW":"Like new",GOOD:"Good",USED:"Used",NEEDS_REPAIR:"Needs repair"})[s] || s;
const money = (n) => n > 0 ? `₹${Number(n).toLocaleString("en-IN")}` : "Free";
const emojiFor = (item) => item.emoji || (item.category === "Books" ? "📚" : item.category === "Electronics" ? "🔌" : item.category === "Stationery" ? "✏️" : "📦");
const toneFor = (id) => ["lavender","mint","peach","cream","blue","rose"][String(id || "1").charCodeAt(0) % 6];
const initials = (name="Student") => name.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
const relativeDate = (date) => { const d = Math.max(0, Date.now()-new Date(date).getTime()); const h=Math.floor(d/3600000); return h<1?"Just now":h<24?`${h} hours ago`:h<48?"Yesterday":`${Math.floor(h/24)} days ago`; };
async function api(path, {token, ...options}={}) {
  const headers = {...(options.body instanceof FormData ? {} : {"Content-Type":"application/json"}), ...(token ? {Authorization:`Bearer ${token}`} : {}), ...options.headers};
  const response = await fetch(`${API}${path}`, {...options, headers});
  const data = response.status === 204 ? {} : await response.json().catch(()=>({error:"Unexpected server response."}));
  if (!response.ok) throw new Error(data.error || "Request failed.");
  return data;
}
function normalizeItem(raw) {
  return {...raw, mode:modeFromApi(raw.mode), condition:conditionFromApi(raw.condition), owner:raw.owner?.name || "Student", initials:initials(raw.owner?.name), posted:relativeDate(raw.createdAt), tone:toneFor(raw.id), emoji:emojiFor(raw), location:raw.location || "SRM AP Campus", status:raw.status === "AVAILABLE" ? "Available" : raw.status, price:Number(raw.price || 0)};
}
function normalizeRequest(r) {
  return {id:r.id,itemId:r.itemId,itemTitle:r.item?.title || "Item",requestType:modeFromApi(r.type),status:r.status[0]+r.status.slice(1).toLowerCase(),owner:r.owner?.name || "Student",requester:r.requester?.name || "Student",date:new Date(r.createdAt).toLocaleDateString("en-IN"),isMine:r.requesterId === r.requester?.id};
}

function App() {
  const [token,setToken] = useState(()=>localStorage.getItem("reuse-token") || "");
  const [user,setUser] = useState(()=>{try{return JSON.parse(localStorage.getItem("reuse-user"))}catch{return null}});
  const [authMode,setAuthMode] = useState("login");
  const [items,setItems] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileModal, setProfileModal] = useState(null);
  const [mineItems,setMineItems] = useState([]);
  const [requests,setRequests] = useState({sent:[],received:[]});
  const [dashboard,setDashboard] = useState(null);
  const [active,setActive] = useState("Explore");
  const [query,setQuery] = useState("");
  const [category,setCategory] = useState("All items");
  const [mode,setMode] = useState("All ways to reuse");
  const [sort,setSort] = useState("recent");
  const [modal,setModal] = useState(null);
  const [selected,setSelected] = useState(null);
  const [toast,setToast] = useState("");
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  const [mobileMenu,setMobileMenu] = useState(false);
  const notify = (message) => {setToast(message); window.setTimeout(()=>setToast(""),2600);};
  const load = async (authToken=token) => {
    const [itemsData,requestData,dashData,mineData] = await Promise.all([
      api(`/api/items?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}&mode=${encodeURIComponent(mode)}&sort=${sort}`),
      api("/api/requests",{token:authToken}),
      api("/api/dashboard",{token:authToken}),
      api("/api/items/mine",{token:authToken})
    ]);
    setItems(itemsData.items.map(normalizeItem)); setRequests(requestData); setDashboard(dashData); setMineItems(mineData.items.map(normalizeItem));
  };
  useEffect(()=>{
    if(!token){setItems([]);setRequests({sent:[],received:[]});setDashboard(null);return;}
    api("/api/auth/me",{token}).then(({user:u})=>{setUser(u);localStorage.setItem("reuse-user",JSON.stringify(u));}).catch(()=>logout());
  },[]);
  useEffect(()=>{if(token){load().catch(e=>setError(e.message));}},[token,query,category,mode,sort]);
   
  useEffect(() => {
    if (!token) return;

    const refreshInterval = setInterval(() => {
      load().catch(e => setError(e.message));
    }, 5000);

    return () => clearInterval(refreshInterval);
  }, [token, query, category, mode, sort]);

  useEffect(()=>{if(token && active==="My listings"){api("/api/items/mine",{token}).then(({items:mine})=>setMineItems(mine.map(normalizeItem))).catch(e=>setError(e.message));}},[token,active]);
  const logout = () => {localStorage.removeItem("reuse-token");localStorage.removeItem("reuse-user");setToken("");setUser(null);setItems([]);setRequests({sent:[],received:[]});setDashboard(null);setActive("Explore");notify("You have been logged out.");};
  const authenticate = async (payload) => {
    setBusy(true);setError("");
    try {const result=await api(`/api/auth/${authMode==="login"?"login":"register"}`,{method:"POST",body:JSON.stringify(payload)});
      localStorage.setItem("reuse-token",result.token);localStorage.setItem("reuse-user",JSON.stringify(result.user));setToken(result.token);setUser(result.user);notify(authMode==="login"?"Welcome back!":"Your account has been created.");}
    catch(e){setError(e.message);}finally{setBusy(false);}
  };
  const addItem = async (data) => {
    setBusy(true);
    try {const body=new FormData();body.append("title",data.title);body.append("description",data.description||"No additional description provided.");body.append("category",data.category);body.append("mode",modeToApi(data.mode));body.append("price",data.mode==="Sell"?String(Number(data.price||0)):"0");body.append("condition",conditionToApi(data.condition));body.append("location","SRM AP Campus");if(data.image)body.append("image",data.image);
      await api("/api/items",{method:"POST",token,body});setModal(null);setActive("My listings");await load();notify("Your item has been listed!");}
    catch(e){notify(e.message);}finally{setBusy(false);}
  };
  const requestItem = async (item) => {
    setBusy(true);
    try {await api("/api/requests",{method:"POST",token,body:JSON.stringify({itemId:item.id})});setModal(null);await load();notify("Request sent to the item owner!");}
    catch(e){notify(e.message);}finally{setBusy(false);}
  };
  const changeRequest = async (id,status) => {
    try {await api(`/api/requests/${id}/status`,{method:"PATCH",token,body:JSON.stringify({status})});await load();notify(`Request ${status.toLowerCase()}.`);}
    catch(e){notify(e.message);}
  };
  const updateProfile = async (name) => {
  try {
    const result = await api("/api/auth/profile", {
      method: "PATCH",
      token,
      body: JSON.stringify({ name })
    });

    setUser(result.user);
    localStorage.setItem("reuse-user", JSON.stringify(result.user));
    setProfileModal(null);
    notify("Profile updated successfully.");
  } catch (e) {
    notify(e.message);
  }
};

const updatePassword = async (currentPassword, newPassword) => {
  try {
    await api("/api/auth/password", {
      method: "PATCH",
      token,
      body: JSON.stringify({ currentPassword, newPassword })
    });

    setProfileModal(null);
    notify("Password changed successfully.");
  } catch (e) {
    notify(e.message);
  }
};
  const updateItem = async (id,data) => {
    setBusy(true);
    try {
      const body={title:data.title,description:data.description,category:data.category,mode:modeToApi(data.mode),price:data.mode==="Sell"?Number(data.price||0):0,condition:conditionToApi(data.condition),location:data.location||"SRM AP Campus"};
      await api(`/api/items/${id}`,{method:"PATCH",token,body:JSON.stringify(body)});
      setModal(null);await load();notify("Listing updated.");
    } catch(e){notify(e.message);} finally {setBusy(false);}
  };
  const deleteItem = async (id) => {
    try {await api(`/api/items/${id}`,{method:"DELETE",token});await load();notify("Listing removed.");}
    catch(e){notify(e.message);}
  };
  const filtered = items;
  
  const nav = [{name:"Explore",icon:Search},{name:"My listings",icon:Package},{name:"My requests",icon:ArrowLeftRight},{name:"Dashboard",icon:LayoutDashboard}];
  if(!token || !user) return <AuthScreen mode={authMode} setMode={m=>{setAuthMode(m);setError("");}} onSubmit={authenticate} busy={busy} error={error}/>;
  return <div className="app-shell">
    
<aside className={`sidebar ${mobileMenu ? "sidebar-open" : ""}`}>
  <div className="brand">
    <div className="brand-mark"><Leaf size={21}/></div>
    <div>
      <strong>reuse<span>campus</span></strong>
      <small>THE CAMPUS MARKETPLACE</small>
    </div>
    <button className="mobile-close icon-button" onClick={() => setMobileMenu(false)}>
      <X size={18}/>
    </button>
  </div>

  <div className="campus-pill">
    <span className="online-dot"/> SRM AP community <ChevronDown size={14}/>
  </div>

  <p className="nav-label">WORKSPACE</p>
  <nav>
    {nav.map(({name, icon: Icon}) => (
      <button
        key={name}
        className={`nav-link ${active === name ? "active" : ""}`}
        onClick={() => {
          setActive(name);
          setMobileMenu(false);
        }}
      >
        <Icon size={18}/>
        <span>{name}</span>
        {name === "My requests" && requests.sent.length > 0 && (
          <em>{requests.sent.length}</em>
        )}
      </button>
    ))}
  </nav>

  <div className="sidebar-bottom">
    <div className="impact-card">
      <div className="impact-icon"><Sparkles size={17}/></div>
      <strong>Small actions.<br/>Big impact.</strong>
      <p>Every reused item is one less item wasted.</p>
      <div className="impact-leaves">✳ ✳ ✳</div>
    </div>

    {/* Updated profile row */}
    <div className="profile-row">
      <button
        className="profile-trigger"
        onClick={() => setProfileModal("profile")}
      >
        <div className="avatar avatar-dark">{initials(user.name)}</div>
        <div className="profile-copy">
          <strong>{user.name}</strong>
          <small>View profile</small>
        </div>
      </button>

      <button
        className="icon-button"
        title="Log out"
        onClick={logout}
      >
        <LogOut size={16}/>
      </button>
    </div>
  </div>
</aside>

    <main className="main-area"><header className="topbar"><button className="icon-button mobile-menu" onClick={()=>setMobileMenu(true)}><Menu size={20}/></button><div className="breadcrumb">Workspace <span>/</span> <b>{active}</b></div><div className="top-actions"><span className="top-campus"><MapPin size={14}/> SRM University-AP</span><div className="profile-menu-wrap">
  <button
    className="avatar avatar-small"
    title="Account menu"
    onClick={() => setProfileOpen(!profileOpen)}
  >
    {initials(user.name)}
  </button>

  {profileOpen && (
    <div className="profile-dropdown">
      <div className="profile-dropdown-header">
        <strong>{user.name}</strong>
        <small>{user.email}</small>
      </div>

      <button onClick={() => {
        setProfileOpen(false);
        setProfileModal("profile");
      }}>
        <User size={16}/> View / edit profile
      </button>

      <button onClick={() => {
        setProfileOpen(false);
        setProfileModal("password");
      }}>
        <LockKeyhole size={16}/> Change password
      </button>

      <button className="profile-logout" onClick={logout}>
        <LogOut size={16}/> Logout
      </button>
    </div>
  )}
</div></div></header>
      <div className="content">
        {error&&<div className="inline-error">{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}
        {active==="Explore"&&<Explore query={query} setQuery={setQuery} category={category} setCategory={setCategory} mode={mode} setMode={setMode} sort={sort} setSort={setSort} filtered={filtered} onSelect={item=>{setSelected(item);setModal("detail");}} onCreate={()=>setModal("create")}/>}
        {active==="My listings"&&<MyListings items={mineItems} onCreate={()=>setModal("create")} onDelete={deleteItem} onEdit={item=>{setSelected(item);setModal("edit");}} onSelect={item=>{setSelected(item);setModal("detail");}}/>}
        {active==="My requests"&&<MyRequests requests={requests} onChange={changeRequest} userId={user.id}/>}
        {active==="Dashboard"&&<Dashboard items={items} requests={requests} data={dashboard}/>}
        <footer className="footer"><span>© 2026 ReUse Campus</span><span>Made for a more thoughtful campus <Heart size={12} fill="currentColor"/></span></footer>
      </div>
    </main>
    {modal==="create"&&<CreateModal onClose={()=>setModal(null)} onSubmit={addItem} busy={busy}/>}
    {modal==="edit"&&selected&&<EditModal item={selected} onClose={()=>setModal(null)} onSubmit={data=>updateItem(selected.id,data)} busy={busy}/>}
    {modal==="detail"&&selected&&<DetailModal item={selected} onClose={()=>setModal(null)} onRequest={requestItem} busy={busy} own={selected.ownerId===user.id}/>}
    {toast&&<div className="toast"><CircleCheck size={17}/>{toast}</div>}
    {profileModal && (
  <ProfileModal
    user={user}
    mode={profileModal}
    onClose={() => setProfileModal(null)}
    onSave={updateProfile}
    onPasswordChange={updatePassword}
  />
)}
  </div>;
}

function AuthScreen({mode,setMode,onSubmit,busy,error}) {
  const [form,setForm]=useState({name:"",email:"",password:""});
  const update=(k,v)=>setForm(x=>({...x,[k]:v}));
  return <div className="auth-shell"><div className="auth-left"><div className="brand"><div className="brand-mark"><Leaf size={21}/></div><div><strong>reuse<span>campus</span></strong><small>THE CAMPUS MARKETPLACE</small></div></div><div className="auth-hero"><div className="eyebrow"><span/> A BETTER WAY TO SHARE ON CAMPUS</div><h1>Good finds.<br/><i>Second lives.</i></h1><p>Find what you need, pass on what you don't. A little reuse goes a long way.</p><div className="auth-art"><span>📚</span><span>🧮</span><span>💡</span><span>🌱</span></div><div className="auth-foot">BUY LESS · WASTE LESS · SHARE MORE</div></div></div>
    <div className="auth-right"><form className="auth-card" onSubmit={e=>{e.preventDefault();onSubmit(mode==="login"?{email:form.email,password:form.password}:{name:form.name,email:form.email,password:form.password});}}>
      <div className="eyebrow muted">SRM AP STUDENT COMMUNITY</div><h2>{mode==="login"?"Welcome back.":"Create your account."}</h2><p>{mode==="login"?"Sign in to continue to your campus marketplace.":"Join your campus community and give useful things a second life."}</p>
      {mode==="register"&&<label className="field"><span>Full name</span><div className="auth-input"><User size={17}/><input required minLength="2" maxLength="60" value={form.name} onChange={e=>update("name",e.target.value)} placeholder="Your name"/></div></label>}
      <label className="field"><span>Email address</span><div className="auth-input"><Mail size={17}/><input required type="email" value={form.email} onChange={e=>update("email",e.target.value)} placeholder="you@example.com"/></div></label>
      <label className="field"><span>Password</span><div className="auth-input"><LockKeyhole size={17}/><input required type="password" minLength={mode==="register"?8:1} value={form.password} onChange={e=>update("password",e.target.value)} placeholder={mode==="register"?"At least 8 characters":"Your password"}/></div></label>
      {error&&<div className="auth-error">{error}</div>}
      <button className="primary-button auth-submit" disabled={busy}>{busy?"Please wait…":mode==="login"?"Sign in":"Create account"} <ArrowUpRight size={16}/></button>
      <div className="auth-switch">{mode==="login"?"New to ReUse Campus?":"Already have an account?"} <button type="button" onClick={()=>setMode(mode==="login"?"register":"login")}>{mode==="login"?"Create account":"Sign in"}</button></div>
      <div className="auth-security"><LockKeyhole size={14}/> Passwords are securely hashed. Your account data is stored on the project database.</div>
    </form></div></div>;
}

function Explore({query,setQuery,category,setCategory,mode,setMode,sort,setSort,filtered,onSelect,onCreate}) {
  return <><section className="hero"><div className="hero-copy"><div className="eyebrow"><span/> A BETTER WAY TO SHARE ON CAMPUS</div><h1>Good finds.<br/><i>Second lives.</i></h1><p>Find what you need, pass on what you don't.<br/>A little reuse goes a long way.</p><button className="primary-button" onClick={onCreate}><Plus size={17}/> List an item</button></div><div className="hero-art"><div className="hero-orbit orbit-one"/><div className="hero-orbit orbit-two"/><div className="hero-sticker sticker-book">📚</div><div className="hero-sticker sticker-lamp">💡</div><div className="hero-sticker sticker-plant">🌱</div><div className="hero-note"><span>PASS IT ON</span><strong>Reuse is<br/>the new cool.</strong></div><div className="hero-sun">✳</div></div><div className="hero-foot"><span>01 — DISCOVER</span><span>BUY LESS · WASTE LESS · SHARE MORE</span></div></section>
    <section className="stats-strip"><div><strong>4</strong><span>ways to reuse</span></div><div><strong>1</strong><span>campus community</span></div><div><strong>∞</strong><span>second chances</span></div><div className="stats-note"><Leaf size={16}/> Better for your wallet, kinder to the planet.</div></section>
    <section className="market-section"><div className="section-heading"><div><div className="eyebrow muted">THE COMMUNITY MARKETPLACE</div><h2>Find your next <i>good thing.</i></h2><p>Useful things, looking for a new home.</p></div><div className="result-count">{filtered.length} items <span>to explore</span></div></div>
      <div className="search-row"><div className="search-box"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search books, calculators, essentials..."/>{query&&<button className="clear-search" onClick={()=>setQuery("")}><X size={15}/></button>}</div><label className="sort-select"><SlidersHorizontal size={16}/><select value={sort} onChange={e=>setSort(e.target.value)}><option value="recent">Most recent</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select></label></div>
      <div className="filter-row"><div className="category-pills">{categories.map(c=><button key={c} className={category===c?"selected":""} onClick={()=>setCategory(c)}>{c}</button>)}</div><div className="mode-pills">{modes.map(m=><button key={m} className={mode===m?"selected":""} onClick={()=>setMode(m)}>{m==="All ways to reuse"?"All":m}</button>)}</div></div>
      {filtered.length?<div className="item-grid">{filtered.map(item=><ItemCard key={item.id} item={item} onClick={()=>onSelect(item)}/>)}</div>:<div className="empty-state"><div>🔎</div><h3>No items found</h3><p>Try another search or clear some filters.</p><button className="secondary-button" onClick={()=>{setQuery("");setCategory("All items");setMode("All ways to reuse");}}>Clear filters</button></div>}
    </section></>;
}
function ItemCard({item,onClick}) {
  const ModeIcon=({Sell:ShoppingBag,Exchange:ArrowLeftRight,Donate:HandHeart,Borrow:Clock3})[item.mode]||Package;
  return <button className="item-card" onClick={onClick}><div className={`item-visual ${item.tone}`}>{item.imageUrl?<img className="item-photo" src={`${API}${item.imageUrl}`} alt={item.title}/>:<span className="item-emoji">{emojiFor(item)}</span>}<span className={`mode-tag mode-${item.mode.toLowerCase()}`}><ModeIcon size={12}/>{item.mode}</span><span className="condition-tag">{item.condition}</span></div><div className="item-info"><div className="item-category">{item.category}</div><h3>{item.title}</h3><div className="item-bottom"><strong>{money(item.price)}</strong><span>{item.posted}</span></div><div className="item-owner"><span className="avatar avatar-tiny">{item.initials}</span>{item.owner}<span className="owner-location"><MapPin size={11}/>{(item.location||"Campus").split("·")[0].trim()}</span></div></div><span className="card-arrow"><ArrowUpRight size={17}/></span></button>;
}
function MyListings({items,onCreate,onDelete,onEdit,onSelect}) {
  return <section className="page-section"><div className="page-title-row"><div><div className="eyebrow muted">YOUR CONTRIBUTION</div><h1>My <i>listings.</i></h1><p>Keep track of the useful things you've passed on.</p></div><button className="primary-button" onClick={onCreate}><Plus size={17}/> Add a listing</button></div>{items.length?<div className="item-grid">{items.map(item=><div className="listing-wrap" key={item.id}><ItemCard item={item} onClick={()=>onSelect(item)}/><div className="listing-actions"><button className="text-button" onClick={()=>onEdit(item)}>Edit</button><button className="delete-listing" onClick={()=>onDelete(item.id)}><X size={14}/> Remove listing</button></div></div>)}</div>:<div className="empty-state"><div>📦</div><h3>Your shelf is waiting</h3><p>List something you no longer need and give it a second life.</p><button className="primary-button" onClick={onCreate}><Plus size={17}/> List your first item</button></div>}</section>;
}

function MyRequests({ requests, onChange, userId }) {
  const sentRows = (requests.sent || []).map((r) => {
    const normalized = normalizeRequest(r);
    const status = String(r.status || "").toUpperCase();

    return {
      ...normalized,
      direction: "Sent",
      canCancel: status === "PENDING",
    };
  });

  const receivedRows = (requests.received || []).map((r) => {
    const normalized = normalizeRequest(r);
    const status = String(r.status || "").toUpperCase();

    return {
      ...normalized,
      direction: "Received",
      canApprove: status === "PENDING",
      canComplete: status === "APPROVED",
    };
  });

  const rows = [...sentRows, ...receivedRows];

  return (
    <section className="page-section">
      <div className="eyebrow muted">KEEP THINGS MOVING</div>

      <h1>My <i>requests.</i></h1>

      <p className="page-subtitle">
        Track requests you've sent and requests for your listings.
      </p>

      {rows.length ? (
        <div className="request-list">
          {rows.map((r) => (
            <div className="request-row" key={`${r.direction}-${r.id}`}>
              <div className="request-icon">↗</div>

              <div className="request-main">
                <strong>{r.itemTitle}</strong>
                <span>
                  {r.direction} · {r.requestType} ·
                  {r.direction === "Sent"
                    ? ` Owner: ${r.owner}`
                    : ` From: ${r.requester}`}
                  {" · "}{r.date}
                </span>
              </div>

              <span className={`status status-${r.status.toLowerCase()}`}>
                {r.status}
              </span>

              {r.canCancel && (
                <button
                  className="text-button"
                  onClick={() => onChange(r.id, "CANCELLED")}
                >
                  Cancel request
                </button>
              )}

              {r.canApprove && (
                <>
                  <button
                    className="text-button"
                    onClick={() => onChange(r.id, "APPROVED")}
                  >
                    Accept request
                  </button>

                  <button
                    className="text-button"
                    onClick={() => onChange(r.id, "REJECTED")}
                  >
                    Reject
                  </button>
                </>
              )}

              {r.canComplete && r.direction === "Received" && (
                <button
                  className="text-button"
                  onClick={() => onChange(r.id, "COMPLETED")}
                >
                  Mark completed
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div>🧾</div>
          <h3>No requests yet</h3>
          <p>
            When you request an item or someone requests yours,
            it will appear here.
          </p>
        </div>
      )}
    </section>
  );
}

function Dashboard({items,requests,data}) {
  const rows=data?.byMode||[];
  return <section className="page-section"><div className="eyebrow muted">A LITTLE GOOD GOES A LONG WAY</div><h1>Campus <i>impact.</i></h1><p className="page-subtitle">Live activity from the ReUse Campus database.</p><div className="dashboard-stats"><div><span>Total listings</span><strong>{data?.totalListings??items.length}</strong><small>Across the marketplace</small></div><div><span>Available items</span><strong>{data?.availableItems??0}</strong><small>Ready for a new owner</small></div><div><span>Your listings</span><strong>{data?.myListings??0}</strong><small>Items you've added</small></div><div><span>Pending requests</span><strong>{data?.pendingRequests??0}</strong><small>Waiting for a response</small></div></div><div className="dashboard-bottom"><div className="dash-panel"><div className="panel-title">Ways to reuse <span>LIVE DATA</span></div>{["SELL","EXCHANGE","DONATE","BORROW"].map(m=>{const n=rows.find(x=>x.mode===m)?.count||0;const total=rows.reduce((a,x)=>a+x.count,0)||1;return <div className="bar-row" key={m}><span>{modeFromApi(m)}</span><div className="bar-track"><div className={`bar-fill bar-${m.toLowerCase()}`} style={{width:`${Math.max(4,n/total*100)}%`}}/></div><b>{n}</b></div>})}</div><div className="dash-message"><div className="message-icon"><Leaf size={20}/></div><h3>Every item deserves<br/>a second life.</h3><p>Share something useful today. Someone on campus might be looking for exactly that.</p></div></div></section>;
}
function CreateModal({onClose,onSubmit,busy}) {
  const [form,setForm]=useState({title:"",category:"Books",mode:"Sell",price:"",condition:"Good",description:"",image:null});
  const update=(k,v)=>setForm(x=>({...x,[k]:v}));
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><div className="eyebrow muted">GIVE IT A SECOND LIFE</div><h2>List an <i>item.</i></h2></div><button className="icon-button" onClick={onClose}><X/></button></div><form onSubmit={e=>{e.preventDefault();onSubmit(form);}} className="form-grid">
    <label className="field full">Item name<input required minLength="3" maxLength="90" value={form.title} onChange={e=>update("title",e.target.value)} placeholder="e.g. Engineering Mathematics textbook"/></label>
    <label className="field">Category<select value={form.category} onChange={e=>update("category",e.target.value)}>{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label>
    <label className="field">Reuse method<select value={form.mode} onChange={e=>update("mode",e.target.value)}>{modes.slice(1).map(m=><option key={m}>{m}</option>)}</select></label>
    {form.mode==="Sell"&&<label className="field">Price (₹)<input type="number" min="0" max="1000000" value={form.price} onChange={e=>update("price",e.target.value)} placeholder="e.g. 250"/></label>}
    <label className="field">Condition<select value={form.condition} onChange={e=>update("condition",e.target.value)}><option>Like new</option><option>Good</option><option>Used</option><option>Needs repair</option></select></label>
    <label className="field full">Description<textarea required minLength="5" maxLength="600" rows="3" value={form.description} onChange={e=>update("description",e.target.value)} placeholder="Add a few details about the item..."/></label>
    <label className="field full">Item photo (optional)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={e=>update("image",e.target.files?.[0]||null)}/><small className="upload-hint">JPG, PNG, WEBP or GIF · Maximum 4 MB</small></label>
    <div className="demo-notice full"><Sparkles size={15}/> Your listing will be saved to the PostgreSQL database.</div>
    <div className="modal-actions full"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={busy}><Plus size={16}/>{busy?" Publishing…":" Publish listing"}</button></div>
  </form></div></div>;
}
function EditModal({item,onClose,onSubmit,busy}) {
  const [form,setForm]=useState({title:item.title,category:item.category,mode:item.mode,price:String(item.price||0),condition:item.condition,description:item.description||"",location:item.location||"SRM AP Campus"});
  const update=(k,v)=>setForm(x=>({...x,[k]:v}));
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal"><div className="modal-head"><div><div className="eyebrow muted">KEEP YOUR LISTING CURRENT</div><h2>Edit <i>item.</i></h2></div><button className="icon-button" onClick={onClose}><X/></button></div><form onSubmit={e=>{e.preventDefault();onSubmit(form);}} className="form-grid">
    <label className="field full">Item name<input required minLength="3" maxLength="90" value={form.title} onChange={e=>update("title",e.target.value)}/></label>
    <label className="field">Category<select value={form.category} onChange={e=>update("category",e.target.value)}>{categories.slice(1).map(c=><option key={c}>{c}</option>)}</select></label>
    <label className="field">Reuse method<select value={form.mode} onChange={e=>update("mode",e.target.value)}>{modes.slice(1).map(m=><option key={m}>{m}</option>)}</select></label>
    {form.mode==="Sell"&&<label className="field">Price (₹)<input type="number" min="0" max="1000000" value={form.price} onChange={e=>update("price",e.target.value)}/></label>}
    <label className="field">Condition<select value={form.condition} onChange={e=>update("condition",e.target.value)}><option>Like new</option><option>Good</option><option>Used</option><option>Needs repair</option></select></label>
    <label className="field full">Description<textarea required minLength="5" maxLength="600" rows="3" value={form.description} onChange={e=>update("description",e.target.value)}/></label>
    <div className="modal-actions full"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={busy}>{busy?"Saving…":"Save changes"}</button></div>
  </form></div></div>;
}
function DetailModal({item,onClose,onRequest,busy,own}) {
  return <div className="modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&onClose()}><div className="modal detail-modal"><div className="modal-head"><div className="eyebrow muted">ITEM DETAILS</div><button className="icon-button" onClick={onClose}><X/></button></div><div className={`detail-visual item-visual ${item.tone}`}>{item.imageUrl?<img className="item-photo" src={`${API}${item.imageUrl}`} alt={item.title}/>:<span>{emojiFor(item)}</span>}<span className={`mode-tag mode-${item.mode.toLowerCase()}`}>{item.mode}</span></div><div className="detail-content"><div className="item-category">{item.category} · {item.condition}</div><h2>{item.title}</h2><div className="detail-price">{money(item.price)}</div><p>{item.description||"No additional description provided."}</p><div className="detail-owner"><span className="avatar">{item.initials}</span><div><strong>{item.owner}</strong><small><MapPin size={12}/> {item.location}</small></div><span className="posted">{item.posted}</span></div><div className="demo-notice"><MessageCircle size={15}/> Requests are stored in the database and appear in both students' request lists.</div><div className="modal-actions"><button className="secondary-button" onClick={onClose}>Close</button>{!own&&<button className="primary-button" disabled={busy} onClick={()=>onRequest(item)}><ArrowUpRight size={16}/> {busy?"Sending…":`Send ${item.mode.toLowerCase()} request`}</button>}</div></div></div></div>;
}

function ProfileModal({ user, mode, onClose, onSave, onPasswordChange }) {
  const [name, setName] = useState(user.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const isPassword = mode === "password";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (isPassword && newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (isPassword && newPassword.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setSaving(true);

    try {
      if (isPassword) {
        await onPasswordChange(currentPassword, newPassword);
      } else {
        await onSave(name.trim());
      }
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal profile-modal">
        <div className="modal-head">
          <div>
            <div className="eyebrow muted">YOUR ACCOUNT</div>
            <h2>
              {isPassword ? <>Change <i>password.</i></> : <>Your <i>profile.</i></>}
            </h2>
          </div>
          <button className="icon-button" onClick={onClose}>
            <X/>
          </button>
        </div>

        {!isPassword && (
          <div className="profile-summary">
            <div className="avatar profile-large">
              {initials(user.name)}
            </div>
            <div>
              <strong>{user.name}</strong>
              <small>ReUse Campus member</small>
            </div>
          </div>
        )}

        <form className="form-grid" onSubmit={handleSubmit}>
          {!isPassword ? (
            <>
              <label className="field full">
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>

              <label className="field full">
                Registered email
                <input
                  type="email"
                  value={user.email}
                  readOnly
                  disabled
                />
                <small className="upload-hint">
                  Your registered email cannot be changed here.
                </small>
              </label>
            </>
          ) : (
            <>
              <label className="field full">
                Current password
                <input
                  required
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </label>

              <label className="field full">
                New password
                <input
                  required
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>

              <label className="field full">
                Confirm new password
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </label>
            </>
          )}

          {error && <div className="auth-error full">{error}</div>}

          <div className="modal-actions full">
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="primary-button"
              disabled={saving}
            >
              {saving
                ? "Saving..."
                : isPassword
                  ? "Update password"
                  : "Save changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App/>);
