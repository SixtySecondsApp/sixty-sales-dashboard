import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStages() {
  try {
    // Get all stages
    const { data: stages, error: stagesError } = await supabase
      .from('deal_stages')
      .select('*');
      
    if (stagesError) {
      return;
    }
    stages.forEach((stage, index) => {
    });
    
    // Find won/signed stages
    const wonStages = stages.filter(s => 
      s.name.toLowerCase().includes('signed') || 
      s.name.toLowerCase().includes('won') || 
      s.name.toLowerCase().includes('closed') ||
      s.name.toLowerCase().includes('paid')
    );
    
    if (wonStages.length > 0) {
      wonStages.forEach(stage => {
      });
      
      const wonStageIds = wonStages.map(s => s.id);
      
      // Get deals in won stages
      const { data: deals, error: dealsError } = await supabase
        .from('deals')
        .select(`
          id, name, company, value, stage_id, monthly_mrr, one_off_revenue,
          owner_id, contact_name, contact_email
        `)
        .in('stage_id', wonStageIds)
        .order('created_at', { ascending: false })
        .limit(10);
        
      if (dealsError) {
        return;
      }
      if (deals.length === 0) {
      } else {
        deals.forEach((deal, index) => {
          const stage = stages.find(s => s.id === deal.stage_id);
          if (deal.monthly_mrr) {
          }
          if (deal.one_off_revenue) {
          }
          if (deal.contact_email) {
          }
        });
      }
      
      // Check if any clients already exist
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, company_name, subscription_amount, status, deal_id')
        .limit(5);
        
      if (clientsError) {
      } else {
        clients.forEach((client, index) => {
        });
      }
      
    } else {
    }
    
  } catch (error) {
  }
}

checkStages().then(() => {
  process.exit(0);
}).catch(error => {
  process.exit(1);
});