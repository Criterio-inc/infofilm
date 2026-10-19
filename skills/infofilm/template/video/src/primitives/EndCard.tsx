import React from "react";
import { Img, staticFile } from "remotion";
import { pop, prog } from "../anim";
import { DISPLAY_FONT, DISPLAY_UPPER, UI } from "../fonts";
import { BRAND, C, PLATE, S, WIN, WIDE } from "../theme";
import { useScene } from "../timing";
import { Card } from "./Card";

/**
 * The closing card: the client's logo, one line and the address, on a panel in the band colour.
 * Line and address come from the profile ("endCard"); a scene can pass its own.
 * Any scene named "end-card" in the script renders this by itself (scenes/index.ts).
 */
export const EndCard: React.FC<{ line?: string; url?: string }> = ({ line, url }) => {
  const s = useScene();
  const f = s.frame;
  const text = line ?? BRAND.endCard?.line ?? "";
  const addr = url ?? BRAND.endCard?.url ?? "";
  const panel = prog(f, 6, 16);
  const logo = pop(f, 14, { damping: 14, stiffness: 160 });
  const lineIn = prog(f, 24, 14);
  const urlIn = prog(f, 34, 14);
  const w = WIDE ? 1100 : WIN.w - 120;
  const h = WIDE ? 520 : Math.min(WIN.h - 120, 620);
  return (
    <Card title={s.title} kicker={s.kicker} img={s.img} dim={0.75 * panel} caption={addr}>
      <div
        style={{
          position: "absolute",
          left: (WIN.w - w) / 2,
          top: (WIN.h - h) / 2,
          width: w,
          height: h,
          background: C.band,
          borderRadius: PLATE.radius * 1.5,
          boxShadow: PLATE.shadow,
          border: PLATE.border ? `${PLATE.border}px solid ${C.ink}` : undefined,
          opacity: panel,
          transform: `translateY(${(1 - panel) * 40}px)`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: Math.round(36 * S),
          padding: 40,
          boxSizing: "border-box",
          textAlign: "center",
        }}
      >
        {BRAND.logo && <Img src={staticFile(BRAND.logo.src)} style={{ height: Math.round(150 * S), width: "auto", transform: `scale(${logo})` }} />}
        {text && (
          <div style={{ ...DISPLAY_FONT, fontSize: Math.round(64 * S), lineHeight: 1.1, color: C.bandText, opacity: lineIn }}>
            {DISPLAY_UPPER ? text.toUpperCase() : text}
          </div>
        )}
        {addr && <div style={{ fontFamily: UI, fontWeight: 600, fontSize: Math.round(40 * S), color: C.kicker, opacity: urlIn }}>{addr}</div>}
      </div>
    </Card>
  );
};
