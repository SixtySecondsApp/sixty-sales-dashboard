// packages/landing/src/pages/PricingPage.tsx
// Standalone pricing page for viewing the pricing section

import { PricingSectionV4 } from '../components/components-v4/PricingSectionV4';

export function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-800">
      <PricingSectionV4 />
    </div>
  );
}

export default PricingPage;
