"use client";
import { useMemo, useState } from "react";
import { MACHINES, estimateCostPerHour, MAX_CONCURRENT } from "@/lib/benchmark/catalog";
import styles from "./BenchmarkLauncher.module.css";

const GROUPS: { key: "x86" | "graviton" | "gpu"; label: string }[] = [
  { key: "x86", label: "CPU x86" },
  { key: "graviton", label: "Graviton (arm64)" },
  { key: "gpu", label: "GPU (NVENC)" },
];

export default function BenchmarkLauncher() {
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");
  const cost = useMemo(() => estimateCostPerHour(selected), [selected]);
  const overCap = selected.length > MAX_CONCURRENT;

  function toggle(type: string) {
    setSelected((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  async function launch() {
    setStatus("Disparando...");
    try {
      const res = await fetch("/api/benchmark/launch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          instanceTypes: selected,
          codecs: ["h264", "h265", "av1"],
          resolutions: "1280x720:2800,1920x1080:5000",
          repeats: 3,
          mode: "throughput",
        }),
      });
      const body = await res.json();
      setStatus(res.ok ? `Sessão iniciada: ${body.sessionId}` : `Erro: ${body.error ?? res.status}`);
    } catch (e) {
      setStatus(`Erro: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div>
      <h2>Benchmark de Transcoding</h2>
      {GROUPS.map((g) => (
        <div key={g.key} className={styles.group}>
          <h3>{g.label}</h3>
          <div className={styles.grid}>
            {MACHINES.filter((m) => m.group === g.key).map((m) => (
              <label key={m.type}>
                <input type="checkbox" aria-label={m.type} checked={selected.includes(m.type)} onChange={() => toggle(m.type)} />
                {m.type} (~${m.usdPerHour.toFixed(2)}/h)
              </label>
            ))}
          </div>
        </div>
      ))}
      <p className={styles.cost} data-testid="cost-estimate">Custo estimado: ${cost.toFixed(2)}/h ({selected.length} máquina(s))</p>
      {overCap && <p role="alert">Acima do teto de {MAX_CONCURRENT} máquinas por run.</p>}
      <div className={styles.actions}>
        <button onClick={launch} disabled={selected.length === 0 || overCap}>Rodar benchmark</button>
        {status && <span>{status}</span>}
      </div>
    </div>
  );
}
