/** @jest-environment jsdom */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
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
});
