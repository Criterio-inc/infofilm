import React from "react";
import { Card } from "../primitives/Card";
import { useScene } from "../timing";

/** Stand-in for a scene that has not been built yet: its card, its illustration, no overlays. */
export const Placeholder: React.FC = () => {
  const s = useScene();
  const first = s.text.split(/(?<=[.!?])\s/)[0] ?? "";
  return (
    <Card
      title={s.title}
      kicker={s.kicker}
      img={s.img}
      caption={<span style={{ opacity: 0.6 }}>{first.length > 70 ? first.slice(0, 68) + "…" : first}</span>}
    />
  );
};
