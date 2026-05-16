import { useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import i18n from "./i18n";

// ─── Config ──────────────────────────────────────────────────────────────────
// Change this to your deployed backend URL when hosting
const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const UPI_NUMBER = "9494646462";
const MONTHLY_AMOUNT = 100;
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function monthLabel(key) {
  if (!key) return "";
  const [y, m] = key.split("-");
  return `${MONTHS[parseInt(m)-1]} ${y}`;
}
function getMonthKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}`;
}
function getCurrentMonths(joinDate) {
  const months = [];
  const start = new Date(joinDate);
  const now = new Date();
  let d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d <= now) { months.push(getMonthKey(d)); d.setMonth(d.getMonth()+1); }
  return months;
}

// ─── API Client ───────────────────────────────────────────────────────────────
function getToken() { return localStorage.getItem("dargah_token"); }
async function apiFetch(path, opts = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...opts.headers },
    ...opts,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── UI Components ───────────────────────────────────────────────────────────
function Badge({ status }) {
  const map = {
    verified: { bg:"#d4edda", color:"#155724", label:"✓ Verified" },
    pending:  { bg:"#fff3cd", color:"#856404", label:"⏳ Pending" },
    rejected: { bg:"#f8d7da", color:"#721c24", label:"✗ Rejected" },
    unpaid:   { bg:"#f1f1f1", color:"#666",    label:"— Unpaid" },
  };
  const s = map[status] || map.unpaid;
  return <span style={{background:s.bg,color:s.color,border:`1px solid ${s.bg}`,borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:600}}>{s.label}</span>;
}

function Spinner() {
  return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:200}}>
    <div style={{width:36,height:36,border:"4px solid #e0f0e8",borderTop:"4px solid #1a6e4a",borderRadius:"50%",animation:"spin 0.8s linear infinite"}} />
    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
  </div>;
}

function Toast({ msg, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, []);
  return (
    <div style={{position:"fixed",top:20,right:20,zIndex:9999,background:type==="error"?"#dc3545":"#28a745",color:"#fff",borderRadius:10,padding:"12px 20px",fontSize:14,fontWeight:600,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",maxWidth:320}}>
      {type==="error"?"❌ ":"✅ "}{msg}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{background:"#fff",borderRadius:16,maxWidth:500,width:"100%",maxHeight:"90vh",overflow:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.3)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"18px 24px",borderBottom:"1px solid #e8f0ec"}}>
          <h3 style={{margin:0,color:"#1a3a2a",fontSize:18}}>{title}</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:24,cursor:"pointer",color:"#888"}}>×</button>
        </div>
        <div style={{padding:"20px 24px"}}>{children}</div>
      </div>
    </div>
  );
}

function Input({ label, required, ...props }) {
  return (
    <div style={{marginBottom:14}}>
      {label && <label style={{display:"block",marginBottom:5,fontSize:13,fontWeight:600,color:"#2d5a3d"}}>{label}{required&&<span style={{color:"#c0392b"}}> *</span>}</label>}
      <input {...props} style={{width:"100%",border:"1px solid #c8e0d4",borderRadius:8,padding:"9px 12px",fontSize:14,outline:"none",boxSizing:"border-box",background:"#fff",...props.style}} />
    </div>
  );
}

// ─── UPI QR ───────────────────────────────────────────────────────────────────
function UpiQR({ memberName = "" }) {
  const upiUrl = `upi://pay?pa=${UPI_NUMBER}@ybl&pn=Dargah+Donation&am=${MONTHLY_AMOUNT}&cu=INR&tn=Monthly+Donation+${encodeURIComponent(memberName)}`;
  return (
    <div style={{textAlign:"center",padding:20}}>
      <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(upiUrl)}`} alt="UPI QR" width={180} height={180} style={{border:"4px solid #1a3a2a",borderRadius:12,display:"block",margin:"0 auto"}} />
      <p style={{fontSize:12,color:"#5a7a6a",marginTop:8}}>Scan with PhonePe / GPay / Paytm</p>
      <div style={{background:"#eaf5f0",borderRadius:8,padding:"8px 16px",display:"inline-block",margin:"4px 0"}}>
        <strong style={{color:"#1a3a2a",fontSize:15}}>{UPI_NUMBER}</strong>
      </div>
      <br/>
      <a href={upiUrl} style={{display:"inline-block",marginTop:10,background:"#1a6e4a",color:"#fff",borderRadius:8,padding:"8px 20px",fontSize:13,textDecoration:"none",fontWeight:600}}>
        📱 Open UPI App
      </a>
    </div>
  );
}

// ─── Auth Page ────────────────────────────────────────────────────────────────
function AuthPage({ onLogin }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ name:"", mobile:"", address:"", upi_id:"", password:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const set = k => e => setForm(f => ({...f, [k]:e.target.value}));

  const submit = async () => {
    setLoading(true); setError("");
    try {
      const data = tab === "login"
        ? await apiFetch("/login", { method:"POST", body: JSON.stringify({ mobile:form.mobile, password:form.password }) })
        : await apiFetch("/register", { method:"POST", body: JSON.stringify(form) });
      localStorage.setItem("dargah_token", data.token);
      onLogin(data.user);
    } catch (e) { setError(e.message); }
    setLoading(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"linear-gradient(135deg,#0d2b1d 0%,#1a5c38 60%,#0d2b1d 100%)",display:"flex",alignItems:"center",justifyContent:"center",padding:16}}>
      <div style={{width:"100%",maxWidth:420}}>
        <div style={{textAlign:"center",marginBottom:28}}>
  <div style={{fontSize:52,marginBottom:8}}>☪️</div>

  <h1 style={{
      color:"#f0c040",
      margin:0,
      fontSize:28,
      fontFamily:"Georgia,serif"
  }}>
      Dargah Donation
  </h1>

  <p style={{
      color:"#a8d5b5",
      margin:"4px 0 0",
      fontSize:13
  }}>
      Monthly Contribution — ₹100/month to {UPI_NUMBER}
  </p>

  {/* Language buttons */}
  <div style={{marginTop:15}}>
      <button
      onClick={()=>i18n.changeLanguage("te")}
      style={{
          marginRight:10,
          padding:"6px 12px",
          borderRadius:"6px",
          border:"none",
          cursor:"pointer"
      }}
      >
          తెలుగు
      </button>

      <button
      onClick={()=>i18n.changeLanguage("en")}
      style={{
          padding:"6px 12px",
          borderRadius:"6px",
          border:"none",
          cursor:"pointer"
      }}
      >
          English
      </button>
  </div>
</div>
        <div style={{background:"#fff",borderRadius:20,padding:28,boxShadow:"0 24px 64px rgba(0,0,0,0.4)"}}>
          <div style={{display:"flex",marginBottom:24,background:"#f0f7f3",borderRadius:10,padding:4}}>
            {["login","register"].map(t => (
              <button key={t} onClick={() => { setTab(t); setError(""); }}
                style={{flex:1,padding:"9px 0",border:"none",borderRadius:8,cursor:"pointer",fontWeight:600,fontSize:14,background:tab===t?"#1a6e4a":"transparent",color:tab===t?"#fff":"#2d5a3d",transition:"all .2s"}}>
                {t==="login"?"Login":"Register"}
              </button>
            ))}
          </div>
          {tab==="login" ? (
            <>
              <Input label="Mobile Number" required placeholder="10-digit mobile" value={form.mobile} onChange={set("mobile")} type="tel" />
              <Input label="Password" required placeholder="Your password" value={form.password} onChange={set("password")} type="password" />
            </>
          ) : (
            <>
              <Input label="Full Name" required placeholder="Your full name" value={form.name} onChange={set("name")} />
              <Input label="Mobile Number" required placeholder="10-digit mobile" value={form.mobile} onChange={set("mobile")} type="tel" />
              <Input label="Address" required placeholder="Your address" value={form.address} onChange={set("address")} />
              <Input label="UPI ID (optional)" placeholder="e.g. name@gpay" value={form.upi_id} onChange={set("upi_id")} />
              <Input label="Password" required placeholder="Create a password" value={form.password} onChange={set("password")} type="password" />
            </>
          )}
          {error && <p style={{color:"#c0392b",fontSize:13,marginBottom:12,background:"#ffeaea",padding:"8px 12px",borderRadius:7}}>{error}</p>}
          <button onClick={submit} disabled={loading}
            style={{width:"100%",background:loading?"#aaa":"#1a6e4a",color:"#fff",border:"none",borderRadius:10,padding:12,fontSize:15,fontWeight:700,cursor:loading?"not-allowed":"pointer"}}>
            {loading ? "Please wait..." : tab==="login" ? "Login →" : "Register ✓"}
          </button>
          {tab==="login" && <p style={{textAlign:"center",marginTop:10,fontSize:12,color:"#888"}}>Admin: 9001447689 / admin123</p>}
        </div>
      </div>
    </div>
  );
}

// ─── User Dashboard ───────────────────────────────────────────────────────────
function UserDashboard({ user, onLogout }) {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showPay, setShowPay]   = useState(false);
  const [payMonth, setPayMonth] = useState(getMonthKey());
  const [utr, setUtr]           = useState("");
  const [note, setNote]         = useState("");
  const [file, setFile]         = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]       = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setPayments(await apiFetch("/payments")); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const myMonths   = getCurrentMonths(user.join_date);
  const paidSet    = new Set(payments.filter(p=>p.status==="verified").map(p=>p.month));
  const pendingSet = new Set(payments.filter(p=>p.status==="pending").map(p=>p.month));
  const unpaid     = myMonths.filter(m=>!paidSet.has(m)&&!pendingSet.has(m));
  const dueAmount  = unpaid.length * MONTHLY_AMOUNT;
  const totalPaid  = paidSet.size * MONTHLY_AMOUNT;

  const submitPayment = async () => {
    if (!utr) { setToast({ msg:"Please enter UTR/Transaction ID", type:"error" }); return; }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("month", payMonth); fd.append("utr", utr); fd.append("note", note);
      if (file) fd.append("screenshot", file);
      const token = getToken();
      const res = await fetch(`${API}/payments`, { method:"POST", headers:{ Authorization:`Bearer ${token}` }, body:fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ msg:"Payment submitted! Awaiting admin verification.", type:"success" });
      setShowPay(false); setUtr(""); setNote(""); setFile(null);
      load();
    } catch(e) { setToast({ msg:e.message, type:"error" }); }
    setSubmitting(false);
  };

  return (
    <div style={{minHeight:"100vh",background:"#f5f9f6"}}>
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
      <div style={{background:"linear-gradient(135deg,#1a3a2a,#2d6e4a)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:22}}>☪️</span>
          <div>
            <div style={{color:"#f0c040",fontWeight:700,fontSize:16,fontFamily:"Georgia,serif"}}>Dargah Donation</div>
            <div style={{color:"#a8d5b5",fontSize:12}}>Assalamu Alaikum, {user.name}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13}}>Logout</button>
      </div>

      <div style={{maxWidth:640,margin:"0 auto",padding:16}}>
        {/* Stats */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginBottom:20}}>
          {[
            {label:"Total Paid",value:`₹${totalPaid}`,bg:"#d4edda",color:"#155724",icon:"✓"},
            {label:"Pending Dues",value:`₹${dueAmount}`,bg:dueAmount?"#fff3cd":"#d4edda",color:dueAmount?"#856404":"#155724",icon:"⏳"},
            {label:"Months",value:myMonths.length,bg:"#d1ecf1",color:"#0c5460",icon:"📅"},
          ].map((s,i)=>(
            <div key={i} style={{background:s.bg,borderRadius:12,padding:"14px 10px",textAlign:"center"}}>
              <div style={{fontSize:20}}>{s.icon}</div>
              <div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</div>
              <div style={{fontSize:11,color:s.color,opacity:0.8}}>{s.label}</div>
            </div>
          ))}
        </div>

        {dueAmount > 0 && (
          <div style={{background:"#fff8e1",border:"1px solid #ffc107",borderRadius:12,padding:16,marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div>
              <div style={{fontWeight:700,color:"#856404",fontSize:15}}>⚠️ Dues Pending: ₹{dueAmount}</div>
              <div style={{color:"#856404",fontSize:13,marginTop:2}}>{unpaid.slice(0,3).map(monthLabel).join(", ")}{unpaid.length>3?` +${unpaid.length-3} more`:""}</div>
            </div>
            <button onClick={()=>setShowPay(true)} style={{background:"#1a6e4a",color:"#fff",border:"none",borderRadius:8,padding:"9px 18px",cursor:"pointer",fontWeight:700,fontSize:14}}>Pay Now</button>
          </div>
        )}

        {/* Payment History */}
        <div style={{background:"#fff",border:"1px solid #c8e0d4",borderRadius:14,overflow:"hidden",marginBottom:16}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid #e8f0ec",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontWeight:700,color:"#1a3a2a",fontSize:16}}>Payment History</span>
            <button onClick={()=>setShowPay(true)} style={{background:"#1a6e4a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontWeight:600,fontSize:13}}>+ Submit Payment</button>
          </div>
          {loading ? <Spinner /> : myMonths.length === 0 ? (
            <p style={{padding:20,color:"#888",textAlign:"center"}}>No months tracked yet.</p>
          ) : (
            <div style={{overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#f0f7f3"}}>
                    {["Month","Amount","Status","UTR / Transaction"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:12,fontWeight:700,color:"#2d5a3d",borderBottom:"1px solid #e8f0ec"}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {[...myMonths].reverse().map(month=>{
                    const p = payments.find(p=>p.month===month);
                    return (
                      <tr key={month} style={{borderBottom:"1px solid #f0f4f1"}}>
                        <td style={{padding:"10px 14px",fontSize:14,fontWeight:500,color:"#1a3a2a"}}>{monthLabel(month)}</td>
                        <td style={{padding:"10px 14px",fontSize:14}}>₹{MONTHLY_AMOUNT}</td>
                        <td style={{padding:"10px 14px"}}><Badge status={p?p.status:"unpaid"} /></td>
                        <td style={{padding:"10px 14px",fontSize:12,color:"#888",fontFamily:"monospace"}}>{p?.utr||"—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* QR */}
        <div style={{background:"#fff",border:"1px solid #c8e0d4",borderRadius:14}}>
          <div style={{padding:"14px 18px",borderBottom:"1px solid #e8f0ec"}}><h3 style={{margin:0,color:"#1a3a2a",fontSize:16}}>Pay via UPI</h3></div>
          <UpiQR memberName={user.name} />
        </div>
      </div>

      {showPay && (
        <Modal title="Submit Payment Proof" onClose={()=>setShowPay(false)}>
          <div style={{marginBottom:14}}>
            <label style={{display:"block",marginBottom:5,fontSize:13,fontWeight:600,color:"#2d5a3d"}}>Select Month <span style={{color:"#c0392b"}}>*</span></label>
            <select value={payMonth} onChange={e=>setPayMonth(e.target.value)} style={{width:"100%",border:"1px solid #c8e0d4",borderRadius:8,padding:"9px 12px",fontSize:14}}>
              {unpaid.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>
          <div style={{background:"#f0f7f3",borderRadius:10,padding:14,marginBottom:14,textAlign:"center"}}>
            <div style={{fontSize:13,color:"#2d5a3d"}}>Transfer ₹{MONTHLY_AMOUNT} to</div>
            <div style={{fontWeight:700,fontSize:20,color:"#1a3a2a",margin:"4px 0"}}>{UPI_NUMBER}</div>
            <div style={{fontSize:12,color:"#5a7a6a"}}>PhonePe / GPay / Paytm / Any UPI</div>
          </div>
          <Input label="UTR / Transaction ID" required placeholder="12-digit transaction ID" value={utr} onChange={e=>setUtr(e.target.value)} />
          <Input label="Note (optional)" placeholder="Any additional info" value={note} onChange={e=>setNote(e.target.value)} />
          <div style={{marginBottom:14}}>
            <label style={{display:"block",marginBottom:5,fontSize:13,fontWeight:600,color:"#2d5a3d"}}>Payment Screenshot (optional)</label>
            <input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])} style={{fontSize:13,width:"100%"}} />
          </div>
          <button onClick={submitPayment} disabled={submitting}
            style={{width:"100%",background:submitting?"#aaa":"#1a6e4a",color:"#fff",border:"none",borderRadius:10,padding:12,fontSize:15,fontWeight:700,cursor:submitting?"not-allowed":"pointer"}}>
            {submitting?"Submitting...":"Submit for Verification"}
          </button>
        </Modal>
      )}
    </div>
  );
}

// ─── Admin Dashboard ──────────────────────────────────────────────────────────
function AdminDashboard({ user, onLogout }) {
  const [tab, setTab]         = useState("overview");
  const [members, setMembers] = useState([]);
  const [payments, setPayments] = useState([]);
  const [stats, setStats]     = useState({});
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newM, setNewM]       = useState({ name:"", mobile:"", address:"", upi_id:"", password:"member123" });
  const [filter, setFilter]   = useState("all");
  const [aiReport, setAiReport] = useState("");
  const [loadingAi, setLoadingAi] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [m, p, s, mo] = await Promise.all([
        apiFetch("/members"), apiFetch("/payments"), apiFetch("/stats"), apiFetch("/reports/monthly")
      ]);
      setMembers(m); setPayments(p); setStats(s); setMonthly(mo);
    } catch(e) { setToast({ msg:e.message, type:"error" }); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const verify = async (pid) => {
    try { await apiFetch(`/payments/${pid}/verify`, { method:"POST" }); load(); setToast({ msg:"Payment verified!", type:"success" }); }
    catch(e) { setToast({ msg:e.message, type:"error" }); }
  };
  const reject = async (pid) => {
    try { await apiFetch(`/payments/${pid}/reject`, { method:"POST" }); load(); setToast({ msg:"Payment rejected.", type:"error" }); }
    catch(e) { setToast({ msg:e.message, type:"error" }); }
  };
  const deleteMember = async (mid, name) => {
    if (!confirm(`Delete member "${name}" and all their records?`)) return;
    try { await apiFetch(`/members/${mid}`, { method:"DELETE" }); load(); setToast({ msg:"Member deleted.", type:"success" }); }
    catch(e) { setToast({ msg:e.message, type:"error" }); }
  };
  const addMember = async () => {
    if (!newM.name||!newM.mobile||!newM.address) { setToast({ msg:"Fill all required fields.", type:"error" }); return; }
    try { await apiFetch("/members", { method:"POST", body:JSON.stringify(newM) }); load(); setShowAdd(false); setNewM({ name:"",mobile:"",address:"",upi_id:"",password:"member123" }); setToast({ msg:"Member added!", type:"success" }); }
    catch(e) { setToast({ msg:e.message, type:"error" }); }
  };

  const generateAiReport = async () => {
    setLoadingAi(true); setAiReport("");
    const withDues = members.filter(m=>m.due_amount>0).map(m=>`${m.name} (₹${m.due_amount})`).join(", ");
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1000, messages:[{
          role:"user", content:`Generate an admin report for Dargah donation management. Stats: Total members: ${stats.total_members}, Paid this month: ${stats.verified_this_month}, Pending verification: ${stats.pending_verification}, Total collected: ₹${stats.total_collected}. Members with dues: ${withDues||"None"}. Write in bullet points, professional and Islamic-toned, under 120 words.`
        }]})
      });
      const data = await res.json();
      setAiReport(data.content?.[0]?.text || "Report unavailable.");
    } catch { setAiReport(`• Total collected: ₹${stats.total_collected}\n• Members with dues need follow-up\n• Verify ${stats.pending_verification} pending payments`); }
    setLoadingAi(false);
  };

  const exportCSV = () => {
    const rows = [["Name","Mobile","Address","Total Paid","Dues"]];
    members.forEach(m => rows.push([m.name, m.mobile, m.address, `Rs.${m.total_paid}`, `Rs.${m.due_amount}`]));
    const blob = new Blob([rows.map(r=>r.join(",")).join("\n")], { type:"text/csv" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="dargah_report.csv"; a.click();
  };

  const pendingPayments = payments.filter(p=>p.status==="pending");
  const filteredMembers = filter==="unpaid" ? members.filter(m=>m.due_amount>0)
    : filter==="pending" ? members.filter(m=>payments.some(p=>p.member_id===m.id&&p.status==="pending"))
    : members;

  return (
    <div style={{minHeight:"100vh",background:"#f5f9f6"}}>
      {toast && <Toast {...toast} onClose={()=>setToast(null)} />}
      <div style={{background:"linear-gradient(135deg,#1a3a2a,#2d6e4a)",padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:22}}>☪️</span>
          <div>
            <div style={{color:"#f0c040",fontWeight:700,fontSize:16,fontFamily:"Georgia,serif"}}>Admin Panel</div>
            <div style={{color:"#a8d5b5",fontSize:12}}>Dargah Donation Management</div>
          </div>
        </div>
        <button onClick={onLogout} style={{background:"rgba(255,255,255,0.15)",border:"1px solid rgba(255,255,255,0.3)",color:"#fff",borderRadius:8,padding:"6px 14px",cursor:"pointer",fontSize:13}}>Logout</button>
      </div>

      <div style={{background:"#fff",borderBottom:"1px solid #e8f0ec",overflowX:"auto"}}>
        <div style={{display:"flex",maxWidth:940,margin:"0 auto"}}>
          {[["overview","📊 Overview"],["members","👥 Members"],["payments","💰 Payments"],["reports","📋 Reports"]].map(([key,label])=>(
            <button key={key} onClick={()=>setTab(key)} style={{padding:"14px 20px",border:"none",background:"none",cursor:"pointer",fontWeight:600,fontSize:14,color:tab===key?"#1a6e4a":"#666",borderBottom:tab===key?"3px solid #1a6e4a":"3px solid transparent",whiteSpace:"nowrap"}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:940,margin:"0 auto",padding:16}}>
        {loading ? <Spinner /> : (
          <>
            {/* Overview */}
            {tab==="overview" && (
              <>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:20}}>
                  {[
                    {label:"Total Members",value:stats.total_members,bg:"#d1ecf1",color:"#0c5460",icon:"👥"},
                    {label:"Paid This Month",value:stats.verified_this_month,bg:"#d4edda",color:"#155724",icon:"✓"},
                    {label:"Pending Verify",value:stats.pending_verification,bg:stats.pending_verification?"#fff3cd":"#d4edda",color:stats.pending_verification?"#856404":"#155724",icon:"⏳"},
                    {label:"Total Collected",value:`₹${stats.total_collected}`,bg:"#d4edda",color:"#155724",icon:"💰"},
                  ].map((s,i)=>(
                    <div key={i} style={{background:s.bg,borderRadius:12,padding:16,textAlign:"center"}}>
                      <div style={{fontSize:24}}>{s.icon}</div>
                      <div style={{fontSize:22,fontWeight:700,color:s.color}}>{s.value}</div>
                      <div style={{fontSize:12,color:s.color,opacity:0.8}}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {pendingPayments.length > 0 && (
                  <div style={{background:"#fff",border:"1px solid #ffc107",borderRadius:14,padding:16,marginBottom:16}}>
                    <h3 style={{margin:"0 0 12px",color:"#856404",fontSize:15}}>⚠️ Awaiting Verification ({pendingPayments.length})</h3>
                    {pendingPayments.slice(0,5).map(p=>{
                      const m = members.find(m=>m.id===p.member_id);
                      return (
                        <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:"1px solid #f5f5f5",gap:8,flexWrap:"wrap"}}>
                          <div>
                            <div style={{fontWeight:600,fontSize:14,color:"#1a3a2a"}}>{m?.name}</div>
                            <div style={{fontSize:12,color:"#888"}}>{monthLabel(p.month)} • UTR: <code>{p.utr}</code> • {p.submitted_at?.slice(0,10)}</div>
                          </div>
                          <div style={{display:"flex",gap:8}}>
                            {p.screenshot && <a href={`${API.replace("/api","")}/api/uploads/${p.screenshot}`} target="_blank" style={{background:"#17a2b8",color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600,textDecoration:"none"}}>📷</a>}
                            <button onClick={()=>verify(p.id)} style={{background:"#28a745",color:"#fff",border:"none",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:12,fontWeight:600}}>✓ Verify</button>
                            <button onClick={()=>reject(p.id)} style={{background:"#dc3545",color:"#fff",border:"none",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>✗</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={{background:"#fff",border:"1px solid #c8e0d4",borderRadius:14,padding:18}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <h3 style={{margin:0,color:"#1a3a2a",fontSize:16}}>✨ AI Admin Report</h3>
                    <button onClick={generateAiReport} disabled={loadingAi} style={{background:"#1a6e4a",color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",cursor:"pointer",fontSize:13,fontWeight:600}}>
                      {loadingAi?"Generating...":"Generate Report"}
                    </button>
                  </div>
                  {aiReport ? <pre style={{margin:0,fontSize:13,color:"#2d5a3d",whiteSpace:"pre-wrap",lineHeight:1.7,background:"#f0f7f3",borderRadius:8,padding:12,fontFamily:"inherit"}}>{aiReport}</pre>
                    : <p style={{color:"#888",margin:0,fontSize:13}}>Click "Generate Report" for an AI-powered collection summary.</p>}
                </div>
              </>
            )}

            {/* Members */}
            {tab==="members" && (
              <div style={{background:"#fff",border:"1px solid #c8e0d4",borderRadius:14,overflow:"hidden"}}>
                <div style={{padding:"14px 18px",borderBottom:"1px solid #e8f0ec",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {["all","unpaid","pending"].map(f=>(
                      <button key={f} onClick={()=>setFilter(f)} style={{background:filter===f?"#1a6e4a":"#f0f7f3",color:filter===f?"#fff":"#2d5a3d",border:"1px solid #c8e0d4",borderRadius:7,padding:"6px 14px",cursor:"pointer",fontSize:13,fontWeight:600}}>
                        {f==="all"?"All Members":f==="unpaid"?"Has Dues":"Pending Verify"}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>setShowAdd(true)} style={{background:"#1a6e4a",color:"#fff",border:"none",borderRadius:8,padding:"8px 14px",cursor:"pointer",fontWeight:600,fontSize:13}}>+ Add Member</button>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:600}}>
                    <thead>
                      <tr style={{background:"#f0f7f3"}}>
                        {["Name","Mobile","Address","Total Paid","Dues","Action"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:12,fontWeight:700,color:"#2d5a3d",borderBottom:"1px solid #e8f0ec",whiteSpace:"nowrap"}}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMembers.map(m=>(
                        <tr key={m.id} style={{borderBottom:"1px solid #f0f4f1"}}>
                          <td style={{padding:"10px 14px",fontWeight:600,fontSize:14,color:"#1a3a2a"}}>{m.name}</td>
                          <td style={{padding:"10px 14px",fontSize:13,color:"#555"}}>{m.mobile}</td>
                          <td style={{padding:"10px 14px",fontSize:12,color:"#888",maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.address}</td>
                          <td style={{padding:"10px 14px",fontWeight:600,color:"#155724"}}>₹{m.total_paid}</td>
                          <td style={{padding:"10px 14px",fontWeight:700,color:m.due_amount>0?"#dc3545":"#155724"}}>₹{m.due_amount}</td>
                          <td style={{padding:"10px 14px"}}>
                            <button onClick={()=>deleteMember(m.id,m.name)} style={{background:"#f8d7da",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",color:"#721c24",fontSize:12,fontWeight:600}}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Payments */}
            {tab==="payments" && (
              <div style={{background:"#fff",border:"1px solid #c8e0d4",borderRadius:14,overflow:"hidden"}}>
                <div style={{padding:"14px 18px",borderBottom:"1px solid #e8f0ec"}}>
                  <h3 style={{margin:0,color:"#1a3a2a",fontSize:16}}>All Payment Submissions</h3>
                </div>
                <div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:700}}>
                    <thead>
                      <tr style={{background:"#f0f7f3"}}>
                        {["Member","Month","Amount","UTR","Screenshot","Date","Status","Actions"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:12,fontWeight:700,color:"#2d5a3d",borderBottom:"1px solid #e8f0ec",whiteSpace:"nowrap"}}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p=>{
                        const m=members.find(m=>m.id===p.member_id);
                        return (
                          <tr key={p.id} style={{borderBottom:"1px solid #f0f4f1"}}>
                            <td style={{padding:"10px 14px",fontWeight:600,fontSize:14,color:"#1a3a2a"}}>{m?.name||"—"}</td>
                            <td style={{padding:"10px 14px",fontSize:13}}>{monthLabel(p.month)}</td>
                            <td style={{padding:"10px 14px",fontWeight:600,color:"#155724"}}>₹{p.amount}</td>
                            <td style={{padding:"10px 14px",fontSize:12,color:"#888",fontFamily:"monospace"}}>{p.utr}</td>
                            <td style={{padding:"10px 14px"}}>
                              {p.screenshot ? <a href={`${API.replace("/api","")}/api/uploads/${p.screenshot}`} target="_blank" style={{color:"#1a6e4a",fontSize:12,fontWeight:600}}>View</a> : "—"}
                            </td>
                            <td style={{padding:"10px 14px",fontSize:12,color:"#888"}}>{p.submitted_at?.slice(0,10)}</td>
                            <td style={{padding:"10px 14px"}}><Badge status={p.status} /></td>
                            <td style={{padding:"10px 14px"}}>
                              {p.status==="pending" && (
                                <div style={{display:"flex",gap:6}}>
                                  <button onClick={()=>verify(p.id)} style={{background:"#28a745",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>✓</button>
                                  <button onClick={()=>reject(p.id)} style={{background:"#dc3545",color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:12,fontWeight:600}}>✗</button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reports */}
            {tab==="reports" && (
              <>
                <div style={{display:"flex",gap:12,marginBottom:16,flexWrap:"wrap"}}>
                  <button onClick={exportCSV} style={{background:"#1a6e4a",color:"#fff",border:"none",borderRadius:8,padding:"10px 18px",cursor:"pointer",fontWeight:600,fontSize:14}}>📥 Export CSV</button>
                </div>
                <div style={{background:"#fff",border:"1px solid #c8e0d4",borderRadius:14,overflow:"hidden",marginBottom:16}}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #e8f0ec"}}><h3 style={{margin:0,color:"#1a3a2a",fontSize:16}}>Monthly Collection</h3></div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse"}}>
                      <thead>
                        <tr style={{background:"#f0f7f3"}}>
                          {["Month","Paid","Pending","Collected"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:12,fontWeight:700,color:"#2d5a3d",borderBottom:"1px solid #e8f0ec"}}>{h}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {monthly.map(r=>(
                          <tr key={r.month} style={{borderBottom:"1px solid #f0f4f1"}}>
                            <td style={{padding:"10px 14px",fontWeight:600,color:"#1a3a2a"}}>{monthLabel(r.month)}</td>
                            <td style={{padding:"10px 14px",color:"#155724",fontWeight:600}}>{r.paid}</td>
                            <td style={{padding:"10px 14px",color:"#856404",fontWeight:600}}>{r.pending}</td>
                            <td style={{padding:"10px 14px",color:"#155724",fontWeight:700}}>₹{r.collected}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div style={{background:"#fff",border:"1px solid #c8e0d4",borderRadius:14,overflow:"hidden"}}>
                  <div style={{padding:"14px 18px",borderBottom:"1px solid #e8f0ec"}}><h3 style={{margin:0,color:"#1a3a2a",fontSize:16}}>Members with Dues</h3></div>
                  {members.filter(m=>m.due_amount>0).length===0
                    ? <p style={{padding:20,textAlign:"center",color:"#28a745",fontWeight:600}}>🎉 All members are up to date!</p>
                    : <div style={{overflowX:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse"}}>
                          <thead><tr style={{background:"#f0f7f3"}}>{["Member","Mobile","Dues"].map(h=><th key={h} style={{padding:"10px 14px",textAlign:"left",fontSize:12,fontWeight:700,color:"#2d5a3d",borderBottom:"1px solid #e8f0ec"}}>{h}</th>)}</tr></thead>
                          <tbody>
                            {members.filter(m=>m.due_amount>0).map(m=>(
                              <tr key={m.id} style={{borderBottom:"1px solid #f0f4f1"}}>
                                <td style={{padding:"10px 14px",fontWeight:600,fontSize:14,color:"#1a3a2a"}}>{m.name}</td>
                                <td style={{padding:"10px 14px",fontSize:13,color:"#555"}}>{m.mobile}</td>
                                <td style={{padding:"10px 14px",fontSize:16,fontWeight:700,color:"#dc3545"}}>₹{m.due_amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {showAdd && (
        <Modal title="Add New Member" onClose={()=>setShowAdd(false)}>
          <Input label="Full Name" required value={newM.name} onChange={e=>setNewM(f=>({...f,name:e.target.value}))} />
          <Input label="Mobile Number" required value={newM.mobile} onChange={e=>setNewM(f=>({...f,mobile:e.target.value}))} type="tel" />
          <Input label="Address" required value={newM.address} onChange={e=>setNewM(f=>({...f,address:e.target.value}))} />
          <Input label="UPI ID (optional)" value={newM.upi_id} onChange={e=>setNewM(f=>({...f,upi_id:e.target.value}))} />
          <Input label="Default Password" value={newM.password} onChange={e=>setNewM(f=>({...f,password:e.target.value}))} />
          <button onClick={addMember} style={{width:"100%",background:"#1a6e4a",color:"#fff",border:"none",borderRadius:10,padding:12,fontSize:15,fontWeight:700,cursor:"pointer"}}>Add Member ✓</button>
        </Modal>
      )}
    </div>
  );
}

// ─── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (token) {
      apiFetch("/me").then(u => setUser(u)).catch(() => localStorage.removeItem("dargah_token")).finally(() => setChecking(false));
    } else { setChecking(false); }
  }, []);

  const handleLogout = () => { localStorage.removeItem("dargah_token"); setUser(null); };

  if (checking) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#f5f9f6"}}>
      <div style={{textAlign:"center"}}><div style={{fontSize:40,marginBottom:12}}>☪️</div><Spinner /></div>
    </div>
  );

  if (!user) return <AuthPage onLogin={setUser} />;
  if (user.role==="admin") return <AdminDashboard user={user} onLogout={handleLogout} />;
  return <UserDashboard user={user} onLogout={handleLogout} />;
}
