import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentManager } from "./DocumentManager";

const repository = vi.hoisted(() => ({ loadDocuments: vi.fn(), uploadDocument: vi.fn(), downloadDocument: vi.fn(), executeDocumentCommand: vi.fn() }));
const ocrRepository = vi.hoisted(() => ({
  loadOcrJobsByDocumentIds: vi.fn(),
  loadOcrQuotaSummary: vi.fn(),
  requestOcr: vi.fn(),
  processNextOcrJob: vi.fn(),
  startOcrReview: vi.fn(),
  correctOcrField: vi.fn(),
  approveOcrReview: vi.fn(),
  rejectOcrReview: vi.fn(),
}));
vi.mock("../../data/documents-repository", () => repository);
vi.mock("../../data/ocr-repository", () => ocrRepository);

beforeEach(() => {
  repository.loadDocuments.mockResolvedValue([]);
  ocrRepository.loadOcrJobsByDocumentIds.mockResolvedValue(new Map());
  ocrRepository.loadOcrQuotaSummary.mockResolvedValue({ used: 0, reserved: 0, limit: 20, available: 20 });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe("gestor documental", () => {
  it("muestra carga y estado vacío accesibles", async () => {
    render(<DocumentManager organizationId="org-1" orderId="order-1" stops={[]} />);
    expect(screen.getByText("Cargando documentos...")).toHaveAttribute("aria-busy", "true");
    expect(await screen.findByText("Sin documentos asociados.")).toBeInTheDocument();
    expect(screen.getByRole("form", { name: "Subir documento" })).toBeInTheDocument();
  });
  it("rechaza el envío sin archivo antes de llamar al repositorio", async () => {
    render(<DocumentManager organizationId="org-1" orderId="order-1" stops={[]} />);
    await screen.findByText("Sin documentos asociados.");
    fireEvent.change(screen.getByLabelText("Titulo"), { target: { value: "Prueba" } });
    fireEvent.change(screen.getByLabelText("Tipo documental"), { target: { value: "justificante" } });
    fireEvent.submit(screen.getByRole("form", { name: "Subir documento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Selecciona un archivo");
    await waitFor(() => expect(repository.uploadDocument).not.toHaveBeenCalled());
  });
});
