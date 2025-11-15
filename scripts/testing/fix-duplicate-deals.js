import { createClient } from '@supabase/supabase-js';

// Use service role key for admin operations
const supabase = createClient(
  'https://dcqjcbagvnsjhmmvuhyp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRjcWpjYmFndm5zamhtbXZ1aHlwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyNzI3MTgwMiwiZXhwIjoyMDQyODQ3ODAyfQ.fqDcmJ4zUFPBQJc1QvVB1E8lNLGbgMhGCg2NxvjcCDg'
);

async function fixDuplicateDeals() {
  try {
    // Get all sale activities
    const { data: activities, error: activitiesError } = await supabase
      .from('activities')
      .select('*')
      .eq('type', 'sale')
      .eq('status', 'completed')
      .not('deal_id', 'is', null)
      .order('date', { ascending: false });
    
    if (activitiesError) {
      return;
    }
    // Group activities by deal_id to find duplicates
    const dealIdGroups = activities.reduce((groups, activity) => {
      const dealId = activity.deal_id;
      if (!groups[dealId]) {
        groups[dealId] = [];
      }
      groups[dealId].push(activity);
      return groups;
    }, {});
    
    // Find deal_ids that have multiple activities
    const duplicateDeals = Object.entries(dealIdGroups).filter(([dealId, activities]) => activities.length > 1);
    if (duplicateDeals.length === 0) {
      return;
    }
    
    // Process each duplicate deal group
    for (const [dealId, duplicateActivities] of duplicateDeals) {
      // Get the original deal details
      const { data: originalDeal, error: dealError } = await supabase
        .from('deals')
        .select('*')
        .eq('id', dealId)
        .single();
        
      if (dealError || !originalDeal) {
        continue;
      }
      
      // Sort activities by date (oldest first)
      duplicateActivities.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Keep the oldest activity with the original deal, create new deals for others
      for (let i = 1; i < duplicateActivities.length; i++) {
        const activity = duplicateActivities[i];
        // Generate a new UUID for the deal
        const { data: newDealResult, error: createError } = await supabase
          .from('deals')
          .insert({
            name: `${activity.client_name} Deal (${activity.date.split('T')[0]})`,
            company: activity.client_name,
            contact_name: originalDeal.contact_name,
            contact_email: originalDeal.contact_email,
            contact_phone: originalDeal.contact_phone,
            value: activity.amount || originalDeal.value,
            one_off_revenue: originalDeal.one_off_revenue,
            monthly_mrr: originalDeal.monthly_mrr,
            annual_value: originalDeal.annual_value,
            description: `Generated from activity: ${activity.details}`,
            stage_id: originalDeal.stage_id,
            owner_id: originalDeal.owner_id,
            expected_close_date: originalDeal.expected_close_date,
            first_billing_date: originalDeal.first_billing_date,
            probability: originalDeal.probability,
            status: 'won', // It's a completed sale
            priority: originalDeal.priority,
            deal_size: originalDeal.deal_size,
            lead_source_type: originalDeal.lead_source_type,
            lead_source_channel: originalDeal.lead_source_channel,
            next_steps: originalDeal.next_steps,
            created_at: activity.date,
            updated_at: new Date().toISOString(),
            stage_changed_at: activity.date
          })
          .select('id')
          .single();
        
        if (createError) {
          continue;
        }
        
        const newDealId = newDealResult.id;
        // Update the activity to point to the new deal
        const { error: updateError } = await supabase
          .from('activities')
          .update({ 
            deal_id: newDealId,
            updated_at: new Date().toISOString()
          })
          .eq('id', activity.id);
        
        if (updateError) {
        } else {
        }
      }
    }
  } catch (error) {
  }
}

fixDuplicateDeals();