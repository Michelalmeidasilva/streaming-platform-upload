'use client';

import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import type { TranscodeRun } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './TranscodeMetrics.module.css';

interface CodecAgg {
  codec: string;
  runs: number;
  avgElapsed: number;
  avgCpu: number;
  maxCpu: number;
  outputBitrate: number;
  preset: string;
}

function aggregateByCodec(runs: TranscodeRun[]): CodecAgg[] {
  const byCodec = new Map<string, { elapsed: number[]; avgCpu: number[]; maxCpu: number; bitrate: number[]; preset: string }>();
  for (const run of runs) {
    for (const r of run.renditions) {
      const entry = byCodec.get(r.codec) ?? { elapsed: [], avgCpu: [], maxCpu: 0, bitrate: [], preset: r.preset ?? '' };
      entry.elapsed.push(r.elapsedSeconds);
      entry.avgCpu.push(r.avgCpuPercent);
      entry.maxCpu = Math.max(entry.maxCpu, r.maxCpuPercent);
      entry.bitrate.push(r.outputBitrateKbps);
      byCodec.set(r.codec, entry);
    }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return Array.from(byCodec.entries()).map(([codec, e]) => ({
    codec,
    runs: e.elapsed.length,
    avgElapsed: avg(e.elapsed),
    avgCpu: avg(e.avgCpu),
    maxCpu: e.maxCpu,
    outputBitrate: avg(e.bitrate),
    preset: e.preset,
  }));
}

export default function TranscodeMetrics() {
  const { t } = useI18n();
  const [runs, setRuns] = useState<TranscodeRun[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/runs', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((body) => { if (!cancelled) { setRuns(body.runs ?? []); setStatus('ready'); } })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  const byMachine = useMemo(() => {
    const groups = new Map<string, TranscodeRun[]>();
    for (const run of runs) {
      const list = groups.get(run.machineLabel) ?? [];
      list.push(run);
      groups.set(run.machineLabel, list);
    }
    return Array.from(groups.entries());
  }, [runs]);

  if (status === 'loading') return <div className={styles.state}><LoadingSpinner /></div>;
  if (status === 'error') return <div className={styles.state}>{t('metrics.error')}</div>;
  if (runs.length === 0) return <div className={styles.state}>{t('metrics.empty')}</div>;

  return (
    <section className={styles.wrap} aria-label={t('metrics.title')}>
      <h2 className={styles.title}>{t('metrics.title')}</h2>
      {byMachine.map(([machine, machineRuns]) => (
        <div key={machine} className={styles.machineCard}>
          <h3 className={styles.machineLabel}>{machine}</h3>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('metrics.codec')}</th>
                <th>{t('metrics.runs')}</th>
                <th>{t('metrics.avgElapsed')}</th>
                <th>{t('metrics.avgCpu')}</th>
                <th>{t('metrics.maxCpu')}</th>
                <th>{t('metrics.outputBitrate')}</th>
                <th>{t('metrics.preset')}</th>
              </tr>
            </thead>
            <tbody>
              {aggregateByCodec(machineRuns).map((c) => (
                <tr key={c.codec}>
                  <td>{c.codec}</td>
                  <td>{c.runs}</td>
                  <td>{c.avgElapsed.toFixed(1)}</td>
                  <td>{c.avgCpu.toFixed(0)}</td>
                  <td>{c.maxCpu.toFixed(0)}</td>
                  <td>{c.outputBitrate.toFixed(0)}</td>
                  <td>{c.preset || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
