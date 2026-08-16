export const invoiceStatuses = ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled", "rectified"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];
export const invoicePaymentMethods = ["bank_transfer", "cash", "card", "direct_debit", "other"] as const;
export type InvoicePaymentMethod = (typeof invoicePaymentMethods)[number];
export const invoiceTaxKinds = ["standard", "reduced", "super_reduced", "zero", "exempt"] as const;
export type InvoiceTaxKind = (typeof invoiceTaxKinds)[number];

export interface InvoiceTaxInput { code: string; name: string; kind: InvoiceTaxKind; rate: string; exemptionReason?: string | null }
export interface InvoiceLineInput {
  description: string;
  quantity: string;
  unitPrice: string;
  tax: InvoiceTaxInput;
  transportOrderId?: string | null;
  valuationId?: string | null;
}
export interface InvoiceLineResult extends InvoiceLineInput {
  subtotal: string;
  taxAmount: string;
  total: string;
}
export interface InvoiceTotals { subtotal: string; taxTotal: string; total: string; lines: InvoiceLineResult[] }
export interface InvoicePaymentSummary { total: string; amountPaid: string; amountDue: string; status: InvoiceStatus }
