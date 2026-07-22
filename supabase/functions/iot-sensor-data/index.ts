import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { sensor_id, ph, tds, turbidity, temperature, battery_level, communication_mode } = await req.json();

    console.log('Received sensor data:', { sensor_id, ph, tds, turbidity, temperature, battery_level });

    // Get or create device
    const { data: deviceData, error: deviceError } = await supabase
      .from('iot_devices')
      .select('*')
      .eq('sensor_id', sensor_id)
      .maybeSingle();

    let device = deviceData;

    if (!device) {
      // Create new device if doesn't exist
      const { data: newDevice, error: deviceError } = await supabase
        .from('iot_devices')
        .insert({
          sensor_id,
          device_type: 'water_quality_sensor',
          battery_level,
          communication_mode: communication_mode || 'wifi',
          status: 'active',
          last_communication: new Date().toISOString(),
        })
        .select()
        .single();

      if (deviceError) {
        console.error('Error creating device:', deviceError);
        throw deviceError;
      }
      device = newDevice;
    } else {
      // Update device communication time and battery
      await supabase
        .from('iot_devices')
        .update({
          last_communication: new Date().toISOString(),
          battery_level,
          communication_mode: communication_mode || 'wifi',
          status: 'active',
        })
        .eq('id', device.id);
    }

    // Store water quality reading
    const { data: reading, error: readingError } = await supabase
      .from('water_quality_readings')
      .insert({
        device_id: device.id,
        village_id: device.village_id,
        sensor_id,
        ph: parseFloat(ph),
        tds: parseFloat(tds),
        turbidity: parseFloat(turbidity),
        temperature: parseFloat(temperature),
        reading_timestamp: new Date().toISOString(),
        status: determineWaterStatus(ph, tds, turbidity),
      })
      .select()
      .single();

    if (readingError) {
      console.error('Error storing reading:', readingError);
      throw readingError;
    }

    // Check if alert should be triggered
    const waterStatus = determineWaterStatus(ph, tds, turbidity);
    if (waterStatus !== 'normal') {
      await triggerAlert(supabase, device, waterStatus, { ph, tds, turbidity, temperature });
    }

    // Run AI prediction if needed
    if (device.village_id) {
      await generateAIPrediction(supabase, device.village_id);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        device_id: device.id,
        reading_id: reading.id,
        status: waterStatus 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing sensor data:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

function determineWaterStatus(ph: number, tds: number, turbidity: number): string {
  // WHO standards: pH 6.5-8.5, TDS <500, Turbidity <5 NTU
  if (ph < 6.0 || ph > 9.0 || tds > 800 || turbidity > 10) {
    return 'critical';
  } else if (ph < 6.5 || ph > 8.5 || tds > 500 || turbidity > 5) {
    return 'warning';
  }
  return 'normal';
}

async function triggerAlert(supabase: any, device: any, status: string, readings: any) {
  const severity = status === 'critical' ? 'high' : 'medium';
  
  const { data: alert } = await supabase
    .from('alerts')
    .insert({
      village_id: device.village_id,
      type: 'water_quality',
      severity,
      status: 'active',
      title: `Water Quality Alert - ${device.location_name || device.sensor_id}`,
      message: `Abnormal water quality detected. pH: ${readings.ph}, TDS: ${readings.tds}, Turbidity: ${readings.turbidity}`,
    })
    .select()
    .single();

  if (alert && severity === 'high') {
    // Trigger escalation system for critical alerts
    await supabase.functions.invoke('alert-escalation', {
      body: { alert_id: alert.id }
    });
  }
}

async function generateAIPrediction(supabase: any, village_id: string) {
  try {
    // Get recent readings for analysis
    const { data: readings } = await supabase
      .from('water_quality_readings')
      .select('*')
      .eq('village_id', village_id)
      .order('reading_timestamp', { ascending: false })
      .limit(50);

    if (!readings || readings.length < 10) return; // Need enough data

    // Simple trend analysis
    const avgPh = readings.reduce((sum: number, r: any) => sum + (r.ph || 0), 0) / readings.length;
    const avgTds = readings.reduce((sum: number, r: any) => sum + (r.tds || 0), 0) / readings.length;
    const avgTurbidity = readings.reduce((sum: number, r: any) => sum + (r.turbidity || 0), 0) / readings.length;

    // Calculate deterioration trend
    const recentReadings = readings.slice(0, 10);
    const olderReadings = readings.slice(-10);
    
    const recentAvgPh = recentReadings.reduce((sum: number, r: any) => sum + (r.ph || 0), 0) / recentReadings.length;
    const olderAvgPh = olderReadings.reduce((sum: number, r: any) => sum + (r.ph || 0), 0) / olderReadings.length;
    
    const deteriorating = Math.abs(recentAvgPh - 7) > Math.abs(olderAvgPh - 7);
    
    let riskLevel = 'low';
    let confidence = 0.6;
    
    if (avgPh < 6.5 || avgPh > 8.5 || avgTds > 500 || avgTurbidity > 5) {
      riskLevel = deteriorating ? 'high' : 'medium';
      confidence = 0.75;
    }

    await supabase
      .from('ai_predictions')
      .insert({
        village_id,
        prediction_type: 'water_quality',
        confidence_score: confidence,
        prediction_data: {
          predicted_risk: riskLevel,
          avg_ph: avgPh,
          avg_tds: avgTds,
          avg_turbidity: avgTurbidity,
          trend: deteriorating ? 'deteriorating' : 'stable',
        },
        model_version: 'v1.0-trend-analysis',
      });
  } catch (error) {
    console.error('Error generating AI prediction:', error);
  }
}
