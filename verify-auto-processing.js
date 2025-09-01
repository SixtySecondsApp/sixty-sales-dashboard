// Quick verification script for automatic activity processing
// Run this in your browser console or as a Node script

import { createClient } from '@supabase/supabase-js';

// Update these with your actual values
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyAutoProcessing() {
    console.log('🔍 Verifying Automatic Activity Processing...\n');
    
    try {
        // 1. Check if columns exist
        console.log('1️⃣ Checking database columns...');
        const { data: testActivity, error: columnError } = await supabase
            .from('activities')
            .select('is_processed, auto_matched')
            .limit(1);
        
        if (columnError) {
            console.error('❌ Missing columns:', columnError.message);
            return false;
        }
        console.log('✅ Required columns exist\n');
        
        // 2. Get processing statistics
        console.log('2️⃣ Getting processing statistics...');
        const { data: stats, error: statsError } = await supabase
            .from('activities')
            .select('is_processed, contact_identifier, deal_id, type')
            .not('contact_identifier', 'is', null);
        
        if (statsError) {
            console.error('❌ Error getting stats:', statsError.message);
            return false;
        }
        
        const total = stats.length;
        const processed = stats.filter(a => a.is_processed).length;
        const withDeals = stats.filter(a => a.deal_id).length;
        const byType = {};
        
        stats.forEach(a => {
            if (!byType[a.type]) {
                byType[a.type] = { total: 0, processed: 0, withDeals: 0 };
            }
            byType[a.type].total++;
            if (a.is_processed) byType[a.type].processed++;
            if (a.deal_id) byType[a.type].withDeals++;
        });
        
        console.log(`📊 Statistics:`);
        console.log(`   Total activities with emails: ${total}`);
        console.log(`   Processed: ${processed} (${total ? (processed/total*100).toFixed(1) : 0}%)`);
        console.log(`   With deals: ${withDeals} (${total ? (withDeals/total*100).toFixed(1) : 0}%)\n`);
        
        console.log('📈 By Activity Type:');
        Object.entries(byType).forEach(([type, data]) => {
            console.log(`   ${type}: ${data.processed}/${data.total} processed, ${data.withDeals} with deals`);
        });
        console.log('');
        
        // 3. Test with a new activity
        console.log('3️⃣ Creating test activity to verify trigger...');
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            console.warn('⚠️ Not authenticated. Please log in to test activity creation.');
            return true;
        }
        
        const testEmail = `test-${Date.now()}@example.com`;
        const { data: newActivity, error: createError } = await supabase
            .from('activities')
            .insert({
                type: 'meeting',
                contact_identifier: testEmail,
                client_name: 'Auto Process Test Company',
                details: 'Test activity for automatic processing verification',
                date: new Date().toISOString(),
                user_id: user.id
            })
            .select()
            .single();
        
        if (createError) {
            console.error('❌ Error creating test activity:', createError.message);
            return false;
        }
        
        console.log(`✅ Created test activity: ${newActivity.id}`);
        
        // Wait for trigger to process
        console.log('⏳ Waiting for automatic processing...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if it was processed
        const { data: processedActivity, error: checkError } = await supabase
            .from('activities')
            .select('*, deals(*), contacts(*)')
            .eq('id', newActivity.id)
            .single();
        
        if (checkError) {
            console.error('❌ Error checking activity:', checkError.message);
            return false;
        }
        
        console.log('\n🎯 Test Results:');
        console.log(`   Activity ID: ${processedActivity.id}`);
        console.log(`   Processed: ${processedActivity.is_processed ? '✅' : '❌'}`);
        console.log(`   Auto-matched: ${processedActivity.auto_matched ? '✅' : '❌'}`);
        console.log(`   Deal created: ${processedActivity.deal_id ? '✅ ' + processedActivity.deal_id : '❌'}`);
        console.log(`   Contact created: ${processedActivity.contact_id ? '✅ ' + processedActivity.contact_id : '❌'}`);
        
        if (processedActivity.deals) {
            console.log(`   Deal details: ${processedActivity.deals.name} (Stage: ${processedActivity.deals.stage_id})`);
        }
        
        // Clean up test data
        console.log('\n🧹 Cleaning up test data...');
        await supabase.from('activities').delete().eq('id', newActivity.id);
        
        if (processedActivity.is_processed) {
            console.log('\n✅ AUTOMATIC PROCESSING IS WORKING!');
            console.log('Activities with emails are being automatically processed into deals.');
            return true;
        } else {
            console.log('\n⚠️ Activity was not automatically processed.');
            console.log('The trigger may not be active. Please check:');
            console.log('1. Migration was applied successfully');
            console.log('2. No errors in Supabase logs');
            console.log('3. Trigger permissions are correct');
            return false;
        }
        
    } catch (error) {
        console.error('❌ Unexpected error:', error);
        return false;
    }
}

// Run verification
verifyAutoProcessing().then(success => {
    console.log('\n' + '='.repeat(50));
    if (success) {
        console.log('🎉 System is ready for automatic activity processing!');
    } else {
        console.log('⚠️ Please check the issues above and try again.');
    }
    console.log('='.repeat(50));
});

// Export for use in other scripts
export { verifyAutoProcessing };