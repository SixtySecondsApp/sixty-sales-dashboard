import React from 'react'
import { Routes, Route } from 'react-router-dom'
import MeetingsList from '@/components/meetings/MeetingsList'
import { MeetingDetail } from '@/pages/MeetingDetail'
import RecordingsList from '@/components/recordings/RecordingsList'
import { RecordingDetail } from '@/pages/RecordingDetail'
import { RecordingSettings } from '@/pages/RecordingSettings'

const MeetingsPage: React.FC = () => {
  return (
    <Routes>
      {/* Main meetings list (Fathom + Voice recordings) */}
      <Route index element={<MeetingsList />} />

      {/* Individual meeting detail */}
      <Route path=":id" element={<MeetingDetail />} />

      {/* MeetingBaaS Recordings - integrated recorder */}
      <Route path="recordings" element={<RecordingsList />} />
      <Route path="recordings/settings" element={<RecordingSettings />} />
      <Route path="recordings/:id" element={<RecordingDetail />} />
    </Routes>
  )
}

export default MeetingsPage