#!/usr/bin/env python3
"""Draw the Infofilm app icon in the macOS icon family (needs Pillow).

  python3 app/macos/make_icon.py      → app/macos/icon.png (1024 px) and app/public/icon.png (256 px)

Apple's grid: an 824 px rounded square centred on a 1024 canvas, a top-lit gradient, a soft drop
shadow and a hairline edge. The motif is the films themselves: a small deck of cards, the front one
with a title band, a bar chart and a play button, in the template's colours.
"""
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
SS = 2  # draw at 2048 and scale down, for clean edges
S = 1024 * SS
NAVY, SKY, YELLOW, RED = (11, 61, 92), (30, 155, 215), (242, 183, 5), (212, 70, 47)


def sc(v):
    return int(round(v * SS))


def rrect(size, box, radius, fill):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=radius, fill=fill)
    return layer


def vgrad(size, top, bottom):
    w, h = size
    g = Image.new("RGBA", (1, h))
    for y in range(h):
        t = y / (h - 1)
        g.putpixel((0, y), tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,))
    return g.resize((w, h))


def card(w, h, angle, dx, dy, alpha, content):
    """One film card: white, rounded, a sky-blue title band; rotated and placed on the canvas."""
    pad = sc(60)
    L = Image.new("RGBA", (w + 2 * pad, h + 2 * pad), (0, 0, 0, 0))
    L = Image.alpha_composite(L, rrect(L.size, (pad, pad + sc(14), pad + w, pad + h + sc(14)), sc(34), (4, 20, 34, int(120 * alpha))).filter(ImageFilter.GaussianBlur(sc(16))))
    L = Image.alpha_composite(L, rrect(L.size, (pad, pad, pad + w, pad + h), sc(34), (255, 255, 255, int(255 * alpha))))
    band_h = sc(78)
    band = rrect(L.size, (pad, pad, pad + w, pad + band_h + sc(34)), sc(34), SKY + (int(255 * alpha),))
    cut = Image.new("L", L.size, 0)
    ImageDraw.Draw(cut).rectangle((pad, pad, pad + w, pad + band_h), fill=255)
    band.putalpha(ImageChops.multiply(band.split()[3], cut))
    L = Image.alpha_composite(L, band)
    if content:
        d = ImageDraw.Draw(L)
        d.rounded_rectangle((pad + sc(40), pad + sc(28), pad + sc(250), pad + sc(50)), radius=sc(11), fill=(255, 255, 255, 235))
        base = pad + h - sc(56)
        for x, bh, col in ((sc(52), sc(118), NAVY), (sc(142), sc(186), NAVY), (sc(232), sc(250), YELLOW)):
            d.rounded_rectangle((pad + x, base - bh, pad + x + sc(66), base), radius=sc(10), fill=col + (255,))
        d.rounded_rectangle((pad + sc(40), base + sc(10), pad + sc(312), base + sc(18)), radius=sc(4), fill=NAVY + (70,))
        cx, cy, r = pad + w - sc(118), pad + band_h + (h - band_h) / 2 + sc(4), sc(64)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=RED + (255,))
        t = r * 0.46
        d.polygon([(cx - t * 0.7, cy - t), (cx - t * 0.7, cy + t), (cx + t * 1.05, cy)], fill=(255, 255, 255, 255))
    L = L.rotate(angle, resample=Image.BICUBIC, expand=True)
    out = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    out.paste(L, ((S - L.width) // 2 + dx, (S - L.height) // 2 + dy), L)
    return out


def main():
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    body = (sc(100), sc(100), sc(924), sc(924))
    R = sc(185)
    canvas = Image.alpha_composite(canvas, rrect((S, S), (body[0], body[1] + sc(12), body[2], body[3] + sc(12)), R, (0, 0, 0, 110)).filter(ImageFilter.GaussianBlur(sc(18))))
    mask = rrect((S, S), body, R, (255, 255, 255, 255)).split()[3]
    canvas.paste(vgrad((S, S), (34, 132, 201), (8, 45, 74)), (0, 0), mask)
    glow = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse((sc(40), sc(-380), sc(984), sc(470)), fill=(255, 255, 255, 24))
    glow = glow.filter(ImageFilter.GaussianBlur(sc(60)))
    glow.putalpha(ImageChops.multiply(glow.split()[3], mask))
    canvas = Image.alpha_composite(canvas, glow)
    W, H = sc(560), sc(400)
    for layer in (card(W, H, 9, sc(26), sc(-56), 0.45, False), card(W, H, 4, sc(12), sc(-28), 0.7, False), card(W, H, -3, 0, sc(26), 1.0, True)):
        layer.putalpha(ImageChops.multiply(layer.split()[3], mask))
        canvas = Image.alpha_composite(canvas, layer)
    edge = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle(body, radius=R, outline=(255, 255, 255, 40), width=sc(3))
    canvas = Image.alpha_composite(canvas, edge)
    icon = canvas.resize((1024, 1024), Image.LANCZOS)
    icon.save(HERE / "icon.png")
    icon.resize((256, 256), Image.LANCZOS).save(HERE.parent / "public/icon.png")
    print("icon.png + public/icon.png")


if __name__ == "__main__":
    main()
