#!/usr/bin/env node
/**
 * Profile Image Migration Script
 *
 * Migrates profile images from old Supabase project to new EU project:
 * - Old: ewtuefzeogytgmsnkpmb (US West)
 * - New: ygdpgliavpxeugaajgrb (EU)
 *
 * Usage: node scripts/migrate-profile-images.mjs
 */

import { createClient } from '@supabase/supabase-js';

// Old project (source) - read-only access needed
// Can be overridden via environment variables
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const OLD_SUPABASE_ANON_KEY = process.env.OLD_SUPABASE_ANON_KEY || process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;

// New project (destination) - need service role for storage writes
// Uses current project configuration by default
const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ygdpgliavpxeugaajgrb.supabase.co';
const NEW_SUPABASE_SERVICE_KEY = process.env.NEW_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEW_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY env var (required).');
  process.exit(1);
}

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_ANON_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_KEY);

const OLD_URL_PREFIX = 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const NEW_URL_PREFIX = 'https://ygdpgliavpxeugaajgrb.supabase.co';

async function ensureBucketExists() {
  console.log('📦 Checking if profile-images bucket exists in new project...');

  const { data: buckets, error } = await newSupabase.storage.listBuckets();

  if (error) {
    console.error('Error listing buckets:', error);
    return false;
  }

  const bucketExists = buckets.some(b => b.name === 'profile-images');

  if (!bucketExists) {
    console.log('Creating profile-images bucket...');
    const { error: createError } = await newSupabase.storage.createBucket('profile-images', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    });

    if (createError) {
      console.error('Error creating bucket:', createError);
      return false;
    }
    console.log('✅ Bucket created successfully');
  } else {
    console.log('✅ Bucket already exists');
  }

  return true;
}

async function getProfilesWithOldUrls() {
  console.log('\n🔍 Finding profiles with old image URLs...');

  const { data, error } = await newSupabase
    .from('profiles')
    .select('id, avatar_url')
    .like('avatar_url', `${OLD_URL_PREFIX}%`);

  if (error) {
    console.error('Error fetching profiles:', error);
    return [];
  }

  console.log(`Found ${data?.length || 0} profiles with old URLs`);
  return data || [];
}

async function downloadImage(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    return { buffer: new Uint8Array(arrayBuffer), contentType };
  } catch (error) {
    console.error(`  ❌ Download failed: ${error.message}`);
    return null;
  }
}

async function uploadImage(path, buffer, contentType) {
  const { error } = await newSupabase.storage
    .from('profile-images')
    .upload(path, buffer, {
      contentType,
      upsert: true
    });

  if (error) {
    console.error(`  ❌ Upload failed: ${error.message}`);
    return null;
  }

  const { data: { publicUrl } } = newSupabase.storage
    .from('profile-images')
    .getPublicUrl(path);

  return publicUrl;
}

async function updateProfileUrl(profileId, newUrl) {
  const { error } = await newSupabase
    .from('profiles')
    .update({ avatar_url: newUrl })
    .eq('id', profileId);

  if (error) {
    console.error(`  ❌ Update failed: ${error.message}`);
    return false;
  }
  return true;
}

async function migrateProfile(profile) {
  const { id, avatar_url } = profile;
  console.log(`\n👤 Migrating profile ${id}...`);
  console.log(`   Old URL: ${avatar_url}`);

  // Extract path from old URL
  // Format: .../storage/v1/object/public/profile-images/{user_id}/profile.jpeg
  const pathMatch = avatar_url.match(/\/storage\/v1\/object\/public\/profile-images\/(.+)$/);
  if (!pathMatch) {
    console.log('   ⚠️ Could not parse path from URL, skipping');
    return false;
  }

  const storagePath = pathMatch[1];
  console.log(`   Path: ${storagePath}`);

  // Download from old bucket
  console.log('   📥 Downloading...');
  const imageData = await downloadImage(avatar_url);
  if (!imageData) return false;

  // Upload to new bucket
  console.log('   📤 Uploading to new bucket...');
  const newUrl = await uploadImage(storagePath, imageData.buffer, imageData.contentType);
  if (!newUrl) return false;

  console.log(`   New URL: ${newUrl}`);

  // Update database
  console.log('   💾 Updating database...');
  const updated = await updateProfileUrl(id, newUrl);
  if (!updated) return false;

  console.log('   ✅ Migration complete');
  return true;
}

async function main() {
  console.log('🚀 Profile Image Migration Script');
  console.log('==================================');
  console.log(`From: ${OLD_URL_PREFIX}`);
  console.log(`To:   ${NEW_URL_PREFIX}`);

  // Ensure bucket exists
  const bucketReady = await ensureBucketExists();
  if (!bucketReady) {
    console.error('\n❌ Failed to ensure bucket exists. Aborting.');
    process.exit(1);
  }

  // Get profiles to migrate
  const profiles = await getProfilesWithOldUrls();
  if (profiles.length === 0) {
    console.log('\n✅ No profiles need migration!');
    return;
  }

  // Migrate each profile
  let success = 0;
  let failed = 0;

  for (const profile of profiles) {
    const result = await migrateProfile(profile);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  console.log('\n==================================');
  console.log('📊 Migration Summary');
  console.log(`   ✅ Success: ${success}`);
  console.log(`   ❌ Failed: ${failed}`);
  console.log(`   📁 Total: ${profiles.length}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(console.error);
