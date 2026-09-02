import type { ClientInvoiceListItem, ClientTransportListItem, ClientVisibilityPolicy } from "@albatrans/contracts";
import { clientTransportStatusLabel } from "@albatrans/domain";
import { getSupabaseClient } from "../infrastructure/supabase/client";

export interface ClientPortalProfileData {
  organizationName: string;
  customerName: string;
  supportEmail: string | null;
  supportPhone: string | null;
  policy: ClientVisibilityPolicy;
}

export interface ClientTransportDetail extends ClientTransportListItem {
  items: readonly { description: string; packages: number; pallets: number; weightKg: number | null }[];
  incidents: readonly { id: string; title: string; description: string; reportedAt: string }[];
  events: readonly { id: string; eventType: string; occurredAt: string }[];
}

export interface ClientDocumentItem { id: string; title: string; documentType: string; createdAt: string; }

function client() {
  const value = getSupabaseClient();
  if (!value) throw new Error("Supabase no está configurado.");
  return value;
}

export async function loadClientPortalProfile(): Promise<ClientPortalProfileData> {
  const {data,error}=await client().functions.invoke("client-portal",{body:{action:"profile"}});
  if(error||typeof data?.organizationName!=="string"||typeof data?.customerName!=="string"||!data?.policy)throw new Error("No se pudo cargar la configuración del portal.");
  return {
    organizationName:data.organizationName,
    customerName:data.customerName,supportEmail:data.supportEmail??null,supportPhone:data.supportPhone??null,policy:data.policy
  };
}

export async function listClientTransports(search = ""): Promise<ClientTransportListItem[]> {
  const {data,error}=await client().functions.invoke("client-portal",{body:{action:"transports",search:search.trim()}});
  if (error) throw new Error("No se pudieron cargar los transportes.");
  return (data?.items ?? []).map((row: {id:string;order_number:string;status:string|null;priority:string;planned_pickup_at:string|null;planned_delivery_at:string|null;transport_stops:{position:number;locations:{name:string;city:string}|null}[];pod_available:boolean;document_count:number}) => {
    const stops = [...row.transport_stops].sort((a,b)=>a.position-b.position);
    const label=(index:number)=>stops[index]?.locations ? `${stops[index].locations.name}, ${stops[index].locations.city}` : null;
    return { id:row.id, orderNumber:row.order_number, status:row.status??"hidden", statusLabel:row.status?clientTransportStatusLabel(row.status):"En seguimiento", priority:row.priority,
      plannedPickupAt:row.planned_pickup_at, plannedDeliveryAt:row.planned_delivery_at, origin:label(0), destination:label(stops.length-1), podAvailable:row.pod_available, documentCount:row.document_count };
  });
}

export async function loadClientTransport(orderId: string): Promise<ClientTransportDetail> {
  const rows=await listClientTransports(); const base=rows.find((item)=>item.id===orderId); if(!base) throw new Error("Transporte no encontrado.");
  const {data,error}=await client().functions.invoke("client-portal",{body:{action:"transport_detail",orderId}});if(error)throw new Error("No se pudo cargar el detalle del transporte.");
  return {...base,items:(data.items??[]).map((x:{description:string;packages:number;pallets:number;weight_kg:number|null})=>({description:x.description,packages:x.packages,pallets:x.pallets,weightKg:x.weight_kg})),incidents:(data.incidents??[]).map((x:{id:string;title:string;description:string;reported_at:string})=>({id:x.id,title:x.title,description:x.description,reportedAt:x.reported_at})),events:(data.events??[]).map((x:{id:string;event_type:string;occurred_at:string})=>({id:x.id,eventType:x.event_type,occurredAt:x.occurred_at}))};
}

export async function listClientDocuments(): Promise<ClientDocumentItem[]> {
  const {data,error}=await client().functions.invoke("client-portal",{body:{action:"documents"}});
  if(error) throw new Error("No se pudieron cargar los documentos.");
  return (data?.items??[]).map((x:{id:string;title:string;document_type:string;created_at:string})=>({id:x.id,title:x.title,documentType:x.document_type,createdAt:x.created_at}));
}

export async function listClientInvoices(): Promise<ClientInvoiceListItem[]> {
  const {data,error}=await client().functions.invoke("client-portal",{body:{action:"invoices"}});
  if(error) throw new Error("No se pudieron cargar las facturas.");
  return (data?.items??[]).map((x:{id:string;invoice_number:string;issue_date:string;due_date:string|null;status:string;currency_code:string;total:number;amount_due:number})=>({id:x.id,invoiceNumber:x.invoice_number,issueDate:x.issue_date,dueDate:x.due_date,status:x.status,currencyCode:x.currency_code,totalMinor:Math.round(Number(x.total)*100),amountDueMinor:Math.round(Number(x.amount_due)*100)}));
}

export async function createClientSignedUrl(kind:"document_url"|"invoice_pdf_url",id:string):Promise<string>{
  const {data,error}=await client().functions.invoke("client-portal",{body:{action:kind,[kind==="document_url"?"documentId":"invoiceId"]:id}});
  if(error||typeof data?.url!=="string")throw new Error("No se pudo preparar la descarga segura."); return data.url;
}

export interface ClientAccessItem { id:string; userId:string; role:"client_admin"|"client_viewer"; status:string; displayName:string; phone:string|null; lastAccessAt:string|null; }
export async function listClientAccesses(customerId:string,organizationId?:string):Promise<ClientAccessItem[]>{const {data,error}=await client().functions.invoke("client-portal",{body:{action:"list_accesses",customerId,organizationId}});if(error)throw new Error("No se pudieron cargar los accesos.");return (data?.items??[]).map((x:{id:string;user_id:string;role:"client_admin"|"client_viewer";status:string;last_access_at:string|null;profiles:{display_name:string;phone:string|null}|null})=>({id:x.id,userId:x.user_id,role:x.role,status:x.status,displayName:x.profiles?.display_name??"Usuario",phone:x.profiles?.phone??null,lastAccessAt:x.last_access_at}));}
export async function createClientAccess(input:{customerId:string;organizationId?:string;firstName:string;lastName:string;email:string;phone:string;role:"client_admin"|"client_viewer";password:string;mustChangePassword:boolean}):Promise<void>{const {error}=await client().functions.invoke("client-portal",{body:{action:"create_access",...input,idempotencyKey:crypto.randomUUID()}});if(error)throw new Error("No se pudo crear el acceso.");}
export async function setClientAccessStatus(userId:string,blocked:boolean,organizationId?:string):Promise<void>{const {error}=await client().functions.invoke("client-portal",{body:{action:blocked?"block_access":"reactivate_access",userId,organizationId}});if(error)throw new Error("No se pudo actualizar el acceso.");}
