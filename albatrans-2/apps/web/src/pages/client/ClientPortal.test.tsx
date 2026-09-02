import { cleanup,render,screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach,describe,expect,it,vi } from "vitest";
import { ClientDashboard,ClientTransports } from "./ClientPortal";

vi.mock("../../auth/AuthContext",()=>({useAuth:()=>({signOut:vi.fn(),access:{profile:{displayName:"Cliente Demo"},effectiveRole:"client_viewer"}})}));
vi.mock("../../data/client-portal-repository",()=>({
 loadClientPortalProfile:async()=>({organizationName:"Transportes Demo",customerName:"Cliente A",supportEmail:null,supportPhone:null,policy:{transport_status:true,planned_dates:true,actual_dates:true,goods_summary:true,incidents:false,pod:true,regulatory_documents:true,invoices:true,signatures:false}}),
 listClientTransports:async()=>[{id:"order-a",orderNumber:"TR-001",status:"in_transit",statusLabel:"En tránsito",priority:"normal",plannedPickupAt:"2026-08-24T08:00:00Z",plannedDeliveryAt:null,origin:"Madrid",destination:"Valencia",podAvailable:false,documentCount:0}],
 listClientInvoices:async()=>[{id:"invoice-a",invoiceNumber:"F-001",issueDate:"2026-08-24",dueDate:null,status:"issued",currencyCode:"EUR",totalMinor:12100,amountDueMinor:12100}],
 listClientDocuments:async()=>[],loadClientTransport:vi.fn(),createClientSignedUrl:vi.fn()
}));
afterEach(cleanup);
describe("portal cliente",()=>{
 it("muestra un dashboard profesional sin datos internos",async()=>{render(<MemoryRouter><ClientDashboard/></MemoryRouter>);expect(await screen.findByText("Hola, Cliente A")).toBeInTheDocument();expect(screen.getAllByText("1",{selector:"strong"})).toHaveLength(2);expect(screen.queryByText(/margen|tarifa|prefactura/i)).not.toBeInTheDocument();});
 it("lista sólo transportes entregados por el repositorio RLS",async()=>{render(<MemoryRouter><ClientTransports/></MemoryRouter>);expect(await screen.findByText("TR-001")).toBeInTheDocument();expect(screen.getByText("Madrid → Valencia")).toBeInTheDocument();});
});
