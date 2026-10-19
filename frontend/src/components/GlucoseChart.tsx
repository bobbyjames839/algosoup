import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TARGET_HIGH, TARGET_LOW, humanize } from '../lib/format'
import type { GlucoseReading } from '../types'

export function GlucoseChart({ readings, days = 7 }: { readings: GlucoseReading[]; days?: number }) {
  const now = Date.now()
  const start = now - days * 24 * 60 * 60 * 1000
  const data = readings.map((r) => ({ t: new Date(r.recorded_at).getTime(), value: Number(r.value_mmol), context: r.context }))
  const maxY = Math.max(15, ...data.map((d) => Math.ceil(d.value + 1)))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: -10 }}>
        <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
        <ReferenceArea y1={TARGET_LOW} y2={TARGET_HIGH} fill="#10b981" fillOpacity={0.08} />
        <XAxis
          dataKey="t"
          type="number"
          domain={[start, now]}
          scale="time"
          tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })}
          tick={{ fontSize: 12, fill: '#64748b' }}
        />
        <YAxis domain={[0, maxY]} tick={{ fontSize: 12, fill: '#64748b' }} unit="" />
        <Tooltip
          labelFormatter={(t) => new Date(t as number).toLocaleString()}
          formatter={(v, _n, item) => [`${v} mmol/L (${humanize(item.payload.context)})`, 'Glucose']}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#1d4ed8"
          strokeWidth={2}
          dot={(props) => {
            const { cx, cy, payload, index } = props
            const out = payload.value < TARGET_LOW || payload.value > TARGET_HIGH
            const color = payload.value < TARGET_LOW ? '#dc2626' : payload.value > TARGET_HIGH ? '#d97706' : '#1d4ed8'
            return <circle key={index} cx={cx} cy={cy} r={out ? 4 : 3} fill={color} stroke="white" strokeWidth={1} />
          }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
