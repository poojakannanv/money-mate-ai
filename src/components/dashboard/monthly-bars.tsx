"use client";

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
import { categoryColour } from "@/lib/categories";
import { formatGBP } from "@/lib/format";

export interface MonthlyBarDatum {
  /** Human label, e.g. "May 2026" */
  label: string;
  /** One numeric key per category present in the period. */
  [category: string]: string | number;
}

interface MonthlyBarsProps {
  data: MonthlyBarDatum[];
  categories: string[];
}

export function MonthlyBars({ data, categories }: MonthlyBarsProps) {
  if (data.length === 0 || categories.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        Upload a few months of statements to see the trend.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" fontSize={12} tickLine={false} />
          <YAxis
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `£${Math.round(v)}`}
            width={56}
          />
          <Tooltip formatter={(value) => formatGBP(Number(value))} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {categories.map((category) => (
            <Bar
              key={category}
              dataKey={category}
              stackId="spend"
              fill={categoryColour(category)}
              radius={[0, 0, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
