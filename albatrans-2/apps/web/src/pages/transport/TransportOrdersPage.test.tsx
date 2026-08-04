import {cleanup,fireEvent,render,screen,waitFor,within} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {TransportOrdersPage} from "./TransportOrdersPage";
const repository=vi.hoisted(()=>({loadTransportOrders:vi.fn(),loadTransportOptions:vi.fn(),transportCommand:vi.fn()}));
vi.mock("../../data/transport-repository",()=>repository);
beforeEach(()=>{repository.loadTransportOrders.mockResolvedValue({items:[],total:0});repository.loadTransportOptions.mockResolvedValue([{value:"client-1",label:"Cliente Uno"}]);repository.transportCommand.mockResolvedValue({organizationId:"org-1",orderId:"order-1",entityId:"order-1",action:"create",eventType:"transport.created"});});afterEach(()=>{cleanup();vi.clearAllMocks();});
describe("listado de órdenes",()=>{
 it("muestra vacío y filtros",async()=>{render(<MemoryRouter><TransportOrdersPage organizationId="org-1" platform={false}/></MemoryRouter>);expect(await screen.findByText("Todavía no hay órdenes.")).toBeInTheDocument();fireEvent.change(screen.getByLabelText("Buscar"),{target:{value:"TR-99"}});expect(await screen.findByText("No hay resultados para los filtros.")).toBeInTheDocument();});
 it("crea una orden validada",async()=>{render(<MemoryRouter><TransportOrdersPage organizationId="org-1" platform={false}/></MemoryRouter>);await screen.findByText("Todavía no hay órdenes.");fireEvent.click(screen.getByRole("button",{name:"Nueva orden"}));const dialog=screen.getByRole("dialog",{name:"Nueva orden"});fireEvent.change(within(dialog).getByLabelText("Cliente"),{target:{value:"client-1"}});fireEvent.change(within(dialog).getByLabelText("Tipo de transporte"),{target:{value:" Carga   refrigerada "}});fireEvent.click(within(dialog).getByRole("button",{name:"Crear orden"}));await waitFor(()=>expect(repository.transportCommand).toHaveBeenCalledWith(expect.objectContaining({action:"create",resource:"order",values:expect.objectContaining({transport_type:"Carga refrigerada"})})));});
});
