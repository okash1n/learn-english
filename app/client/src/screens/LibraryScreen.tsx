import { fetchModelTalkLibrary } from "../api";
import { STR, type Lang } from "../i18n";
import { useLoad } from "../useLoad";
import { usePlayRow } from "../usePlayRow";
import { Banner } from "../ui/Banner";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";

/** 生成済みモデルトークの一覧（情報表示のみ）。本文確認と再再生ができる。 */
export function LibraryScreen({ lang }: { lang: Lang }) {
  const t = STR[lang].library;
  const { state, reload } = useLoad(fetchModelTalkLibrary);
  const row = usePlayRow<number>();

  return (
    <div>
      <h3>{t.title}</h3>
      {state.status === "loading" && <p className="text-muted">{t.loading}</p>}
      {state.status === "error" && (
        <Banner kind="error" action={<Button onClick={reload}>{t.retry}</Button>}>{state.error}</Banner>
      )}
      {state.status === "ready" && state.data.length === 0 && (
        <p className="text-muted">
          {t.empty}
        </p>
      )}
      {state.status === "ready" &&
        state.data.map((e) => (
          <Card
            key={e.id}
            header={
              <>
                <Button
                  variant="ghost"
                  onClick={() => row.play(e.id, e.text)}
                  disabled={row.playingKey !== null}
                  ariaLabel={t.playAria(e.topicTitle || e.topicId)}
                >
                  {row.playingKey === e.id ? t.playing : "▶"}
                </Button>{" "}
                {e.topicTitle || e.topicId}{" "}
                <span className="text-sm text-muted">{e.createdAt.slice(0, 10)}</span>
              </>
            }
          >
            <details>
              <summary className="text-muted">{t.transcript}</summary>
              <p className="reading-text">{e.text}</p>
            </details>
          </Card>
        ))}
      {state.status === "ready" && row.error && <Banner kind="error">{row.error}</Banner>}
    </div>
  );
}
