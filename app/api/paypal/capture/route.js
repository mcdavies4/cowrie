import { NextResponse } from 'next/server';
import { serverClient } from '../../../../lib/supabase';
import { getProvider } from '../../../../lib/providers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// PayPal redirects the brand here after they approve the order (?deal=<id>&token=<orderId>).
// We capture the order (money lands in the platform PayPal balance), mark the deal
// collected ('paid'), then send the brand back to the deal page.
export async function GET(req) {
  const url = new URL(req.url);
  const dealId = url.searchParams.get('deal');
  const orderId = url.searchParams.get('token'); // PayPal calls the order id "token" on return
  const app = process.env.NEXT_PUBLIC_APP_URL;

  if (!dealId || !orderId) {
    return NextResponse.redirect(`${app}/deals/${dealId || ''}`);
  }

  const db = serverClient();
  const { data: deal } = await db.from('deals').select('*').eq('id', dealId).single();
  if (!deal) return NextResponse.redirect(`${app}/deals`);

  try {
    const paypal = getProvider('paypal');
    const { status } = await paypal.captureOrder(orderId);
    if (status === 'COMPLETED' && deal.status !== 'distributed' && deal.status !== 'cancelled') {
      await db.from('transactions').insert({
        deal_id: deal.id, kind: 'payment_received', amount_minor: deal.total_amount_minor, provider_ref: orderId,
      });
      await db.from('deals').update({ status: 'paid' }).eq('id', deal.id);
    }
  } catch (e) {
    // Capture may also be confirmed by the PAYMENT.CAPTURE.COMPLETED webhook.
  }

  return NextResponse.redirect(`${app}/deals/${dealId}?paid=1`);
}
