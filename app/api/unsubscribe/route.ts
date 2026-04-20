import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const dotIndex = decoded.indexOf('.');
    if (dotIndex < 1) return null;

    const userId = decoded.slice(0, dotIndex);
    const providedSig = decoded.slice(dotIndex + 1);

    if (!userId || !/^[0-9a-f]{64}$/.test(providedSig)) return null;

    const key = process.env.RESEND_API_KEY;
    if (!key) return null;

    const expectedSig = createHmac('sha256', key).update(userId).digest('hex');

    const isValid = timingSafeEqual(
      Buffer.from(providedSig, 'hex'),
      Buffer.from(expectedSig, 'hex')
    );

    return isValid ? userId : null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const userId = verifyToken(token);

  if (!userId) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase
    .from('profiles')
    .update({ job_alerts_enabled: false })
    .eq('id', userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/?unsubscribed=true', req.url));
}
