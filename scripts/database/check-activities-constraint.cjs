const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8'
);

async function test() {
  // Test with 'call' type
  const { data: callData, error: callError } = await supabase
    .from('activities')
    .insert({
      type: 'call',
      client_name: 'Test Client Call',
      sales_rep: 'test@example.com',
      details: 'Test call',
      date: new Date().toISOString(),
      status: 'completed',
      subject: 'Test Call Subject'
    })
    .select();
  
  if (callError) {
  } else {
    // Clean up
    await supabase.from('activities').delete().eq('id', callData[0].id);
  }

  // Test with 'outbound' type
  const { data: outboundData, error: outboundError } = await supabase
    .from('activities')
    .insert({
      type: 'outbound',
      client_name: 'Test Client Outbound',
      sales_rep: 'test@example.com',
      details: 'Test outbound',
      date: new Date().toISOString(),
      status: 'completed',
      subject: 'Test Outbound Subject'
    })
    .select();
  
  if (outboundError) {
  } else {
    // Clean up
    await supabase.from('activities').delete().eq('id', outboundData[0].id);
  }
}

test();
