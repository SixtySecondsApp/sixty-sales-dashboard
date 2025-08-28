import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Get the user from the authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No authorization token provided' });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (req.method === 'POST') {
      const { suggestion_id } = req.body;

      if (!suggestion_id) {
        return res.status(400).json({ error: 'Suggestion ID is required' });
      }

      // Check if user already voted
      const { data: existingVote } = await supabase
        .from('roadmap_votes')
        .select('id')
        .eq('suggestion_id', suggestion_id)
        .eq('user_id', user.id)
        .single();

      if (existingVote) {
        return res.status(400).json({ error: 'You have already voted for this suggestion' });
      }

      // Create the vote
      const { data: vote, error } = await supabase
        .from('roadmap_votes')
        .insert({
          suggestion_id,
          user_id: user.id
        })
        .select()
        .single();

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(201).json(vote);
    }

    if (req.method === 'DELETE') {
      const { suggestion_id } = req.body;

      if (!suggestion_id) {
        return res.status(400).json({ error: 'Suggestion ID is required' });
      }

      // Delete the vote
      const { error } = await supabase
        .from('roadmap_votes')
        .delete()
        .eq('suggestion_id', suggestion_id)
        .eq('user_id', user.id);

      if (error) {
        return res.status(500).json({ error: error.message });
      }

      return res.status(204).end();
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Roadmap votes API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}