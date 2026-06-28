/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MAX_CONCURRENT } from "@/lib/benchmark/catalog";
import BenchmarkLauncher from "../BenchmarkLauncher";

describe("BenchmarkLauncher", () => {
  beforeEach(() => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ sessionId: "s1" }) }) as any;
  });

  it("desabilita o botão sem máquinas selecionadas", () => {
    render(<BenchmarkLauncher />);
    expect(screen.getByRole("button", { name: /rodar benchmark/i })).toBeDisabled();
  });

  it("mostra custo estimado ao selecionar", () => {
    render(<BenchmarkLauncher />);
    fireEvent.click(screen.getByLabelText("c5.xlarge"));
    expect(screen.getByTestId("cost-estimate")).toHaveTextContent("$");
  });

  it("dispara o launch e mostra o sessionId", async () => {
    render(<BenchmarkLauncher />);
    fireEvent.click(screen.getByLabelText("c5.xlarge"));
    fireEvent.click(screen.getByRole("button", { name: /rodar benchmark/i }));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith("/api/benchmark/launch", expect.objectContaining({ method: "POST" })));
    await waitFor(() => expect(screen.getByText(/s1/)).toBeInTheDocument());
  });

  it("mostra alerta ao exceder MAX_CONCURRENT e desabilita botão", () => {
    render(<BenchmarkLauncher />);
    // Seleciona todas as 10 máquinas (MACHINES.length = 10 > MAX_CONCURRENT = 8)
    fireEvent.click(screen.getByLabelText("c5.xlarge"));
    fireEvent.click(screen.getByLabelText("c5.2xlarge"));
    fireEvent.click(screen.getByLabelText("c7i.xlarge"));
    fireEvent.click(screen.getByLabelText("c7i.2xlarge"));
    fireEvent.click(screen.getByLabelText("c7g.xlarge"));
    fireEvent.click(screen.getByLabelText("c8g.xlarge"));
    fireEvent.click(screen.getByLabelText("g4dn.xlarge"));
    fireEvent.click(screen.getByLabelText("g5.xlarge"));
    fireEvent.click(screen.getByLabelText("g6.xlarge"));
    fireEvent.click(screen.getByLabelText("g6e.xlarge"));

    // Verifica alerta
    expect(screen.getByRole("alert")).toHaveTextContent(`Acima do teto de ${MAX_CONCURRENT} máquinas`);

    // Verifica botão desabilitado
    expect(screen.getByRole("button", { name: /rodar benchmark/i })).toBeDisabled();
  });

  it("trata erro de resposta não-JSON ou erro HTTP", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: "internal" }),
    }) as any;

    render(<BenchmarkLauncher />);
    fireEvent.click(screen.getByLabelText("c5.xlarge"));
    fireEvent.click(screen.getByRole("button", { name: /rodar benchmark/i }));

    await waitFor(() => expect(screen.getByText(/erro/i)).toBeInTheDocument());
  });
});
