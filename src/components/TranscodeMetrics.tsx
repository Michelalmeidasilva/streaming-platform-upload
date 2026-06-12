'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import type { TranscodeRun } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './TranscodeMetrics.module.css';

function clipTitle(clip: string): string {
  const base = clip.split('/').pop() ?? clip;
  const dot = base.lastIndexOf('.');
  return dot > 0 ? base.slice(0, dot) : base;
}

function humanSize(bytes?: number): string {
  if (!bytes || bytes <= 0) return '—';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toISOString().slice(0, 16).replace('T', ' ');
}

function sourceLabel(run: TranscodeRun): string {
  if (!run.sourceWidth || !run.sourceHeight) return '—';
  const parts = [`${run.sourceWidth}×${run.sourceHeight}`];
  if (run.sourceDurationSeconds) parts.push(`${Math.round(run.sourceDurationSeconds)}s`);
  if (run.sourceCodec) parts.push(run.sourceCodec);
  if (run.sourceFileSizeBytes && run.sourceFileSizeBytes >= 1024) parts.push(humanSize(run.sourceFileSizeBytes));
  return parts.join(' · ');
}

// Production view: aggregate by codec across the machine's runs.
interface CodecAgg { codec: string; runs: number; avgElapsed: number; avgCpu: number; maxCpu: number; outputBitrate: number; preset: string }
function aggregateByCodec(runs: TranscodeRun[]): CodecAgg[] {
  const groups = new Map<string, { elapsed: number[]; avgCpu: number[]; maxCpu: number; bitrate: number[]; preset: string }>();
  for (const run of runs) {
    for (const r of run.renditions) {
      const e = groups.get(r.codec) ?? { elapsed: [], avgCpu: [], maxCpu: 0, bitrate: [], preset: r.preset ?? '' };
      e.elapsed.push(r.elapsedSeconds);
      e.avgCpu.push(r.avgCpuPercent);
      e.maxCpu = Math.max(e.maxCpu, r.maxCpuPercent);
      e.bitrate.push(r.outputBitrateKbps);
      groups.set(r.codec, e);
    }
  }
  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  return Array.from(groups.entries()).map(([codec, e]) => ({
    codec, runs: e.elapsed.length, avgElapsed: avg(e.elapsed), avgCpu: avg(e.avgCpu),
    maxCpu: e.maxCpu, outputBitrate: avg(e.bitrate), preset: e.preset,
  }));
}

// Benchmark view: one row per run (per rendition).
interface RunRow {
  key: string; machine: string; codec: string; resolution: string;
  elapsed: number; outputBitrate: number; outputSize?: number; cpu: number; date?: string; rep?: number;
}
function runRows(runs: TranscodeRun[]): RunRow[] {
  const rows: RunRow[] = [];
  for (const run of runs) {
    for (const r of run.renditions) {
      rows.push({
        key: `${run.id}-${r.codec}-${r.width}x${r.height}`,
        machine: run.machineLabel, codec: r.codec, resolution: `${r.width}x${r.height}`,
        elapsed: r.elapsedSeconds, outputBitrate: r.outputBitrateKbps, outputSize: r.outputFileSizeBytes,
        cpu: r.avgCpuPercent, date: run.completedAt, rep: run.repetition,
      });
    }
  }
  rows.sort((a, b) =>
    a.machine.localeCompare(b.machine) || a.codec.localeCompare(b.codec) ||
    a.resolution.localeCompare(b.resolution) || (a.date ?? '').localeCompare(b.date ?? ''));
  return rows;
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

  const byVideo = useMemo(() => {
    const groups = new Map<string, TranscodeRun[]>();
    for (const run of runs) {
      const k = run.clip ?? '';
      const list = groups.get(k) ?? [];
      list.push(run);
      groups.set(k, list);
    }
    return Array.from(groups.entries()).sort((a, b) => clipTitle(a[0]).localeCompare(clipTitle(b[0])));
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
  else if (mode === 'benchmark') inner = (
    <>
      {byVideo.map(([clip, vRuns]) => (
        <div key={clip} className={styles.machineCard}>
          <h3 className={styles.machineLabel} title={clip}>{clipTitle(clip)}</h3>
          <div className={styles.sourceMeta}>{sourceLabel(vRuns[0])}</div>
          <table className={styles.table}>
            <thead><tr>
              <th>{t('metrics.machine')}</th>
              <th>{t('metrics.codec')}</th>
              <th>{t('metrics.resolution')}</th>
              <th>{t('metrics.runTime')}</th>
              <th>{t('metrics.outputBitrate')}</th>
              <th>{t('metrics.outputSize')}</th>
              <th>{t('metrics.cpu')}</th>
              <th>{t('metrics.date')}</th>
              <th>{t('metrics.repetition')}</th>
            </tr></thead>
            <tbody>
              {runRows(vRuns).map((row) => (
                <tr key={row.key}>
                  <td>{row.machine}</td>
                  <td>{row.codec}</td>
                  <td>{row.resolution}</td>
                  <td>{row.elapsed.toFixed(1)}</td>
                  <td>{row.outputBitrate.toFixed(0)}</td>
                  <td>{humanSize(row.outputSize)}</td>
                  <td>{row.cpu.toFixed(0)}</td>
                  <td>{formatDate(row.date)}</td>
                  <td>{row.rep ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </>
  );
  else inner = (
    <>
      {byMachine.map(([machine, machineRuns]) => (
        <div key={machine} className={styles.machineCard}>
          <h3 className={styles.machineLabel}>{machine}</h3>
          <table className={styles.table}>
            <thead><tr>
              <th>{t('metrics.codec')}</th>
              <th>{t('metrics.runs')}</th>
              <th>{t('metrics.avgElapsed')}</th>
              <th>{t('metrics.avgCpu')}</th>
              <th>{t('metrics.maxCpu')}</th>
              <th>{t('metrics.outputBitrate')}</th>
              <th>{t('metrics.preset')}</th>
            </tr></thead>
            <tbody>
              {aggregateByCodec(machineRuns).map((row) => (
                <tr key={row.codec}>
                  <td>{row.codec}</td>
                  <td>{row.runs}</td>
                  <td>{row.avgElapsed.toFixed(1)}</td>
                  <td>{row.avgCpu.toFixed(0)}</td>
                  <td>{row.maxCpu.toFixed(0)}</td>
                  <td>{row.outputBitrate.toFixed(0)}</td>
                  <td>{row.preset || '—'}</td>
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
