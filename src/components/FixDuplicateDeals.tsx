import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabaseAdmin } from '@/lib/supabase/clientV2';
import { toast } from 'sonner';
import { format } from 'date-fns';

export function FixDuplicateDeals() {
  const [isFixing, setIsFixing] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message);
  };

  const fixDuplicateDeals = async () => {
    setIsFixing(true);
    setLogs([]);
    
    try {
      addLog('🔍 Finding activities with duplicate deal_ids...');
      
      // Get all sale activities
      const { data: activities, error: activitiesError } = await supabaseAdmin
        .from('activities')
        .select('*')
        .eq('type', 'sale')
        .eq('status', 'completed')
        .not('deal_id', 'is', null)
        .order('date', { ascending: false });
      
      if (activitiesError) {
        addLog(`❌ Error fetching activities: ${activitiesError.message}`);
        toast.error('Failed to fetch activities');
        return;
      }
      
      addLog(`📋 Found ${activities.length} completed sale activities with deal_ids`);
      
      // Group activities by deal_id to find duplicates
      const dealIdGroups = activities.reduce((groups: Record<string, any[]>, activity) => {
        const dealId = activity.deal_id;
        if (!groups[dealId]) {
          groups[dealId] = [];
        }
        groups[dealId].push(activity);
        return groups;
      }, {});
      
      // Find deal_ids that have multiple activities
      const duplicateDeals = Object.entries(dealIdGroups).filter(([dealId, activities]) => activities.length > 1);
      
      addLog(`🎯 Found ${duplicateDeals.length} deal_ids with multiple activities`);
      
      if (duplicateDeals.length === 0) {
        addLog('✅ No duplicate deal_ids found - all activities have unique deals');
        toast.success('No duplicates found!');
        return;
      }
      
      // Process each duplicate deal group
      for (const [dealId, duplicateActivities] of duplicateDeals) {
        addLog(`🔧 Processing deal_id ${dealId} with ${duplicateActivities.length} activities`);
        
        // Get the original deal details
        const { data: originalDeal, error: dealError } = await supabaseAdmin
          .from('deals')
          .select('*')
          .eq('id', dealId)
          .single();
          
        if (dealError || !originalDeal) {
          addLog(`❌ Could not fetch original deal ${dealId}: ${dealError?.message}`);
          continue;
        }
        
        // Sort activities by date (oldest first)
        const sortedActivities = [...duplicateActivities].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
        // Keep the oldest activity with the original deal, create new deals for others
        for (let i = 1; i < sortedActivities.length; i++) {
          const activity = sortedActivities[i];
          addLog(`📝 Creating new deal for activity ${activity.id} (${activity.client_name})`);
          
          // First, ensure company exists in CRM
          let companyId = null;
          try {
            // Check if company already exists
            const { data: existingCompany } = await supabaseAdmin
              .from('companies')
              .select('id')
              .ilike('name', activity.client_name.trim())
              .single();
            
            if (existingCompany) {
              companyId = existingCompany.id;
              addLog(`✅ Found existing company: ${activity.client_name}`);
            } else {
              // Create new company
              const { data: newCompany, error: companyError } = await supabaseAdmin
                .from('companies')
                .insert({
                  name: activity.client_name.trim(),
                  domain: '', // Will be filled later
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
                addLog(`⚠️ Could not create company for ${activity.client_name}: ${companyError.message}`);
              } else {
                companyId = newCompany.id;
                addLog(`✅ Created new company: ${activity.client_name}`);
              }
            }
          } catch (error: any) {
            addLog(`⚠️ Error handling company ${activity.client_name}: ${error.message}`);
          }
          
          // Create a unique deal name based on client and date
          const dealName = `${activity.client_name} - ${format(new Date(activity.date), 'MMM d, yyyy')}`;
          const dealDescription = `Deal for ${activity.client_name} signed on ${format(new Date(activity.date), 'MMM d, yyyy')}${activity.details ? ` - ${activity.details}` : ''}`;
          
          // Create new deal
          const { data: newDeal, error: createError } = await supabaseAdmin
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
            addLog(`❌ Error creating new deal for activity ${activity.id}: ${createError.message}`);
            continue;
          }
          
          const newDealId = newDeal.id;
          addLog(`✅ Created new deal ${newDealId}`);
          
          // Update the activity to point to the new deal
          const { error: updateError } = await supabaseAdmin
            .from('activities')
            .update({ 
              deal_id: newDealId,
              updated_at: new Date().toISOString()
            })
            .eq('id', activity.id);
          
          if (updateError) {
            addLog(`❌ Error updating activity ${activity.id}: ${updateError.message}`);
          } else {
            addLog(`✅ Updated activity ${activity.id} to point to new deal ${newDealId}`);
          }
        }
        
        // Also update the original deal to ensure it's linked to a company
        const oldestActivity = sortedActivities[0];
        try {
          // Check if company already exists for the original deal
          const { data: existingCompany } = await supabaseAdmin
            .from('companies')
            .select('id')
            .ilike('name', oldestActivity.client_name.trim())
            .single();
          
          let companyId = null;
          if (existingCompany) {
            companyId = existingCompany.id;
          } else {
            // Create new company for the original deal too
            const { data: newCompany, error: companyError } = await supabaseAdmin
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
            await supabaseAdmin
              .from('deals')
              .update({ 
                company_id: companyId,
                updated_at: new Date().toISOString()
              })
              .eq('id', dealId);
            
            addLog(`✅ Updated original deal ${dealId} with company link`);
          }
        } catch (error: any) {
          addLog(`⚠️ Error updating original deal company link: ${error.message}`);
        }
      }
      
      addLog('🎉 Migration completed! Each sale activity now has its own unique deal.');
      toast.success('Duplicate deals fixed successfully!');
      
    } catch (error: any) {
      addLog(`❌ Unexpected error: ${error.message}`);
      toast.error('Failed to fix duplicate deals');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-xl rounded-xl p-6 border border-gray-800/50">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">Fix Duplicate Deals</h3>
        <p className="text-sm text-gray-400">
          This tool creates separate deals for activities that currently share the same deal_id.
        </p>
      </div>
      
      <Button 
        onClick={fixDuplicateDeals}
        disabled={isFixing}
        className="bg-emerald-600 hover:bg-emerald-700 text-white mb-4"
      >
        {isFixing ? 'Fixing...' : 'Fix Duplicate Deals'}
      </Button>
      
      {logs.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg p-4 max-h-60 overflow-y-auto">
          <h4 className="text-sm font-medium text-white mb-2">Progress Log:</h4>
          <div className="space-y-1 text-xs font-mono">
            {logs.map((log, index) => (
              <div key={index} className="text-gray-300">
                {log}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}