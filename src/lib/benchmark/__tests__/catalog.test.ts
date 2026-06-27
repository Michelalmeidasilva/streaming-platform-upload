import { MACHINES, isSupportedType, estimateCostPerHour, MAX_CONCURRENT } from "../catalog";

describe("benchmark catalog", () => {
  it("tem 10 máquinas em 3 grupos", () => {
    expect(MACHINES).toHaveLength(10);
    expect(new Set(MACHINES.map((m) => m.group))).toEqual(new Set(["x86", "graviton", "gpu"]));
  });

  it("valida tipos suportados", () => {
    expect(isSupportedType("g6.xlarge")).toBe(true);
    expect(isSupportedType("t2.micro")).toBe(false);
  });

  it("soma o custo/h dos tipos selecionados", () => {
    const c5 = MACHINES.find((m) => m.type === "c5.xlarge")!.usdPerHour;
    const g6 = MACHINES.find((m) => m.type === "g6.xlarge")!.usdPerHour;
    expect(estimateCostPerHour(["c5.xlarge", "g6.xlarge"])).toBeCloseTo(c5 + g6, 5);
  });

  it("ignora tipos desconhecidos no custo", () => {
    expect(estimateCostPerHour(["t2.micro"])).toBe(0);
  });

  it("expõe o teto de concorrência", () => {
    expect(MAX_CONCURRENT).toBe(8);
  });
});
