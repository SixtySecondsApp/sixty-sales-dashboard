import { WaitlistHeroV2 } from './components/WaitlistHeroV2';
import { useForceDarkMode } from '@/lib/hooks/useForceDarkMode';

/**
 * Waitlist Landing Page
 *
 * Simplified single-page hero with integrated waitlist form
 * No additional sections - focused conversion page
 * Forces dark mode for consistent landing page experience
 */
export default function WaitlistLanding() {
  // Force dark mode for landing pages
  useForceDarkMode();

  return (
    <div className="min-h-screen bg-gray-950 transition-colors duration-300">
      <WaitlistHeroV2 />
    </div>
  );
}
