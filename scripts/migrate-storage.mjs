#!/usr/bin/env node
/**
 * Comprehensive Storage Migration Script
 *
 * Migrates all storage buckets and files from old Supabase project to new project:
 * - Old: ewtuefzeogytgmsnkpmb (US West)
 * - New: ygdpgliavpxeugaajgrb (EU) - or set via env vars
 *
 * Usage:
 *   OLD_SUPABASE_URL=https://old-project.supabase.co \
 *   OLD_SUPABASE_SERVICE_KEY=old-service-key \
 *   NEW_SUPABASE_URL=https://new-project.supabase.co \
 *   NEW_SUPABASE_SERVICE_KEY=new-service-key \
 *   node scripts/migrate-storage.mjs
 *
 * Or set in .env.local:
 *   OLD_SUPABASE_URL=...
 *   OLD_SUPABASE_SERVICE_KEY=...
 *   NEW_SUPABASE_URL=...
 *   NEW_SUPABASE_SERVICE_KEY=...
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env.local if it exists
function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env.local');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    const lines = content.split('\n');
    for (const line of lines) {
      const match = line.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnvFile();

// Configuration - defaults to known old/new projects, but can be overridden
const OLD_SUPABASE_URL = process.env.OLD_SUPABASE_URL || 'https://ewtuefzeogytgmsnkpmb.supabase.co';
const OLD_SUPABASE_SERVICE_KEY = process.env.OLD_SUPABASE_SERVICE_KEY || process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;

const NEW_SUPABASE_URL = process.env.NEW_SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ygdpgliavpxeugaajgrb.supabase.co';
const NEW_SUPABASE_SERVICE_KEY = process.env.NEW_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OLD_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing OLD_SUPABASE_SERVICE_KEY env var (required).');
  console.error('');
  console.error('To migrate storage, you need the service role key for the OLD project.');
  console.error(`   Old project: ${OLD_SUPABASE_URL}`);
  console.error('');
  console.error('Get it from: Supabase Dashboard → Project Settings → API → service_role key');
  console.error('');
  console.error('Set it via:');
  console.error('   export OLD_SUPABASE_SERVICE_KEY="your-old-service-role-key"');
  console.error('   # Or add to .env.local: OLD_SUPABASE_SERVICE_KEY=...');
  process.exit(1);
}

if (!NEW_SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing NEW_SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY env var (required).');
  console.error('   Set NEW_SUPABASE_SERVICE_KEY=your-new-project-service-key');
  process.exit(1);
}

const oldSupabase = createClient(OLD_SUPABASE_URL, OLD_SUPABASE_SERVICE_KEY);
const newSupabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_KEY);

const OLD_URL_PREFIX = OLD_SUPABASE_URL.replace(/\/$/, '');
const NEW_URL_PREFIX = NEW_SUPABASE_URL.replace(/\/$/, '');

// Statistics
const stats = {
  bucketsCreated: 0,
  bucketsSkipped: 0,
  filesCopied: 0,
  filesFailed: 0,
  dbRecordsUpdated: 0,
  dbRecordsFailed: 0,
};

/**
 * Ensure bucket exists in new project with same configuration
 */
async function ensureBucketExists(bucketName, bucketConfig) {
  console.log(`\n📦 Checking bucket: ${bucketName}`);

  const { data: buckets, error } = await newSupabase.storage.listBuckets();
  if (error) {
    console.error(`  ❌ Error listing buckets: ${error.message}`);
    return false;
  }

  const bucketExists = buckets.some(b => b.name === bucketName);

  if (bucketExists) {
    console.log(`  ✅ Bucket already exists`);
    stats.bucketsSkipped++;
    return true;
  }

  console.log(`  🔨 Creating bucket...`);
  const { error: createError } = await newSupabase.storage.createBucket(bucketName, {
    public: bucketConfig.public !== false,
    fileSizeLimit: bucketConfig.fileSizeLimit,
    allowedMimeTypes: bucketConfig.allowedMimeTypes,
  });

  if (createError) {
    console.error(`  ❌ Error creating bucket: ${createError.message}`);
    return false;
  }

  console.log(`  ✅ Bucket created successfully`);
  stats.bucketsCreated++;
  return true;
}

/**
 * List all files in a bucket (recursively)
 */
