import { WaitlistHeroV2 } from './components/WaitlistHeroV2';

/**
 * Waitlist Landing Page
 *
 * Simplified single-page hero with integrated waitlist form
 * No additional sections - focused conversion page
 */
export default function WaitlistLanding() {
  return (
    <div className="min-h-screen bg-[#0a0d14]">
      <WaitlistHeroV2 />
    </div>
  );
}
