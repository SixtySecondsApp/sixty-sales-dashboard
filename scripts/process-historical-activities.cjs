require('dotenv').config(); // Load environment variables from .env file
const { createClient } = require('@supabase/supabase-js');

// --- Configuration ---
// Use VITE_ prefix as defined in the .env file
const SUPABASE_URL = process.env.VITE_SUPABASE_URL; 
// IMPORTANT: Use the SERVICE ROLE KEY for this script to bypass RLS
// Update to use the correct environment variable name
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY; 

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  // Update error message to reflect the correct service key variable name
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- Constants & Helpers ---
const BATCH_SIZE = 50; // Reduce batch size slightly for more complex processing per row
const DELAY_MS = 100; // Increase delay slightly

const activityTypeToStageName = {
  // Ensure these types EXACTLY match the values in your activities.type column
  // Use lowercase keys based on observed data
  meeting: 'SQL', 
  proposal: 'Opportunity', 
  sale: 'Closed Won', 
  // Add other types from activities.type that map to stages if needed
};
const matchingActivityTypes = Object.keys(activityTypeToStageName);

const extractDomain = (email) => {
  if (!email || !email.includes('@')) return 'Unknown Company';
  return email.split('@')[1] || 'Unknown Company';
};

// --- Main Processing Function ---
async function processActivities() {
  let processedCount = 0;
  let createdDealActivitiesCount = 0;
  let updatedDealsCount = 0;
  let createdDealsCount = 0;
  let errorCount = 0;
  let markedProcessedCount = 0;
  let offset = 0;
  let hasMore = true;

  // 1. Fetch Stage IDs
  const { data: stagesData, error: stagesError } = await supabase
    .from('deal_stages')
    .select('id, name, default_probability'); // Fetch probability too

  if (stagesError) {
    return;
  }
  const stageInfo = stagesData.reduce((acc, stage) => {
    acc[stage.name] = { id: stage.id, probability: stage.default_probability };
    return acc;
  }, {});
  // --- Process in Batches ---
  while (hasMore) {
    // 2. Fetch Unprocessed Activities with contact_identifier in batches
    const { data: activities, error: fetchError } = await supabase
      .from('activities') // Read from activities table
      .select('*') 
      .eq('is_processed', false) // Filter by the new column
      .not('contact_identifier', 'is', null)
      .order('created_at', { ascending: true }) // Process older first maybe?
      .range(offset, offset + BATCH_SIZE - 1);

    if (fetchError) {
      errorCount++; 
      hasMore = false; // Stop processing if a batch fails
      break;
    }

    if (!activities || activities.length === 0) {
      hasMore = false;
      break;
    }
    // 3. Iterate through the batch
    for (const activity of activities) {
      processedCount++;
      const activityLogPrefix = `Activity ID: ${activity.id} (Type: ${activity.type}, Email: ${activity.contact_identifier}) -`;
      if (!matchingActivityTypes.includes(activity.type) || !activity.contact_identifier) {
          // Mark non-matchable types as processed to avoid reprocessing
          const { error: markSkippedError } = await supabase
              .from('activities')
              .update({ is_processed: true })
              .eq('id', activity.id);
          if (markSkippedError) {
              errorCount++;
          } else {
              markedProcessedCount++;
          }
          continue;
      }

      let dealToLink = null;
      let success = false;

      try {
        // 4. Find existing deal by contact_identifier (email)
        const { data: existingDeals, error: findError } = await supabase
          .from('deals')
          .select('*') // Select all fields for potential update
          .eq('contact_email', activity.contact_identifier)
          .limit(1);

        if (findError) throw findError; 

        const existingDeal = existingDeals?.[0];
        const targetStageName = activityTypeToStageName[activity.type];
        const targetStageDetails = stageInfo[targetStageName];
        const activityDate = activity.date || activity.created_at; // Use activity date
        const activityTimestamp = new Date(activityDate).toISOString();

        if (!targetStageDetails) {
            errorCount++;
            continue; // Skip this activity
        }
        const targetStageId = targetStageDetails.id;
        const targetProbability = targetStageDetails.probability;

        if (existingDeal) {
          // 5a. Deal Found: Update it
          dealToLink = existingDeal;
          let dealUpdateData = {};

          // Only update stage if the activity's corresponding stage is different/later?
          // Or simply set it based on the activity? Let's set based on activity for now.
          if (existingDeal.stage_id !== targetStageId) {
              dealUpdateData.stage_id = targetStageId;
              dealUpdateData.stage_changed_at = activityTimestamp; // Use activity timestamp
              dealUpdateData.probability = targetProbability; // Update probability
          }

          // Set specific date columns if they aren't already set
          if (activity.type === 'Meeting' && !existingDeal.sql_date) dealUpdateData.sql_date = activityTimestamp;
          if (activity.type === 'Proposal' && !existingDeal.opportunity_date) dealUpdateData.opportunity_date = activityTimestamp;
          if (activity.type === 'Sale' && !existingDeal.closed_won_date) dealUpdateData.closed_won_date = activityTimestamp;
          if (activity.type === 'Meeting' && !existingDeal.first_meeting_date) {
            dealUpdateData.first_meeting_date = activityTimestamp;
          }
          
          // Only update if there are changes
          if (Object.keys(dealUpdateData).length > 0) {
          const { error: updateDealError } = await supabase
            .from('deals')
            .update(dealUpdateData)
            .eq('id', existingDeal.id);

          if (updateDealError) throw updateDealError; 
              updatedDealsCount++;
          } else {
          }

        } else {
          // 5b. Deal Not Found: Create it
          const companyName = activity.client_name || extractDomain(activity.contact_identifier);
          const dealName = activity.client_name || `Deal for ${activity.contact_identifier}`;
          const ownerId = activity.user_id; 
          const dealValue = activity.amount !== null ? Number(activity.amount) : 0;

          if (!ownerId) {
            errorCount++;
            continue;
          }

          const newDealPayload = {
            name: dealName,
            company: companyName,
            contact_email: activity.contact_identifier,
            value: dealValue, 
            stage_id: targetStageId,
            owner_id: ownerId,
            first_meeting_date: activity.type === 'Meeting' ? activityTimestamp : null,
            sql_date: activity.type === 'Meeting' ? activityTimestamp : null,
            opportunity_date: activity.type === 'Proposal' ? activityTimestamp : null,
            verbal_date: null,
            closed_won_date: activity.type === 'Sale' ? activityTimestamp : null,
            closed_lost_date: null,
            contact_name: activity.client_name || '', // Use client_name if available
            contact_phone: '', // N/A from activity
            description: `Deal auto-created from Activity ${activity.id}. Notes: ${activity.details || ''}`,
            expected_close_date: null,
            probability: targetProbability,
            status: 'active',
            created_at: activityTimestamp, // Set created_at based on activity time
            stage_changed_at: activityTimestamp, // Set stage changed based on activity time
          };
          
          // --- Create Deal ---
          const { data: createdDealData, error: createDealError } = await supabase
            .from('deals')
            .insert(newDealPayload)
            .select()
            .single();

          if (createDealError) throw createDealError;
          dealToLink = createdDealData;
          createdDealsCount++;
        }

        // 6. Create corresponding deal_activity record
        if (dealToLink) {
            const dealActivityPayload = {
                deal_id: dealToLink.id,
                user_id: activity.user_id,
                activity_type: activity.type,
                notes: activity.details,
                due_date: null, // Not applicable for historical logs
                completed: activity.status === 'completed', // Set based on original status
                contact_email: activity.contact_identifier, // Store email here too
                is_matched: true, // It's matched now
                created_at: activityTimestamp, // Use activity timestamp for creation time
                updated_at: activityTimestamp
            };

            const { error: createDealActivityError } = await supabase
                .from('deal_activities')
                .insert(dealActivityPayload);

            if (createDealActivityError) throw createDealActivityError;
            createdDealActivitiesCount++;
            success = true; // Mark as successful for this activity
        } else {
            errorCount++;
        }

      } catch (err) {
        errorCount++;
        success = false; // Mark as failed
      }

      // 7. Mark original activity as processed (if successful)
      if (success) {
          const { error: markProcessedError } = await supabase
              .from('activities')
              .update({ is_processed: true })
              .eq('id', activity.id);
          
           if (markProcessedError) {
              errorCount++; // Log error but continue
           } else {
               markedProcessedCount++;
           }
      }

      // Add delay
      await new Promise(resolve => setTimeout(resolve, DELAY_MS));
    } // End of batch loop

    // Move to the next batch
    offset += activities.length; 

    // If we fetched less than the batch size, we're done
    if (activities.length < BATCH_SIZE) {
      hasMore = false;
    }

  } // End of while loop
}

// --- Run the script ---
processActivities().catch(err => {
}); 