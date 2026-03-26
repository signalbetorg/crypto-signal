import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier, stripe_customer_id')
    .eq('id', user.id)
    .single();

  if (profile?.tier === 'pro') {
    return NextResponse.json({ tier: 'pro' });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const customerId = profile?.stripe_customer_id ?? null;

  if (!customerId) {
    return NextResponse.json({ tier: 'free' });
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
    return NextResponse.json({ tier: 'pro' });
  }

  return NextResponse.json({ tier: 'free' });
}