async function listAllFiles(bucketName, supabaseClient, path = '') {
  const files = [];
  const { data, error } = await supabaseClient.storage
    .from(bucketName)
    .list(path, {
      limit: 1000,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });

  if (error) {
    console.error(`  ❌ Error listing files in ${path}: ${error.message}`);
    return files;
  }

  if (!data) return files;

  for (const item of data) {
    const fullPath = path ? `${path}/${item.name}` : item.name;

    if (item.id === null) {
      // It's a folder, recurse
      const subFiles = await listAllFiles(bucketName, supabaseClient, fullPath);
      files.push(...subFiles);
    } else {
      // It's a file
      files.push({
        name: item.name,
        path: fullPath,
        size: item.metadata?.size || 0,
        mimeType: item.metadata?.mimetype || 'application/octet-stream',
        updatedAt: item.updated_at,
      });
    }
  }

  return files;
}

/**
 * Download file from old bucket
 */
async function downloadFile(bucketName, filePath, supabaseClient) {
  try {
    const { data, error } = await supabaseClient.storage
      .from(bucketName)
      .download(filePath);

    if (error) {
      throw new Error(error.message);
    }

    const arrayBuffer = await data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  } catch (error) {
    console.error(`    ❌ Download failed: ${error.message}`);
    return null;
  }
}

/**
 * Upload file to new bucket
 */
async function uploadFile(bucketName, filePath, buffer, mimeType, supabaseClient) {
  try {
    const { error } = await supabaseClient.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(error.message);
    }

    const { data: { publicUrl } } = supabaseClient.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    return publicUrl;
  } catch (error) {
    console.error(`    ❌ Upload failed: ${error.message}`);
    return null;
  }
}

/**
 * Migrate all files in a bucket
 */
async function migrateBucket(bucketName, bucketConfig) {
  console.log(`\n🔄 Migrating bucket: ${bucketName}`);
  console.log(`   From: ${OLD_URL_PREFIX}/storage/v1/object/public/${bucketName}/`);
  console.log(`   To:   ${NEW_URL_PREFIX}/storage/v1/object/public/${bucketName}/`);

  // Ensure bucket exists
  const bucketReady = await ensureBucketExists(bucketName, bucketConfig);
  if (!bucketReady) {
    console.error(`  ❌ Failed to ensure bucket exists. Skipping.`);
    return;
  }

  // List all files in old bucket
  console.log(`  📋 Listing files...`);
  const files = await listAllFiles(bucketName, oldSupabase);
  console.log(`  📁 Found ${files.length} files`);

  if (files.length === 0) {
    console.log(`  ✅ No files to migrate`);
    return;
  }

  // Migrate each file
  let success = 0;
  let failed = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const progress = `[${i + 1}/${files.length}]`;
    console.log(`  ${progress} ${file.path} (${(file.size / 1024).toFixed(1)}KB)`);

    // Download from old bucket
    const buffer = await downloadFile(bucketName, file.path, oldSupabase);
    if (!buffer) {
      failed++;
      stats.filesFailed++;
      continue;
    }

    // Upload to new bucket
    const newUrl = await uploadFile(bucketName, file.path, buffer, file.mimeType, newSupabase);
    if (!newUrl) {
      failed++;
      stats.filesFailed++;
      continue;
    }

    success++;
    stats.filesCopied++;
  }

  console.log(`  ✅ Migrated ${success} files, ${failed} failed`);
}

/**
 * Update database records that reference old storage URLs
 */
