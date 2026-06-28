export const MAX_CONCURRENT = 8;

export interface Machine {
  type: string;
  group: "x86" | "graviton" | "gpu";
  usdPerHour: number; // us-east-2 on-demand, aproximado (informativo)
}

export const MACHINES: Machine[] = [
  { type: "c5.xlarge", group: "x86", usdPerHour: 0.17 },
  { type: "c5.2xlarge", group: "x86", usdPerHour: 0.34 },
  { type: "c7i.xlarge", group: "x86", usdPerHour: 0.1785 },
  { type: "c7i.2xlarge", group: "x86", usdPerHour: 0.357 },
  { type: "c7g.xlarge", group: "graviton", usdPerHour: 0.1445 },
  { type: "c8g.xlarge", group: "graviton", usdPerHour: 0.159 },
  { type: "g4dn.xlarge", group: "gpu", usdPerHour: 0.526 },
  { type: "g5.xlarge", group: "gpu", usdPerHour: 1.006 },
  { type: "g6.xlarge", group: "gpu", usdPerHour: 0.8048 },
  { type: "g6e.xlarge", group: "gpu", usdPerHour: 1.861 },
];

const BY_TYPE = new Map(MACHINES.map((m) => [m.type, m]));

export function isSupportedType(t: string): boolean {
  return BY_TYPE.has(t);
}

export function estimateCostPerHour(types: string[]): number {
  return types.reduce((sum, t) => sum + (BY_TYPE.get(t)?.usdPerHour ?? 0), 0);
}
