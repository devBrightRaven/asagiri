// src/RecentList.tsx
import { h } from "preact";
import type { Fragment } from "./types";

interface Props {
  fragments: Fragment[];
}

export function RecentList({ fragments }: Props) {
  if (fragments.length === 0) return null;

  return (
    <div>
      <div class="sg-section-title">Recent</div>
      {fragments.map((f) => (
        <div class="sg-recent-item" key={f.id}>
          <span class="sg-recent-dot" />
          <span class="sg-recent-content">
            {f.content.length > 60 ? f.content.slice(0, 60) + "..." : f.content}
          </span>
          <span class="sg-recent-type">{f.type}</span>
        </div>
      ))}
    </div>
  );
}
