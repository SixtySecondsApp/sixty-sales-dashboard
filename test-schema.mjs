import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// Test if importance column exists
const { data, error } = await supabase
  .from('tasks')
  .select('id, importance')
  .limit(1)

if (error) {
  console.log('❌ Importance column does NOT exist or has issues:', error.message)
  process.exit(1)
} else {
  console.log('✅ Importance column exists in tasks table')
  console.log('Sample data:', data)
}

// Test user_settings table
const { data: settings, error: settingsError } = await supabase
  .from('user_settings')
  .select('id, preferences')
  .limit(1)

if (settingsError) {
  console.log('❌ User settings table has issues:', settingsError.message)
} else {
  console.log('✅ User settings table accessible')
  if (settings && settings[0] && settings[0].preferences) {
    console.log('✅ Preferences column exists')
  }
}

console.log('\n🎯 Schema check complete')
