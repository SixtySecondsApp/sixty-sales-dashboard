import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables (need service role key)');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function ensureOwnerActivity(dealId) {
  console.log(`\nEnsuring owner activity for deal ${dealId}`);
  
  // Get the deal
  const { data: deal } = await supabase
    .from('deals')
    .select('*')
    .eq('id', dealId)
    .single();
  
  if (!deal) {
    console.log('Deal not found');
    return;
  }
  
  console.log(`Deal: ${deal.name} (${deal.company}), Value: ${deal.value}, Owner: ${deal.owner_id}`);
  
  // Get all splits for this deal
  const { data: splits } = await supabase
    .from('deal_splits')
    .select('*')
    .eq('deal_id', dealId);
  
  const totalSplitPercentage = splits?.reduce((sum, s) => sum + s.percentage, 0) || 0;
  const ownerPercentage = 100 - totalSplitPercentage;
  
  console.log(`Splits: ${splits?.length || 0}, Total split: ${totalSplitPercentage}%, Owner keeps: ${ownerPercentage}%`);
  
  // Check for owner's activity
  const { data: ownerActivity } = await supabase
    .from('activities')
    .select('*')
    .eq('deal_id', dealId)
    .eq('user_id', deal.owner_id)
    .eq('type', 'sale')
    .single();
  
  if (ownerActivity) {
    console.log(`Found owner activity: ${ownerActivity.details}, Amount: ${ownerActivity.amount}`);
    
    // Update the amount if needed
    const expectedAmount = deal.value * (ownerPercentage / 100);
    if (Math.abs(ownerActivity.amount - expectedAmount) > 0.01) {
      console.log(`Updating owner activity amount from ${ownerActivity.amount} to ${expectedAmount}`);
      
      const baseDetails = ownerActivity.details?.replace(/ \(\d+% retained after split\)/, '') || 'Sale';
      const updatedDetails = ownerPercentage < 100 
        ? `${baseDetails} (${ownerPercentage}% retained after split)`
        : baseDetails;
      
      const { error } = await supabase
        .from('activities')
        .update({
          amount: expectedAmount,
          details: updatedDetails,
          split_percentage: ownerPercentage < 100 ? ownerPercentage : null
        })
        .eq('id', ownerActivity.id);
      
      if (error) {
        console.error('Failed to update owner activity:', error);
      } else {
        console.log('✅ Owner activity updated');
      }
    } else {
      console.log('✅ Owner activity amount is correct');
    }
  } else {
    console.log('No owner activity found - creating one');
    
    // Get owner profile
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', deal.owner_id)
      .single();
    
    if (ownerProfile) {
      const ownerAmount = deal.value * (ownerPercentage / 100);
      const details = ownerPercentage < 100 
        ? `${deal.name || 'Sale'} (${ownerPercentage}% retained after split)`
        : `${deal.name || 'Sale'}`;
      
      const newActivity = {
        user_id: deal.owner_id,
        type: 'sale',
        client_name: deal.company || deal.name,
        details: details,
        amount: ownerAmount,
        priority: 'high',
        sales_rep: `${ownerProfile.first_name} ${ownerProfile.last_name}`,
        date: deal.created_at,
        status: 'completed',
        quantity: 1,
        contact_identifier: deal.contact_email,
        contact_identifier_type: deal.contact_email ? 'email' : 'unknown',
        deal_id: dealId,
        is_split: false,
        split_percentage: ownerPercentage < 100 ? ownerPercentage : null
      };
      
      const { error } = await supabase
        .from('activities')
        .insert([newActivity]);
      
      if (error) {
        console.error('Failed to create owner activity:', error);
      } else {
        console.log('✅ Owner activity created');
      }
    }
  }
}

// Run for the specific deal
ensureOwnerActivity('1c44cf61-950a-4c39-a5d3-0e95573d5552');