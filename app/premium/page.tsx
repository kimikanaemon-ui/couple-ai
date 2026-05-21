import Link from "next/link";

export default function SuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold">
          決済が完了しました 🎉
        </h1>

        <p className="mt-4 text-gray-600">
          プレミアムプランへようこそ。
          深層カウンセリング機能をご利用いただけます。
        </p>

        <Link
          href="/premium"
          className="mt-8 inline-block rounded-2xl bg-black px-6 py-3 text-white"
        >
          カウンセリングを始める
        </Link>
      </div>
    </main>
  );
}