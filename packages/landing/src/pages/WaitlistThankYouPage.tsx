import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';
import { WaitlistThankYou } from './components/WaitlistThankYou';

interface ThankYouState {
  email: string;
  fullName: string;
  companyName?: string;
}

export default function WaitlistThankYouPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');
  const [companyName, setCompanyName] = useState<string>('');
  const [emailSent, setEmailSent] = useState<boolean>(false);

  useEffect(() => {
    // Try to get data from location state first (no URL exposure)
    const state = location.state as ThankYouState | null;

    if (state?.email && state?.fullName) {
      // Store in sessionStorage as backup for refresh
      sessionStorage.setItem('waitlist_thankyou_email', state.email);
      sessionStorage.setItem('waitlist_thankyou_name', state.fullName);
      if (state.companyName) {
        sessionStorage.setItem('waitlist_thankyou_company', state.companyName);
      }
      setEmail(state.email);
      setFullName(state.fullName);
      setCompanyName(state.companyName || '');
    } else {
      // Fallback to sessionStorage if state is missing (e.g., page refresh)
      const storedEmail = sessionStorage.getItem('waitlist_thankyou_email');
      const storedName = sessionStorage.getItem('waitlist_thankyou_name');
      const storedCompany = sessionStorage.getItem('waitlist_thankyou_company');

      if (storedEmail && storedName) {
        setEmail(storedEmail);
        setFullName(storedName);
        setCompanyName(storedCompany || '');
      } else {
        // If no data available, redirect back to waitlist
        navigate('/waitlist', { replace: true });
      }
    }
  }, [location.state, navigate]);

  // Send welcome email when page loads
  useEffect(() => {
    const sendWelcomeEmail = async () => {
      // Skip if missing data or already sent
      if (!email || !fullName || emailSent) return;

      // Check sessionStorage flag for idempotency
      const emailSentKey = `waitlist_email_sent_${email}`;
      if (sessionStorage.getItem(emailSentKey)) {
        setEmailSent(true);
        return;
      }

      try {
        const supabase = createClient(
          import.meta.env.VITE_SUPABASE_URL || '',
          import.meta.env.VITE_SUPABASE_ANON_KEY || ''
        );

        // Use waitlist-welcome-email edge function (handles auth internally)
        const { data, error } = await supabase.functions.invoke('waitlist-welcome-email', {
          body: {
            email: email.trim().toLowerCase(),
            full_name: fullName,
            company_name: companyName || '',
          },
        });

        if (error) {
          console.error('[Waitlist] Welcome email failed:', error);
          console.error('[Waitlist] Error details:', {
            message: error.message,
            status: (error as any).status,
            context: (error as any).context,
          });
        } else {
          console.log('[Waitlist] Welcome email sent successfully:', data);
          sessionStorage.setItem(emailSentKey, 'true');
          setEmailSent(true);
        }
      } catch (err) {
        console.error('[Waitlist] Welcome email exception:', err);
        // On localhost, edge functions might not have service role key - this is non-blocking
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
          console.warn('[Waitlist] Email failed on localhost (expected) - ensure supabase start and function deployment are set up');
        }
      }
    };

    sendWelcomeEmail();
  }, [email, fullName, companyName, emailSent]);

  // Clean up sessionStorage when component unmounts
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('waitlist_thankyou_email');
      sessionStorage.removeItem('waitlist_thankyou_name');
      sessionStorage.removeItem('waitlist_thankyou_company');
      if (email) {
        sessionStorage.removeItem(`waitlist_email_sent_${email}`);
      }
    };
  }, [email]);

  if (!email || !fullName) {
    return null; // Will redirect in useEffect
  }

  return (
    <WaitlistThankYou
      email={email}
      fullName={fullName}
      companyName={companyName}
      onClose={() => {
        // Clean up sessionStorage before navigating
        sessionStorage.removeItem('waitlist_thankyou_email');
        sessionStorage.removeItem('waitlist_thankyou_name');
        sessionStorage.removeItem('waitlist_thankyou_company');
        navigate('/learnmore');
      }}
    />
  );
}
