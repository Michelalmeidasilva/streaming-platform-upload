'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from '@/lib/i18n/LocaleProvider';
import type { DistributionRun, DistributionProjection } from '@/types';
import LoadingSpinner from '@/components/LoadingSpinner';
import styles from './DistributionMetrics.module.css';

function fmtMs(ms: number): string {
  return ms.toFixed(0);
}

function fmtPct(ratio: number): string {
  return (ratio * 100).toFixed(2);
}

function fmtKbps(kbps: number): string {
  return kbps.toFixed(0);
}

function fmtNumber(n: number): string {
  return n.toLocaleString();
}

interface QoeRow {
  runId: number;
  tier: string;
  n_viewers: number;
  machine: string;
  engine: string;
  startup: string;
  startupP95: string;
  startupP99: string;
  rebuffer: string;
  bitrate: string;
  samples: number;
}

function buildQoeRows(runs: DistributionRun[]): QoeRow[] {
  const rows: QoeRow[] = [];
  for (const run of runs) {
    if (!run.qoe || run.qoe.length === 0) {
      rows.push({
        runId: run.id,
        tier: run.tier,
        n_viewers: run.n_viewers,
        machine: run.machine,
        engine: '—',
        startup: '—',
        startupP95: '—',
        startupP99: '—',
        rebuffer: '—',
        bitrate: '—',
        samples: 0,
      });
    } else {
      for (const q of run.qoe) {
        rows.push({
          runId: run.id,
          tier: run.tier,
          n_viewers: run.n_viewers,
          machine: run.machine,
          engine: q.PlayerEngine,
          startup: fmtMs(q.StartupP50MS),
          startupP95: fmtMs(q.StartupP95MS),
          startupP99: fmtMs(q.StartupP99MS),
          rebuffer: fmtPct(q.RebufferRatioAvg),
          bitrate: fmtKbps(q.BitrateAvgKbps),
          samples: q.Samples,
        });
      }
    }
  }
  return rows;
}

export default function DistributionMetrics() {
  const { t } = useI18n();
  const [runs, setRuns] = useState<DistributionRun[]>([]);
  const [projections, setProjections] = useState<DistributionProjection[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetch('/api/distribution-runs', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('failed'))))
      .then((body) => {
        if (!cancelled) {
          setRuns(body.runs ?? []);
          setProjections(body.projections ?? []);
          setStatus('ready');
        }
      })
      .catch(() => { if (!cancelled) setStatus('error'); });
    return () => { cancelled = true; };
  }, []);

  let inner: ReactNode;
  if (status === 'loading') {
    inner = <div className={styles.state}><LoadingSpinner /></div>;
  } else if (status === 'error') {
    inner = <div className={styles.state}>{t('distribution.error')}</div>;
  } else if (runs.length === 0) {
    inner = <div className={styles.state}>{t('distribution.empty')}</div>;
  } else {
    const qoeRows = buildQoeRows(runs);
    inner = (
      <>
        <div className={styles.machineCard}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t('distribution.col.tier')}</th>
                <th>{t('distribution.col.viewers')}</th>
                <th>{t('distribution.col.machine')}</th>
                <th>{t('distribution.col.engine')}</th>
                <th>{t('distribution.col.startup')}</th>
                <th>{t('distribution.col.startupP95')}</th>
                <th>{t('distribution.col.startupP99')}</th>
                <th>{t('distribution.col.rebuffer')}</th>
                <th>{t('distribution.col.bitrate')}</th>
                <th>{t('distribution.col.samples')}</th>
              </tr>
            </thead>
            <tbody>
              {qoeRows.map((row, i) => (
                <tr key={`${row.runId}-${row.engine}-${i}`}>
                  <td>{row.tier}</td>
                  <td>{row.n_viewers}</td>
                  <td>{row.machine}</td>
                  <td>{row.engine}</td>
                  <td>{row.startup}</td>
                  <td>{row.startupP95}</td>
                  <td>{row.startupP99}</td>
                  <td>{row.rebuffer}</td>
                  <td>{row.bitrate}</td>
                  <td>{row.engine === '—' ? '—' : row.samples}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {projections.length > 0 && (
          <div className={styles.machineCard}>
            <h3 className={styles.machineLabel}>{t('distribution.projections')}</h3>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>{t('distribution.col.target')}</th>
                  <th>{t('distribution.col.egress')}</th>
                  <th>{t('distribution.col.rps')}</th>
                  <th>{t('distribution.col.connections')}</th>
                  <th>{t('distribution.col.cost')}</th>
                  <th>{t('distribution.col.saturation')}</th>
                </tr>
              </thead>
              <tbody>
                {projections.map((p, i) => (
                  <tr key={`${p.basis}-${i}`}>
                    <td>{fmtNumber(p.n_target)}</td>
                    <td>{fmtNumber(p.egress_gb_h)}</td>
                    <td>{fmtNumber(p.agg_rps)}</td>
                    <td>{fmtNumber(p.connections)}</td>
                    <td>{fmtNumber(p.cost_usd_month)}</td>
                    <td>{p.saturation_tier}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </>
    );
  }

  return (
    <section className={styles.wrap} aria-label={t('distribution.title')}>
      <h2 className={styles.title}>{t('distribution.title')}</h2>
      {inner}
    </section>
  );
}
