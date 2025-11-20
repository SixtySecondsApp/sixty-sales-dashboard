/**
 * Utility script to extract unique link IDs from SavvyCal CSV
 * Run this to get a list of all link IDs that need source mapping
 * 
 * Usage: deno run --allow-read scripts/extractSavvyCalLinkIds.ts <path-to-csv>
 */

const csvPath = Deno.args[0];

if (!csvPath) {
  Deno.exit(1);
}

try {
  const csvText = await Deno.readTextFile(csvPath);
  const lines = csvText.split('\n').filter(line => line.trim());
  
  if (lines.length < 2) {
    Deno.exit(1);
  }

  // Parse header
  const headers = lines[0].split(',').map(h => h.trim());
  const linkIdIndex = headers.findIndex(h => h.toLowerCase() === 'link_id');
  
  if (linkIdIndex === -1) {
    Deno.exit(1);
  }

  // Extract unique link IDs
  const linkIds = new Set<string>();
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const linkId = values[linkIdIndex];
    if (linkId && linkId !== '') {
      linkIds.add(linkId);
    }
  }
} catch (error) {
  Deno.exit(1);
}












