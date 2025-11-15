const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ewtuefzeogytgmsnkpmb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzc4OTQ5MjcsImV4cCI6MjA1MzQ3MDkyN30.O22Zx_xB_UuasB19V66g69fl6GdAdW38vuYQPbGUUf8'
);

async function getStages() {
  const { data: stages, error } = await supabase
    .from('deal_stages')
    .select('*')
    .order('order_position', { ascending: true });
  
  if (error) {
    return;
  }
  stages.forEach(stage => {
    const isUnwanted = ['Lead', 'Qualified', 'Closed Won'].includes(stage.name);
    const marker = isUnwanted ? '❌ REMOVE' : '✅ KEEP';
  });
  
  // Get the first non-unwanted stage to use as default
  const firstGoodStage = stages.find(s => !['Lead', 'Qualified', 'Closed Won'].includes(s.name));
  if (firstGoodStage) {
  } else {
  }
}

getStages();
