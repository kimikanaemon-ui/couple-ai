import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { userId, email } = await req.json();

    console.log("STRIPE_PRICE_ID:", process.env.STRIPE_PRICE_ID);
    console.log("NEXT_PUBLIC_APP_URL:", process.env.NEXT_PUBLIC_APP_URL);
    console.log("userId:", userId, "email:", email);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID!,
          quantity: 1,
        },
      ],
      customer_email: email,
      metadata: { userId },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/premium/success`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe error detail:", error?.message, error?.raw);
    return NextResponse.json({
      error: "決済セッションの作成に失敗しました",
      detail: error?.message,
    }, { status: 500 });
  }
}