import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheGetJson, cacheSetJson } from '@/lib/redis/cache';

const SYNC_CACHE_TTL_SEC = 60;

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cacheKey = `stripe:sync:${user.id}`;
  const cached = await cacheGetJson<{ tier: 'free' | 'pro' }>(cacheKey);
  if (cached) {
    return NextResponse.json({ ...cached, cached: true });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (profile?.tier === 'pro') {
    const result = { tier: 'pro' as const };
    await cacheSetJson(cacheKey, result, SYNC_CACHE_TTL_SEC);
    return NextResponse.json(result);
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    const result = { tier: 'free' as const };
    await cacheSetJson(cacheKey, result, SYNC_CACHE_TTL_SEC);
    return NextResponse.json(result);
  }

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: 'active',
    limit: 1,
  });
  const isActive = subscriptions.data.length > 0;

  if (isActive) {
    const adminSupabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    await adminSupabase
      .from('profiles')
      .update({ tier: 'pro', stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    const result = { tier: 'pro' as const };
    await cacheSetJson(cacheKey, result, SYNC_CACHE_TTL_SEC);
    return NextResponse.json(result);
  }

  const result = { tier: 'free' as const };
  await cacheSetJson(cacheKey, result, SYNC_CACHE_TTL_SEC);
  return NextResponse.json(result);
}
