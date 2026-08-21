import type { RegulatoryDocumentExportV1, RegulatoryDocumentSnapshotV1, RegulatoryDocumentStatus, RegulatoryEvidence, RegulatoryValidationIssue, RegulatoryValidationResult, RegulatoryRevision } from "@albatrans/contracts";

const transitions: Record<RegulatoryDocumentStatus, readonly RegulatoryDocumentStatus[]> = {
  draft:["ready","cancelled"],ready:["issued","draft","cancelled"],issued:["in_execution","completed","amended","cancelled"],in_execution:["completed","amended","cancelled"],completed:["amended","archived"],amended:["archived"],cancelled:["archived"],archived:[],
};
export const allowedRegulatoryTransitions=(status:RegulatoryDocumentStatus)=>transitions[status];
export const canTransitionRegulatoryDocument=(from:RegulatoryDocumentStatus,to:RegulatoryDocumentStatus)=>transitions[from].includes(to);
export function validateRegulatorySnapshot(snapshot:RegulatoryDocumentSnapshotV1):RegulatoryValidationResult{
  const errors:RegulatoryValidationIssue[]=[],warnings:RegulatoryValidationIssue[]=[];
  const error=(code:string,path:string,message:string)=>errors.push({code,path,message,severity:"error"});
  const warning=(code:string,path:string,message:string)=>warnings.push({code,path,message,severity:"warning"});
  if(!snapshot.parties.some(p=>p.role==="carrier"&&p.legalName?.trim())) error("carrier_missing","parties.carrier","Falta la empresa transportista.");
  if(!snapshot.stops.some(s=>s.type==="pickup")) error("origin_missing","stops","Falta una parada de origen.");
  if(!snapshot.stops.some(s=>s.type==="delivery")) error("destination_missing","stops","Falta una parada de destino.");
  if(!snapshot.goods.length||snapshot.goods.every(g=>!g.description?.trim())) error("goods_missing","goods","Falta mercancía identificable.");
  if(!snapshot.transport.vehiclePlate) warning("vehicle_missing","transport.vehiclePlate","No consta matrícula del vehículo.");
  if(snapshot.parties.some(p=>!p.phone)) warning("party_phone_missing","parties","Algún participante no tiene teléfono.");
  return {errors,warnings,complete:errors.length===0};
}
function sortValue(value:unknown):unknown{if(Array.isArray(value))return value.map(sortValue);if(value&&typeof value==="object"){return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,sortValue(v)]));}return value;}
export const canonicalizeRegulatorySnapshot=(snapshot:RegulatoryDocumentSnapshotV1)=>JSON.stringify(sortValue(snapshot));
export const regulatoryHashInput=(snapshot:RegulatoryDocumentSnapshotV1)=>new TextEncoder().encode(canonicalizeRegulatorySnapshot(snapshot));
export const revisionRequiresNewSignatures=()=>true;
export function buildRegulatoryExportV1(document:{id:string;documentType:RegulatoryDocumentExportV1["header"]["documentType"];documentNumber:string|null;revision:number;schemaVersion:string;status:RegulatoryDocumentExportV1["header"]["status"];contentHash:string|null;snapshot:RegulatoryDocumentSnapshotV1},signatures:RegulatoryDocumentExportV1["signatures"],evidences:RegulatoryEvidence[],revisions:RegulatoryRevision[]):RegulatoryDocumentExportV1{return{format:"albatrans.regulatory.v1",header:{documentId:document.id,documentType:document.documentType,documentNumber:document.documentNumber,revision:document.revision,schemaVersion:document.schemaVersion,status:document.status,contentHash:document.contentHash},parties:document.snapshot.parties,transport:document.snapshot.transport,stops:document.snapshot.stops,goods:document.snapshot.goods,signatures,evidences,revisions:revisions.map(r=>({revision:r.revisionNumber,hash:r.contentHash,reason:r.reason,createdAt:r.createdAt}))};}
