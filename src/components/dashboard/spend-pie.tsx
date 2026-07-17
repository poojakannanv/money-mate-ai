"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { categoryColour } from "@/lib/categories";
import { formatGBP } from "@/lib/format";

export interface PieDatum {
  name: string;
  value: number;
}

export function SpendPie({ data }: { data: PieDatum[] }) {
  if (data.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-muted-foreground">
        No spending in this period yet.
      </p>
    );
  }

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            strokeWidth={1}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={categoryColour(entry.name)} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => formatGBP(Number(value))} />
          <Legend
            layout="vertical"
            align="right"
            verticalAlign="middle"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12, maxWidth: 160 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
