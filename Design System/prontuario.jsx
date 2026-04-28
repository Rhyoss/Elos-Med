// prontuario.jsx — Prontuário do Paciente + Tela de Consulta Médica
// Uses T, Ico, Glass, Mono, Badge, Btn, Bar, MetalTag, Pill from ds-final-components.jsx

// ─── MOCK DATA ───────────────────────────────────────────────────
const PAT = {
  id:"PAC-0847", name:"Ana Clara Mendes", age:34, dob:"12/03/1992", cpf:"082.445.***-04",
  phone:"(11) 98845-2233", email:"ana.mendes@email.com", blood:"O+", weight:"62 kg", height:"1.65 m",
  allergies:["Dipirona","Látex"], insurance:"SulAmérica Saúde", insuranceId:"SA-2024-88412",
  status:"Ativo", since:"Mar 2023", photo:null, address:"R. das Acácias, 142 — São Paulo, SP",
};

const VITALS = [
  { label:"Pressão", value:"120/80", unit:"mmHg", icon:"activity", trend:"stable" },
  { label:"FC", value:"72", unit:"bpm", icon:"activity", trend:"stable" },
  { label:"SpO₂", value:"98", unit:"%", icon:"activity", trend:"stable" },
  { label:"Temp.", value:"36.4", unit:"°C", icon:"activity", trend:"stable" },
  { label:"IMC", value:"22.8", unit:"kg/m²", icon:"activity", trend:"stable" },
];

const ENCOUNTERS = [
  { id:"ENC-0034", date:"21 Jan 2026", dr:"Dra. Ana Souza", type:"Consulta dermatológica", chief:"Dermatite recorrente nos antebraços", diag:"L20.0 — Dermatite atópica", plan:"Corticoide tópico 2x/dia por 14 dias. Hidratante barreira. Retorno em 30 dias.", status:"Completa", notes:"Paciente refere piora com estresse. Lesões eritematosas difusas em flexuras." },
  { id:"ENC-0028", date:"15 Dez 2025", dr:"Dr. Carlos Lima", type:"Retorno", chief:"Avaliação de melhora do quadro", diag:"L20.0 — Dermatite atópica", plan:"Manter tratamento. Adicionar emoliente noturno.", status:"Completa", notes:"Melhora de 60% das lesões. Sem novas áreas." },
  { id:"ENC-0019", date:"10 Out 2025", dr:"Dra. Ana Souza", type:"Primeira consulta", chief:"Manchas vermelhas que coçam nos braços há 3 meses", diag:"L20.0 — Dermatite atópica", plan:"Biópsia excisional. Corticoide de média potência. Retorno com resultado.", status:"Completa", notes:"Paciente jovem, sem comorbidades. Histórico familiar de atopia." },
];

const PRESCRIPTIONS = [
  { id:"RX-0042", date:"21 Jan 2026", dr:"Dra. Ana Souza", items:[
    { name:"Mometasona furoato 0.1% creme", dose:"Aplicar fina camada nas lesões", freq:"2x/dia", dur:"14 dias" },
    { name:"Ceramidas Reparadora Loção", dose:"Aplicar no corpo todo", freq:"Após banho", dur:"Contínuo" },
  ], status:"Ativa" },
  { id:"RX-0031", date:"15 Dez 2025", dr:"Dr. Carlos Lima", items:[
    { name:"Dexametasona 0.05% creme", dose:"Fina camada nas lesões", freq:"1x/dia", dur:"7 dias" },
  ], status:"Encerrada" },
];

const PROTOCOLS = [
  { id:"PROT-008", name:"Fototerapia UVB Narrow Band", sessions:{ done:8, total:12 }, start:"Nov 2025", status:"Em andamento", nextSession:"28 Jan 2026" },
];

const IMAGES = [
  { id:"IMG-001", date:"21 Jan 2026", region:"Antebraço D", type:"Dermoscopia", notes:"Lesão eritematosa 2.3cm — padrão reticular" },
  { id:"IMG-002", date:"21 Jan 2026", region:"Fossa cubital E", type:"Clínica", notes:"Liquenificação leve — prurigo crônico" },
  { id:"IMG-003", date:"10 Out 2025", region:"Antebraço D", type:"Dermoscopia", notes:"Lesão inicial — baseline para comparação" },
];

