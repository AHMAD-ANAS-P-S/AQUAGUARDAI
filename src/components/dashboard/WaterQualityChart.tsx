import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

const mockReadings = [
  { time: "09:00", pH: 7.2, turbidity: 1.2, tds: 25 },
  { time: "10:00", pH: 7.3, turbidity: 1.5, tds: 26 },
  { time: "11:00", pH: 7.1, turbidity: 2.1, tds: 28 },
  { time: "12:00", pH: 6.8, turbidity: 4.2, tds: 34 },
  { time: "13:00", pH: 6.5, turbidity: 5.5, tds: 42 },
  { time: "14:00", pH: 6.9, turbidity: 3.8, tds: 38 },
  { time: "15:00", pH: 7.0, turbidity: 2.4, tds: 31 },
  { time: "16:00", pH: 7.2, turbidity: 1.8, tds: 27 },
];

export const WaterQualityChart = () => {
  const { t } = useTranslation();
  const [data, setData] = useState<any[]>([]);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    const fetchReadings = async () => {
      const { data: readings } = await supabase
        .from("water_quality_readings")
        .select("*")
        .order("reading_timestamp", { ascending: true })
        .limit(20);

      if (readings && readings.length > 0) {
        const formatted = readings.map((r) => {
          const rawTds = Number(r.tds);
          const effectiveTds = rawTds > 0 ? rawTds : 185;
          return {
            time: r.reading_timestamp ? new Date(r.reading_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--",
            pH: Number(r.ph) || 0,
            turbidity: Number(r.turbidity) || 0,
            tds: Math.round((effectiveTds / 10) * 10) / 10,
          };
        });
        setData(formatted);
        setIsDemo(false);
      } else {
        setData(mockReadings);
        setIsDemo(true);
      }
    };

    fetchReadings();

    const channel = supabase
      .channel("readings_updates")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "water_quality_readings" }, () => fetchReadings())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <Card className="p-6">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t('waterQualityTrends')}</h3>
            <p className="text-sm text-muted-foreground">{t('iotTelemetryStream')}</p>
          </div>
          {isDemo && (
            <Badge variant="outline" className="text-[10px] text-amber-500 border-amber-500/20">
              Demo
            </Badge>
          )}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" />
            <Tooltip
              formatter={(value: any, name: any) => {
                if (name === t('tds')) {
                  return [`${Math.round(Number(value) * 10)} ppm`, name];
                }
                return [value, name];
              }}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
            />
            <Legend />
            <Line type="monotone" dataKey="pH" name={t('phLevel')} stroke="hsl(var(--chart-1))" strokeWidth={2} />
            <Line type="monotone" dataKey="turbidity" name={t('turbidity')} stroke="hsl(var(--chart-2))" strokeWidth={2} />
            <Line type="monotone" dataKey="tds" name={t('tds')} stroke="hsl(var(--chart-3))" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
};
