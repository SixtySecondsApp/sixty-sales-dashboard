import { WaitlistHeroV2 } from './components/WaitlistHeroV2';

/**
 * Waitlist Landing Page
 *
 * Simplified single-page hero with integrated waitlist form
 * No additional sections - focused conversion page
 * Supports both light and dark mode via design system
 */
export default function WaitlistLanding() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 transition-colors duration-300">
      <WaitlistHeroV2 />
    </div>
  );
}
