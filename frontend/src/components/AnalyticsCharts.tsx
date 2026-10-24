import React from 'react';

// ==========================================
// 1. Interactive Trend Line Chart
// ==========================================
export interface LineSeries {
  key: string;
  label: string;
  color: string;
}

interface TrendLineChartProps {
  data: Array<{ label: string; [key: string]: any }>;
  series: LineSeries[];
  height?: number;
}

export const TrendLineChart: React.FC<TrendLineChartProps> = ({
  data,
  series,
  height = 240,
}) => {
  if (!data || data.length === 0) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.88rem' }}>
        No trend records available for the selected period
      </div>
    );
  }

  // Find max value across all series
  let maxVal = 0;
  data.forEach((d) => {
    series.forEach((s) => {
      const v = Number(d[s.key] || 0);
      if (v > maxVal) maxVal = v;
    });
  });
  if (maxVal === 0) maxVal = 5; // default scale
  maxVal = Math.ceil(maxVal * 1.15); // headroom

  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartWidth = 700; // viewBox width

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const getX = (index: number) => {
    if (data.length <= 1) return paddingLeft + plotWidth / 2;
    return paddingLeft + (index / (data.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return paddingTop + plotHeight - (val / maxVal) * plotHeight;
  };

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        {series.map((s) => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600, color: '#475569' }}>
            <span style={{ width: '12px', height: '4px', borderRadius: '2px', background: s.color }} />
            {s.label}
          </div>
        ))}
      </div>

      <svg viewBox={`0 0 ${chartWidth} ${height}`} style={{ width: '100%', height: 'auto', maxHeight: `${height}px`, overflow: 'visible' }}>
        {/* Horizontal grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
          const y = paddingTop + plotHeight * (1 - pct);
          const gridVal = Math.round(maxVal * pct);
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={chartWidth - paddingRight}
                y2={y}
                stroke="#e2e8f0"
                strokeDasharray={pct === 0 ? 'none' : '3 3'}
                strokeWidth={1}
              />
              <text x={paddingLeft - 8} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
                {gridVal}
              </text>
            </g>
          );
        })}

        {/* Series paths and points */}
        {series.map((s) => {
          const points = data.map((d, i) => `${getX(i)},${getY(Number(d[s.key] || 0))}`).join(' ');
          return (
            <g key={s.key}>
              <polyline
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                points={points}
              />
              {data.map((d, i) => {
                const cx = getX(i);
                const cy = getY(Number(d[s.key] || 0));
                return (
                  <circle
                    key={i}
                    cx={cx}
                    cy={cy}
                    r={3.5}
                    fill="#ffffff"
                    stroke={s.color}
                    strokeWidth={2}
                  >
                    <title>{`${d.label}: ${d[s.key]} ${s.label}`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}

        {/* X Axis labels (sample up to 7 labels to prevent crowding) */}
        {data.map((d, i) => {
          const step = Math.max(1, Math.floor(data.length / 6));
          if (i % step !== 0 && i !== data.length - 1) return null;
          return (
            <text
              key={i}
              x={getX(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize="10"
              fill="#64748b"
            >
              {d.label}
            </text>
          );
        })}
      </svg>
    </div>
  );
};


// ==========================================
// 2. Horizontal Bar Chart (Categories / Listings)
// ==========================================
interface HorizontalBarChartProps {
  items: Array<{ label: string; value: number; secondaryLabel?: string }>;
  color?: string;
  emptyMessage?: string;
}

export const HorizontalBarChart: React.FC<HorizontalBarChartProps> = ({
  items,
  color = '#0d8a73',
  emptyMessage = 'No data available yet.',
}) => {
  if (!items || items.length === 0) {
    return <div style={{ color: '#94a3b8', fontSize: '0.88rem', padding: '16px 0' }}>{emptyMessage}</div>;
  }

  const maxVal = Math.max(...items.map((it) => it.value), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {items.map((it, idx) => {
        const pct = Math.round((it.value / maxVal) * 100);
        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                {it.label}
              </span>
              <span style={{ color: '#0f172a', fontWeight: 700 }}>
                {it.value.toLocaleString()} {it.secondaryLabel ? `(${it.secondaryLabel})` : ''}
              </span>
            </div>
            <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${pct}%`,
                  height: '100%',
                  background: color,
                  borderRadius: '4px',
                  transition: 'width 0.4s ease-in-out',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};


// ==========================================
// 3. Status Distribution Progress Bar
// ==========================================
interface StatusItem {
  status: string;
  count: number;
  color: string;
}

export const StatusDistributionChart: React.FC<{ items: StatusItem[] }> = ({ items }) => {
  const total = items.reduce((acc, it) => acc + it.count, 0);

  if (total === 0) {
    return <div style={{ color: '#94a3b8', fontSize: '0.88rem', padding: '16px 0' }}>No booking statuses recorded for this period.</div>;
  }

  return (
    <div>
      {/* Segmented multi-color bar */}
      <div style={{ display: 'flex', height: '14px', borderRadius: '7px', overflow: 'hidden', background: '#f1f5f9', marginBottom: '14px' }}>
        {items.map((it, idx) => {
          const pct = (it.count / total) * 100;
          if (pct === 0) return null;
          return (
            <div
              key={idx}
              title={`${it.status}: ${it.count} (${Math.round(pct)}%)`}
              style={{
                width: `${pct}%`,
                background: it.color,
                transition: 'width 0.3s ease',
              }}
            />
          );
        })}
      </div>

      {/* Legend & Breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px' }}>
        {items.map((it, idx) => {
          const pct = Math.round((it.count / total) * 100);
          return (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
              <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: it.color, flexShrink: 0 }} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ color: '#64748b', fontSize: '0.74rem' }}>{it.status}</span>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>
                  {it.count} <span style={{ fontWeight: 500, color: '#94a3b8' }}>({pct}%)</span>
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


// ==========================================
// 4. Conversion Funnel Visualizer
// ==========================================
interface FunnelStageItem {
  stage: string;
  count: number;
  percentage: number;
}

export const ConversionFunnelChart: React.FC<{ stages: FunnelStageItem[] }> = ({ stages }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {stages.map((st, idx) => {
        // Compute relative width based on first stage (or 100%)
        const baseCount = stages[0]?.count || 1;
        const relativePct = Math.max(12, Math.round((st.count / Math.max(1, baseCount)) * 100));

        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '160px', fontSize: '0.8rem', fontWeight: 600, color: '#475569', textAlign: 'right', flexShrink: 0 }}>
              {st.stage}
            </div>

            <div style={{ flex: 1, position: 'relative', height: '34px', display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: `${relativePct}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #0d8a73 0%, #14b8a6 100%)',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 12px',
                  color: '#ffffff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  boxShadow: '0 2px 4px rgba(13,138,115,0.15)',
                  transition: 'width 0.4s ease-in-out',
                }}
              >
                {st.count.toLocaleString()}
              </div>
            </div>

            <div style={{ width: '55px', fontSize: '0.78rem', fontWeight: 700, color: '#0d8a73', flexShrink: 0 }}>
              {st.percentage}%
            </div>
          </div>
        );
      })}
    </div>
  );
};


// ==========================================
// 5. Day-of-Week Peak Heat Bars
// ==========================================
export const PeakDaysBarChart: React.FC<{ peakDays: Array<{ day: string; requests: number }> }> = ({ peakDays }) => {
  const maxReq = Math.max(...peakDays.map((p) => p.requests), 1);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px', alignItems: 'end', height: '140px', paddingTop: '20px' }}>
      {peakDays.map((p, idx) => {
        const heightPct = Math.max(8, Math.round((p.requests / maxReq) * 100));
        const isPeak = p.requests === maxReq && maxReq > 0;
        return (
          <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end', gap: '6px' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: isPeak ? '#0d8a73' : '#64748b' }}>
              {p.requests}
            </span>
            <div
              style={{
                width: '100%',
                maxWidth: '28px',
                height: `${heightPct}%`,
                background: isPeak ? '#0d8a73' : '#cbd5e1',
                borderRadius: '4px',
                transition: 'height 0.3s ease',
              }}
              title={`${p.day}: ${p.requests} booking requests`}
            />
            <span style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600 }}>
              {p.day.substring(0, 3)}
            </span>
          </div>
        );
      })}
    </div>
  );
};
