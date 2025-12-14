import React from 'react'
import { Routes, Route } from 'react-router-dom'
import MeetingsList from '@/components/meetings/MeetingsList'
import { MeetingDetail } from '@/pages/MeetingDetail'

const MeetingsPage: React.FC = () => {
  return (
    <Routes>
      <Route index element={<MeetingsList />} />
      <Route path=":id" element={<MeetingDetail />} />
    </Routes>
  )
}

export default MeetingsPage