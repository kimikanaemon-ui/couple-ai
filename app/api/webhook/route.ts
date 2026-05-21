import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();

  const signature = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed.", err);

    return NextResponse.json(
      { error: "Webhook Error" },
      { status: 400 }
    );
  }

  // 決済成功
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    console.log("✅ 決済成功", session.customer_email);

    // ここで Supabase 更新などを行う
  }

  // サブスク解除
  if (event.type === "customer.subscription.deleted") {
    console.log("❌ サブスク解除");
  }

  return NextResponse.json({ received: true });
}