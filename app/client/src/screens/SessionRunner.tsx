import { useEffect, useState } from "react";
import { fetchMenu, sendSessionEvent, type Menu, type MenuBlock } from "../api";
import { formatMmSs, useCountdown } from "../useCountdown";
import { ChunkPlaceholderScreen } from "./ChunkPlaceholderScreen";
import { FourThreeTwoScreen } from "./FourThreeTwoScreen";
import { ReflectionScreen } from "./ReflectionScreen";
import { RoleplayScreen } from "./RoleplayScreen";
import { ShadowingScreen } from "./ShadowingScreen";

/** メニューを取得し、ブロックを順番に進行させる。ブロックタイマーと進行イベント記録を持つ */
export function SessionRunner(props: { minutes: 60 | 30; onExit: () => void }) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [index, setIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");
  const timer = useCountdown(0);

  useEffect(() => {
    fetchMenu(props.minutes)
      .then((m) => {
        setMenu(m);
        const first = m.blocks[0];
        timer.reset(first.minutes * 60);
        timer.start();
        sendSessionEvent("block_start", { blockId: first.id, kind: first.kind });
      })
      .catch((err) => setErrorMsg(err instanceof Error ? err.message : String(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.minutes]);

  if (errorMsg) return <p style={{ color: "crimson" }}>{errorMsg}</p>;
  if (!menu) return <p>今日のメニューを組んでいます…</p>;

  const block = menu.blocks[index];
  const isLast = index === menu.blocks.length - 1;

  function nextBlock() {
    sendSessionEvent("block_end", { blockId: block.id, kind: block.kind });
    if (isLast) {
      props.onExit();
      return;
    }
    const next = menu!.blocks[index + 1];
    setIndex(index + 1);
    timer.reset(next.minutes * 60);
    timer.start();
    sendSessionEvent("block_start", { blockId: next.id, kind: next.kind });
  }

  return (
    <div>
      <p style={{ color: "#666" }}>
        ブロック {index + 1}/{menu.blocks.length} ・ ⏱ {formatMmSs(timer.remaining)}
        {timer.expired && " — 時間切れ（キリのいいところで次へ）"}
      </p>
      <h2 style={{ fontSize: "1.1rem" }}>{block.title}</h2>
      <BlockBody block={block} />
      <hr style={{ margin: "1.5rem 0" }} />
      <button onClick={nextBlock} style={{ padding: "0.8rem 1.4rem", fontSize: "1rem", cursor: "pointer" }}>
        {isLast ? "✅ セッションを終える" : "次のブロックへ →"}
      </button>
    </div>
  );
}

function BlockBody({ block }: { block: MenuBlock }) {
  switch (block.kind) {
    case "chunk-placeholder":
      return <ChunkPlaceholderScreen />;
    case "four-three-two":
      return block.params.topic ? (
        <FourThreeTwoScreen topic={block.params.topic} onDone={() => undefined} />
      ) : (
        <p>トピックがありません</p>
      );
    case "roleplay":
      return block.params.scenario ? <RoleplayScreen scenario={block.params.scenario} /> : <p>シナリオがありません</p>;
    case "shadowing":
      return block.params.topic ? <ShadowingScreen topic={block.params.topic} /> : <p>トピックがありません</p>;
    case "reflection":
      return <ReflectionScreen />;
    default:
      return <p>未知のブロック: {block.kind}</p>;
  }
}
