import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();

    const signature = req.headers.get("stripe-signature")!;

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );

    console.log("✅ webhook received:", event.type);

    return NextResponse.json({
      received: true,
    });
  } catch (error) {
    console.error("WEBHOOK ERROR:", error);

    return NextResponse.json(
      { error: "Webhook failed" },
      { status: 500 }
    );
  }
}