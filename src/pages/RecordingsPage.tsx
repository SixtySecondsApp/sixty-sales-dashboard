import React from 'react'
import { Routes, Route } from 'react-router-dom'
import RecordingsList from '@/components/recordings/RecordingsList'
import { RecordingDetail } from '@/pages/RecordingDetail'
import { RecordingSettings } from '@/pages/RecordingSettings'

const RecordingsPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<RecordingsList />} />
      <Route path=":id" element={<RecordingDetail />} />
      <Route path="settings" element={<RecordingSettings />} />
    </Routes>
  )
}

export default RecordingsPage
