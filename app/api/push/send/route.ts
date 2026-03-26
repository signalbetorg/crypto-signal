import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@/lib/supabase/server';

let vapidInitialized = false;
function ensureVapid() {
  if (!vapidInitialized) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!,
    );
    vapidInitialized = true;
  }
}

export async function POST(req: NextRequest) {
  ensureVapid();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { type, symbol, confidence, price, target, watch } = await req.json() as {
    type: string;
    symbol: string;
    confidence: number;
    price: number;
    target: number | null;
    watch: 'WATCH_BUY' | 'WATCH_SELL' | null;
  };

  const { data: profile } = await supabase
    .from('profiles')
    .select('push_subscription, trading_type, tier')
    .eq('id', user.id)
    .single();

  if (profile?.tier !== 'pro') return NextResponse.json({ ok: true });
  if (!profile?.push_subscription) return NextResponse.json({ ok: true });

  const coin = symbol.replace('USDT', '');
  const fmt = (n: number) =>
    n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let payload: string;

  if (watch !== null) {
    // WATCH alert: confidence threshold ≥ 80
    if (confidence < 80) return NextResponse.json({ ok: true });

    // Spot users: skip WATCH_SELL notifications
    if (profile.trading_type === 'spot' && watch === 'WATCH_SELL') {
      return NextResponse.json({ ok: true });
    }

    const arrow = watch === 'WATCH_BUY' ? '↑' : '↓';
    payload = JSON.stringify({
      title: `${coin} WATCH ${arrow}`,
      body: `${watch} setup forming — Confidence: ${confidence}%`,
      data: { url: '/' },
    });
  } else {
    // BUY/SELL alert
    // Spot users: skip SELL notifications
    if (profile.trading_type === 'spot' && type === 'SELL') {
      return NextResponse.json({ ok: true });
    }

    const arrow = type === 'BUY' ? '↑' : '↓';
    payload = JSON.stringify({
      title: `${coin} ${type} ${arrow}`,
      body: `Confidence: ${confidence}% · Entry: ${fmt(price)}${target ? ` · Target: ${fmt(target)}` : ''}`,
      data: { url: '/' },
    });
  }

  try {
    await webpush.sendNotification(
      profile.push_subscription as webpush.PushSubscription,
      payload
    );
  } catch (err: unknown) {
    // Subscription expired (410) or invalid (404) — purge it
    const code = (err as { statusCode?: number }).statusCode;
    if (code === 410 || code === 404) {
      await supabase
        .from('profiles')
        .update({ push_subscription: null })
        .eq('id', user.id);
    }
  }

  return NextResponse.json({ ok: true });
}
