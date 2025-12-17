import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { WaitlistThankYou } from './components/WaitlistThankYou';

interface ThankYouState {
  email: string;
  fullName: string;
}

export default function WaitlistThankYouPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState<string>('');
  const [fullName, setFullName] = useState<string>('');

  useEffect(() => {
    // Try to get data from location state first (no URL exposure)
    const state = location.state as ThankYouState | null;
    
    if (state?.email && state?.fullName) {
      // Store in sessionStorage as backup for refresh
      sessionStorage.setItem('waitlist_thankyou_email', state.email);
      sessionStorage.setItem('waitlist_thankyou_name', state.fullName);
      setEmail(state.email);
      setFullName(state.fullName);
    } else {
      // Fallback to sessionStorage if state is missing (e.g., page refresh)
      const storedEmail = sessionStorage.getItem('waitlist_thankyou_email');
      const storedName = sessionStorage.getItem('waitlist_thankyou_name');
      
      if (storedEmail && storedName) {
        setEmail(storedEmail);
        setFullName(storedName);
      } else {
        // If no data available, redirect back to waitlist
        navigate('/waitlist', { replace: true });
      }
    }
  }, [location.state, navigate]);

  // Clean up sessionStorage when component unmounts
  useEffect(() => {
    return () => {
      sessionStorage.removeItem('waitlist_thankyou_email');
      sessionStorage.removeItem('waitlist_thankyou_name');
    };
  }, []);

  if (!email || !fullName) {
    return null; // Will redirect in useEffect
  }

  return (
    <WaitlistThankYou
      email={email}
      fullName={fullName}
      onClose={() => {
        // Clean up sessionStorage before navigating
        sessionStorage.removeItem('waitlist_thankyou_email');
        sessionStorage.removeItem('waitlist_thankyou_name');
        navigate('/');
      }}
    />
  );
}
