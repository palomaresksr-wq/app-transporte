import type {
  DriverIncidentInput,
  DriverPortalAction,
  DriverTransportSection,
  DriverTransportSummary,
} from "@albatrans/contracts";
import {
  classifyDriverTransport,
  driverAlternativeActions,
  driverCompletion,
} from "@albatrans/domain";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import {
  type DriverDetail,
  type DriverStop,
  executeDriverCommand,
  loadDriverTransport,
  loadDriverTransports,
  uploadDriverPod,
  uploadDriverSignature,
} from "../../data/driver-portal-repository";
type DriverAction = DriverPortalAction;
const actionLabels: Record<DriverPortalAction, string> = {
  heading_to_pickup: "INICIAR TRAYECTO A CARGA",
  arrived_pickup: "HE LLEGADO A CARGA",
  waiting_pickup: "ESTOY ESPERANDO",
  loading: "INICIAR CARGA",
  loaded: "CARGA TERMINADA",
  departed_pickup: "SALIR DE ORIGEN",
  arrived_delivery: "HE LLEGADO A DESTINO",
  waiting_delivery: "ESTOY ESPERANDO",
  unloading: "INICIAR DESCARGA",
  delivered: "DESCARGA TERMINADA",
  completed: "FINALIZAR TRANSPORTE",
};
export function DriverPortalRoute() {
  const { signOut } = useAuth();
  return (
    <div className="driver-shell">
      <header>
        <Link to="/driver/transports" className="driver-brand">
          Albatrans · Conductor
        </Link>
        <button onClick={() => void signOut()} className="driver-link">
          Salir
        </button>
      </header>
      <DriverRoutes />
    </div>
  );
}
function DriverRoutes() {
  const { orderId } = useParams();
  return orderId ? <DriverDetailPage orderId={orderId} /> : <DriverListPage />;
}
export function DriverListPage() {
  const [items, setItems] = useState<DriverTransportSummary[] | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    loadDriverTransports().then(setItems).catch((e) => setError(message(e)));
  }, []);
  if (error) return <DriverState error={error} />;
  if (!items) return <DriverState />;
  if (!items.length) {
    return <DriverState text="No tienes transportes asignados." />;
  }
  const groups: Record<DriverTransportSection, DriverTransportSummary[]> = {
    today: [],
    upcoming: [],
    recent: [],
  };
  items.forEach((x) =>
    groups[classifyDriverTransport(x.plannedPickupAt, x.status)].push(x)
  );
  return (
    <main className="driver-main">
      <h1>Mis transportes</h1>
      {(["today", "upcoming", "recent"] as const).map((section) => (
        <section key={section}>
          <h2>
            {{
              today: "Hoy",
              upcoming: "Próximos",
              recent: "Completados recientes",
            }[section]}
          </h2>
          {groups[section].length
            ? (
              <div className="driver-card-list">
                {groups[section].map((item) => (
                  <article className="driver-card" key={item.id}>
                    <div>
                      <strong>{item.orderNumber}</strong>
                      <span>{item.status.replaceAll("_", " ")}</span>
                    </div>
                    <p>{item.origin} → {item.destination}</p>
                    <p>
                      {item.packages} bultos · {item.weightKg} kg ·{" "}
                      {item.priority}
                      {item.hasOpenIncident ? " · Incidencia activa" : ""}
                    </p>
                    <Link
                      className="driver-primary"
                      to={`/driver/transports/${item.id}`}
                    >
                      Abrir transporte
                    </Link>
                  </article>
                ))}
              </div>
            )
            : <p className="driver-muted">Sin transportes.</p>}
        </section>
      ))}
    </main>
  );
}
export function DriverDetailPage({ orderId }: { orderId: string }) {
  const navigate = useNavigate(),
    [data, setData] = useState<DriverDetail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [online, setOnline] = useState(navigator.onLine),
    [showIncident, setShowIncident] = useState(false),
    [showNote, setShowNote] = useState(false);
  const refresh = useCallback(
    () =>
      loadDriverTransport(orderId).then(setData).catch((e) =>
        setError(message(e))
      ),
    [orderId],
  );
  useEffect(() => {
    void refresh();
    const on = () => setOnline(navigator.onLine);
    addEventListener("online", on);
    addEventListener("offline", on);
    return () => {
      removeEventListener("online", on);
      removeEventListener("offline", on);
    };
  }, [refresh]);
  async function command(
    target: DriverAction,
    values: Record<string, string | boolean | null> = {},
    resource: "execution" | "incident" | "note" = "execution",
  ) {
    if (!data) return;
    setBusy(true);
    setError("");
    try {
      await executeDriverCommand({
        organizationId: data.order.organization_id,
        transportOrderId: orderId,
        resource,
        action: resource === "execution" ? "transition" : "create",
        targetStatus: resource === "execution" ? target : undefined,
        values,
        idempotencyKey: crypto.randomUUID(),
      });
      await refresh();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  if (!data) return <DriverState error={error} />;
  const actions = driverAlternativeActions(data.execution.status),
    nextStop = nextRelevantStop(data),
    completion = driverCompletion(data.policy, {
      status: data.execution.status,
      ...data.facts,
    });
  return (
    <main className="driver-main driver-detail">
      <button
        className="driver-link"
        onClick={() => navigate("/driver/transports")}
      >
        ← Mis transportes
      </button>
      {!online && (
        <p className="driver-offline" role="status">
          Sin conexión. Tus formularios permanecerán en pantalla; reintenta al
          recuperar cobertura.
        </p>
      )}
      <header className="driver-order-head">
        <div>
          <small>TRANSPORTE</small>
          <h1>{data.order.order_number}</h1>
          <p>
            {data.execution.status.replaceAll("_", " ")} · {data.order.priority}
          </p>
        </div>
        <strong>{data.vehiclePlate ?? "Sin matrícula"}</strong>
      </header>
      {nextStop && <StopCard stop={nextStop} />}
      <WaitingCounter execution={data.execution} />
      <section className="driver-panel">
        <h2>Mercancía</h2>
        {data.items.map((i) => (
          <div key={i.id}>
            <strong>{i.description}</strong>
            <p>
              {i.packages} bultos · {i.pallets} pallets · {i.weight_kg ?? 0}
              {" "}
              kg · {i.volume_m3 ?? 0} m³
            </p>
            {i.reference && <p>Ref. {i.reference}</p>}
          </div>
        ))}
        <button
          className="driver-secondary"
          onClick={() => setShowIncident(true)}
        >
          Registrar discrepancia como incidencia
        </button>
      </section>
      {actions.length > 0 && (
        <section className="driver-actions">
          {actions.map((action) => (
            <button
              key={action}
              className="driver-primary driver-big"
              disabled={busy || !online ||
                (action === "completed" && !completion.allowed)}
              onClick={() => {
                if (
                  action !== "completed" ||
                  confirm("¿Finalizar este transporte?")
                ) void command(action);
              }}
            >
              {busy ? "ENVIANDO…" : actionLabels[action]}
            </button>
          ))}
          {completion.warning && data.execution.status === "delivered" && (
            <p role="alert">⚠ {completion.warning}</p>
          )}
          {!completion.allowed && data.execution.status === "delivered" && (
            <p>Falta: {completion.missing.join(", ")}</p>
          )}
        </section>
      )}
      <div className="driver-tools">
        <button
          className="driver-secondary"
          onClick={() => setShowIncident((v) => !v)}
        >
          Reportar incidencia
        </button>
        <button
          className="driver-secondary"
          onClick={() => setShowNote((v) => !v)}
        >
          Añadir observación
        </button>
      </div>
      {showIncident && (
        <IncidentForm
          disabled={busy || !online}
          submit={(v) => command("heading_to_pickup", v, "incident")}
        />
      )} {showNote && (
        <NoteForm
          disabled={busy || !online}
          submit={(v) => command("heading_to_pickup", { body: v }, "note")}
        />
      )}
      <DeliveryPanel data={data} online={online} refresh={refresh} />
      {data.execution.status === "completed" && (
        <section className="driver-complete">
          <h2>Transporte completado</h2>
          <p>
            {data.order.order_number} · {data.execution.completed_at &&
              new Date(data.execution.completed_at).toLocaleString("es-ES")}
          </p>
        </section>
      )}
      {error && <p className="form-error" role="alert">{error}</p>}
    </main>
  );
}
function WaitingCounter({ execution }: { execution: DriverDetail["execution"] }) {
  const started = execution.status === "waiting_pickup" ? execution.arrived_pickup_at : execution.status === "waiting_delivery" ? execution.arrived_delivery_at : null;
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (!started) return; const id=window.setInterval(()=>setNow(Date.now()),5000); return()=>clearInterval(id); }, [started]);
  if (!started) return null;
  const minutes=Math.max(0,Math.floor((now-new Date(started).getTime())/60000));
  return <p className="driver-offline" role="timer">Esperando: {String(Math.floor(minutes/60)).padStart(2,"0")}:{String(minutes%60).padStart(2,"0")}</p>;
}
function DeliveryPanel({data,online,refresh}:{data:DriverDetail;online:boolean;refresh:()=>Promise<void>}){
  const [file,setFile]=useState<File|null>(null),[preview,setPreview]=useState<string|null>(null),[name,setName]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const canvas=useRef<HTMLCanvasElement>(null),drawing=useRef(false),signed=useRef(false);
  useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
  function choose(next:File|null){if(preview)URL.revokeObjectURL(preview);setFile(next);setPreview(next?.type.startsWith("image/")?URL.createObjectURL(next):null);}
  function point(event:React.PointerEvent<HTMLCanvasElement>){const target=event.currentTarget,rect=target.getBoundingClientRect(),ctx=target.getContext("2d");if(!ctx)return;const x=(event.clientX-rect.left)*target.width/rect.width,y=(event.clientY-rect.top)*target.height/rect.height;if(!drawing.current){ctx.beginPath();ctx.moveTo(x,y);drawing.current=true;}else{ctx.lineWidth=3;ctx.lineCap="round";ctx.strokeStyle="#10271d";ctx.lineTo(x,y);ctx.stroke();signed.current=true;}}
  function clear(){const target=canvas.current;target?.getContext("2d")?.clearRect(0,0,target.width,target.height);signed.current=false;}
  async function pod(){if(!file)return;setBusy(true);setError("");try{await uploadDriverPod(data.order.organization_id,data.order.id,file,name);choose(null);await refresh();}catch(e){setError(message(e));}finally{setBusy(false)}}
  async function signature(){const target=canvas.current;if(!target||!signed.current||!name.trim()){setError("Indica el receptor y dibuja la firma.");return;}setBusy(true);setError("");try{const blob=await new Promise<Blob>((resolve,reject)=>target.toBlob(v=>v?resolve(v):reject(new Error("No se pudo generar la firma.")),"image/png"));await uploadDriverSignature(data.order.organization_id,data.order.id,new File([blob],"firma-recepcion.png",{type:"image/png"}),name);clear();await refresh();}catch(e){setError(message(e));}finally{setBusy(false)}}
  return <section className="driver-panel"><h2>Captura POD y firma</h2><label>Nombre receptor<input value={name} onChange={e=>setName(e.target.value)}/></label><label className="driver-upload">Foto/PDF POD<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" capture="environment" disabled={!online||busy} onChange={e=>choose(e.target.files?.[0]??null)}/></label>{preview&&<img className="driver-preview" src={preview} alt="Vista previa del POD"/>}{file&&<div className="driver-tools"><button className="driver-secondary" onClick={()=>choose(null)}>Quitar</button><button className="driver-primary" disabled={busy||!online} onClick={()=>void pod()}>Subir POD</button></div>}<h3>Firma de recepción</h3><canvas ref={canvas} width={640} height={240} className="driver-signature" aria-label="Área para firma dibujada" onPointerDown={point} onPointerMove={e=>drawing.current&&point(e)} onPointerUp={()=>drawing.current=false} onPointerLeave={()=>drawing.current=false}/><div className="driver-tools"><button className="driver-secondary" onClick={clear}>Limpiar firma</button><button className="driver-primary" disabled={busy||!online||data.facts.hasSignature} onClick={()=>void signature()}>Guardar firma</button></div>{error&&<p role="alert" className="form-error">{error}</p>}<p className="driver-muted">Storage privado y hash. Firma de recepción no cualificada ni certificada.</p></section>;
}
function StopCard({ stop }: { stop: DriverStop }) {
  const l = stop.location;
  if (!l) return null;
  const address = [l.address_line_1, l.address_line_2, l.postal_code, l.city]
      .filter(Boolean).join(", "),
    maps = `https://www.google.com/maps/search/?api=1&query=${
      encodeURIComponent(
        l.latitude != null && l.longitude != null
          ? `${l.latitude},${l.longitude}`
          : address,
      )
    }`;
  return (
    <section className="driver-next">
      <small>PRÓXIMA PARADA</small>
      <h2>{l.name}</h2>
      <p>{address}</p>
      {stop.window_starts_at && (
        <time>
          {new Date(stop.window_starts_at).toLocaleTimeString("es-ES", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      )}
      <a
        className="driver-secondary"
        href={maps}
        target="_blank"
        rel="noreferrer"
      >
        Abrir navegación
      </a>
    </section>
  );
}
function IncidentForm(
  { disabled, submit }: {
    disabled: boolean;
    submit: (v: Record<string, string>) => Promise<void>;
  },
) {
  const [category, setCategory] = useState<DriverIncidentInput["category"]>(
      "delay",
    ),
    [severity, setSeverity] = useState<DriverIncidentInput["severity"]>(
      "normal",
    ),
    [description, setDescription] = useState("");
  return (
    <form
      className="driver-panel"
      onSubmit={(e) => {
        e.preventDefault();
        void submit({
          category,
          severity,
          title: category === "missing_goods"
            ? "Discrepancia de mercancía"
            : "Incidencia del conductor",
          description,
        });
      }}
    >
      <h2>Reportar incidencia</h2>
      <select
        aria-label="Categoría"
        value={category}
        onChange={(e) =>
          setCategory(e.target.value as DriverIncidentInput["category"])}
      >
        {[
          "delay",
          "breakdown",
          "traffic",
          "customer_absent",
          "wrong_address",
          "missing_goods",
          "damaged_goods",
          "documentation",
          "other",
        ].map((x) => <option key={x} value={x}>{x}</option>)}
      </select>
      <select
        aria-label="Gravedad"
        value={severity}
        onChange={(e) =>
          setSeverity(e.target.value as DriverIncidentInput["severity"])}
      >
        {["low", "normal", "high", "critical"].map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <textarea
        aria-label="Descripción"
        required
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <label>
        Foto opcional<input
          type="file"
          accept="image/*"
          capture="environment"
        />
      </label>
      <button className="driver-primary" disabled={disabled}>
        Enviar incidencia
      </button>
    </form>
  );
}
function NoteForm(
  { disabled, submit }: {
    disabled: boolean;
    submit: (v: string) => Promise<void>;
  },
) {
  const [body, setBody] = useState("");
  return (
    <form
      className="driver-panel"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(body);
      }}
    >
      <h2>Añadir observación</h2>
      <textarea
        required
        value={body}
        onChange={(e) => setBody(e.target.value)}
        aria-label="Observación"
      />
      <button className="driver-primary" disabled={disabled}>
        Guardar observación
      </button>
    </form>
  );
}
function nextRelevantStop(data: DriverDetail) {
  const delivery = [
    "departed_pickup",
    "in_transit",
    "arrived_delivery",
    "waiting_delivery",
    "unloading",
    "delivered",
    "completed",
  ].includes(data.execution.status);
  return data.stops.find((s) =>
    delivery ? s.stop_type === "delivery" : s.stop_type === "pickup"
  ) ?? data.stops[0];
}
function DriverState(
  { error, text = "Cargando transportes…" }: { error?: string; text?: string },
) {
  return (
    <main className="driver-state" role={error ? "alert" : "status"}>
      {error || text}
    </main>
  );
}
function message(value: unknown) {
  return value instanceof Error
    ? value.message
    : "No se pudo completar la operación.";
}
