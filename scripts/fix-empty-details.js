import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixEmptyDetails() {
  try {
    // Find all activities with empty or null details
    const { data: activitiesWithEmptyDetails, error: fetchError } = await supabase
      .from('activities')
      .select('*')
      .or('details.is.null,details.eq.')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Error fetching activities: ${fetchError.message}`);
    }
    if (activitiesWithEmptyDetails.length === 0) {
      return;
    }

    // Group activities by type
    const activitiesByType = activitiesWithEmptyDetails.reduce((acc, activity) => {
      if (!acc[activity.type]) acc[activity.type] = [];
      acc[activity.type].push(activity);
      return acc;
    }, {});
    Object.entries(activitiesByType).forEach(([type, activities]) => {
    });

    let totalUpdated = 0;

    // Update meeting activities with discovery details
    if (activitiesByType.meeting && activitiesByType.meeting.length > 0) {
      for (const activity of activitiesByType.meeting) {
        // Set a default meeting type - you can customize this logic
        let newDetails = 'Discovery Call'; // Default to Discovery Call
        
        // You could add more sophisticated logic here based on:
        // - client_name patterns
        // - date ranges 
        // - other activity context
        const { error: updateError } = await supabase
          .from('activities')
          .update({ details: newDetails })
          .eq('id', activity.id);
          
        if (updateError) {
        } else {
          totalUpdated++;
        }
      }
    }

    // Update outbound activities 
    if (activitiesByType.outbound && activitiesByType.outbound.length > 0) {
      for (const activity of activitiesByType.outbound) {
        let newDetails = 'Call'; // Default to Call
        const { error: updateError } = await supabase
          .from('activities')
          .update({ details: newDetails })
          .eq('id', activity.id);
          
        if (updateError) {
        } else {
          totalUpdated++;
        }
      }
    }

    // Update proposal activities
    if (activitiesByType.proposal && activitiesByType.proposal.length > 0) {
      for (const activity of activitiesByType.proposal) {
        let newDetails = 'Proposal Sent'; // Default details
        const { error: updateError } = await supabase
          .from('activities')
          .update({ details: newDetails })
          .eq('id', activity.id);
          
        if (updateError) {
        } else {
          totalUpdated++;
        }
      }
    }

    // Update sale activities
    if (activitiesByType.sale && activitiesByType.sale.length > 0) {
      for (const activity of activitiesByType.sale) {
        let newDetails = 'One-off Sale'; // Default details
        const { error: updateError } = await supabase
          .from('activities')
          .update({ details: newDetails })
          .eq('id', activity.id);
          
        if (updateError) {
        } else {
          totalUpdated++;
        }
      }
    }
    // Verify the fix
    const { data: remainingEmptyDetails, error: verifyError } = await supabase
      .from('activities')
      .select('id, type, details')
      .or('details.is.null,details.eq.');

    if (verifyError) {
    } else {
      if (remainingEmptyDetails.length === 0) {
      } else {
        remainingEmptyDetails.forEach(activity => {
        });
      }
    }

  } catch (error) {
    process.exit(1);
  }
}

// Run the migration
fixEmptyDetails()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    process.exit(1);
  }); 