const TIMELINE = [
  { date:"21 Jan 2026", type:"consulta", label:"Consulta — Dra. Ana Souza", detail:"Dermatite recorrente" },
  { date:"21 Jan 2026", type:"prescricao", label:"Prescrição RX-0042 emitida", detail:"Mometasona + Ceramidas" },
  { date:"21 Jan 2026", type:"imagem", label:"2 imagens capturadas", detail:"Dermoscopia + Clínica" },
  { date:"15 Dez 2025", type:"consulta", label:"Retorno — Dr. Carlos Lima", detail:"Melhora de 60%" },
  { date:"15 Dez 2025", type:"prescricao", label:"Prescrição RX-0031 emitida", detail:"Dexametasona creme" },
  { date:"10 Out 2025", type:"consulta", label:"Primeira consulta — Dra. Ana Souza", detail:"Biópsia solicitada" },
  { date:"10 Out 2025", type:"imagem", label:"1 imagem capturada", detail:"Baseline dermoscopia" },
];

// ─── PRONTUÁRIO VIEW ─────────────────────────────────────────────
function Prontuario() {
  const [tab, setTab] = React.useState("resumo");
  const tabs = [
    { id:"resumo", label:"Resumo", icon:"grid" },
    { id:"consultas", label:"Consultas", icon:"calendar" },
    { id:"prescricoes", label:"Prescrições", icon:"file" },
    { id:"protocolos", label:"Protocolos", icon:"layers" },
    { id:"imagens", label:"Imagens", icon:"image" },
    { id:"timeline", label:"Timeline", icon:"clock" },
  ];

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      {/* Patient sidebar */}
      <div style={{ width:256, borderRight:`1px solid ${T.divider}`, overflowY:"auto", flexShrink:0, display:"flex", flexDirection:"column" }}>
        {/* Header */}
        <div style={{ padding:"18px 16px", borderBottom:`1px solid ${T.divider}` }}>
          <div style={{ display:"flex", gap:12, marginBottom:12 }}>
            <div style={{ width:56, height:56, borderRadius:T.r.xl, background:T.clinical.bg, border:`1px solid ${T.clinical.color}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Ico name="user" size={28} color={T.clinical.color} />
            </div>
            <div>
              <p style={{ fontSize:16, fontWeight:700, color:T.textPrimary, lineHeight:1.2 }}>{PAT.name}</p>
              <Mono size={9}>{PAT.id} · {PAT.age} anos</Mono>
              <div style={{ marginTop:4 }}><Badge variant="success">{PAT.status}</Badge></div>
            </div>
          </div>
        </div>
        {/* Info cards */}
        <div style={{ padding:"12px 14px", display:"flex", flexDirection:"column", gap:8, flex:1 }}>
          {[
            ["Data de nascimento", PAT.dob],
            ["CPF", PAT.cpf],
            ["Telefone", PAT.phone],
            ["Email", PAT.email],
            ["Tipo sanguíneo", PAT.blood],
            ["Peso / Altura", `${PAT.weight} · ${PAT.height}`],
            ["Convênio", PAT.insurance],
            ["N° Convênio", PAT.insuranceId],
            ["Paciente desde", PAT.since],
          ].map(([k,v]) => (
            <div key={k} style={{ padding:"7px 10px", borderRadius:T.r.md, background:T.glass, border:`1px solid ${T.glassBorder}` }}>
              <Mono size={7} spacing="0.8px">{k.toUpperCase()}</Mono>
              <p style={{ fontSize:12, color:T.textPrimary, marginTop:2 }}>{v}</p>
            </div>
          ))}
          {/* Allergies */}
          <div style={{ padding:"7px 10px", borderRadius:T.r.md, background:T.dangerBg, border:`1px solid ${T.dangerBorder}` }}>
            <Mono size={7} spacing="0.8px" color={T.danger}>ALERGIAS</Mono>
            <div style={{ display:"flex", gap:4, marginTop:4, flexWrap:"wrap" }}>
              {PAT.allergies.map(a => <Badge key={a} variant="danger" dot={false}>{a}</Badge>)}
            </div>
          </div>
          <div style={{ marginTop:"auto", padding:"8px 10px", borderRadius:T.r.md, background:T.primaryBg, border:`1px solid ${T.primaryBorder}` }}>
            <Mono size={7} color={T.primary}>ENDEREÇO</Mono>
            <p style={{ fontSize:11, color:T.textSecondary, marginTop:2 }}>{PAT.address}</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>
        {/* Tab bar */}
        <div style={{ padding:"0 20px", borderBottom:`1px solid ${T.divider}`, display:"flex", gap:0, flexShrink:0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              padding:"12px 16px", display:"flex", alignItems:"center", gap:6,
              borderBottom: tab===t.id ? `2px solid ${T.primary}` : "2px solid transparent",
              background:"transparent", border:"none", borderBottomStyle:"solid",
              color: tab===t.id ? T.primary : T.textMuted,
              fontSize:12, fontFamily:"'IBM Plex Sans',sans-serif", fontWeight: tab===t.id ? 600 : 400,
              cursor:"pointer", transition:"all 0.15s",
            }}>
              <Ico name={t.icon} size={14} color={tab===t.id ? T.primary : T.textMuted} />
              {t.label}
            </button>
          ))}
          <div style={{ flex:1 }} />
          <div style={{ display:"flex", gap:6, alignItems:"center", padding:"8px 0" }}>
            <Btn variant="glass" small icon="printer">Imprimir</Btn>
            <Btn small icon="edit">Nova Consulta</Btn>
          </div>
        </div>

        {/* Tab content */}
        <div style={{ flex:1, overflowY:"auto", padding:"18px 22px" }}>
          {tab === "resumo" && <TabResumo />}
          {tab === "consultas" && <TabConsultas />}
          {tab === "prescricoes" && <TabPrescricoes />}
          {tab === "protocolos" && <TabProtocolos />}
          {tab === "imagens" && <TabImagens />}
          {tab === "timeline" && <TabTimeline />}
        </div>
      </div>
    </div>
  );
}

function TabResumo() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Vitals */}
      <div>
        <Mono size={9} spacing="1.2px" color={T.primary}>SINAIS VITAIS — ÚLTIMA AFERIÇÃO (21 JAN 2026)</Mono>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginTop:10 }}>
          {VITALS.map(v => (
            <Glass key={v.label} style={{ padding:"12px 14px", textAlign:"center" }}>
              <Mono size={8}>{v.label.toUpperCase()}</Mono>
              <p style={{ fontSize:22, fontWeight:700, color:T.textPrimary, margin:"6px 0 2px", letterSpacing:"-0.02em" }}>{v.value}</p>
              <Mono size={8} color={T.textMuted}>{v.unit}</Mono>
            </Glass>
          ))}
        </div>
      </div>
      {/* Last encounter + Active prescription */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <Glass style={{ padding:"16px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
            <Mono size={9} spacing="1px" color={T.primary}>ÚLTIMA CONSULTA</Mono>
            <Badge variant="success" dot={false}>{ENCOUNTERS[0].status}</Badge>
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:T.textPrimary, marginBottom:3 }}>{ENCOUNTERS[0].type}</p>
          <Mono size={9}>{ENCOUNTERS[0].date} · {ENCOUNTERS[0].dr}</Mono>
          <div style={{ marginTop:10, padding:"8px 10px", borderRadius:T.r.md, background:T.primaryBg, border:`1px solid ${T.primaryBorder}` }}>
            <Mono size={7} color={T.primary}>QUEIXA PRINCIPAL</Mono>
            <p style={{ fontSize:12, color:T.textPrimary, marginTop:3 }}>{ENCOUNTERS[0].chief}</p>
          </div>
          <div style={{ marginTop:8, padding:"8px 10px", borderRadius:T.r.md, background:T.glass, border:`1px solid ${T.glassBorder}` }}>
            <Mono size={7}>DIAGNÓSTICO</Mono>
            <p style={{ fontSize:12, color:T.textPrimary, marginTop:3 }}>{ENCOUNTERS[0].diag}</p>
          </div>
        </Glass>
        <Glass metal style={{ padding:"16px 18px" }}>
          <Mono size={9} spacing="1px" color={T.primary}>PRESCRIÇÃO ATIVA</Mono>
          <div style={{ marginTop:10 }}>
            {PRESCRIPTIONS[0].items.map((item,i) => (
              <div key={i} style={{ padding:"8px 10px", borderRadius:T.r.md, background:T.glass, border:`1px solid ${T.glassBorder}`, marginBottom:8 }}>
                <p style={{ fontSize:12, fontWeight:600, color:T.textPrimary }}>{item.name}</p>
                <div style={{ display:"flex", gap:12, marginTop:4 }}>
                  <div><Mono size={7}>DOSE</Mono><p style={{ fontSize:10, color:T.textSecondary, marginTop:1 }}>{item.dose}</p></div>
                  <div><Mono size={7}>FREQ.</Mono><p style={{ fontSize:10, color:T.textSecondary, marginTop:1 }}>{item.freq}</p></div>
                  <div><Mono size={7}>DURAÇÃO</Mono><p style={{ fontSize:10, color:T.textSecondary, marginTop:1 }}>{item.dur}</p></div>
                </div>
              </div>
            ))}
            <Mono size={8}>{PRESCRIPTIONS[0].date} · {PRESCRIPTIONS[0].dr}</Mono>
          </div>
        </Glass>
      </div>
      {/* Protocol */}
      {PROTOCOLS.length > 0 && (
        <Glass style={{ padding:"16px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
            <Mono size={9} spacing="1px" color={T.primary}>PROTOCOLO EM ANDAMENTO</Mono>
            <Badge variant="default">{PROTOCOLS[0].status}</Badge>
          </div>
          <p style={{ fontSize:14, fontWeight:600, color:T.textPrimary, marginBottom:4 }}>{PROTOCOLS[0].name}</p>
          <div style={{ display:"flex", gap:16, marginBottom:10 }}>
            <div><Mono size={7}>SESSÕES</Mono><p style={{ fontSize:13, fontWeight:700, color:T.textPrimary, marginTop:2 }}>{PROTOCOLS[0].sessions.done}/{PROTOCOLS[0].sessions.total}</p></div>
            <div><Mono size={7}>INÍCIO</Mono><p style={{ fontSize:12, color:T.textSecondary, marginTop:2 }}>{PROTOCOLS[0].start}</p></div>
            <div><Mono size={7}>PRÓXIMA</Mono><p style={{ fontSize:12, color:T.primary, fontWeight:600, marginTop:2 }}>{PROTOCOLS[0].nextSession}</p></div>
          </div>
          <Bar pct={(PROTOCOLS[0].sessions.done / PROTOCOLS[0].sessions.total) * 100} color={T.clinical.color} height={5} />
        </Glass>
      )}
    </div>
  );
}

function TabConsultas() {
  const [expanded, setExpanded] = React.useState(ENCOUNTERS[0].id);
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
      {ENCOUNTERS.map(enc => {
        const isOpen = expanded === enc.id;
        return (
          <Glass key={enc.id} hover style={{ padding:0, overflow:"hidden" }}>
            <div onClick={()=>setExpanded(isOpen?null:enc.id)} style={{ padding:"14px 18px", cursor:"pointer", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:32, height:32, borderRadius:T.r.md, background:T.clinical.bg, display:"flex", alignItems:"center", justifyContent:"center" }}><Ico name="calendar" size={16} color={T.clinical.color} /></div>
                <div>
                  <p style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>{enc.type}</p>
                  <Mono size={9}>{enc.date} · {enc.dr}</Mono>
                </div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <Badge variant="success" dot={false}>{enc.status}</Badge>
                <Ico name="chevDown" size={16} color={T.textMuted} />
              </div>
            </div>
            {isOpen && (
              <div style={{ padding:"0 18px 18px", borderTop:`1px solid ${T.divider}` }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:14 }}>
                  <div style={{ padding:"10px 12px", borderRadius:T.r.md, background:T.primaryBg, border:`1px solid ${T.primaryBorder}` }}>
                    <Mono size={7} color={T.primary}>QUEIXA PRINCIPAL</Mono>
                    <p style={{ fontSize:12, color:T.textPrimary, marginTop:4, lineHeight:1.5 }}>{enc.chief}</p>
                  </div>
                  <div style={{ padding:"10px 12px", borderRadius:T.r.md, background:T.glass, border:`1px solid ${T.glassBorder}` }}>
                    <Mono size={7}>DIAGNÓSTICO</Mono>
                    <p style={{ fontSize:12, color:T.textPrimary, marginTop:4 }}>{enc.diag}</p>
                  </div>
                </div>
                <div style={{ marginTop:10, padding:"10px 12px", borderRadius:T.r.md, background:T.glass, border:`1px solid ${T.glassBorder}` }}>
                  <Mono size={7}>OBSERVAÇÕES CLÍNICAS</Mono>
                  <p style={{ fontSize:12, color:T.textSecondary, marginTop:4, lineHeight:1.6 }}>{enc.notes}</p>
                </div>
                <div style={{ marginTop:10, padding:"10px 12px", borderRadius:T.r.md, background:T.clinical.bg, border:`1px solid ${T.clinical.color}15` }}>
                  <Mono size={7} color={T.clinical.color}>PLANO DE TRATAMENTO</Mono>
                  <p style={{ fontSize:12, color:T.textPrimary, marginTop:4, lineHeight:1.6 }}>{enc.plan}</p>
                </div>
              </div>
            )}
          </Glass>
        );
      })}
    </div>
  );
}

function TabPrescricoes() {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      {PRESCRIPTIONS.map(rx => (
        <Glass key={rx.id} style={{ padding:"16px 18px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={{ width:32, height:32, borderRadius:T.r.md, background:T.primaryBg, display:"flex", alignItems:"center", justifyContent:"center" }}><Ico name="file" size={16} color={T.primary} /></div>
              <div><p style={{ fontSize:13, fontWeight:600, color:T.textPrimary }}>{rx.id}</p><Mono size={9}>{rx.date} · {rx.dr}</Mono></div>
            </div>
            <div style={{ display:"flex", gap:6 }}><Badge variant={rx.status==="Ativa"?"success":"default"} dot={false}>{rx.status}</Badge><Btn variant="ghost" small icon="printer">PDF</Btn></div>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["Medicamento","Posologia","Frequência","Duração"].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:8, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"1px", color:T.textMuted, fontWeight:500, borderBottom:`1px solid ${T.divider}` }}>{h}</th>)}</tr></thead>
            <tbody>{rx.items.map((item,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${T.divider}` }}>
                <td style={{ padding:"10px 12px", fontSize:12, fontWeight:500, color:T.textPrimary }}>{item.name}</td>
                <td style={{ padding:"10px 12px", fontSize:11, color:T.textSecondary }}>{item.dose}</td>
                <td style={{ padding:"10px 12px", fontSize:11, color:T.textSecondary }}>{item.freq}</td>
                <td style={{ padding:"10px 12px" }}><Badge variant="default" dot={false}>{item.dur}</Badge></td>
              </tr>
            ))}</tbody>
          </table>
        </Glass>
      ))}
    </div>
  );
}

