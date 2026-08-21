import type {
  DriverCommand,
  DriverCompletionPolicy,
  DriverTransportSummary,
  ExecutionStatus,
} from "@albatrans/contracts";
import { FunctionsHttpError } from "@supabase/supabase-js";
import { getSupabaseClient } from "../infrastructure/supabase/client";
import { executeDocumentCommand, uploadDocument } from "./documents-repository";
import { signRegulatoryDocument } from "./regulatory-documents-repository";
export interface DriverStop {
  id: string;
  stop_type: string;
  window_starts_at: string | null;
  notes: string | null;
  location: {
    name: string;
    address_line_1: string;
    address_line_2: string | null;
    postal_code: string;
    city: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
}
export interface DriverItem {
  id: string;
  description: string;
  reference: string | null;
  packages: number;
  pallets: number;
  weight_kg: number | null;
  volume_m3: number | null;
  notes: string | null;
}
export interface DriverDetail {
  order: {
    id: string;
    organization_id: string;
    order_number: string;
    priority: string;
    planned_pickup_at: string | null;
    planned_delivery_at: string | null;
    notes: string | null;
  };
  execution: {
    status: ExecutionStatus;
    arrived_pickup_at: string | null;
    loading_started_at: string | null;
    loading_completed_at: string | null;
    departed_pickup_at: string | null;
    arrived_delivery_at: string | null;
    unloading_started_at: string | null;
    unloading_completed_at: string | null;
    completed_at: string | null;
  };
  stops: DriverStop[];
  items: DriverItem[];
  incidents: Array<
    { id: string; title: string; severity: string; status: string }
  >;
  notes: Array<{ id: string; body: string; created_at: string }>;
  vehiclePlate: string | null;
  policy: DriverCompletionPolicy;
  facts: {
    hasPod: boolean;
    hasSignature: boolean;
    hasDocument: boolean;
    hasOpenCriticalIncident: boolean;
  };
  regulatoryDocuments?: Array<{ id: string; document_type: string; document_number: string | null; status: string; revision_number: number; document_id: string | null }>;
}
async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const client = getSupabaseClient();
  if (!client) throw new Error("Supabase no está configurado.");
  const result = await client.functions.invoke<T>("driver-portal", { body });
  if (result.error) {
    if (result.error instanceof FunctionsHttpError) {
      const value: unknown = await result.error.context.json();
      if (errorBody(value)) throw new Error(value.error.message);
    }
    throw result.error;
  }
  if (result.data === null) throw new Error("Respuesta vacía.");
  return result.data;
}
export const loadDriverTransports = () =>
  invoke<DriverTransportSummary[]>({ action: "list" });
export const loadDriverTransport = (orderId: string) =>
  invoke<DriverDetail>({ action: "detail", orderId });
export const executeDriverCommand = (command: DriverCommand) =>
  invoke<Record<string, unknown>>({
    action: "command",
    orderId: command.transportOrderId,
    command,
  });
export async function uploadDriverPod(
  organizationId: string,
  orderId: string,
  file: File,
  recipientName: string,
) {
  if (
    !["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(
      file.type,
    ) || file.size > 10 * 1024 * 1024
  ) {
    throw new Error(
      "El archivo debe ser JPEG, PNG, WebP o PDF y no superar 10 MB.",
    );
  }
  const uploaded = await uploadDocument({
    organizationId,
    documentType: "proof_of_delivery",
    title: `POD ${orderId}`,
    source: file.type.startsWith("image/") ? "camera" : "upload",
    originalFilename: file.name,
    mimeType: file.type as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "application/pdf",
    sizeBytes: file.size,
    relations: { transportOrderId: orderId },
  }, file);
  await executeDocumentCommand({
    action: "create_pod",
    organizationId,
    documentId: uploaded.documentId,
    transportOrderId: orderId,
    values: {
      deliveredAt: new Date().toISOString(),
      recipientName: recipientName.trim() || "Receptor no indicado",
    },
  });
  return uploaded;
}
export async function uploadDriverSignature(organizationId:string,orderId:string,file:File,signerName:string){
  const uploaded=await uploadDocument({organizationId,documentType:"receipt_signature",title:`Firma de recepción ${orderId}`,source:"generated",originalFilename:file.name,mimeType:"image/png",sizeBytes:file.size,relations:{transportOrderId:orderId}},file);
  const signatureValue=await blobDataUrl(file);
  await executeDocumentCommand({action:"create_signature",organizationId,documentId:uploaded.documentId,versionId:uploaded.versionId,transportOrderId:orderId,values:{signatureType:"drawn",signerName:signerName.trim(),signedAt:new Date().toISOString(),signatureValue,signatureDataPath:uploaded.storagePath}});
  const client=getSupabaseClient();
  if(client){const documents=await client.functions.invoke<Array<{id:string;document_id:string|null;status:string}>>("regulatory-documents",{body:{action:"list",organizationId,transportOrderId:orderId,idempotencyKey:crypto.randomUUID()}});if(!documents.error){for(const document of documents.data??[]){if(document.document_id&&["issued","in_execution","completed"].includes(document.status)){await signRegulatoryDocument(organizationId,document.id,{signatureValue,signerName:signerName.trim(),signerRole:"receiver",signatureType:"drawn",signatureDataPath:uploaded.storagePath});}}}}
  return uploaded;
}
function blobDataUrl(file:File):Promise<string>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==="string"?resolve(reader.result):reject(new Error("Firma inválida."));reader.onerror=()=>reject(new Error("No se pudo leer la firma."));reader.readAsDataURL(file);});}
function errorBody(v: unknown): v is { error: { message: string } } {
  return typeof v === "object" && v !== null && "error" in v &&
    typeof v.error === "object" && v.error !== null && "message" in v.error &&
    typeof v.error.message === "string";
}
