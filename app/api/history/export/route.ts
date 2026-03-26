import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse('Unauthorized', { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  if (!profile || profile.tier !== 'pro') {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from('signal_history')
    .select('fired_at, symbol, exchange, signal_type, confidence, entry_price, target_price, stop_price, outcome, outcome_price')
    .eq('user_id', user.id)
    .order('fired_at', { ascending: false });

  if (error) return new NextResponse('Internal error', { status: 500 });

  const header = 'date,symbol,exchange,type,confidence,entry,target,stop,outcome,outcome_price\n';
  const csvRows = (rows ?? []).map((r) =>
    [
      r.fired_at,
      r.symbol,
      r.exchange,
      r.signal_type,
      r.confidence,
      r.entry_price,
      r.target_price,
      r.stop_price,
      r.outcome ?? 'PENDING',
      r.outcome_price ?? '',
    ].join(',')
  );

  const csv = header + csvRows.join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="signal_history.csv"',
    },
  });
}
