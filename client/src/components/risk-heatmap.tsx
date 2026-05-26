// Stacked Recharts BarChart: clause types on X, violation count on Y,
// stacked by risk level (red / amber / green).

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Audit } from "@/lib/types";
import { CLAUSE_TYPES } from "@/lib/types";

interface Props {
  audits: Audit[];
  clauseTypes: Record<string, string>; // clause_id -> clause_type
}

export function RiskHeatmap({ audits, clauseTypes }: Props) {
  const data = CLAUSE_TYPES.map((t) => ({
    type: shortLabel(t),
    fullType: t,
    High: 0,
    Med: 0,
    Low: 0,
  }));
  const idx: Record<string, number> = {};
  data.forEach((d, i) => (idx[d.fullType] = i));

  for (const a of audits) {
    if (a.verdict === "compliant") continue;
    const t = clauseTypes[a.clause_id] ?? "Other";
    const row = data[idx[t] ?? idx["Other"]];
    if (!row) continue;
    if (a.risk_level === "High") row.High += 1;
    else if (a.risk_level === "Med") row.Med += 1;
    else row.Low += 1;
  }

  return (
    <div className="w-full h-[280px]" data-testid="chart-risk-heatmap">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 16, left: -8, bottom: 0 }}>
          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 4" vertical={false} />
          <XAxis
            dataKey="type"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            interval={0}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "hsl(var(--border))" }}
            width={28}
          />
          <Tooltip
            cursor={{ fill: "hsl(var(--accent) / 0.4)" }}
            contentStyle={{
              background: "hsl(var(--popover))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
              color: "hsl(var(--foreground))",
            }}
            labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "hsl(var(--muted-foreground))" }}
            iconType="square"
          />
          <Bar dataKey="Low" stackId="r" fill="hsl(var(--risk-low))" radius={[0, 0, 4, 4]} />
          <Bar dataKey="Med" stackId="r" fill="hsl(var(--risk-med))" />
          <Bar dataKey="High" stackId="r" fill="hsl(var(--risk-high))" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function shortLabel(t: string): string {
  return t
    .replace("Data Collection", "Collection")
    .replace("User Rights", "Rights");
}
