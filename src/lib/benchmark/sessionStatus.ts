/** TTL alinhado ao watchdog (2h). Sessões sem resultado novo após este prazo = incompletas. */
const STALE_AFTER_MINUTES = 120;

export interface ReconcileInput {
  /** Tipos de instância disparados (source-of-truth: Task 5 vai suprir a lista real do store de sessões). */
  launchedTypes: string[];
  /** machineLabels que já reportaram resultados no ingest. */
  reportedLabels: string[];
  /** Idade da sessão em minutos (desde o primeiro resultado ou desde o disparo). */
  ageMinutes: number;
}

export interface SessionStatus {
  status: "launched" | "collecting" | "complete" | "incomplete";
  reported: number;
  total: number;
}

/**
 * Reconcilia o status de uma sessão de benchmark.
 *
 * Regras:
 *  - complete   : todos os tipos lançados já reportaram
 *  - launched   : nenhum reportou ainda e está dentro da janela
 *  - incomplete : parcial (ou vazio) e passou da janela STALE_AFTER_MINUTES
 *  - collecting : parcial, dentro da janela
 *
 * NOTE (Task 5): `launchedTypes` deve vir do store de sessões persistido no disparo.
 * No Task 4, o chamador deriva `launchedTypes` a partir dos labels já reportados
 * (i.e., launchedTypes === reportedLabels), o que torna o status sempre "complete"
 * para sessões com ≥1 resultado. Task 5 substituirá por dados reais.
 */
export function reconcileSession(i: ReconcileInput): SessionStatus {
  const total = i.launchedTypes.length;
  const reported = i.launchedTypes.filter((t) => i.reportedLabels.includes(t)).length;

  let status: SessionStatus["status"];
  if (reported >= total && total > 0) {
    status = "complete";
  } else if (reported === 0 && i.ageMinutes <= STALE_AFTER_MINUTES) {
    status = "launched";
  } else if (i.ageMinutes > STALE_AFTER_MINUTES) {
    status = "incomplete";
  } else {
    status = "collecting";
  }

  return { status, reported, total };
}
