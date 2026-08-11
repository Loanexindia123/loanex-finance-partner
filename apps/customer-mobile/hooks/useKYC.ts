import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { getKYC } from '../services/kycService';
import { CustomerKYC } from '../types';

export function useKYC() {
  const { user } = useAuth();
  const userId = user?.id;
  const [kyc, setKYC] = useState<CustomerKYC | null>(null);
  const [kycLoading, setKycLoading] = useState(true);

  // Keyed by user id — not the whole user object — so Auth refreshUser()
  // recreating the same user from AsyncStorage does not re-fetch KYC.
  const refresh = useCallback(async () => {
    if (!userId) {
      setKYC(null);
      setKycLoading(false);
      return;
    }
    setKycLoading(true);
    try {
      const data = await getKYC(userId);
      setKYC(data);
    } catch {
      setKYC(null);
    }
    setKycLoading(false);
  }, [userId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const isKYCComplete = kyc?.kycCompleted === true;

  return { kyc, kycLoading, isKYCComplete, refresh };
}