function TabProtocolos() {
  return PROTOCOLS.map(p => (
    <Glass key={p.id} style={{ padding:"18px 20px" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:12 }}>
        <div><p style={{ fontSize:15, fontWeight:700, color:T.textPrimary }}>{p.name}</p><Mono size={9}>{p.id}</Mono></div>
        <Badge>{p.status}</Badge>
      </div>
      <div style={{ display:"flex", gap:24, marginBottom:14 }}>
        <div><Mono size={7}>SESSÕES</Mono><p style={{ fontSize:20, fontWeight:700, color:T.textPrimary, marginTop:3 }}>{p.sessions.done}<span style={{ fontSize:14, color:T.textMuted }}>/{p.sessions.total}</span></p></div>
        <div><Mono size={7}>INÍCIO</Mono><p style={{ fontSize:13, color:T.textSecondary, marginTop:3 }}>{p.start}</p></div>
        <div><Mono size={7}>PRÓXIMA SESSÃO</Mono><p style={{ fontSize:13, fontWeight:600, color:T.primary, marginTop:3 }}>{p.nextSession}</p></div>
      </div>
      <Bar pct={(p.sessions.done/p.sessions.total)*100} color={T.clinical.color} height={6} />
    </Glass>
  ));
}

function TabImagens() {
  return (
    <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
      {IMAGES.map(img => (
        <Glass key={img.id} hover style={{ padding:0, overflow:"hidden" }}>
          {/* Placeholder image area */}
          <div style={{ height:140, background:`linear-gradient(145deg, ${T.clinical.bg}, ${T.glass})`, display:"flex", alignItems:"center", justifyContent:"center", borderBottom:`1px solid ${T.divider}` }}>
            <div style={{ textAlign:"center" }}>
              <Ico name="image" size={32} color={T.clinical.color} />
              <p style={{ fontSize:10, color:T.textMuted, marginTop:4 }}>{img.type}</p>
            </div>
          </div>
          <div style={{ padding:"12px 14px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
              <Mono size={8} color={T.primary}>{img.region.toUpperCase()}</Mono>
              <Mono size={8}>{img.date}</Mono>
            </div>
            <p style={{ fontSize:11, color:T.textSecondary, lineHeight:1.5 }}>{img.notes}</p>
          </div>
        </Glass>
      ))}
    </div>
  );
}

function TabTimeline() {
  const typeIcon = { consulta:"calendar", prescricao:"file", imagem:"image" };
  const typeColor = { consulta:T.clinical.color, prescricao:T.primary, imagem:T.supply.color };
  return (
    <div style={{ position:"relative", paddingLeft:24 }}>
      {/* Vertical line */}
      <div style={{ position:"absolute", left:10, top:0, bottom:0, width:1, background:T.divider }} />
      {TIMELINE.map((ev,i) => {
        const ic = typeIcon[ev.type] || "grid";
        const clr = typeColor[ev.type] || T.primary;
        const showDate = i===0 || TIMELINE[i-1].date !== ev.date;
        return (
          <div key={i}>
            {showDate && <div style={{ marginBottom:8, marginLeft:-24 }}><Mono size={9} spacing="1px" color={T.textMuted}>{ev.date.toUpperCase()}</Mono></div>}
            <div style={{ display:"flex", gap:12, marginBottom:14, position:"relative" }}>
              <div style={{ width:20, height:20, borderRadius:"50%", background:clr+"12", border:`1.5px solid ${clr}`, display:"flex", alignItems:"center", justifyContent:"center", position:"absolute", left:-24, flexShrink:0, zIndex:1, backgroundColor:T.bg }}>
                <Ico name={ic} size={10} color={clr} />
              </div>
              <div style={{ marginLeft:8 }}>
                <p style={{ fontSize:12, fontWeight:600, color:T.textPrimary }}>{ev.label}</p>
                <p style={{ fontSize:11, color:T.textMuted }}>{ev.detail}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── TELA DE CONSULTA (PREENCHIMENTO AO VIVO) ────────────────────
function ConsultaViva() {
  const [chief, setChief] = React.useState("");
  const [hda, setHda] = React.useState("");
  const [examFisico, setExamFisico] = React.useState("");
  const [diag, setDiag] = React.useState("");
  const [plan, setPlan] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [vitals, setVitals] = React.useState({ pa:"", fc:"", spo2:"", temp:"", peso:"" });
  const [rxItems, setRxItems] = React.useState([{ name:"", dose:"", freq:"", dur:"" }]);
  const [saved, setSaved] = React.useState(false);

  const addRxItem = () => setRxItems([...rxItems, { name:"", dose:"", freq:"", dur:"" }]);
  const updateRx = (idx, field, val) => { const n = [...rxItems]; n[idx][field] = val; setRxItems(n); };

  const handleSave = () => { setSaved(true); setTimeout(()=>setSaved(false), 2000); };

  const iS = { width:"100%", padding:"8px 12px", borderRadius:T.r.md, background:T.inputBg, border:`1px solid ${T.inputBorder}`, color:T.textPrimary, fontSize:12, fontFamily:"'IBM Plex Sans',sans-serif", outline:"none", transition:"border 0.15s" };
  const tS = { ...iS, resize:"vertical", minHeight:60 };

  return (
    <div style={{ display:"flex", height:"100%", overflow:"hidden" }}>
      {/* Patient mini sidebar */}
      <div style={{ width:220, borderRight:`1px solid ${T.divider}`, overflowY:"auto", flexShrink:0, padding:"16px 12px", display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ display:"flex", gap:10, marginBottom:6 }}>
          <div style={{ width:42, height:42, borderRadius:T.r.lg, background:T.clinical.bg, border:`1px solid ${T.clinical.color}18`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <Ico name="user" size={20} color={T.clinical.color} />
          </div>
          <div>
            <p style={{ fontSize:14, fontWeight:700, color:T.textPrimary }}>{PAT.name}</p>
            <Mono size={9}>{PAT.id} · {PAT.age} anos</Mono>
          </div>
        </div>
        {[["Tipo sanguíneo",PAT.blood],["Peso / Altura",`${PAT.weight} · ${PAT.height}`],["Convênio",PAT.insurance]].map(([k,v])=>(
          <div key={k} style={{ padding:"6px 8px", borderRadius:T.r.sm, background:T.glass, border:`1px solid ${T.glassBorder}` }}>
            <Mono size={6} spacing="0.8px">{k.toUpperCase()}</Mono>
            <p style={{ fontSize:11, color:T.textPrimary, marginTop:1 }}>{v}</p>
          </div>
        ))}
        <div style={{ padding:"6px 8px", borderRadius:T.r.sm, background:T.dangerBg, border:`1px solid ${T.dangerBorder}` }}>
          <Mono size={6} spacing="0.8px" color={T.danger}>ALERGIAS</Mono>
          <div style={{ display:"flex", gap:3, marginTop:3, flexWrap:"wrap" }}>{PAT.allergies.map(a=><Badge key={a} variant="danger" dot={false}>{a}</Badge>)}</div>
        </div>
        <div style={{ height:1, background:T.divider }} />
        <Mono size={8} spacing="1px" color={T.primary}>ÚLTIMO DIAGNÓSTICO</Mono>
        <p style={{ fontSize:11, color:T.textSecondary, lineHeight:1.5 }}>{ENCOUNTERS[0].diag}</p>
        <Mono size={8} spacing="1px" color={T.primary}>ÚLTIMA PRESCRIÇÃO</Mono>
        {PRESCRIPTIONS[0].items.map((item,i) => (
          <p key={i} style={{ fontSize:10, color:T.textMuted, lineHeight:1.4 }}>{item.name} — {item.freq}</p>
        ))}
        <div style={{ height:1, background:T.divider }} />
        <Mono size={8} spacing="1px" color={T.primary}>PROTOCOLO</Mono>
        <p style={{ fontSize:11, color:T.textSecondary }}>{PROTOCOLS[0].name}</p>
        <div style={{ display:"flex", justifyContent:"space-between" }}>
          <Mono size={9}>Sessões</Mono>
          <span style={{ fontSize:12, fontWeight:700, color:T.textPrimary }}>{PROTOCOLS[0].sessions.done}/{PROTOCOLS[0].sessions.total}</span>
        </div>
        <Bar pct={(PROTOCOLS[0].sessions.done/PROTOCOLS[0].sessions.total)*100} color={T.clinical.color} />
      </div>

      {/* Form area */}
      <div style={{ flex:1, overflowY:"auto", padding:"18px 24px" }}>
        {/* Top bar */}
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background:T.success, boxShadow:`0 0 8px ${T.success}40` }} />
              <Mono size={9} spacing="1px" color={T.success}>CONSULTA EM ANDAMENTO</Mono>
            </div>
            <p style={{ fontSize:18, fontWeight:700, color:T.textPrimary }}>Consulta Dermatológica</p>
            <Mono size={9}>21 JAN 2026 · 09:30 · DRA. ANA SOUZA · CRM 123456-SP</Mono>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn variant="ghost" small icon="eye">Preview</Btn>
            <Btn variant="glass" small icon="printer">Imprimir</Btn>
            <Btn icon="check" onClick={handleSave}>{saved ? "Salvo!" : "Finalizar Consulta"}</Btn>
          </div>
        </div>

        {/* Vitals capture */}
        <Glass metal style={{ padding:"14px 18px", marginBottom:16 }}>
          <Mono size={9} spacing="1px" color={T.primary}>SINAIS VITAIS</Mono>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10, marginTop:10 }}>
            {[
              { key:"pa", label:"PA (mmHg)", placeholder:"120/80" },
              { key:"fc", label:"FC (bpm)", placeholder:"72" },
              { key:"spo2", label:"SpO₂ (%)", placeholder:"98" },
              { key:"temp", label:"Temp (°C)", placeholder:"36.4" },
              { key:"peso", label:"Peso (kg)", placeholder:"62" },
            ].map(v=>(
              <div key={v.key}>
                <Mono size={7} spacing="0.8px">{v.label.toUpperCase()}</Mono>
                <input value={vitals[v.key]} onChange={e=>setVitals({...vitals,[v.key]:e.target.value})} placeholder={v.placeholder} style={{ ...iS, marginTop:4, textAlign:"center", fontFamily:"'IBM Plex Mono',monospace", fontSize:14, fontWeight:600 }} />
              </div>
            ))}
          </div>
        </Glass>

        {/* SOAP-style form */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <Glass style={{ padding:"16px 18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <div style={{ width:22, height:22, borderRadius:T.r.sm, background:T.primaryBg, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:11, fontWeight:700, color:T.primary }}>S</span></div>
              <Mono size={9} spacing="1px" color={T.primary}>SUBJETIVO — QUEIXA PRINCIPAL</Mono>
            </div>
            <textarea value={chief} onChange={e=>setChief(e.target.value)} placeholder="O que traz o paciente à consulta hoje…" style={tS} />
            <div style={{ marginTop:10 }}>
              <Mono size={7}>HDA — HISTÓRIA DA DOENÇA ATUAL</Mono>
              <textarea value={hda} onChange={e=>setHda(e.target.value)} placeholder="Início, duração, fatores de piora/melhora, tratamentos anteriores…" style={{ ...tS, marginTop:4, minHeight:80 }} />
            </div>
          </Glass>

          <Glass style={{ padding:"16px 18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <div style={{ width:22, height:22, borderRadius:T.r.sm, background:T.primaryBg, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:11, fontWeight:700, color:T.primary }}>O</span></div>
              <Mono size={9} spacing="1px" color={T.primary}>OBJETIVO — EXAME FÍSICO</Mono>
            </div>
            <textarea value={examFisico} onChange={e=>setExamFisico(e.target.value)} placeholder="Inspeção, palpação, dermoscopia. Descreva as lesões encontradas…" style={{ ...tS, minHeight:120 }} />
            <div style={{ marginTop:10, display:"flex", gap:8 }}>
              <Btn variant="glass" small icon="image">Capturar Imagem</Btn>
              <Btn variant="ghost" small icon="layers">Body Map</Btn>
            </div>
          </Glass>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:16 }}>
          <Glass style={{ padding:"16px 18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <div style={{ width:22, height:22, borderRadius:T.r.sm, background:T.primaryBg, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:11, fontWeight:700, color:T.primary }}>A</span></div>
              <Mono size={9} spacing="1px" color={T.primary}>AVALIAÇÃO — DIAGNÓSTICO</Mono>
            </div>
            <input value={diag} onChange={e=>setDiag(e.target.value)} placeholder="CID-10 ou descrição clínica…" style={iS} />
            <div style={{ marginTop:8, display:"flex", gap:6, flexWrap:"wrap" }}>
              {["L20.0 — Dermatite atópica","L30.9 — Dermatite NE","L50.0 — Urticária alérgica"].map(sug=>(
                <button key={sug} onClick={()=>setDiag(sug)} style={{ padding:"4px 8px", borderRadius:T.r.sm, background:T.glass, border:`1px solid ${T.glassBorder}`, fontSize:10, color:T.textMuted, cursor:"pointer", fontFamily:"'IBM Plex Sans',sans-serif" }}>{sug}</button>
              ))}
            </div>
          </Glass>

          <Glass style={{ padding:"16px 18px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:8 }}>
              <div style={{ width:22, height:22, borderRadius:T.r.sm, background:T.primaryBg, display:"flex", alignItems:"center", justifyContent:"center" }}><span style={{ fontSize:11, fontWeight:700, color:T.primary }}>P</span></div>
              <Mono size={9} spacing="1px" color={T.primary}>PLANO — CONDUTA</Mono>
            </div>
            <textarea value={plan} onChange={e=>setPlan(e.target.value)} placeholder="Tratamento proposto, encaminhamentos, orientações ao paciente…" style={{ ...tS, minHeight:80 }} />
          </Glass>
        </div>

        {/* Prescription builder */}
        <Glass style={{ padding:"16px 18px", marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}><Ico name="file" size={16} color={T.primary} /><Mono size={9} spacing="1px" color={T.primary}>PRESCRIÇÃO</Mono></div>
            <Btn variant="glass" small icon="plus" onClick={addRxItem}>Adicionar</Btn>
          </div>
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr>{["Medicamento","Posologia","Frequência","Duração",""].map(h=><th key={h} style={{ padding:"6px 10px", textAlign:"left", fontSize:8, fontFamily:"'IBM Plex Mono',monospace", letterSpacing:"1px", color:T.textMuted, fontWeight:500, borderBottom:`1px solid ${T.divider}` }}>{h}</th>)}</tr></thead>
            <tbody>{rxItems.map((item,i)=>(
              <tr key={i} style={{ borderBottom:`1px solid ${T.divider}` }}>
                <td style={{ padding:"6px 4px" }}><input value={item.name} onChange={e=>updateRx(i,"name",e.target.value)} placeholder="Ex: Mometasona 0.1%" style={{ ...iS, padding:"6px 8px" }} /></td>
                <td style={{ padding:"6px 4px" }}><input value={item.dose} onChange={e=>updateRx(i,"dose",e.target.value)} placeholder="Aplicar fina camada" style={{ ...iS, padding:"6px 8px" }} /></td>
                <td style={{ padding:"6px 4px" }}><input value={item.freq} onChange={e=>updateRx(i,"freq",e.target.value)} placeholder="2x/dia" style={{ ...iS, padding:"6px 8px", width:80 }} /></td>
                <td style={{ padding:"6px 4px" }}><input value={item.dur} onChange={e=>updateRx(i,"dur",e.target.value)} placeholder="14 dias" style={{ ...iS, padding:"6px 8px", width:80 }} /></td>
                <td style={{ padding:"6px 4px" }}>{rxItems.length>1&&<button onClick={()=>setRxItems(rxItems.filter((_,j)=>j!==i))} style={{ background:"none", border:"none", cursor:"pointer" }}><Ico name="x" size={14} color={T.danger} /></button>}</td>
              </tr>
            ))}</tbody>
          </table>
        </Glass>

        {/* Notes */}
        <Glass style={{ padding:"16px 18px" }}>
          <Mono size={9} spacing="1px" color={T.primary}>OBSERVAÇÕES ADICIONAIS</Mono>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas internas, lembretes para próxima consulta…" style={{ ...tS, marginTop:8, minHeight:60 }} />
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <MetalTag>LGPD</MetalTag><MetalTag>PHI-SAFE</MetalTag><MetalTag>ANVISA</MetalTag>
          </div>
        </Glass>
      </div>
    </div>
  );
}

Object.assign(window, {
  Prontuario, ConsultaViva, TabResumo, TabConsultas, TabPrescricoes, TabProtocolos, TabImagens, TabTimeline,
});
