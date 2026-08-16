import type { InvoiceLineInput, InvoiceLineResult, InvoicePaymentSummary, InvoiceStatus, InvoiceTotals } from "@albatrans/contracts";

export class InvoiceValidationError extends Error { constructor(message: string) { super(message); this.name = "InvoiceValidationError"; } }
const SCALE = 10000n;
const CENT = 100n;
function decimal(value: string) { if (!/^-?\d+(?:\.\d{1,4})?$/.test(value)) throw new InvoiceValidationError("Decimal inválido."); const sign=value.startsWith("-")?-1n:1n; const [whole,fraction=""] = value.replace("-","").split("."); return sign*(BigInt(whole)*SCALE+BigInt(`${fraction}0000`.slice(0,4))); }
function round(value: bigint, divisor: bigint) { const sign=value<0n?-1n:1n; const abs=value<0n?-value:value; return sign*(abs/divisor+(abs%divisor*2n>=divisor?1n:0n)); }
function money(cents: bigint) { const sign=cents<0n?"-":""; const abs=cents<0n?-cents:cents; return `${sign}${abs/CENT}.${String(abs%CENT).padStart(2,"0")}`; }
export function calculateInvoice(lines: InvoiceLineInput[]): InvoiceTotals {
  if (!lines.length) throw new InvoiceValidationError("La factura necesita líneas.");
  let subtotal=0n,taxTotal=0n;
  const calculated: InvoiceLineResult[]=lines.map((line)=>{ const quantity=decimal(line.quantity),unit=decimal(line.unitPrice),rate=decimal(line.tax.rate); if(quantity<=0n)throw new InvoiceValidationError("La cantidad debe ser positiva."); if(rate<0n)throw new InvoiceValidationError("El impuesto no puede ser negativo."); const sub=round(quantity*unit,1000000n); const tax=round(sub*rate,1000000n); subtotal+=sub;taxTotal+=tax; return {...line,subtotal:money(sub),taxAmount:money(tax),total:money(sub+tax)}; });
  return {subtotal:money(subtotal),taxTotal:money(taxTotal),total:money(subtotal+taxTotal),lines:calculated};
}
export function summarizeInvoicePayments(total: string, payments: string[], overdue=false): InvoicePaymentSummary { const totalCents=round(decimal(total),100n); const paid=payments.reduce((sum,p)=>sum+round(decimal(p),100n),0n); if(paid<0n||paid>totalCents)throw new InvoiceValidationError("El cobro supera el pendiente."); const due=totalCents-paid; const status:InvoiceStatus=due===0n?"paid":paid>0n?"partially_paid":overdue?"overdue":"issued"; return {total:money(totalCents),amountPaid:money(paid),amountDue:money(due),status}; }
export function dueDate(issueDate:string,days:number){if(!Number.isInteger(days)||days<0)throw new InvoiceValidationError("Días de pago inválidos.");const date=new Date(`${issueDate}T00:00:00Z`);if(Number.isNaN(date.valueOf()))throw new InvoiceValidationError("Fecha inválida.");date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);}
export function canCancelInvoice(status:InvoiceStatus){return status==="draft"||status==="issued"||status==="overdue";}
export function correctiveLines(lines:InvoiceLineInput[],partial=false){if(!lines.length)throw new InvoiceValidationError("La rectificativa necesita líneas.");return lines.map(line=>({...line,quantity:partial?line.quantity:`-${line.quantity}`}));}
