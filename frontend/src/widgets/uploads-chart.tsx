'use client';

import { useState } from 'react';
import { cx } from '@/utils/cx';
import { formatDateTime, formatNumber } from '@/utils/format';
import { useT } from '@/utils/locale';

interface Point { date: string; uploads: number }

const fmtDay = (iso: string) => formatDateTime(iso + 'T00:00:00', { month: 'short', day: 'numeric' });
const fmtNum = formatNumber;

/** Nice rounded axis max and 4 evenly spaced ticks. */
function scale(max: number) {
  const step = Math.pow(10, Math.floor(Math.log10(max / 4)));
  const nice = [1, 2, 2.5, 5, 10].map(m => m * step).find(s => s * 4 >= max) ?? step * 10;
  return { top: nice * 4, ticks: [0, 1, 2, 3, 4].map(i => i * nice) };
}

export default function UploadsChart({ data }: { data: Point[] }) {
  const t = useT();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hover, setHover] = useState<number | null>(null);

  const total = data.reduce((s, d) => s + d.uploads, 0);
  const peakIdx = data.reduce((best, d, i) => (d.uploads > data[best].uploads ? i : best), 0);
  const { top, ticks } = scale(data[peakIdx].uploads);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-bold tracking-wider text-muted uppercase">{t('Photo uploads · last 14 days', 'Загрузки фото · 14 дней')}</h2>
          <p className="mt-1 text-[28px] leading-none font-bold tracking-tight tabular-nums">{fmtNum(total)}</p>
        </div>
        <div role="tablist" aria-label={t('Chart view', 'Вид графика')} className="flex rounded-[10px] border border-line p-0.5 text-[13px] font-semibold">
          {(['chart', 'table'] as const).map(v => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={cx('h-7 rounded-lg px-3 capitalize transition-colors', view === v ? 'bg-fg text-bg' : 'text-muted hover:text-fg')}>
              {v === 'chart' ? t('Chart', 'График') : t('Table', 'Таблица')}
            </button>
          ))}
        </div>
      </div>

      {view === 'chart' ? (
        <div className="flex gap-2">
          {/* Y axis */}
          <div className="relative h-52 w-9 shrink-0 text-right text-[11px] text-muted tabular-nums" aria-hidden="true">
            {ticks.map(t => (
              <span key={t} className="absolute right-0" style={{ bottom: `${(t / top) * 100}%`, transform: 'translateY(50%)' }}>
                {t >= 1000 ? `${t / 1000}k` : t}
              </span>
            ))}
          </div>

          <div className="min-w-0 flex-1">
            <div className="relative h-52" role="img" aria-label={t(`Bar chart of daily photo uploads, ${fmtDay(data[0].date)} to ${fmtDay(data[data.length - 1].date)}. Peak ${fmtNum(data[peakIdx].uploads)} on ${fmtDay(data[peakIdx].date)}.`, `Загрузки фото по дням, ${fmtDay(data[0].date)} — ${fmtDay(data[data.length - 1].date)}. Пик ${fmtNum(data[peakIdx].uploads)} — ${fmtDay(data[peakIdx].date)}.`)}>
              {/* Recessive grid */}
              {ticks.map(t => (
                <div key={t} className={cx('absolute inset-x-0 border-t', t === 0 ? 'border-line' : 'border-dashed border-line/70')} style={{ bottom: `${(t / top) * 100}%` }} />
              ))}

              <div className="absolute inset-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
                {data.map((d, i) => {
                  const h = (d.uploads / top) * 100;
                  const active = hover === i;
                  return (
                    // Full-height column is the hit target; the bar is the mark
                    <div key={d.date} className="relative flex h-full flex-1 cursor-default items-end justify-center"
                      onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)}>
                      {i === peakIdx && hover === null && (
                        <span className="absolute text-[11px] font-semibold text-fg tabular-nums" style={{ bottom: `calc(${h}% + 6px)` }}>
                          {fmtNum(d.uploads)}
                        </span>
                      )}
                      <div className="w-full max-w-7 rounded-t-[4px] transition-opacity"
                        style={{ height: `${h}%`, background: 'var(--chart-1)', opacity: hover === null || active ? 1 : 0.45 }} />
                      {active && (
                        <div className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-3 py-2 text-xs whitespace-nowrap shadow-lg"
                          style={{ bottom: `calc(${h}% + 10px)`, ...(i > data.length / 2 ? { right: 0 } : { left: 0 }) }}>
                          <p className="text-muted">{fmtDay(d.date)}</p>
                          <p className="mt-0.5 font-bold text-fg tabular-nums">{t.count(d.uploads, ['upload', 'uploads'], ['загрузка', 'загрузки', 'загрузок'])}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* X axis: every day on wide screens, every other on phones */}
            <div className="mt-2 flex gap-[2px] text-[11px] text-muted" aria-hidden="true">
              {data.map((d, i) => (
                <span key={d.date} className={cx('flex-1 truncate text-center', i % 2 === 1 && 'invisible sm:visible')}>
                  {new Date(d.date + 'T00:00:00').getDate()}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-left text-xs text-muted">
              <tr><th className="px-4 py-2 font-semibold">{t('Date', 'Дата')}</th><th className="px-4 py-2 text-right font-semibold">{t('Uploads', 'Загрузки')}</th></tr>
            </thead>
            <tbody>
              {data.map(d => (
                <tr key={d.date} className="border-t border-line">
                  <td className="px-4 py-2">{fmtDay(d.date)}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular-nums">{fmtNum(d.uploads)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
