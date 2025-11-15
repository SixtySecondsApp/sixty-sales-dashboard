// Direct script to fix duplicate deals issue
import { createClient } from '@supabase/supabase-js';
import { format } from 'date-fns';

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
      duplicateActivities.forEach(activity => {
      });
      
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
      const sortedActivities = [...duplicateActivities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      sortedActivities.forEach((activity, index) => {
      });
      
      // Keep the oldest activity with the original deal, create new deals for others
      for (let i = 1; i < sortedActivities.length; i++) {
        const activity = sortedActivities[i];
        // First, ensure company exists in CRM
        let companyId = null;
        try {
          // Check if company already exists
          const { data: existingCompany } = await supabase
            .from('companies')
            .select('id')
            .ilike('name', activity.client_name.trim())
            .single();
          
          if (existingCompany) {
            companyId = existingCompany.id;
          } else {
            // Create new company
            const { data: newCompany, error: companyError } = await supabase
              .from('companies')
              .insert({
                name: activity.client_name.trim(),
                domain: '', 
                size: 'unknown',
                industry: 'unknown',
                website: '',
                linkedin_url: '',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .select('id')
              .single();
            
            if (companyError) {
            } else {
              companyId = newCompany.id;
            }
          }
        } catch (error) {
        }
        
        // Create a unique deal name based on client and date
        const dealName = `${activity.client_name} - ${format(new Date(activity.date), 'MMM d, yyyy')}`;
        const dealDescription = `Deal for ${activity.client_name} signed on ${format(new Date(activity.date), 'MMM d, yyyy')}${activity.details ? ` - ${activity.details}` : ''}`;
        
        // Create new deal
        const { data: newDeal, error: createError } = await supabase
          .from('deals')
          .insert({
            name: dealName,
            company: activity.client_name,
            company_id: companyId, // Link to CRM company
            contact_name: originalDeal.contact_name,
            contact_email: originalDeal.contact_email,
            contact_phone: originalDeal.contact_phone,
            value: activity.amount || originalDeal.value,
            one_off_revenue: originalDeal.one_off_revenue,
            monthly_mrr: originalDeal.monthly_mrr,
            annual_value: originalDeal.annual_value,
            description: dealDescription,
            stage_id: originalDeal.stage_id,
            owner_id: originalDeal.owner_id,
            expected_close_date: originalDeal.expected_close_date,
            first_billing_date: originalDeal.first_billing_date,
            probability: 100, // Set to 100% since it's a completed sale
            status: 'won', // It's a completed sale
            priority: originalDeal.priority,
            deal_size: originalDeal.deal_size,
            lead_source_type: originalDeal.lead_source_type,
            lead_source_channel: originalDeal.lead_source_channel,
            next_steps: 'Deal completed',
            created_at: activity.date,
            updated_at: new Date().toISOString(),
            stage_changed_at: activity.date
          })
          .select('id')
          .single();
        
        if (createError) {
          continue;
        }
        
        const newDealId = newDeal.id;
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
      
      // Also update the original deal to ensure it's linked to a company
      const oldestActivity = sortedActivities[0];
      try {
        // Check if company already exists for the original deal
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .ilike('name', oldestActivity.client_name.trim())
          .single();
        
        let companyId = null;
        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          // Create new company for the original deal too
          const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .insert({
              name: oldestActivity.client_name.trim(),
              domain: '',
              size: 'unknown', 
              industry: 'unknown',
              website: '',
              linkedin_url: '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select('id')
            .single();
          
          if (!companyError && newCompany) {
            companyId = newCompany.id;
          }
        }
        
        // Update original deal with company link
        if (companyId) {
          await supabase
            .from('deals')
            .update({ 
              company_id: companyId,
              updated_at: new Date().toISOString()
            })
            .eq('id', dealId);
        }
      } catch (error) {
      }
    }
  } catch (error) {
  }
}

fixDuplicateDeals();