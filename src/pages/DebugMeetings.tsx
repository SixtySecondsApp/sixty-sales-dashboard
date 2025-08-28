import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/clientV2'
import { useAuth } from '@/lib/contexts/AuthContext'

export default function DebugMeetings() {
  const { user } = useAuth()
  const [meetings, setMeetings] = useState<any[]>([])
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    debugMeetings()
  }, [user])

  const debugMeetings = async () => {
    if (!user) {
      setError('No user logged in')
      setLoading(false)
      return
    }

    try {
      // First, let's see all meetings in the database
      const { data: allMeetings, error: allError } = await supabase
        .from('meetings')
        .select('*')
      
      console.log('Current user ID:', user.id)
      console.log('Current user email:', user.email)
      console.log('All meetings in database:', allMeetings)
      console.log('All meetings error:', allError)

      // Now try the filtered query
      const { data: userMeetings, error: userError } = await supabase
        .from('meetings')
        .select('*')
        .eq('owner_user_id', user.id)

      console.log('User meetings:', userMeetings)
      console.log('User meetings error:', userError)

      setMeetings(allMeetings || [])
      if (allError) setError(allError.message)
      else if (userError) setError(userError.message)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createMeetingForUser = async () => {
    if (!user) return

    const shareId = `user-meeting-${Date.now()}`
    
    try {
      const { data, error } = await supabase
        .from('meetings')
        .insert({
          fathom_recording_id: shareId,
          title: 'Test Meeting for Current User',
          share_url: `https://fathom.video/share/${shareId}`,
          calls_url: `https://fathom.video/calls/123456`,
          meeting_start: new Date().toISOString(),
          meeting_end: new Date(Date.now() + 3600000).toISOString(),
          duration_minutes: 60,
          owner_user_id: user.id,
          owner_email: user.email,
          team_name: 'Sales',
          summary: 'This is a test meeting created directly for the current user.',
          updated_at: new Date().toISOString()
        })
        .select()

      console.log('Created meeting:', data)
      console.log('Create error:', error)
      
      if (!error) {
        await debugMeetings() // Refresh the list
      }
    } catch (err: any) {
      console.error('Error creating meeting:', err)
    }
  }

  if (loading) return <div>Loading...</div>

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Meetings</h1>
      
      <div className="mb-4 p-4 bg-gray-800 rounded">
        <p>Current User ID: <code className="text-green-400">{user?.id}</code></p>
        <p>Current User Email: <code className="text-green-400">{user?.email}</code></p>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/50 text-red-200 rounded">
          Error: {error}
        </div>
      )}

      <button
        onClick={createMeetingForUser}
        className="mb-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded"
      >
        Create Meeting for Current User
      </button>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">All Meetings in Database ({meetings.length})</h2>
        {meetings.map((meeting) => (
          <div key={meeting.id} className="p-4 bg-gray-800 rounded">
            <p><strong>Title:</strong> {meeting.title}</p>
            <p><strong>ID:</strong> {meeting.id}</p>
            <p><strong>Owner User ID:</strong> <code className={meeting.owner_user_id === user?.id ? 'text-green-400' : 'text-red-400'}>{meeting.owner_user_id || 'NULL'}</code></p>
            <p><strong>Owner Email:</strong> {meeting.owner_email}</p>
            <p><strong>Match Current User:</strong> {meeting.owner_user_id === user?.id ? '✅ YES' : '❌ NO'}</p>
          </div>
        ))}
      </div>
    </div>
  )
}