import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MeetingsLandingV4 } from './pages/MeetingsLandingV4';
import  WaitlistLanding  from './pages/WaitlistLanding';
import EarlyAccessLanding from './pages/EarlyAccessLanding';
import LeaderboardLookup from './pages/LeaderboardLookup';
import { PricingPage } from './pages/PricingPage';
import { WaitlistLandingPage } from './pages/WaitlistLandingPage';
import { WaitlistLandingPopup } from './pages/WaitlistLandingPopup';

// Initialize i18next for internationalization
import './lib/i18n/config';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main waitlist landing (no pricing) */}
        <Route path="/" element={<WaitlistLandingPage />} />

        {/* Waitlist variations */}
        <Route path="/waitlist" element={<EarlyAccessLanding />} />
        <Route path="/join" element={<WaitlistLandingPopup />} />

        {/* Leaderboard */}
        <Route path="/waitlist/leaderboard" element={<LeaderboardLookup />} />
        <Route path="/leaderboard" element={<LeaderboardLookup />} />

        {/* Legacy routes - redirect to home */}
        <Route path="/pricing" element={<Navigate to="/" replace />} />
        <Route path="/landing" element={<Navigate to="/" replace />} />
        <Route path="/waitlist-hero" element={<Navigate to="/waitlist" replace />} />

        {/* Keep full landing available at hidden route for reference */}
        <Route path="/full-landing" element={<MeetingsLandingV4 />} />

        {/* Redirect auth routes to app domain */}
        <Route path="/auth/*" element={<RedirectToApp />} />
        <Route path="/login" element={<RedirectToApp />} />
        <Route path="/signup" element={<RedirectToApp />} />
      </Routes>
    </BrowserRouter>
  );
}

function RedirectToApp() {
  useEffect(() => {
    window.location.href = 'https://app.use60.com' + window.location.pathname;
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p>Redirecting to app...</p>
    </div>
  );
}

export default App;
