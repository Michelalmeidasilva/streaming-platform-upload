'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import type { TranscodeRun } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './TranscodeMetrics.module.css';

interface AggRow {
  key: string; codec: string; resolution: string; runs: number;
  avgElapsed: number; avgCpu: number; maxCpu: number; outputBitrate: number; preset: string;
}

function aggregate(runs: TranscodeRun[], mode: 'production' | 'benchmark'): AggRow[] {
  const groups = new Map<string, { codec: string; resolution: string; elapsed: number[]; avgCpu: number[]; maxCpu: number; bitrate: number[]; preset: string }>();
  for (const run of runs) {
    for (const r of run.renditions) {
      const resolution = `${r.width}x${r.height}`;
      const key = mode === 'benchmark' ? `${r.codec}@${resolution}` : r.codec;
      const e = groups.get(key) ?? { codec: r.codec, resolution, elapsed: [], avgCpu: [], maxCpu: 0, bitrate: [], preset: r.preset ?? '' };
      e.elapsed.push(r.elapsedSeconds);
      e.avgCpu.push(r.avgCpuPercent);
      e.maxCpu = Math.max(e.maxCpu, r.maxCpuPercent);
      e.bitrate.push(r.outputBitrateKbps);
      groups.set(key, e);
    }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return Array.from(groups.entries()).map(([key, e]) => ({
    key, codec: e.codec, resolution: e.resolution, runs: e.elapsed.length,
    avgElapsed: avg(e.elapsed), avgCpu: avg(e.avgCpu), maxCpu: e.maxCpu,
    outputBitrate: avg(e.bitrate), preset: e.preset,
  }));
}

export default function TranscodeMetrics() {
  const { t } = useI18n();
  const [runs, setRuns] = useState<TranscodeRun[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [mode, setMode] = useState<'production' | 'benchmark'>('production');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    const url = mode === 'benchmark' ? '/api/runs?benchmark=true' : '/api/runs?benchmark=false';
    fetch(url, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((body) => { if (!cancelled) { setRuns(body.runs ?? []); setStatus('ready'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, [mode]);

  const byMachine = useMemo(() => {
    const groups = new Map<string, TranscodeRun[]>();
    for (const run of runs) {
      const list = groups.get(run.machineLabel) ?? [];
      list.push(run);
      groups.set(run.machineLabel, list);
    }
    return Array.from(groups.entries());
  }, [runs]);

  const toggle = (
    <div className={styles.toggle} role="tablist">
      <button type="button" role="tab" aria-selected={mode === 'production'}
        className={mode === 'production' ? styles.toggleActive : styles.toggleBtn}
        onClick={() => setMode('production')}>{t('metrics.viewProduction')}</button>
      <button type="button" role="tab" aria-selected={mode === 'benchmark'}
        className={mode === 'benchmark' ? styles.toggleActive : styles.toggleBtn}
        onClick={() => setMode('benchmark')}>{t('metrics.viewBenchmark')}</button>
    </div>
  );

  let inner: ReactNode;
  if (status === 'loading') inner = <div className={styles.state}><LoadingSpinner /></div>;
  else if (status === 'error') inner = <div className={styles.state}>{t('metrics.error')}</div>;
  else if (runs.length === 0) inner = <div className={styles.state}>{t('metrics.empty')}</div>;
  else inner = (
    <>
      {byMachine.map(([machine, machineRuns]) => (
        <div key={machine} className={styles.machineCard}>
          <h3 className={styles.machineLabel}>{machine}</h3>
          <table className={styles.table}>
            <thead><tr>
              <th>{t('metrics.codec')}</th>
              {mode === 'benchmark' && <th>{t('metrics.resolution')}</th>}
              <th>{t('metrics.runs')}</th>
              <th>{t('metrics.avgElapsed')}</th>
              <th>{t('metrics.avgCpu')}</th>
              <th>{t('metrics.maxCpu')}</th>
              <th>{t('metrics.outputBitrate')}</th>
              {mode === 'production' && <th>{t('metrics.preset')}</th>}
            </tr></thead>
            <tbody>
              {aggregate(machineRuns, mode).map((row) => (
                <tr key={row.key}>
                  <td>{row.codec}</td>
                  {mode === 'benchmark' && <td>{row.resolution}</td>}
                  <td>{row.runs}</td>
                  <td>{row.avgElapsed.toFixed(1)}</td>
                  <td>{row.avgCpu.toFixed(0)}</td>
                  <td>{row.maxCpu.toFixed(0)}</td>
                  <td>{row.outputBitrate.toFixed(0)}</td>
                  {mode === 'production' && <td>{row.preset || '—'}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );

  return (
    <section className={styles.wrap} aria-label={t('metrics.title')}>
      <h2 className={styles.title}>{t('metrics.title')}</h2>
      {toggle}
      {inner}
    </section>
  );
}
