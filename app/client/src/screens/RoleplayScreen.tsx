import { type ContentItem } from "../api";
import { FreeTalkScreen } from "./FreeTalkScreen";

export function RoleplayScreen(props: { scenario: ContentItem }) {
  return (
    <div>
      <p style={{ color: "#666" }}>{props.scenario.titleJa}</p>
      <ul>
        {props.scenario.hints.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
      <FreeTalkScreen scenarioId={props.scenario.id} />
    </div>
  );
}
