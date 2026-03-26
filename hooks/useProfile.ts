import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Exchange } from '@/lib/exchanges/types';

export type TradingType = 'spot' | 'futures';
export type Tier = 'free' | 'pro';
export type { Exchange };

interface Profile {
  id: string;
  trading_type: TradingType;
  tier: Tier;
  exchange: Exchange;
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data } = await supabase
      .from('profiles')
      .select('id, trading_type, tier, exchange')
      .eq('id', user.id)
      .single();

    setProfile(data ?? null);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  async function updateTradingType(type: TradingType) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .update({ trading_type: type, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id, trading_type, tier, exchange')
      .single();

    if (data) setProfile(data);
  }

  async function updateExchange(exchange: Exchange) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .update({ exchange, updated_at: new Date().toISOString() })
      .eq('id', user.id)
      .select('id, trading_type, tier, exchange')
      .single();

    if (data) setProfile(data);
  }

  return { profile, loading, updateTradingType, updateExchange, refreshProfile: fetchProfile };
}
