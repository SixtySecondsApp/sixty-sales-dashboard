import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3dHVlZnplb2d5dGdtc25rcG1iIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzg5NDkyNywiZXhwIjoyMDUzNDcwOTI3fQ.jKjwRZn7fi9rJUcmWPe5zBRpq7leefmx0H8U59bfVEs';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkStages() {
  console.log('🔍 Checking deal stages and signed deals...\n');
  
  try {
    // Get all stages
    const { data: stages, error: stagesError } = await supabase
      .from('deal_stages')
      .select('*');
      
    if (stagesError) {
      console.error('❌ Error fetching stages:', stagesError);
      return;
    }
    
    console.log('📊 Available deal stages:');
    stages.forEach((stage, index) => {
      console.log(`  ${index + 1}. ${stage.name} (ID: ${stage.id})`);
    });
    
    // Find won/signed stages
    const wonStages = stages.filter(s => 
      s.name.toLowerCase().includes('signed') || 
      s.name.toLowerCase().includes('won') || 
      s.name.toLowerCase().includes('closed') ||
      s.name.toLowerCase().includes('paid')
    );
    
    if (wonStages.length > 0) {
      console.log('\n✅ Found won/signed stages:');
      wonStages.forEach(stage => {
        console.log(`  - ${stage.name} (ID: ${stage.id})`);
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
        console.error('❌ Error fetching deals:', dealsError);
        return;
      }
      
      console.log(`\n📋 Found ${deals.length} signed deals ready for conversion:`);
      
      if (deals.length === 0) {
        console.log('  (No deals found in signed stages yet)');
      } else {
        deals.forEach((deal, index) => {
          const stage = stages.find(s => s.id === deal.stage_id);
          console.log(`\n  ${index + 1}. ${deal.name || 'Unnamed Deal'}`);
          console.log(`     Company: ${deal.company || 'No company'}`);
          console.log(`     Value: £${deal.value || 0}`);
          console.log(`     Stage: ${stage?.name || 'Unknown'}`);
          if (deal.monthly_mrr) {
            console.log(`     Monthly MRR: £${deal.monthly_mrr}`);
          }
          if (deal.one_off_revenue) {
            console.log(`     One-off Revenue: £${deal.one_off_revenue}`);
          }
          console.log(`     Contact: ${deal.contact_name || 'No contact'}`);
          if (deal.contact_email) {
            console.log(`     Email: ${deal.contact_email}`);
          }
        });
      }
      
      // Check if any clients already exist
      console.log('\n🔍 Checking existing subscription clients...');
      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, company_name, subscription_amount, status, deal_id')
        .limit(5);
        
      if (clientsError) {
        console.log('❌ No clients table exists yet (expected - run the SQL first)');
      } else {
        console.log(`📊 Found ${clients.length} existing subscription clients:`);
        clients.forEach((client, index) => {
          console.log(`  ${index + 1}. ${client.company_name} - £${client.subscription_amount}/month (${client.status})`);
        });
      }
      
    } else {
      console.log('\n❌ No won/signed stages found');
      console.log('   Available stages:', stages.map(s => s.name).join(', '));
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  }
}

checkStages().then(() => {
  console.log('\n🎉 Analysis complete!');
  process.exit(0);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});