export default function ParentChildPage() {
  return (
    <main className="min-h-screen bg-[#edf2ea] text-[#4e5b4f]">

      {/* ファーストビュー */}
      <section className="px-6 py-28 bg-[#f8fbf6] text-center">
        <div className="max-w-4xl mx-auto">

          <p className="text-sm tracking-[0.25em] text-[#7a8b7b] mb-6 uppercase">
            Parent & Child Counseling
          </p>

          <h1 className="text-4xl md:text-6xl font-bold leading-tight mb-8 text-[#425043]">
            反抗期・不登校・無言・衝突。
            <br />
            「どう接したらいいか分からない」
            <br />
            親御さんへ。
          </h1>

          <p className="text-lg md:text-xl leading-9 text-[#667367] max-w-2xl mx-auto mb-12">
            ここは、
            親か子のどちらかを
            “悪者にする場所”ではありません。
            <br />
            <br />
            言えなくなってしまった気持ちや、
            ぶつかってしまう会話を整理しながら、
            親子関係をもう一度見つめ直していくための時間です。
          </p>

          <a
            href="https://lin.ee/UnX0R6Jk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-5 rounded-full bg-[#5f7161] text-white text-lg hover:bg-[#4e5b4f] transition-all duration-300 shadow-md"
          >
            まずはLINEで相談してみる
          </a>

        </div>
      </section>

      {/* 共感セクション */}
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto">

          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-[#425043]">
            こんなお悩みありませんか？
          </h2>

          <div className="grid md:grid-cols-2 gap-6">

            {[
              "子どもと話そうとすると喧嘩になる",
              "何を考えているのか分からない",
              "無視されると苦しくなる",
              "親として失敗している気がする",
              "優しくしたいのに責めてしまう",
              "家庭の空気がずっと重い",
            ].map((item, index) => (
              <div
                key={index}
                className="bg-[#f8fbf6] rounded-[32px] p-8 shadow-sm border border-[#dbe6d8]"
              >
                <p className="text-lg leading-8 text-[#556357]">
                  {item}
                </p>
              </div>
            ))}

          </div>
        </div>
      </section>

      {/* 感情リアル */}
      <section className="px-6 py-28 bg-[#f8fbf6]">
        <div className="max-w-3xl mx-auto">

          <h2 className="text-3xl md:text-4xl font-bold mb-12 text-center text-[#425043]">
            本当は、
            怒りたいわけじゃない。
          </h2>

          <div className="text-lg leading-10 text-[#5f6d60] space-y-8">

            <p>
              本当は心配しているだけなのに、
              気づくと責めるような言い方になってしまう。
            </p>

            <p>
              子どもも苦しそうなのに、
              どう関わればいいか分からない。
            </p>

            <p>
              「親なのに」
              「子どもなのに」
              という言葉が、
              お互いを追い詰めてしまうことがあります。
            </p>

          </div>
        </div>
      </section>

      {/* 会話イメージ */}
      <section className="px-6 py-28">
        <div className="max-w-4xl mx-auto">

          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-[#425043]">
            こんな会話、
            増えていませんか？
          </h2>

          <div className="space-y-6">

            <div className="bg-[#f8fbf6] p-8 rounded-[32px] border border-[#dbe6d8]">
              <p className="text-[#5f6d60] leading-9">
                <span className="font-semibold">母：</span>
                「あなたのことを心配して言ってるのに…」
              </p>
            </div>

            <div className="bg-[#edf2ea] p-8 rounded-[32px] border border-[#dbe6d8]">
              <p className="text-[#5f6d60] leading-9">
                <span className="font-semibold">子：</span>
                「どうせ何を言っても否定される」
              </p>
            </div>

            <div className="bg-[#f8fbf6] p-8 rounded-[32px] border border-[#dbe6d8]">
              <p className="text-[#5f6d60] leading-9">
                本当は分かり合いたいのに、
                会話になると苦しくなってしまう。
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* カウンセリング説明 */}
      <section className="px-6 py-28 bg-[#f8fbf6]">
        <div className="max-w-4xl mx-auto text-center">

          <h2 className="text-3xl md:text-4xl font-bold mb-10 text-[#425043]">
            親子カウンセリングとは
          </h2>

          <p className="text-lg leading-10 text-[#5f6d60]">
            親か子のどちらかを
            “正す”ための場所ではありません。
            <br />
            <br />
            すれ違ってしまった気持ちを、
            一度ゆっくり整理しながら、
            「本当は何を伝えたかったのか」
            を見つめ直していきます。
          </p>

        </div>
      </section>

      {/* よくある相談 */}
      <section className="px-6 py-28">
        <div className="max-w-5xl mx-auto">

          <h2 className="text-3xl md:text-4xl font-bold text-center mb-14 text-[#425043]">
            よくあるご相談
          </h2>

          <div className="grid md:grid-cols-2 gap-6">

            {[
              "反抗期で会話が成立しない",
              "不登校と家庭内の空気",
              "大人になった子どもとの距離感",
              "進路や将来への衝突",
              "親の干渉をやめられない",
              "親を許せない気持ち",
            ].map((item, index) => (
              <div
                key={index}
                className="bg-[#f8fbf6] rounded-[32px] p-8 border border-[#dbe6d8]"
              >
                <p className="text-lg leading-8 text-[#556357]">
                  {item}
                </p>
              </div>
            ))}

          </div>
        </div>
      </section>
{/* AI相談 */}
<section className="px-6 py-28">
  <div className="max-w-3xl mx-auto text-center">

    <h2 className="text-3xl md:text-4xl font-bold mb-8 text-[#425043]">
      まずはAIに
      気持ちを整理してみる
    </h2>

    <p className="text-lg leading-9 text-[#667367] mb-10">
      うまく説明できなくても大丈夫です。
      <br />
      今つらいことを、
      話せるところから入力してください。
    </p>

    <textarea
      className="w-full h-48 rounded-[24px] border border-[#dbe6d8] bg-[#f8fbf6] p-6 text-lg outline-none"
      placeholder="最近つらいこと、親子関係で悩んでいることを書いてください"
    />

    <button
      className="mt-6 px-10 py-5 rounded-full bg-[#5f7161] text-white text-lg hover:bg-[#4e5b4f] transition-all duration-300 shadow-md"
    >
      AIに相談する
    </button>

  </div>
</section>
      {/* CTA */}
      <section className="px-6 py-32 text-center bg-[#f8fbf6]">
        <div className="max-w-3xl mx-auto">

          <h2 className="text-4xl md:text-5xl font-bold leading-tight mb-8 text-[#425043]">
            一人で抱え続ける前に、
            <br />
            一度整理してみませんか。
          </h2>

          <p className="text-lg leading-9 text-[#667367] mb-12">
            関係をすぐに変えることは難しくても、
            “理解しようとする時間”は
            きっと未来につながっていきます。
          </p>

          <a
            href="https://lin.ee/UnX0R6Jk"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-10 py-5 rounded-full bg-[#5f7161] text-white text-lg hover:bg-[#4e5b4f] transition-all duration-300 shadow-md"
          >
            まずはLINEで相談してみる
          </a>

        </div>
      </section>

    </main>
  );
}