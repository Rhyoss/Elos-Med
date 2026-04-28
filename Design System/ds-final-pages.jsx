// ds-final-pages.jsx — All 8 ElosMed modules (Quite Clear theme)

// ─── NAV ITEMS ───────────────────────────────────────────────────
const NAV = [
  { id:"dashboard", label:"Dashboard", icon:"grid", mod:null },
  { id:"agenda", label:"Agenda", icon:"calendar", mod:"clinical" },
  { id:"pacientes", label:"Pacientes", icon:"user", mod:"clinical" },
  { id:"comunicacoes", label:"Comunic.", icon:"message", mod:"aiMod" },
  { id:"suprimentos", label:"Suprim.", icon:"box", mod:"supply" },
  { id:"financeiro", label:"Financeiro", icon:"creditCard", mod:"financial" },
  { id:"analytics", label:"Analytics", icon:"barChart", mod:null },
  { id:"config", label:"Config.", icon:"settings", mod:null },
];

// ─── 1. DASHBOARD ────────────────────────────────────────────────
function PgDashboard() {
  const alerts = [
    { msg:"Mariana Costa", color:T.warning, icon:"alert" },
    { msg:"Estoque crítico: Toxina Botulínica (4 unid.)", color:T.ai, icon:"zap" },
    { msg:"Fatura #F-0091 vencida há 3 dias", color:T.danger, icon:"creditCard" },
  ];
  const appts = [
    { time:"09:30", name:"Mariana Costa", type:"Botox 100U", mod:"supply", s:"success", status:"Confirmado" },
    { time:"11:00", name:"João Ferreira", type:"Lesão IA", mod:"aiMod", s:"default", status:"Aguardando" },
    { time:"14:00", name:"Mariana Costa", type:"Protocolo rejuv.", mod:"clinical", s:"success", status:"Confirmado" },
    { time:"15:00", name:"Pedro Gomes", type:"Revisão prescrição", mod:"clinical", s:"warning", status:"Pendente" },
  ];
  return (
    <div style={{ overflowY:"auto", height:"100%", padding:"22px 26px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div><Mono size={9} spacing="1.3px">21 JANEIRO 2026 · QUARTA-FEIRA</Mono><h2 style={{ fontSize:20, fontWeight:700, color:T.textPrimary, marginTop:3 }}>Dashboard</h2></div>
        <Btn small icon="activity">Relatório</Btn>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:18 }}>
        <Stat label="Consultas" value="14" sub="+2 em espera" icon="calendar" mod="clinical" pct={70} />
        <Stat label="Receita" value="14" sub="Meta: R$ 10k" icon="creditCard" mod="financial" pct={84} />
        <Stat label="Alertas IA" value="3" sub="2 críticos" icon="zap" mod="aiMod" pct={30} />
        <Stat label="Estoque" value="7 alertas" sub="+2 em espera" icon="box" mod="supply" pct={55} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
        <Glass style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.divider}`, display:"flex", alignItems:"center", gap:7 }}>
            <Ico name="calendar" size={14} color={T.clinical.color} /><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Agenda de Hoje</span>
          </div>
          {appts.map((a,i) => {
            const m = T[a.mod];
            return (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", borderBottom:i<appts.length-1?`1px solid ${T.divider}`:"none" }}>
                <Mono size={9}>{a.time}</Mono>
                <div style={{ width:3, height:28, borderRadius:2, background:m.color }} />
                <div style={{ flex:1, minWidth:0 }}><p style={{ fontSize:12, fontWeight:600, color:T.textPrimary, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.name}</p><p style={{ fontSize:10, color:T.textTertiary }}>{a.type}</p></div>
                <Badge variant={a.s} dot={false}>{a.status}</Badge>
              </div>
            );
          })}
        </Glass>
        <Glass style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.divider}`, display:"flex", alignItems:"center", gap:7 }}>
            <Ico name="alert" size={14} color={T.danger} /><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Alertas Críticos</span>
          </div>
          {alerts.map((a,i) => (
            <div key={i} style={{ display:"flex", alignItems:"flex-start", gap:9, padding:"10px 16px", borderBottom:i<alerts.length-1?`1px solid ${T.divider}`:"none" }}>
              <div style={{ width:26, height:26, borderRadius:T.r.sm, background:a.color+"0F", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Ico name={a.icon} size={13} color={a.color} /></div>
              <p style={{ fontSize:11, color:T.textSecondary, lineHeight:1.5 }}>{a.msg}</p>
            </div>
          ))}
        </Glass>
        <Glass style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"12px 16px", borderBottom:`1px solid ${T.divider}`, display:"flex", alignItems:"center", gap:7 }}>
            <Ico name="message" size={14} color={T.aiMod.color} /><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Comunicações</span>
          </div>
          {[
            { name:"Sandra Ramos", ch:"WhatsApp", msg:"Confirmar consulta amanhã 10h.", time:"14:32" },
            { name:"Lucas Teixeira", ch:"Instagram", msg:"Tratamento para manchas?", time:"13:15" },
            { name:"Beatriz Viana", ch:"Email", msg:"Solicito resultado dos exames.", time:"11:48" },
          ].map((m,i) => (
            <div key={i} style={{ padding:"10px 16px", borderBottom:i<2?`1px solid ${T.divider}`:"none" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}><span style={{ fontSize:12, fontWeight:600, color:T.textPrimary }}>{m.name}</span><Mono size={8}>{m.time}</Mono></div>
              <div style={{ display:"flex", gap:5, alignItems:"center" }}><span style={{ fontSize:8, padding:"1px 5px", borderRadius:3, background:T.primaryBg, color:T.primary, fontFamily:"'IBM Plex Mono',monospace" }}>{m.ch}</span><span style={{ fontSize:10, color:T.textMuted, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{m.msg}</span></div>
            </div>
          ))}
        </Glass>
      </div>
    </div>
  );
}

// ─── 2. AGENDA ───────────────────────────────────────────────────
const APPTS = [
  { h:"08:00", dur:60, name:"Ana Clara Mendes", type:"Consulta dermatológica", s:"success", st:"Confirmado", crm:"DR. LIMA", mod:"clinical", id:"PAC-0847" },
  { h:"09:00", dur:30, name:"Roberto Alves", type:"Retorno acne", s:"warning", st:"Aguardando", crm:"DR. LIMA", mod:"clinical", id:"PAC-0848" },
  { h:"09:30", dur:60, name:"Mariana Costa", type:"Aplicação botox 100U", s:"default", st:"Em sala", crm:"DRA. SOUZA", mod:"supply", id:"PAC-0849" },
  { h:"11:00", dur:45, name:"João Ferreira", type:"Análise lesão IA", s:"success", st:"Confirmado", crm:"DR. LIMA", mod:"aiMod", id:"PAC-0851" },
  { h:"14:00", dur:60, name:"Carla Nunes", type:"Protocolo rejuvenescimento", s:"success", st:"Confirmado", crm:"DRA. SOUZA", mod:"clinical", id:"PAC-0853" },
  { h:"15:00", dur:30, name:"Pedro Gomes", type:"Revisão prescrição", s:"warning", st:"Pendente", crm:"DR. LIMA", mod:"clinical", id:"PAC-0855" },
];
const HOURS = ["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"];
const WEEKD = ["Seg 19","Ter 20","Qua 21","Qui 22","Sex 23","Sáb 24"];
const WEEKC = [1,2,7,3,4,1];

function MiniCalendar({ year, month, selectedDay, onDayClick, onMonthChange }) {
  const MONTH_NAMES = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const WDAYS = ["D","S","T","Q","Q","S","S"];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays = new Date(year, month, 0).getDate();
  // Days with appointments (mock)
  const apptDays = new Set([2,5,8,10,14,15,19,20,21,22,26,28]);
  const today = 21; // mock today

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: prevDays - firstDay + 1 + i, outside: true });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, outside: false });
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) cells.push({ day: i, outside: true });

  return (
    <div>
      {/* Month navigation */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <button onClick={()=>onMonthChange(-1)} style={{ width:24, height:24, borderRadius:T.r.sm, background:T.glass, border:`1px solid ${T.glassBorder}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ico name="arrowLeft" size={12} color={T.textMuted} />
        </button>
        <Mono size={9} spacing="0.8px" color={T.textPrimary}>{MONTH_NAMES[month].toUpperCase()} {year}</Mono>
        <button onClick={()=>onMonthChange(1)} style={{ width:24, height:24, borderRadius:T.r.sm, background:T.glass, border:`1px solid ${T.glassBorder}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <Ico name="arrowRight" size={12} color={T.textMuted} />
        </button>
      </div>
      {/* Weekday headers */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1, marginBottom:4 }}>
        {WDAYS.map((w,i) => (
          <div key={i} style={{ textAlign:"center", padding:"3px 0" }}>
            <Mono size={7} color={i===0?T.danger:T.textMuted}>{w}</Mono>
          </div>
        ))}
      </div>
      {/* Day grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:1 }}>
        {cells.map((c,i) => {
          const isSel = !c.outside && c.day === selectedDay;
          const isToday = !c.outside && c.day === today;
          const hasAppt = !c.outside && apptDays.has(c.day);
          return (
            <button key={i}
              onClick={() => !c.outside && onDayClick(c.day)}
              style={{
                width:"100%", aspectRatio:"1", borderRadius:T.r.sm,
                border: isSel ? `1.5px solid ${T.primary}` : isToday ? `1px solid ${T.primaryBorder}` : "1px solid transparent",
                background: isSel ? T.primaryBg : isToday ? T.glass : "transparent",
                cursor: c.outside ? "default" : "pointer",
                display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:1,
                transition:"all 0.12s",
              }}
            >
              <span style={{
                fontSize:10, fontWeight: isSel || isToday ? 700 : 400,
                color: c.outside ? T.divider : isSel ? T.primary : isToday ? T.primary : T.textPrimary,
                fontFamily:"'IBM Plex Sans',sans-serif",
              }}>{c.day}</span>
              {hasAppt && !c.outside && (
                <div style={{ width:3, height:3, borderRadius:"50%", background: isSel ? T.primary : T.clinical.color, flexShrink:0 }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PgAgenda() {
  const [view, setView] = React.useState("dia");
  const [selDay, setSelDay] = React.useState(21);
  const [calYear, setCalYear] = React.useState(2026);
  const [calMonth, setCalMonth] = React.useState(0); // January
  const WDAY_NAMES = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];
  const MONTH_SHORT = ["JAN","FEV","MAR","ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ"];
  const dayOfWeek = new Date(calYear, calMonth, selDay).getDay();
  const dateLabel = `${WDAY_NAMES[dayOfWeek].toUpperCase()} · ${selDay} ${MONTH_SHORT[calMonth]} ${calYear}`;

  const handleMonthChange = (dir) => {
    let m = calMonth + dir;
    let y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalMonth(m);
    setCalYear(y);
    setSelDay(1);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
      {/* Top bar */}
      <div style={{ padding:"14px 22px 10px", borderBottom:`1px solid ${T.divider}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
        <div>
          <Mono size={9} spacing="1.2px">{dateLabel}</Mono>
          <p style={{ fontSize:18, fontWeight:700, color:T.textPrimary, marginTop:2 }}>Agenda Clínica</p>
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {[{l:"Hoje",v:"7"},{l:"Confirm.",v:"5"},{l:"Fila",v:"3"}].map(k=>(
            <Glass key={k.l} style={{ padding:"5px 10px", textAlign:"center", borderRadius:T.r.md }}>
              <p style={{ fontSize:15, fontWeight:700, color:T.textPrimary, lineHeight:1 }}>{k.v}</p><Mono size={7}>{k.l.toUpperCase()}</Mono>
            </Glass>
          ))}
          <Glass metal style={{ display:"flex", borderRadius:T.r.md, overflow:"hidden", padding:0 }}>
            {["dia","semana"].map((v,i)=>(<button key={v} onClick={()=>setView(v)} style={{ padding:"6px 13px", background:view===v?T.primaryBg:"transparent", border:"none", borderRight:i===0?`1px solid ${T.divider}`:"none", color:view===v?T.primary:T.textMuted, fontSize:10, fontFamily:"'IBM Plex Mono',monospace", fontWeight:500, letterSpacing:"0.6px", cursor:"pointer" }}>{v.toUpperCase()}</button>))}
          </Glass>
          <Btn small icon="plus">Agendar</Btn>
        </div>
      </div>

      {/* Body: Calendar sidebar + Timeline + Queue */}
      <div style={{ display:"flex", flex:1, minHeight:0, overflow:"hidden" }}>
        {/* Mini calendar sidebar */}
        <div style={{ width:192, borderRight:`1px solid ${T.divider}`, padding:"14px 12px", display:"flex", flexDirection:"column", gap:12, flexShrink:0, overflowY:"auto" }}>
          <MiniCalendar
            year={calYear} month={calMonth}
            selectedDay={selDay}
            onDayClick={(d) => setSelDay(d)}
            onMonthChange={handleMonthChange}
          />
          {/* Today shortcut */}
          <button onClick={()=>{setCalMonth(0);setCalYear(2026);setSelDay(21);}} style={{ width:"100%", padding:"7px 10px", borderRadius:T.r.md, background:T.primaryBg, border:`1px solid ${T.primaryBorder}`, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:5 }}>
            <Ico name="clock" size={12} color={T.primary} />
            <Mono size={9} color={T.primary}>HOJE</Mono>
          </button>
          {/* Day summary */}
          <Glass style={{ padding:"10px 12px", borderRadius:T.r.md }}>
            <Mono size={7} spacing="1px" color={T.textMuted}>RESUMO DO DIA {selDay}</Mono>
            <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:5 }}>
              {[{l:"Consultas",v:"7",c:T.clinical.color},{l:"Procedim.",v:"3",c:T.supply.color},{l:"Análises IA",v:"1",c:T.ai}].map(s=>(
                <div key={s.l} style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                    <div style={{ width:4, height:4, borderRadius:"50%", background:s.c }} />
                    <span style={{ fontSize:10, color:T.textMuted }}>{s.l}</span>
                  </div>
                  <span style={{ fontSize:12, fontWeight:700, color:T.textPrimary }}>{s.v}</span>
                </div>
              ))}
            </div>
          </Glass>
        </div>

        {/* Week strip (semana view only) */}
        {view==="semana" ? (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
            <div style={{ display:"flex", padding:"8px 16px", borderBottom:`1px solid ${T.divider}`, gap:3, flexShrink:0 }}>
              {WEEKD.map((d,i)=>{
                const dayNum = parseInt(d.split(" ")[1]);
                const isSel = dayNum === selDay;
                return (
                  <button key={d} onClick={()=>setSelDay(dayNum)} style={{ flex:1, padding:"7px 4px", borderRadius:T.r.md, background:isSel?T.primaryBg:"transparent", border:isSel?`1px solid ${T.primaryBorder}`:"1px solid transparent", cursor:"pointer", textAlign:"center" }}>
                    <p style={{ fontSize:9, fontFamily:"'IBM Plex Mono',monospace", color:isSel?T.primary:T.textMuted }}>{d.split(" ")[0].toUpperCase()}</p>
                    <p style={{ fontSize:16, fontWeight:700, color:isSel?T.primary:T.textPrimary }}>{d.split(" ")[1]}</p>
                    <div style={{ display:"flex", justifyContent:"center", gap:2, marginTop:3 }}>{[...Array(WEEKC[i])].map((_,j)=><div key={j} style={{ width:3, height:3, borderRadius:"50%", background:isSel?T.primary:T.divider }} />)}</div>
                  </button>
                );
              })}
            </div>
            <div style={{ flex:1, overflowY:"auto", padding:"10px 16px" }}>
              <div style={{ display:"grid", gridTemplateColumns:"42px 1fr" }}>
                {HOURS.map(h=>{
                  const a=APPTS.filter(x=>x.h===h);
                  return (<React.Fragment key={h}>
                    <div style={{ paddingTop:3, paddingRight:8, textAlign:"right" }}><Mono size={9}>{h}</Mono></div>
                    <div style={{ borderTop:`1px solid ${T.divider}`, minHeight:46, paddingBottom:3, paddingLeft:2, display:"flex", flexDirection:"column", gap:3 }}>
                      {a.length>0?a.map((ap,i)=>{const m=T[ap.mod];return(
                        <div key={i} style={{ height:Math.max(44,ap.dur*0.8), borderRadius:T.r.md, padding:"7px 11px", background:m.bg, border:`1px solid ${m.color}18`, borderLeft:`3px solid ${m.color}`, display:"flex", flexDirection:"column", justifyContent:"space-between", cursor:"pointer" }}>
                          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:4 }}><div style={{ overflow:"hidden" }}><p style={{ fontSize:11, fontWeight:600, color:T.textPrimary, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ap.name}</p><p style={{ fontSize:9, color:T.textTertiary }}>{ap.type}</p></div><Badge variant={ap.s} dot={false}>{ap.st}</Badge></div>
                          {ap.dur>40&&<div style={{ display:"flex", justifyContent:"space-between" }}><Mono size={8}>{ap.id}</Mono><Mono size={8} color={m.color}>{ap.crm}</Mono></div>}
                        </div>
                      )}):(
                        <div style={{ height:46, borderRadius:T.r.md, border:`1px dashed ${T.divider}`, display:"flex", alignItems:"center", paddingLeft:10 }}><Mono size={8} color={T.divider}>LIVRE</Mono></div>
                      )}
                    </div>
                  </React.Fragment>);
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Day view: timeline */
          <div style={{ flex:1, overflowY:"auto", padding:"10px 18px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"42px 1fr" }}>
              {HOURS.map(h=>{
                const a=APPTS.filter(x=>x.h===h);
                return (<React.Fragment key={h}>
                  <div style={{ paddingTop:3, paddingRight:8, textAlign:"right" }}><Mono size={9}>{h}</Mono></div>
                  <div style={{ borderTop:`1px solid ${T.divider}`, minHeight:46, paddingBottom:3, paddingLeft:2, display:"flex", flexDirection:"column", gap:3 }}>
                    {a.length>0?a.map((ap,i)=>{const m=T[ap.mod];return(
                      <div key={i} style={{ height:Math.max(44,ap.dur*0.8), borderRadius:T.r.md, padding:"7px 11px", background:m.bg, border:`1px solid ${m.color}18`, borderLeft:`3px solid ${m.color}`, display:"flex", flexDirection:"column", justifyContent:"space-between", cursor:"pointer" }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:4 }}><div style={{ overflow:"hidden" }}><p style={{ fontSize:11, fontWeight:600, color:T.textPrimary, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{ap.name}</p><p style={{ fontSize:9, color:T.textTertiary }}>{ap.type}</p></div><Badge variant={ap.s} dot={false}>{ap.st}</Badge></div>
                        {ap.dur>40&&<div style={{ display:"flex", justifyContent:"space-between" }}><Mono size={8}>{ap.id}</Mono><Mono size={8} color={m.color}>{ap.crm}</Mono></div>}
                      </div>
                    )}):(
                      <div style={{ height:46, borderRadius:T.r.md, border:`1px dashed ${T.divider}`, display:"flex", alignItems:"center", paddingLeft:10 }}><Mono size={8} color={T.divider}>LIVRE</Mono></div>
                    )}
                  </div>
                </React.Fragment>);
              })}
            </div>
          </div>
        )}

        {/* Queue */}
        <div style={{ width:166, borderLeft:`1px solid ${T.divider}`, padding:"12px 10px", display:"flex", flexDirection:"column", gap:8, flexShrink:0 }}>
          <Mono size={8} spacing="1.2px">FILA DE ESPERA</Mono>
          {[{n:"Sandra Ramos",w:"12 min"},{n:"Lucas Teixeira",w:"28 min"},{n:"Beatriz Viana",w:"41 min"}].map((q,i)=>(
            <Glass key={i} style={{ padding:"9px 10px", borderRadius:T.r.md }}>
              <p style={{ fontSize:11, fontWeight:600, color:T.textPrimary, marginBottom:3 }}>{q.n}</p>
              <div style={{ display:"flex", justifyContent:"space-between" }}><Mono size={8}>{q.w}</Mono><Badge variant="warning" dot={false}>Espera</Badge></div>
            </Glass>
          ))}
          <div style={{ marginTop:"auto" }}>
            <Glass style={{ padding:"10px", borderRadius:T.r.md, background:T.primaryBg, border:`1px solid ${T.primaryBorder}` }}>
              <Mono size={8} color={T.primary} spacing="0.8px">PRÓXIMO LIVRE</Mono>
              <p style={{ fontSize:15, fontWeight:700, color:T.textPrimary, marginTop:3 }}>10:00</p><p style={{ fontSize:10, color:T.textMuted }}>45 min</p>
            </Glass>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 3. PACIENTES ────────────────────────────────────────────────
const PATS = [
  { id:"PAC-0847", name:"Ana Clara Mendes", age:34, cpf:"082.***.*-04", diag:"Dermatite atópica", last:"15 Jan", st:"Ativo", mod:"clinical" },
  { id:"PAC-0848", name:"Roberto Alves", age:52, cpf:"174.***.*-91", diag:"Acne grau III", last:"18 Jan", st:"Ativo", mod:"clinical" },
  { id:"PAC-0849", name:"Mariana Costa", age:27, cpf:"093.***.*-55", diag:"Envelhecimento facial", last:"21 Jan", st:"Em tratamento", mod:"supply" },
  { id:"PAC-0851", name:"João Ferreira", age:45, cpf:"231.***.*-12", diag:"Lesão suspeita IA", last:"21 Jan", st:"Urgente", mod:"aiMod" },
  { id:"PAC-0853", name:"Carla Nunes", age:38, cpf:"055.***.*-77", diag:"Melasma", last:"19 Jan", st:"Ativo", mod:"clinical" },
  { id:"PAC-0855", name:"Pedro Gomes", age:61, cpf:"187.***.*-23", diag:"Psoríase", last:"17 Jan", st:"Ativo", mod:"clinical" },
];

function PgPacientes() {
  const [search, setSearch] = React.useState("");
  const [sel, setSel] = React.useState(null);
  const filt = PATS.filter(p=>p.name.toLowerCase().includes(search.toLowerCase())||p.id.includes(search));
  const sMap = {"Ativo":"success","Em tratamento":"default","Urgente":"danger"};
  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"14px 22px 10px", borderBottom:`1px solid ${T.divider}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <h2 style={{ fontSize:18, fontWeight:700, color:T.textPrimary }}>Pacientes & Leads</h2>
          <Btn small icon="plus">Novo Paciente</Btn>
        </div>
        <div style={{ padding:"8px 22px", borderBottom:`1px solid ${T.divider}` }}>
          <div style={{ position:"relative" }}><span style={{ position:"absolute", left:10, top:"50%", transform:"translateY(-50%)", pointerEvents:"none" }}><Ico name="search" size={14} color={T.textMuted} /></span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar nome, CPF ou prontuário…" style={{ width:"100%", padding:"8px 12px 8px 32px", borderRadius:T.r.md, background:T.inputBg, border:`1px solid ${T.inputBorder}`, fontSize:12, fontFamily:"'IBM Plex Sans',sans-serif", color:T.textPrimary, outline:"none" }} /></div>
        </div>
        <div style={{ flex:1, overflowY:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["Prontuário","Paciente","Idade","Diagnóstico","Última","Status",""].map(h=><th key={h} style={{ padding:"9px 16px", textAlign:"left", fontSize:8, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"1.1px", color:T.textMuted, fontWeight:500, borderBottom:`1px solid ${T.divider}`, background:T.metalGrad, position:"sticky", top:0, zIndex:1 }}>{h}</th>)}</tr></thead>
            <tbody>{filt.map((p,i)=>{const m=T[p.mod];return(
              <tr key={p.id} onClick={()=>setSel(p)} style={{ borderBottom:`1px solid ${T.divider}`, background:sel?.id===p.id?T.primaryBg:i%2===0?"transparent":"rgba(255,255,255,0.22)", cursor:"pointer" }}>
                <td style={{ padding:"11px 16px" }}><Mono size={9}>{p.id}</Mono></td>
                <td style={{ padding:"11px 16px" }}><div style={{ display:"flex", alignItems:"center", gap:8 }}><div style={{ width:24, height:24, borderRadius:T.r.sm, background:m.bg, display:"flex", alignItems:"center", justifyContent:"center" }}><Ico name="user" size={12} color={m.color} /></div><div><p style={{ fontSize:12, fontWeight:600, color:T.textPrimary }}>{p.name}</p><Mono size={8}>{p.cpf}</Mono></div></div></td>
                <td style={{ padding:"11px 16px", fontSize:12, color:T.textSecondary }}>{p.age}</td>
                <td style={{ padding:"11px 16px", fontSize:11, color:T.textSecondary }}>{p.diag}</td>
                <td style={{ padding:"11px 16px" }}><Mono size={9}>{p.last}</Mono></td>
                <td style={{ padding:"11px 16px" }}><Badge variant={sMap[p.st]||"default"}>{p.st}</Badge></td>
                <td style={{ padding:"11px 16px" }}><Ico name="arrowRight" size={13} color={sel?.id===p.id?T.primary:T.textMuted} /></td>
              </tr>
            );})}</tbody>
          </table>
        </div>
      </div>
      {sel && (
        <div style={{ width:240, borderLeft:`1px solid ${T.divider}`, overflowY:"auto", flexShrink:0 }}>
          <div style={{ padding:"14px 16px", borderBottom:`1px solid ${T.divider}`, display:"flex", justifyContent:"space-between" }}>
            <span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Prontuário</span>
            <button onClick={()=>setSel(null)} style={{ background:"none", border:"none", cursor:"pointer" }}><Ico name="x" size={15} color={T.textMuted} /></button>
          </div>
          <div style={{ padding:"16px" }}>
            <div style={{ width:48, height:48, borderRadius:T.r.lg, background:T[sel.mod].bg, border:`1px solid ${T[sel.mod].color}18`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12 }}><Ico name="user" size={22} color={T[sel.mod].color} /></div>
            <p style={{ fontSize:15, fontWeight:700, color:T.textPrimary, marginBottom:2 }}>{sel.name}</p>
            <Mono size={9}>{sel.id} · {sel.age} anos</Mono>
            <div style={{ marginTop:14, display:"flex", flexDirection:"column", gap:8 }}>
              {[["CPF",sel.cpf],["Diagnóstico",sel.diag],["Última consulta",sel.last]].map(([k,v])=>(
                <div key={k} style={{ padding:"8px 10px", borderRadius:T.r.md, background:T.glass, border:`1px solid ${T.glassBorder}` }}>
                  <Mono size={7}>{k.toUpperCase()}</Mono><p style={{ fontSize:12, color:T.textPrimary, marginTop:2 }}>{v}</p>
                </div>
              ))}
            </div>
            <div style={{ marginTop:12 }}><Btn small icon="edit">Prontuário</Btn></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 4. COMUNICAÇÕES ─────────────────────────────────────────────
const CONVOS = [
  { name:"Sandra Ramos", ch:"WA", msg:"Confirmar consulta amanhã.", time:"14:32", unread:2 },
  { name:"Lucas Teixeira", ch:"IG", msg:"Tratamento para manchas?", time:"13:15", unread:1 },
  { name:"Beatriz Viana", ch:"EM", msg:"Solicito resultado dos exames.", time:"11:48", unread:0 },
  { name:"Carlos Mendes", ch:"WA", msg:"Posso remarcar para sexta?", time:"10:22", unread:3 },
];
const CHAT = [
  { from:"patient", text:"Oi, queria confirmar minha consulta de amanhã às 10h.", time:"14:28" },
  { from:"agent", text:"Olá Sandra! Sua consulta está confirmada para amanhã, 22/01, às 10h com a Dra. Souza. Venha 10 min antes.", time:"14:30", ai:true },
  { from:"patient", text:"Perfeito, obrigada! Preciso levar algum exame?", time:"14:31" },
  { from:"agent", text:"Não é necessário trazer exames para essa consulta. Até amanhã!", time:"14:32", ai:true },
];

function PgComunicacoes() {
  const [selC, setSelC] = React.useState(CONVOS[0]);
  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      <div style={{ width:240, borderRight:`1px solid ${T.divider}`, display:"flex", flexDirection:"column", flexShrink:0 }}>
        <div style={{ padding:"10px", borderBottom:`1px solid ${T.divider}` }}><input placeholder="Buscar conversas…" style={{ width:"100%", padding:"6px 10px", borderRadius:T.r.md, background:T.inputBg, border:`1px solid ${T.inputBorder}`, fontSize:11, fontFamily:"'IBM Plex Sans',sans-serif", color:T.textPrimary, outline:"none" }} /></div>
        <div style={{ flex:1, overflowY:"auto" }}>{CONVOS.map((c,i)=>(
          <div key={i} onClick={()=>setSelC(c)} style={{ padding:"10px 12px", borderBottom:`1px solid ${T.divider}`, cursor:"pointer", background:selC?.name===c.name?T.primaryBg:"transparent" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}><span style={{ fontSize:11, fontWeight:c.unread>0?700:500, color:T.textPrimary }}>{c.name}</span><Mono size={8}>{c.time}</Mono></div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}><span style={{ fontSize:10, color:T.textMuted, flex:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{c.msg}</span>
            {c.unread>0&&<div style={{ width:16, height:16, borderRadius:999, background:T.primary, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, marginLeft:4 }}><span style={{ fontSize:8, fontWeight:700, color:"#fff" }}>{c.unread}</span></div>}</div>
          </div>
        ))}</div>
      </div>
      <div style={{ flex:1, display:"flex", flexDirection:"column" }}>
        <div style={{ padding:"12px 18px", borderBottom:`1px solid ${T.divider}`, display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div><p style={{ fontSize:14, fontWeight:700, color:T.textPrimary }}>{selC?.name}</p><div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:6, height:6, borderRadius:"50%", background:T.success }} /><Mono size={8}>Online · Aurora ativa</Mono></div></div>
        </div>
        <div style={{ flex:1, overflowY:"auto", padding:"14px 18px", display:"flex", flexDirection:"column", gap:8 }}>
          {CHAT.map((m,i)=>(
            <div key={i} style={{ display:"flex", flexDirection:m.from==="agent"?"row-reverse":"row", gap:7, alignItems:"flex-end" }}>
              {m.from==="agent"&&<div style={{ width:22, height:22, borderRadius:"50%", background:T.aiBg, border:`1px solid ${T.aiBorder}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}><Ico name="zap" size={10} color={T.ai} /></div>}
              <div style={{ maxWidth:"72%", padding:"8px 12px", borderRadius:m.from==="agent"?`${T.r.lg}px ${T.r.sm}px ${T.r.lg}px ${T.r.lg}px`:`${T.r.sm}px ${T.r.lg}px ${T.r.lg}px ${T.r.lg}px`, background:m.from==="agent"?T.primaryBg:T.glass, border:`1px solid ${m.from==="agent"?T.primaryBorder:T.glassBorder}` }}>
                <p style={{ fontSize:12, color:T.textPrimary, lineHeight:1.55 }}>{m.text}</p>
                <Mono size={7}>{m.time}{m.ai?" · Aurora IA":""}</Mono>
              </div>
            </div>
          ))}
        </div>
        <div style={{ padding:"10px 18px", borderTop:`1px solid ${T.divider}`, display:"flex", gap:8, flexShrink:0 }}>
          <input placeholder="Escreva uma mensagem…" style={{ flex:1, padding:"8px 12px", borderRadius:T.r.md, background:T.inputBg, border:`1px solid ${T.inputBorder}`, fontSize:12, fontFamily:"'IBM Plex Sans',sans-serif", color:T.textPrimary, outline:"none" }} />
          <Btn small icon="arrowRight">Enviar</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── 5. SUPRIMENTOS ──────────────────────────────────────────────
const INV = [
  { id:"SUP-0021", name:"Ácido Hialurônico 1%", lote:"LT-2024-009", val:"12/2025", qty:48, min:10, s:"success" },
  { id:"SUP-0022", name:"Toxina Botulínica 100U", lote:"LT-2024-012", val:"03/2025", qty:4, min:5, s:"warning" },
  { id:"SUP-0023", name:"Colágeno Hidrolisado", lote:"LT-2024-014", val:"01/2025", qty:0, min:6, s:"danger" },
  { id:"SUP-0024", name:"Vitamina C 20% Sérum", lote:"LT-2024-017", val:"06/2026", qty:22, min:8, s:"success" },
  { id:"SUP-0025", name:"Ácido Mandélico 35%", lote:"LT-2024-019", val:"09/2025", qty:7, min:5, s:"success" },
];

function PgSuprimentos() {
  return (
    <div style={{ overflowY:"auto", height:"100%", padding:"22px 26px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}><div style={{ width:40, height:40, borderRadius:T.r.lg, background:T.supply.bg, border:`1px solid ${T.supply.color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}><Ico name="box" size={20} color={T.supply.color} /></div><div><Mono size={9} spacing="1.3px" color={T.supply.color}>GESTÃO DE INVENTÁRIO FEFO</Mono><h2 style={{ fontSize:18, fontWeight:700, color:T.textPrimary, marginTop:2 }}>Suprimentos</h2></div></div>
        <div style={{ display:"flex", gap:8 }}><Btn variant="glass" small icon="layers">Kits</Btn><Btn small icon="plus">Receber</Btn></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        <Stat label="Em estoque" value="127" sub="5 categorias" icon="box" mod="supply" pct={80} />
        <Stat label="Alertas FEFO" value="4" sub="vencendo em 30d" icon="alert" mod="supply" pct={40} />
        <Stat label="Kits ativos" value="12" sub="3 aguardando" icon="layers" mod="supply" pct={75} />
        <Stat label="Compras" value="R$ 3.280" sub="2 ordens abertas" icon="creditCard" mod="financial" pct={60} />
      </div>
      <Glass style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 18px", borderBottom:`1px solid ${T.divider}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:7 }}><Ico name="box" size={15} color={T.supply.color} /><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Inventário FEFO</span></div>
          <div style={{ display:"flex", gap:5 }}><MetalTag>FEFO ATIVO</MetalTag><MetalTag>ANVISA</MetalTag><MetalTag>AES-256</MetalTag></div>
        </div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["REF","Produto","Lote","Validade","Estoque","Mín.","Status",""].map(h=><th key={h} style={{ padding:"9px 16px", textAlign:"left", fontSize:8, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"1.1px", color:T.textMuted, fontWeight:500, borderBottom:`1px solid ${T.divider}`, background:T.metalGrad }}>{h}</th>)}</tr></thead>
          <tbody>{INV.map((r,i)=>(
            <tr key={r.id} style={{ borderBottom:`1px solid ${T.divider}`, background:i%2===0?"transparent":"rgba(255,255,255,0.22)" }}>
              <td style={{ padding:"11px 16px" }}><Mono size={9}>{r.id}</Mono></td>
              <td style={{ padding:"11px 16px", fontSize:12, color:T.textPrimary, fontWeight:500 }}>{r.name}</td>
              <td style={{ padding:"11px 16px" }}><Mono size={9} color={T.textSecondary}>{r.lote}</Mono></td>
              <td style={{ padding:"11px 16px" }}><Mono size={9} color={T.textSecondary}>{r.val}</Mono></td>
              <td style={{ padding:"11px 16px", fontSize:13, fontWeight:700, color:r.qty===0?T.danger:r.qty<r.min?T.warning:T.textPrimary }}>{r.qty}</td>
              <td style={{ padding:"11px 16px", fontSize:12, color:T.textMuted }}>{r.min}</td>
              <td style={{ padding:"11px 16px" }}><Badge variant={r.s}>{r.qty===0?"Esgotado":r.qty<r.min?"Baixo":"OK"}</Badge></td>
              <td style={{ padding:"11px 16px" }}><Btn variant="ghost" small>Editar</Btn></td>
            </tr>
          ))}</tbody>
        </table>
      </Glass>
    </div>
  );
}

// ─── 6. FINANCEIRO ───────────────────────────────────────────────
function PgFinanceiro() {
  const faturas = [
    { id:"F-0091", patient:"Ana Clara Mendes", valor:"R$ 580,00", status:"Pago", s:"success", data:"15 Jan" },
    { id:"F-0092", patient:"Roberto Alves", valor:"R$ 320,00", status:"Pendente", s:"warning", data:"18 Jan" },
    { id:"F-0093", patient:"Mariana Costa", valor:"R$ 1.200,00", status:"Pago", s:"success", data:"20 Jan" },
    { id:"F-0094", patient:"João Ferreira", valor:"R$ 450,00", status:"Vencida", s:"danger", data:"10 Jan" },
    { id:"F-0095", patient:"Carla Nunes", valor:"R$ 890,00", status:"Pago", s:"success", data:"19 Jan" },
  ];
  return (
    <div style={{ overflowY:"auto", height:"100%", padding:"22px 26px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:22 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}><div style={{ width:40, height:40, borderRadius:T.r.lg, background:T.financial.bg, border:`1px solid ${T.financial.color}18`, display:"flex", alignItems:"center", justifyContent:"center" }}><Ico name="creditCard" size={20} color={T.financial.color} /></div><div><Mono size={9} spacing="1.3px" color={T.financial.color}>CAIXA E FATURAMENTO</Mono><h2 style={{ fontSize:18, fontWeight:700, color:T.textPrimary, marginTop:2 }}>Financeiro</h2></div></div>
        <div style={{ display:"flex", gap:8 }}><Btn variant="glass" small icon="barChart">DRE</Btn><Btn small icon="plus">Nova fatura</Btn></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        <Stat label="Receita hoje" value="R$ 8.420" sub="Meta: R$ 10k" icon="activity" mod="financial" pct={84} />
        <Stat label="Faturas abertas" value="7" sub="R$ 4.230 pend." icon="creditCard" mod="financial" pct={42} />
        <Stat label="Recebido mês" value="R$ 62.4k" sub="+12% vs jan/25" icon="barChart" mod="financial" pct={78} />
        <Stat label="Ticket médio" value="R$ 580" sub="vs R$ 510" icon="percent" mod="financial" pct={68} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        <Glass style={{ padding:"18px 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>DRE — Janeiro 2026</span><Mono size={9} color={T.financial.color}>R$ 10.000 / MÊS</Mono></div>
          {[{l:"Consultas",v:6200,p:62},{l:"Procedimentos",v:3100,p:31},{l:"Produtos",v:700,p:7}].map(d=>(
            <div key={d.l} style={{ marginBottom:12 }}><div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}><span style={{ fontSize:12, color:T.textSecondary }}>{d.l}</span><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>R$ {d.v.toLocaleString("pt-BR")}</span></div><Bar pct={d.p} color={T.financial.color} /></div>
          ))}
          <div style={{ paddingTop:10, borderTop:`1px solid ${T.divider}`, display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:13, fontWeight:700, color:T.textPrimary }}>Total</span><span style={{ fontSize:14, fontWeight:700, color:T.financial.color }}>R$ 10.000</span></div>
        </Glass>
        <Glass metal style={{ padding:"18px 22px" }}>
          <Mono size={9} spacing="1.2px">CAIXA DO DIA</Mono>
          <p style={{ fontSize:30, fontWeight:700, color:T.textPrimary, letterSpacing:"-0.02em", marginTop:6, marginBottom:8 }}>R$ 8.420</p>
          <div style={{ display:"flex", gap:6, marginBottom:16 }}><Badge variant="success">+R$ 1.200 botox</Badge><Badge variant="warning">−R$ 320 fornec.</Badge></div>
          {[{l:"Dinheiro",v:"R$ 1.240",p:15},{l:"Débito",v:"R$ 2.800",p:33},{l:"Crédito",v:"R$ 3.100",p:37},{l:"PIX",v:"R$ 1.280",p:15}].map(m=>(
            <div key={m.l} style={{ display:"flex", alignItems:"center", gap:9, marginBottom:7 }}><span style={{ fontSize:11, color:T.textSecondary, width:55, flexShrink:0 }}>{m.l}</span><Bar pct={m.p} color={T.primary} height={4} /><span style={{ fontSize:11, fontWeight:600, color:T.textPrimary, width:65, textAlign:"right", flexShrink:0 }}>{m.v}</span></div>
          ))}
        </Glass>
      </div>
      <Glass style={{ padding:0, overflow:"hidden" }}>
        <div style={{ padding:"12px 18px", borderBottom:`1px solid ${T.divider}`, display:"flex", alignItems:"center", gap:7 }}><Ico name="creditCard" size={14} color={T.financial.color} /><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Faturas recentes</span></div>
        <table style={{ width:"100%", borderCollapse:"collapse" }}>
          <thead><tr>{["N°","Paciente","Valor","Data","Status",""].map(h=><th key={h} style={{ padding:"9px 16px", textAlign:"left", fontSize:8, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"1.1px", color:T.textMuted, fontWeight:500, borderBottom:`1px solid ${T.divider}`, background:T.metalGrad }}>{h}</th>)}</tr></thead>
          <tbody>{faturas.map((f,i)=>(
            <tr key={f.id} style={{ borderBottom:`1px solid ${T.divider}`, background:i%2===0?"transparent":"rgba(255,255,255,0.20)" }}>
              <td style={{ padding:"11px 16px" }}><Mono size={9}>{f.id}</Mono></td>
              <td style={{ padding:"11px 16px", fontSize:12, color:T.textPrimary, fontWeight:500 }}>{f.patient}</td>
              <td style={{ padding:"11px 16px", fontSize:13, fontWeight:700, color:T.textPrimary }}>{f.valor}</td>
              <td style={{ padding:"11px 16px" }}><Mono size={9}>{f.data}</Mono></td>
              <td style={{ padding:"11px 16px" }}><Badge variant={f.s}>{f.status}</Badge></td>
              <td style={{ padding:"11px 16px" }}><Btn variant="ghost" small>Ver</Btn></td>
            </tr>
          ))}</tbody>
        </table>
      </Glass>
    </div>
  );
}

// ─── 7. ANALYTICS ────────────────────────────────────────────────
function PgAnalytics() {
  const weekData=[{l:"Seg",v:12},{l:"Ter",v:18},{l:"Qua",v:14},{l:"Qui",v:20},{l:"Sex",v:16},{l:"Sáb",v:6}];
  return (
    <div style={{ overflowY:"auto", height:"100%", padding:"22px 26px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:22 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}><div style={{ width:40, height:40, borderRadius:T.r.lg, background:T.aiBg, border:`1px solid ${T.aiBorder}`, display:"flex", alignItems:"center", justifyContent:"center" }}><Ico name="barChart" size={20} color={T.ai} /></div><div><Mono size={9} spacing="1.3px" color={T.ai}>INTELIGÊNCIA OPERACIONAL</Mono><h2 style={{ fontSize:18, fontWeight:700, color:T.textPrimary, marginTop:2 }}>Analytics</h2></div></div>
        <div style={{ display:"flex", gap:8 }}><Btn variant="ghost" small>CSV</Btn><Btn variant="glass" small icon="download">PDF</Btn></div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:20 }}>
        <Stat label="Clinical" value="68%" sub="Consultas e prontuários" icon="user" mod="clinical" />
        <Stat label="Financeiro" value="R$ 62.4k" sub="Receita do mês" icon="creditCard" mod="financial" />
        <Stat label="IA / Aurora" value="94%" sub="Satisfação atendimento" icon="zap" mod="aiMod" />
        <Stat label="Suprimentos" value="127" sub="Itens em estoque" icon="box" mod="supply" />
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        <Glass style={{ padding:"18px 22px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:14 }}><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Consultas/dia — Jan 2026</span><Mono size={9} color={T.clinical.color}>86 TOTAL</Mono></div>
          <div style={{ display:"flex", gap:6, alignItems:"flex-end", height:80 }}>{weekData.map((d,i)=>(<div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, flex:1 }}><div style={{ width:"100%", borderRadius:`${T.r.sm}px ${T.r.sm}px 0 0`, background:`linear-gradient(180deg, ${T.clinical.color}, ${T.clinical.color}88)`, height:`${(d.v/24)*72}px`, transition:"height 0.6s" }} /><Mono size={7}>{d.l}</Mono></div>))}</div>
        </Glass>
        <Glass metal style={{ padding:"18px 22px" }}>
          <Mono size={9} spacing="1.2px">NPS & SATISFAÇÃO</Mono>
          <div style={{ marginTop:12 }}>{[{l:"Atendimento clínico",v:96,c:T.clinical.color},{l:"Comunicação IA",v:91,c:T.ai},{l:"Tempo de espera",v:74,c:T.warning},{l:"Espaço físico",v:88,c:T.financial.color}].map(item=>(
            <div key={item.l} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
              <span style={{ fontSize:11, color:T.textSecondary, width:150, flexShrink:0 }}>{item.l}</span><Bar pct={item.v} color={item.c} /><span style={{ fontSize:12, fontWeight:700, color:T.textPrimary, width:32, textAlign:"right" }}>{item.v}%</span>
            </div>
          ))}</div>
        </Glass>
      </div>
      <Glass style={{ padding:"18px 22px" }}>
        <span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Breakdown por módulo — Jan 2026</span>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginTop:12 }}>
          {[
            {mod:"clinical",items:[["Consultas","86"],["Prescrições","43"],["Protocolos","21"]]},
            {mod:"financial",items:[["Receita","R$ 62.4k"],["Ticket","R$ 580"],["Faturas","108"]]},
            {mod:"aiMod",items:[["Msgs IA","412"],["Escalações","14"],["NPS IA","91%"]]},
            {mod:"supply",items:[["Kits usados","38"],["Consumidos","247"],["Compras","R$ 8.2k"]]},
          ].map(col=>{const m=T[col.mod];return(
            <div key={col.mod} style={{ padding:"12px 14px", borderRadius:T.r.md, background:m.bg, border:`1px solid ${m.color}15` }}>
              <Mono size={7} color={m.color}>{m.label.toUpperCase()}</Mono>
              <div style={{ marginTop:8, display:"flex", flexDirection:"column", gap:7 }}>{col.items.map(([k,v])=>(<div key={k} style={{ display:"flex", justifyContent:"space-between" }}><span style={{ fontSize:11, color:T.textMuted }}>{k}</span><span style={{ fontSize:12, fontWeight:700, color:T.textPrimary }}>{v}</span></div>))}</div>
            </div>
          );})
        }</div>
      </Glass>
    </div>
  );
}

// ─── 8. CONFIGURAÇÕES ────────────────────────────────────────────
function PgConfig() {
  const users=[
    {name:"Dra. Ana Souza",role:"Dermatologista",email:"ana@clinica.com",perms:["prontuário","prescrição","protocolo"]},
    {name:"Dr. Carlos Lima",role:"Dermatologista",email:"lima@clinica.com",perms:["prontuário","prescrição"]},
    {name:"Marina Recepção",role:"Recepcionista",email:"marina@clinica.com",perms:["agenda","comunicação"]},
    {name:"Roberto Admin",role:"Gestor",email:"roberto@clinica.com",perms:["financeiro","analytics","configurações"]},
  ];
  const integs=[
    {name:"WhatsApp Business API",st:"Conectado",icon:"message",mod:"aiMod"},
    {name:"Gateway de Pagamento",st:"Conectado",icon:"creditCard",mod:"financial"},
    {name:"ANVISA — Rastreabilidade",st:"Conectado",icon:"shield",mod:"supply"},
    {name:"Claude API — Aurora IA",st:"Conectado",icon:"zap",mod:"aiMod"},
    {name:"MinIO — Storage S3",st:"Conectado",icon:"box",mod:"supply"},
    {name:"Instagram API",st:"Pendente",icon:"message",mod:"aiMod"},
  ];
  return (
    <div style={{ overflowY:"auto", height:"100%", padding:"22px 26px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:22 }}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}><div style={{ width:40, height:40, borderRadius:T.r.lg, background:T.primaryBg, border:`1px solid ${T.primaryBorder}`, display:"flex", alignItems:"center", justifyContent:"center" }}><Ico name="settings" size={20} color={T.primary} /></div><div><Mono size={9} spacing="1.3px" color={T.primary}>USUÁRIOS, RBAC & INTEGRAÇÕES</Mono><h2 style={{ fontSize:18, fontWeight:700, color:T.textPrimary, marginTop:2 }}>Configurações</h2></div></div>
        <Btn small icon="plus">Novo usuário</Btn>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
        <Glass style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"12px 18px", borderBottom:`1px solid ${T.divider}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}><div style={{ display:"flex", alignItems:"center", gap:7 }}><Ico name="users" size={14} color={T.primary} /><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Usuários & RBAC</span></div><MetalTag>LGPD</MetalTag></div>
          {users.map((u,i)=>(
            <div key={u.email} style={{ padding:"11px 18px", borderBottom:i<users.length-1?`1px solid ${T.divider}`:"none" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}><div><p style={{ fontSize:12, fontWeight:600, color:T.textPrimary }}>{u.name}</p><Mono size={8}>{u.role} · {u.email}</Mono></div><Badge variant="success">Ativo</Badge></div>
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>{u.perms.map(p=><MetalTag key={p}>{p}</MetalTag>)}</div>
            </div>
          ))}
        </Glass>
        <Glass style={{ padding:0, overflow:"hidden" }}>
          <div style={{ padding:"12px 18px", borderBottom:`1px solid ${T.divider}`, display:"flex", alignItems:"center", gap:7 }}><Ico name="layers" size={14} color={T.aiMod.color} /><span style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>Integrações</span></div>
          {integs.map((intg,i)=>{const m=T[intg.mod];return(
            <div key={intg.name} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 18px", borderBottom:i<integs.length-1?`1px solid ${T.divider}`:"none" }}>
              <div style={{ display:"flex", alignItems:"center", gap:9 }}><div style={{ width:26, height:26, borderRadius:T.r.sm, background:m.bg, display:"flex", alignItems:"center", justifyContent:"center" }}><Ico name={intg.icon} size={12} color={m.color} /></div><p style={{ fontSize:12, fontWeight:500, color:T.textPrimary }}>{intg.name}</p></div>
              <Badge variant={intg.st==="Conectado"?"success":"warning"}>{intg.st}</Badge>
            </div>
          );})}
        </Glass>
      </div>
      <Glass metal style={{ padding:"18px 22px" }}>
        <Mono size={9} spacing="1.3px" color={T.primary}>COMPLIANCE & SEGURANÇA</Mono>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:12 }}>
          {[{l:"LGPD Ativo",d:"Consentimentos atualizados"},{l:"ANVISA Rastreável",d:"SHA-256 + PDF auditável"},{l:"AES-256-GCM",d:"Dados cifrados"},{l:"JWT httpOnly",d:"Sessões seguras"},{l:"RLS Multi-tenant",d:"Isolamento por tenant"},{l:"Auditoria imutável",d:"Logs append-only"}].map(c=>(
            <div key={c.l} style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 14px", borderRadius:T.r.md, background:T.primaryBg, border:`1px solid ${T.primaryBorder}` }}>
              <Ico name="shield" size={14} color={T.primary} /><div><p style={{ fontSize:11, fontWeight:600, color:T.textPrimary }}>{c.l}</p><Mono size={7}>{c.d}</Mono></div>
            </div>
          ))}
        </div>
      </Glass>
    </div>
  );
}

// ─── MODULE TOOLBARS ─────────────────────────────────────────────
const MODULE_TOOLS = {
  dashboard: [
    { label:"Visão Geral", icon:"grid", action:"overview" },
    { label:"Relatórios", icon:"barChart", action:"reports" },
    { label:"Exportar", icon:"download", action:"export" },
  ],
  agenda: [
    { label:"Dia", icon:"calendar", action:"day" },
    { label:"Semana", icon:"calendar", action:"week" },
    { label:"Mês", icon:"calendar", action:"month" },
    { label:"Agendar", icon:"plus", action:"new", primary:true },
    { label:"Fila", icon:"users", action:"queue" },
  ],
  pacientes: [
    { label:"Lista", icon:"users", action:"list" },
    { label:"Leads", icon:"user", action:"leads" },
    { label:"Novo", icon:"plus", action:"new", primary:true },
    { label:"Importar", icon:"download", action:"import" },
    { label:"Filtros", icon:"filter", action:"filters" },
  ],
  comunicacoes: [
    // Toolbar vazia - canais já são gerenciados dentro da página
  ],
  suprimentos: [
    { label:"Inventário", icon:"box", action:"inventory" },
    { label:"FEFO", icon:"clock", action:"fefo" },
    { label:"Kits", icon:"layers", action:"kits" },
    { label:"Receber", icon:"plus", action:"new", primary:true },
    { label:"Compras", icon:"creditCard", action:"orders" },
  ],
  financeiro: [
    { label:"Faturas", icon:"creditCard", action:"invoices" },
    { label:"Caixa", icon:"activity", action:"cash" },
    { label:"DRE", icon:"barChart", action:"dre" },
    { label:"Novo", icon:"plus", action:"new", primary:true },
  ],
  analytics: [
    { label:"Visão Geral", icon:"barChart", action:"overview" },
    { label:"Clinical", icon:"user", action:"clinical" },
    { label:"Financeiro", icon:"creditCard", action:"financial" },
    { label:"Exportar CSV", icon:"download", action:"csv" },
    { label:"PDF", icon:"printer", action:"pdf" },
  ],
  config: [
    { label:"Usuários", icon:"users", action:"users" },
    { label:"Integrações", icon:"layers", action:"integrations" },
    { label:"Segurança", icon:"shield", action:"security" },
    { label:"Novo", icon:"plus", action:"new", primary:true },
  ],
};

// ─── TOP TOOLBAR ─────────────────────────────────────────────────
function TopToolbar({ module }) {
  const tools = MODULE_TOOLS[module] || [];
  const modData = NAV.find(n => n.id === module);
  const m = modData?.mod ? T[modData.mod] : null;
  const themeColor = m ? m.color : T.primary;
  
  return (
    <div style={{ 
      height:52, 
      background:T.glass, 
      backdropFilter:`blur(${T.glassBlur}px) saturate(160%)`, 
      WebkitBackdropFilter:`blur(${T.glassBlur}px) saturate(160%)`,
      borderBottom:`1px solid ${T.glassBorder}`,
      boxShadow:"0 1px 0 rgba(255,255,255,0.5) inset, 0 4px 12px rgba(0,0,0,0.04)",
      display:"flex",
      alignItems:"center",
      justifyContent:"space-between",
      padding:"0 20px",
      gap:12,
      flexShrink:0,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {modData && <Ico name={modData.icon} size={18} color={themeColor} sw={2} />}
          <span style={{ fontSize:14, fontWeight:600, color:T.textPrimary }}>{modData?.label || 'Dashboard'}</span>
        </div>
        <div style={{ width:1, height:24, background:T.divider }} />
        <div style={{ display:"flex", gap:4 }}>
          {tools.filter(t => !t.primary).map(tool => (
            <button key={tool.action} style={{
              display:"flex",
              alignItems:"center",
              gap:6,
              padding:"6px 12px",
              borderRadius:T.r.md,
              background:"transparent",
              border:`1px solid transparent`,
              color:T.textSecondary,
              fontSize:11,
              fontFamily:"'IBM Plex Sans',sans-serif",
              fontWeight:500,
              cursor:"pointer",
              transition:"all 0.15s",
              position:"relative",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = T.glass;
              e.currentTarget.style.borderColor = T.glassBorder;
              e.currentTarget.style.color = T.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.color = T.textSecondary;
            }}>
              <Ico name={tool.icon} size={13} color="currentColor" sw={1.6} />
              <span>{tool.label}</span>
              {tool.badge && (
                <div style={{
                  position:"absolute",
                  top:-4,
                  right:-4,
                  minWidth:16,
                  height:16,
                  borderRadius:999,
                  background:T.danger,
                  display:"flex",
                  alignItems:"center",
                  justifyContent:"center",
                  padding:"0 4px",
                  boxShadow:"0 2px 4px rgba(154,32,32,0.3)",
                }}>
                  <span style={{ fontSize:9, fontWeight:700, color:"#fff" }}>{tool.badge}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        {tools.filter(t => t.primary).map(tool => (
          <button key={tool.action} style={{
            display:"flex",
            alignItems:"center",
            gap:6,
            padding:"7px 14px",
            borderRadius:T.r.md,
            background:themeColor,
            border:"none",
            color:"#fff",
            fontSize:11,
            fontFamily:"'IBM Plex Sans',sans-serif",
            fontWeight:600,
            cursor:"pointer",
            boxShadow:`0 2px 8px ${themeColor}30`,
            transition:"all 0.15s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.02)";
            e.currentTarget.style.boxShadow = `0 3px 12px ${themeColor}40`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = `0 2px 8px ${themeColor}30`;
          }}>
            <Ico name={tool.icon} size={13} color="#fff" sw={2} />
            <span>{tool.label}</span>
          </button>
        ))}
        <div style={{ width:1, height:24, background:T.divider }} />
        <button style={{
          width:32,
          height:32,
          borderRadius:T.r.md,
          background:T.glass,
          border:`1px solid ${T.glassBorder}`,
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          cursor:"pointer",
          transition:"all 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = T.glassHover;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = T.glass;
        }}>
          <Ico name="bell" size={15} color={T.textMuted} />
        </button>
        <button style={{
          width:32,
          height:32,
          borderRadius:"50%",
          background:T.primaryGrad,
          border:"none",
          display:"flex",
          alignItems:"center",
          justifyContent:"center",
          cursor:"pointer",
          boxShadow:"0 2px 8px rgba(23,77,56,0.2)",
        }}>
          <span style={{ fontSize:12, fontWeight:700, color:"#fff" }}>U</span>
        </button>
      </div>
    </div>
  );
}

// ─── SHELL ───────────────────────────────────────────────────────
const PAGE_MAP = { dashboard:PgDashboard, agenda:PgAgenda, pacientes:PgPacientes, comunicacoes:PgComunicacoes, suprimentos:PgSuprimentos, financeiro:PgFinanceiro, analytics:PgAnalytics, config:PgConfig };

function Shell({ initialPage = "dashboard" }) {
  const [active, setActive] = React.useState(initialPage);
  const Page = PAGE_MAP[active] || PgDashboard;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"80px 1fr", height:"100%", overflow:"hidden" }}>
      <div style={{ background:T.metalGrad, backdropFilter:`blur(${T.glassBlur}px) saturate(160%)`, WebkitBackdropFilter:`blur(${T.glassBlur}px) saturate(160%)`, borderRight:`1px solid ${T.metalBorder}`, display:"flex", flexDirection:"column", alignItems:"center", padding:"16px 6px", gap:2, position:"relative", boxShadow:"inset -1px 0 0 rgba(255,255,255,0.58)" }}>
        <div style={{ position:"absolute", inset:0, background:T.metalSheen, opacity:0.5, pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:0, left:0, right:0, height:"40%", background:T.metalHighlight, opacity:0.55, pointerEvents:"none" }} />
        <div style={{ width:40, height:40, borderRadius:T.r.lg, background:T.primaryGrad, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:12, zIndex:1, boxShadow:`0 4px 14px rgba(23,77,56,0.28)` }}><span style={{ color:"#fff", fontWeight:700, fontSize:18, fontFamily:"'IBM Plex Sans',sans-serif" }}>E</span></div>
        <div style={{ width:"100%", height:1, background:T.divider, marginBottom:6, zIndex:1 }} />
        {NAV.map(item=>{const isActive=item.id===active;const m=item.mod?T[item.mod]:null;return(
          <button key={item.id} onClick={()=>setActive(item.id)} style={{ width:"100%", display:"flex", flexDirection:"column", alignItems:"center", gap:3, padding:"8px 4px", borderRadius:T.r.md, border:isActive?`1px solid ${m?m.color+"30":T.primaryBorder}`:"1px solid transparent", background:isActive?(m?m.bg:T.primaryBg):"transparent", cursor:"pointer", zIndex:1, transition:"all 0.15s" }}>
            <Ico name={item.icon} size={20} color={isActive?(m?m.color:T.primary):T.textMuted} sw={isActive?2:1.7} />
            <Mono size={7.5} spacing="0.3px" color={isActive?(m?m.color:T.primary):T.textMuted}>{item.label.slice(0,8)}</Mono>
          </button>
        );})}
      </div>
      <div style={{ overflow:"hidden", display:"flex", flexDirection:"column" }}>
        <TopToolbar module={active} />
        <Page key={active} />
      </div>
    </div>
  );
}

Object.assign(window, {
  NAV, Shell, PAGE_MAP, MODULE_TOOLS, TopToolbar,
  PgDashboard, PgAgenda, PgPacientes, PgComunicacoes,
  PgSuprimentos, PgFinanceiro, PgAnalytics, PgConfig,
});
