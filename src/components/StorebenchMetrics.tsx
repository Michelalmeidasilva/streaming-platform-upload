'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import type { StorebenchHttpRun, StorebenchBenchRun, StorebenchBenchResult } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './StorebenchMetrics.module.css';

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 16).replace('T', ' ');
}

// p50/p99 are 0 for legacy rows measured before they were captured — show '—'.
const fmtLat = (ms: number) => (ms > 0 ? `${ms.toFixed(0)}ms` : '—');

// HTTP matrix: rows = config, columns = N×metric (req/s, p50/p95/p99 ms per N).
function HttpRunCard({ run, t }: { run: StorebenchHttpRun; t: (k: string) => string }) {
  const ns = useMemo(() => Array.from(new Set(run.results.map((r) => r.n))).sort((a, b) => a - b), [run]);
  const configs = useMemo(() => Array.from(new Set(run.results.map((r) => r.config))), [run]);
  const cell = (config: string, n: number) => run.results.find((r) => r.config === config && r.n === n);
  return (
    <div className={styles.runCard}>
      <div className={styles.runHead}>
        {`#${run.id} · ${run.mode} · ${run.machine} · ${fmtDate(run.started_at)}`}
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{t('storageBench.config')}</th>
            {ns.map((n) => (
              <Fragment key={n}>
                <th>{`N=${n} req/s`}</th>
                <th>{`N=${n} p50ms`}</th>
                <th>{`N=${n} p95ms`}</th>
                <th>{`N=${n} p99ms`}</th>
              </Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {configs.map((c) => (
            <tr key={c}>
              <td>{c}</td>
              {ns.map((n) => {
                const x = cell(c, n);
                return (
                  <Fragment key={n}>
                    <td>{x ? x.req_s.toFixed(1) : '—'}</td>
                    <td>{x ? fmtLat(x.p50_ms) : '—'}</td>
                    <td>{x ? fmtLat(x.p95_ms) : '—'}</td>
                    <td>{x ? fmtLat(x.p99_ms) : '—'}</td>
                  </Fragment>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BenchRunCard({ run, t }: { run: StorebenchBenchRun; t: (k: string) => string }) {
  const bySuite = useMemo(() => {
    const m = new Map<string, StorebenchBenchResult[]>();
    for (const r of run.results) {
      const list = m.get(r.suite) ?? [];
      list.push(r);
      m.set(r.suite, list);
    }
    return Array.from(m.entries());
  }, [run]);
  return (
    <div className={styles.runCard}>
      <div className={styles.runHead}>
        {`#${run.id} · ${run.machine} · ${run.go_version} · ${fmtDate(run.started_at)}`}
      </div>
      {bySuite.map(([suite, rows]) => (
        <div key={suite}>
          <div className={styles.suiteTitle}>{suite}</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('storageBench.name')}</th>
                <th>ns/op</th><th>B/op</th><th>allocs/op</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td>{r.ns_per_op.toFixed(0)}</td>
                  <td>{r.bytes_per_op ?? '—'}</td>
                  <td>{r.allocs_per_op ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

export default function StorebenchMetrics() {
  const { t } = useI18n();
  const [httpRuns, setHttpRuns] = useState<StorebenchHttpRun[]>([]);
  const [benchRuns, setBenchRuns] = useState<StorebenchBenchRun[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mode, setMode] = useState<'http' | 'micro'>('http');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetch('/api/storebench-runs', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((body) => {
        if (cancelled) return;
        setHttpRuns(body.httpRuns ?? []);
        setBenchRuns(body.benchRuns ?? []);
        setStatus('ready');
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  const toggle = (
    <div className={styles.toggle} role="tablist">
      <button type="button" role="tab" aria-selected={mode === 'http'}
        className={mode === 'http' ? styles.toggleActive : styles.toggleBtn}
        onClick={() => setMode('http')}>{t('storageBench.viewHttp')}</button>
      <button type="button" role="tab" aria-selected={mode === 'micro'}
        className={mode === 'micro' ? styles.toggleActive : styles.toggleBtn}
        onClick={() => setMode('micro')}>{t('storageBench.viewMicro')}</button>
    </div>
  );

  let inner: ReactNode;
  if (status === 'loading') inner = <div className={styles.state}><LoadingSpinner /></div>;
  else if (status === 'error') inner = <div className={styles.state}>{t('storageBench.error')}</div>;
  else {
    const runs = mode === 'http' ? httpRuns : benchRuns;
    if (runs.length === 0) inner = <div className={styles.state}>{t('storageBench.empty')}</div>;
    else if (mode === 'http') inner = <>{httpRuns.map((r) => <HttpRunCard key={r.id} run={r} t={t} />)}</>;
    else inner = <>{benchRuns.map((r) => <BenchRunCard key={r.id} run={r} t={t} />)}</>;
  }

  return <div className={styles.wrap}>{toggle}{inner}</div>;
}
