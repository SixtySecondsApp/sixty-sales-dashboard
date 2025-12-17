import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { MeetingsLandingV4 } from './pages/MeetingsLandingV4';
import  WaitlistLanding  from './pages/WaitlistLanding';
import EarlyAccessLanding from './pages/EarlyAccessLanding';
import LeaderboardLookup from './pages/LeaderboardLookup';
import WaitlistStatus from './pages/WaitlistStatus';
import WaitlistThankYouPage from './pages/WaitlistThankYouPage';
import { PricingPage } from './pages/PricingPage';
import { WaitlistLandingPage } from './pages/WaitlistLandingPage';
import { WaitlistLandingPopup } from './pages/WaitlistLandingPopup';
import { IntroductionPage } from './pages/IntroductionPage';
import { IntroPage } from './pages/IntroPage';

// Initialize i18next for internationalization
import './lib/i18n/config';

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors closeButton />
      <Routes>
        <Route path="/landing" element={<MeetingsLandingV4 />} />
        <Route path="/waitlist" element={<EarlyAccessLanding />} />
        <Route path="/waitlist/thank-you" element={<WaitlistThankYouPage />} />
        <Route path="/waitlist/status/:id" element={<WaitlistStatus />} />
        <Route path="/join" element={<WaitlistLandingPopup />} />
        <Route path="/introduction" element={<IntroductionPage />} />
        <Route path="/intro" element={<IntroPage />} />

        {/* Leaderboard */}
        <Route path="/waitlist/leaderboard" element={<LeaderboardLookup />} />
        <Route path="/leaderboard" element={<LeaderboardLookup />} />
        <Route path="/waitlist-hero" element={<WaitlistLanding />} />
        <Route path="/pricing" element={<PricingPage />} />
        {/* Redirect auth routes to app domain */}
        <Route path="/auth/*" element={<RedirectToApp />} />
        <Route path="/login" element={<RedirectToApp />} />
        <Route path="/signup" element={<RedirectToApp />} />
        <Route path="/" element={<MeetingsLandingV4 />} />
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
