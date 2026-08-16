import {describe,expect,it} from "vitest";
import {calculateInvoice,canCancelInvoice,correctiveLines,dueDate,summarizeInvoicePayments} from "./invoicing";
const tax={code:"IVA21",name:"IVA 21 %",kind:"standard" as const,rate:"21"};
describe("facturación fiscal",()=>{
 it("calcula IVA y redondea por línea",()=>{expect(calculateInvoice([{description:"Servicios",quantity:"1",unitPrice:"346.50",tax}])).toMatchObject({subtotal:"346.50",taxTotal:"72.77",total:"419.27"});});
 it("agrega líneas con precisión decimal",()=>{expect(calculateInvoice([{description:"A",quantity:"2",unitPrice:"10.005",tax},{description:"B",quantity:"1",unitPrice:"5",tax:{...tax,rate:"10"}}])).toMatchObject({subtotal:"25.01",taxTotal:"4.70",total:"29.71"});});
 it("soporta exento",()=>{expect(calculateInvoice([{description:"Exento",quantity:"1",unitPrice:"100",tax:{code:"EX",name:"Exento",kind:"exempt",rate:"0"}}]).taxTotal).toBe("0.00");});
 it("calcula vencimiento",()=>expect(dueDate("2026-08-10",30)).toBe("2026-09-09"));
 it("calcula cobro parcial",()=>expect(summarizeInvoicePayments("419.27",["200"])).toMatchObject({amountDue:"219.27",status:"partially_paid"}));
 it("calcula cobro total",()=>expect(summarizeInvoicePayments("419.27",["200","219.27"])).toMatchObject({amountDue:"0.00",status:"paid"}));
 it("rechaza exceso",()=>expect(()=>summarizeInvoicePayments("100",["100.01"])).toThrow(/supera/));
 it("deriva vencida sin cobros",()=>expect(summarizeInvoicePayments("100",[],true).status).toBe("overdue"));
 it("restringe cancelación",()=>{expect(canCancelInvoice("issued")).toBe(true);expect(canCancelInvoice("paid")).toBe(false);expect(canCancelInvoice("rectified")).toBe(false);});
 it("crea contrapartida total negativa",()=>expect(correctiveLines([{description:"A",quantity:"1",unitPrice:"100",tax}])[0].quantity).toBe("-1"));
});