async function updateDatabaseReferences(bucketName) {
  console.log(`\n💾 Updating database references for bucket: ${bucketName}`);

  // Tables and columns that might reference this bucket
  const tablesToCheck = [
    { table: 'profiles', columns: ['avatar_url'] },
    { table: 'contacts', columns: ['avatar_url', 'linkedin_photo_url', 'photo_url', 'image_url'] },
    { table: 'companies', columns: ['logo_url', 'logo', 'image_url'] },
    { table: 'activities', columns: ['avatar_url', 'attachment_url'] },
    { table: 'meetings', columns: ['thumbnail_url', 'video_url', 'recording_url'] },
    { table: 'tasks', columns: ['attachment_url'] },
    { table: 'deals', columns: ['attachment_url'] },
    { table: 'attachments', columns: ['url', 'file_url', 'storage_path'] },
    { table: 'files', columns: ['url', 'path', 'storage_url'] },
    { table: 'documents', columns: ['url', 'file_url'] },
    { table: 'images', columns: ['url', 'src'] },
    { table: 'media', columns: ['url', 'src'] },
    { table: 'uploads', columns: ['url', 'path'] },
  ];

  const bucketPath = `/storage/v1/object/public/${bucketName}/`;
  const oldBucketUrl = `${OLD_URL_PREFIX}${bucketPath}`;
  const newBucketUrl = `${NEW_URL_PREFIX}${bucketPath}`;

  for (const { table, columns } of tablesToCheck) {
    for (const col of columns) {
      try {
        // Find records with old URLs
        const { data, error } = await newSupabase
          .from(table)
          .select('id, ' + col)
          .like(col, `%${oldBucketUrl}%`);

        if (error) {
          // Table or column doesn't exist, skip
          continue;
        }

        if (!data || data.length === 0) {
          continue;
        }

        console.log(`  📝 Updating ${table}.${col}: ${data.length} records`);

        // Update each record
        for (const row of data) {
          const oldUrl = row[col];
          if (!oldUrl || !oldUrl.includes(oldBucketUrl)) {
            continue;
          }

          const newUrl = oldUrl.replace(OLD_URL_PREFIX, NEW_URL_PREFIX);

          const { error: updateError } = await newSupabase
            .from(table)
            .update({ [col]: newUrl })
            .eq('id', row.id);

          if (updateError) {
            console.error(`    ❌ Failed to update ${table}.id=${row.id}: ${updateError.message}`);
            stats.dbRecordsFailed++;
          } else {
            stats.dbRecordsUpdated++;
          }
        }
      } catch (e) {
        // Skip errors (table might not exist)
      }
    }
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('🚀 Storage Migration Script');
  console.log('===========================');
  console.log(`Old Project: ${OLD_URL_PREFIX}`);
  console.log(`New Project: ${NEW_URL_PREFIX}`);
  console.log('');

  // List all buckets in old project
  console.log('📋 Listing buckets in old project...');
  const { data: oldBuckets, error: listError } = await oldSupabase.storage.listBuckets();

  if (listError) {
    console.error(`❌ Error listing buckets: ${listError.message}`);
    console.error('');
    console.error('This usually means:');
    console.error('  1. The OLD_SUPABASE_SERVICE_KEY is incorrect or missing');
    console.error('  2. The service role key doesn\'t have storage access');
    console.error('  3. The old project URL is incorrect');
    console.error('');
    console.error('Verify:');
    console.error(`  - Old project URL: ${OLD_SUPABASE_URL}`);
    console.error(`  - Service key starts with: ${OLD_SUPABASE_SERVICE_KEY.substring(0, 20)}...`);
    console.error('  - Get the correct key from: Supabase Dashboard → Project Settings → API');
    process.exit(1);
  }

  if (!oldBuckets || oldBuckets.length === 0) {
    console.log('✅ No buckets found in old project');
    return;
  }

  console.log(`Found ${oldBuckets.length} bucket(s): ${oldBuckets.map(b => b.name).join(', ')}`);

  // Migrate each bucket
  for (const bucket of oldBuckets) {
    const bucketConfig = {
      public: bucket.public !== false,
      fileSizeLimit: bucket.file_size_limit,
      allowedMimeTypes: bucket.allowed_mime_types,
    };

    await migrateBucket(bucket.name, bucketConfig);
    await updateDatabaseReferences(bucket.name);
  }

  // Print summary
  console.log('\n===========================');
  console.log('📊 Migration Summary');
  console.log('===========================');
  console.log(`Buckets created: ${stats.bucketsCreated}`);
  console.log(`Buckets skipped: ${stats.bucketsSkipped}`);
  console.log(`Files copied: ${stats.filesCopied}`);
  console.log(`Files failed: ${stats.filesFailed}`);
  console.log(`DB records updated: ${stats.dbRecordsUpdated}`);
  console.log(`DB records failed: ${stats.dbRecordsFailed}`);
  console.log('');

  if (stats.filesFailed > 0 || stats.dbRecordsFailed > 0) {
    console.log('⚠️  Some operations failed. Review the output above.');
    process.exit(1);
  } else {
    console.log('✅ Migration completed successfully!');
  }
}

main().catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
