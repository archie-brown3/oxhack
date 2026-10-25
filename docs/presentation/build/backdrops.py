"""Doom Clock deck backdrops: 7 PNGs at 1920x1080, drawn from the design-system tokens.
Stage theme throughout, Paper for the close. Pixelation = low-res raster + nearest upscale;
gradients = 4x4 Bayer ordered dither. No text is baked in. Ominous: deep vignette, sparse light,
oxblood only where midnight is near."""
import json, math
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

W, H = 1920, 1080
OUT = "/home/claude/deck/bg"

GROUND = "#0b0b0b"; RAISED = "#161616"; INK = "#f1f1f1"; INK2 = "#a8a8a8"; INK3 = "#808080"
OXBLOOD = "#851618"; OX_DEEP = "#3a0b0c"; ALARM = "#e5484d"; WARD = "#6ea8f5"; SIM = "#b392f0"
RULE = "#2c2c2c"; RULE_STRONG = "#6b6b6b"
P_GROUND = "#f1f1f1"; P_INK = "#1f1f1f"; P_RULE = "#d6d6d6"

def rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]], dtype=float) / 16.0

def bayer(shape):
    h, w = shape
    return np.tile(BAYER, (h // 4 + 1, w // 4 + 1))[:h, :w]

def dither_mask(gray):
    return gray > (bayer(gray.shape) + 1 / 32)

def upscale(img_small, cell):
    return img_small.resize((img_small.width * cell, img_small.height * cell), Image.NEAREST)

def new_canvas(color, w=W, h=H):
    a = np.zeros((h, w, 3), dtype=np.uint8); a[:] = rgb(color); return a

def to_img(a): return Image.fromarray(a, "RGB")

_save = Image.Image.save
def save2x(self, fp, *a, **k):
    if isinstance(fp, str) and fp.endswith(".png") and self.size == (W, H):
        self = self.resize((W * 2, H * 2), Image.NEAREST)
    return _save(self, fp, *a, **k)
Image.Image.save = save2x

_save = Image.Image.save
def save2x(self, fp, *a, **k):
    if isinstance(fp, str) and fp.endswith(".png") and self.size == (W, H):
        self = self.resize((W * 2, H * 2), Image.NEAREST)
    return _save(self, fp, *a, **k)
Image.Image.save = save2x

# ---------- ominous treatments ----------

def vignette(img, cell=8, strength=0.9, power=2.2, cx=0.5, cy=0.5):
    """Dithered radial darkening to pure black at the edges, in `cell`-px blocks."""
    w, h = W // cell, H // cell
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx / w - cx) * 1.0) ** 2 + ((yy / h - cy) * (h / w)) ** 2) / 0.75
    g = np.clip(d, 0, 1) ** power * strength
    m = dither_mask(g)
    mask = Image.fromarray((m * 255).astype(np.uint8), "L").resize((W, H), Image.NEAREST)
    arr = np.array(img).astype(float); s = np.array(mask).astype(float)[..., None] / 255
    return Image.fromarray((arr * (1 - 0.82 * s)).astype(np.uint8))

def glow(img, cx, cy, r, color=OXBLOOD, cell=6, strength=0.75, power=1.6):
    """A dithered radial glow in `color`: the only place red is allowed to bleed."""
    w, h = W // cell, H // cell
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt((xx * cell - cx) ** 2 + (yy * cell - cy) ** 2) / r
    g = np.clip(1 - d, 0, 1) ** power * strength
    m = dither_mask(g)
    mask = Image.fromarray((m * 255).astype(np.uint8), "L").resize((W, H), Image.NEAREST)
    arr = np.array(img).astype(float); s = np.array(mask).astype(float)[..., None] / 255
    col = np.array(rgb(color), dtype=float)
    dark = (arr.sum(axis=2) < 200)[..., None]  # never tint the ink
    out = np.where(dark, arr * (1 - s) + col * s, arr)
    return Image.fromarray(out.astype(np.uint8))

def grain(img, amount=10, seed=1):
    rng = np.random.RandomState(seed)
    arr = np.array(img).astype(int)
    n = rng.randint(-amount, amount + 1, size=arr.shape[:2])[..., None]
    arr = np.clip(arr + n * (arr.sum(axis=2, keepdims=True) > 30), 0, 255)
    return Image.fromarray(arr.astype(np.uint8))

# ---------- motifs ----------

def quarter_face(draw, cx, cy, r, ink, ink3, alarm, raised=None, hand_min=85 / 60):
    """The last quarter of a clock face: midnight at the top, minutes run anticlockwise to nine."""
    if raised:
        draw.pieslice([cx - r, cy - r, cx + r, cy + r], 180, 270, fill=raised)
    draw.arc([cx - r, cy - r, cx + r, cy + r], 180, 270, fill=ink, width=max(1, int(r * 0.025)))
    for m in range(0, 16):
        ang = math.radians(90 + m * 6)
        major = m % 5 == 0
        l = r * (0.12 if major else 0.06)
        x1, y1 = cx + math.cos(ang) * r, cy - math.sin(ang) * r
        x2, y2 = cx + math.cos(ang) * (r - l), cy - math.sin(ang) * (r - l)
        draw.line([x1, y1, x2, y2], fill=ink if major else ink3, width=max(1, int(r * (0.018 if major else 0.009))))
    ang = math.radians(90 + hand_min * 6)
    tip = (cx + math.cos(ang) * r * 0.86, cy - math.sin(ang) * r * 0.86)
    bw = r * 0.03
    px, py = math.cos(ang + math.pi / 2) * bw, -math.sin(ang + math.pi / 2) * bw
    draw.polygon([tip, (cx + px, cy + py), (cx - px, cy - py)], fill=ink)
    draw.ellipse([cx - r * .03, cy - r * .03, cx + r * .03, cy + r * .03], fill=ink)
    d = r * 0.028
    draw.ellipse([cx - d, cy - r - d, cx + d, cy - r + d], fill=alarm)


def load_land():
    gj = json.load(open("/mnt/user-data/uploads/oxhack/doomclock/web/public/ne_110m_countries.geojson"))
    polys = []
    for f in gj["features"]:
        g = f["geometry"]
        if g["type"] == "Polygon": polys.append(g["coordinates"][0])
        elif g["type"] == "MultiPolygon":
            for p in g["coordinates"]: polys.append(p[0])
    return polys

def land_mask(lons, lats, polys):
    from matplotlib.path import Path
    pts = np.column_stack([lons, lats]); inside = np.zeros(len(pts), dtype=bool)
    for p in polys: inside |= Path(np.array(p)).contains_points(pts)
    return inside


def globe_points(R, cell, polys, rot_lon, tilt, light):
    """Dot grid on an orthographic sphere. Returns screen offsets, land flag, lambert shade."""
    stepdeg = math.degrees(cell / R) * 0.9
    pts = []
    for la in np.arange(-90, 90, stepdeg):
        n = max(1, int(round(360 / stepdeg * math.cos(math.radians(la)))))
        for lo in np.linspace(-180, 180, n, endpoint=False): pts.append((lo, la))
    pts = np.array(pts); lon, lat = pts[:, 0], pts[:, 1]
    isl = land_mask(lon, lat, polys)
    lo = np.radians(lon + rot_lon); la = np.radians(lat); tl = math.radians(tilt)
    x = np.cos(la) * np.sin(lo); y0 = np.sin(la); z0 = np.cos(la) * np.cos(lo)
    y = y0 * math.cos(tl) - z0 * math.sin(tl); z = y0 * math.sin(tl) + z0 * math.cos(tl)
    front = z > 0.01
    lx, ly, lz = light; ln = math.sqrt(lx * lx + ly * ly + lz * lz)
    shade = (x * lx + y * ly + z * lz) / ln  # -1..1, negative = night
    return x[front], y[front], isl[front], shade[front]


def dot_globe(canvas, cx, cy, R, cell, polys, rot_lon=-20, tilt=18, light=(-0.5, 0.6, 0.62),
              night_land="#1c1c1c", night_sea=None, day_land=(INK3, INK2), day_sea="#2a2a2a",
              terminator=None, seed=7):
    """Each dot a `cell`-px square. `terminator` = (color, width) tints the band around shade 0."""
    x, y, isl, shade = globe_points(R, cell, polys, rot_lon, tilt, light)
    th = np.random.RandomState(seed).rand(len(x))
    for i in range(len(x)):
        px = int(cx + x[i] * R); py = int(cy - y[i] * R); s = shade[i]
        col = None
        if s <= 0:  # night
            if isl[i]:
                if th[i] < 0.75 + 0.25 * (1 + s): col = night_land
            elif night_sea and th[i] < 0.08 * (1 + s): col = night_sea
        else:  # day
            if isl[i]:
                col = day_land[1] if (s > 0.55 and th[i] < s) else day_land[0]
            elif th[i] < 0.25 + 0.5 * s: col = day_sea
        if terminator:
            tcol, tw = terminator
            if abs(s) < tw:
                k = 1 - abs(s) / tw
                if th[i] < k * (0.95 if isl[i] else 0.55): col = tcol
        if col: canvas[py:py + cell - 1, px:px + cell - 1] = rgb(col)


def soft_shadow(base_img, boxes, blur=28, alpha=0.6, dy=14):
    sh = Image.new("L", base_img.size, 0); d = ImageDraw.Draw(sh)
    for (x0, y0, x1, y1) in boxes: d.rectangle([x0, y0 + dy, x1, y1 + dy], fill=int(255 * alpha))
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    arr = np.array(base_img).astype(float); s = np.array(sh).astype(float)[..., None] / 255
    return Image.fromarray((arr * (1 - s)).astype(np.uint8))


# =============================== slides ===============================

def slide1_title(polys):
    """The terminator. A globe the height of the slide, lit from behind its right limb, so what faces us
    is night: land as near-black pixel mass, and a thin oxblood band where the day is ending. The
    only light is the crescent at the limb and the midnight point."""
    c = new_canvas("#060606")
    cx, cy, R = 1290, 600, 620
    dot_globe(c, cx, cy, R, 7, polys, rot_lon=-30, tilt=20, light=(0.95, 0.25, -0.18),
              night_land="#181818", night_sea="#0f0f0f", day_land=("#6a6a6a", INK2), day_sea="#2a2a2a",
              terminator=(OXBLOOD, 0.14))
    img = to_img(c)
    d = ImageDraw.Draw(img)
    d.ellipse([cx - 7, cy - R - 7, cx + 7, cy - R + 7], fill=rgb(ALARM))
    img = glow(img, cx, cy - R, 260, color=OX_DEEP, strength=0.9, power=1.3)
    img = glow(img, cx - R * 0.15, cy + R * 0.2, 520, color="#200607", strength=0.6, power=1.1)
    img = vignette(img, strength=1.0, power=1.8, cx=0.62, cy=0.52)
    img = grain(img, 6)
    img.save(f"{OUT}/01-title.png")


def slide2_promise():
    """The face itself, oversized, bleeding off the top-right: the hand at 85 seconds, and the
    midnight point glowing. Dark raised sector, ink rim. Cell 6 pixelation."""
    cell = 6; w, h = W // cell, H // cell
    small = Image.new("RGB", (w, h), rgb(GROUND)); ds = ImageDraw.Draw(small)
    quarter_face(ds, 1660 // cell, 980 // cell, 820 // cell, rgb(INK), rgb("#5a5a5a"), rgb(ALARM),
                 raised=rgb("#121212"))
    img = upscale(small, cell)
    img = glow(img, 1660, 160, 420, color=OX_DEEP, strength=1.0, power=1.4)
    img = glow(img, 1660, 160, 90, color=OXBLOOD, strength=0.9, power=1.0)
    img = vignette(img, strength=0.9, power=2.0, cx=0.7, cy=0.6)
    img = grain(img, 5)
    img.save(f"{OUT}/02-promise.png")


def slide3_data():
    """The time spine with T. Record rows above it: kept before T, struck out after. The future side
    sinks into the dark; the only colour is sim purple for what is projected."""
    cell = 8; w, h = W // cell, H // cell
    img = to_img(new_canvas(GROUND, w, h)); d = ImageDraw.Draw(img)
    T = 142; rng = np.random.RandomState(3)
    for row in range(60, 100, 3):
        x = 12
        while x < w - 10:
            L = rng.randint(3, 9)
            if x + L > w - 8: break
            if x + L <= T:
                d.rectangle([x, row, x + L - 1, row + 1], fill=rgb("#2e2e2e") if rng.rand() < 0.8 else rgb("#5c5c5c"))
            else:
                d.rectangle([x, row, x + L - 1, row + 1], outline=rgb("#241c33"))
                d.line([x, row, x + L - 1, row + 1], fill=rgb("#5e4a8a"), width=1)
            x += L + rng.randint(1, 3)
    y = 108
    d.line([12, y, T, y], fill=rgb(INK), width=1)
    for x in range(T + 2, w - 10, 2): d.rectangle([x, y, x, y], fill=rgb(SIM))
    d.line([T, 54, T, y + 6], fill=rgb(INK), width=1)
    img = upscale(img, cell); d2 = ImageDraw.Draw(img)
    for i, x in enumerate(range(14 * cell, T * cell - 20, 96)):
        r = 6 if i % 3 == 0 else 3
        d2.ellipse([x - r, y * cell + 4 - r, x + r, y * cell + 4 + r], fill=rgb(INK2) if i % 3 == 0 else rgb(INK3))
    d2.ellipse([T * cell - 7, y * cell - 3, T * cell + 7, y * cell + 11], fill=rgb(INK))
    img = vignette(img, strength=0.95, power=1.9, cx=0.45, cy=0.75)
    img = grain(img, 5)
    img.save(f"{OUT}/03-data.png")


def slide4_model():
    """The catastrophe CDF with 10,000 futures as a dithered fan. Everything above 1 in 10 is
    oxblood territory; the crossing year is marked in alarm. Plot on the right."""
    cell = 4; w, h = W // cell, H // cell
    px0, px1 = 940 // cell, 1860 // cell; py0, py1 = 140 // cell, 940 // cell
    years = np.arange(2026, 2101)
    rng = np.random.RandomState(11); N = 10000
    xs = np.array([2026.8, 2030, 2040, 2100]); ps = np.array([0, .3608, .75, .8635])
    u = rng.rand(N); asi = np.interp(u, ps, xs); asi[u >= ps[-1]] = np.inf
    pbad = 0.297 / 0.8635; bad = rng.rand(N) < pbad; lag = rng.exponential(5.0, N)
    cat = np.where(bad, asi + lag, np.inf)
    cdf = np.array([(cat <= y).mean() for y in years])
    groups = cat.reshape(100, 100)
    gcdf = np.array([[(g <= y).mean() for y in years] for g in groups])
    lo, hi = np.percentile(gcdf, 5, axis=0), np.percentile(gcdf, 95, axis=0)
    ymax = 0.40
    def X(y): return px0 + (y - 2026) / (2100 - 2026) * (px1 - px0)
    def Y(p): return py1 - p / ymax * (py1 - py0)
    c = new_canvas(GROUND, w, h)
    y10 = int(Y(0.10))
    for yy in range(py0, y10):
        g = 0.35 * (1 - (yy - py0) / (y10 - py0)) ** 1.5 + 0.03
        for xx in range(px0, px1):
            if g > BAYER[yy % 4, xx % 4] + 1 / 32: c[yy, xx] = rgb(OX_DEEP)
    for i, y in enumerate(years):
        x = int(X(y)); xn = int(X(y + 1)) if i < len(years) - 1 else x + 1
        yt, yb = max(py0, int(Y(hi[i]))), int(Y(lo[i])); ym = Y(cdf[i])
        for yy in range(min(yt, yb), max(yt, yb) + 1):
            dist = min(1.0, abs(yy - ym) / max(1, (yb - yt) / 2))
            g = 0.6 * (1 - dist) ** 1.2
            for xx in range(x, max(x + 1, xn)):
                if g > BAYER[yy % 4, xx % 4] + 1 / 32: c[yy, xx] = rgb(INK3 if yy > y10 else "#b05a5c")
    img = to_img(c); d = ImageDraw.Draw(img)
    d.line([px0, py1, px1, py1], fill=rgb(RULE_STRONG), width=1)
    d.line([px0, py0, px0, py1], fill=rgb(RULE_STRONG), width=1)
    pts = []
    for i, y in enumerate(years): pts += [(X(y), Y(cdf[i])), (X(y + 1), Y(cdf[i]))]
    d.line(pts, fill=rgb(INK), width=1)
    for x in range(px0, px1, 4): d.line([x, y10, x + 1, y10], fill=rgb(ALARM))
    cross = years[np.argmax(cdf >= 0.10)]
    img = upscale(img, cell); d2 = ImageDraw.Draw(img)
    xc = X(cross) * cell
    d2.line([xc, y10 * cell, xc, py1 * cell], fill=rgb(ALARM), width=2)
    d2.ellipse([xc - 7, y10 * cell - 7, xc + 7, y10 * cell + 7], fill=rgb(ALARM))
    for y in range(2030, 2101, 10):
        x = X(y) * cell; d2.line([x, py1 * cell, x, py1 * cell + 10], fill=rgb(INK3), width=1)
    img = glow(img, xc, y10 * cell, 300, color=OX_DEEP, strength=0.8, power=1.4)
    img = vignette(img, strength=0.9, power=2.0, cx=0.55, cy=0.5)
    img = grain(img, 5)
    img.save(f"{OUT}/04-model.png")
    return int(cross)


def slide5_demo(polys):
    """The World HUD as a frame: four corners space-5 from the edges, the ticker over the spine, a
    night globe behind where the screenshot or live page sits."""
    c = new_canvas(GROUND)
    dot_globe(c, 960, 560, 400, 6, polys, rot_lon=-15, tilt=14, light=(0.9, 0.4, -0.1),
              night_land="#171717", night_sea="#0f0f0f", day_land=("#2a2a2a", "#363636"), day_sea="#141414",
              terminator=(OX_DEEP, 0.12))
    img = to_img(c)
    panels = [(20, 20, 440, 320), (760, 20, 1160, 64), (1480, 20, 1900, 180)]
    img = soft_shadow(img, panels); d = ImageDraw.Draw(img)
    for (x0, y0, x1, y1) in panels: d.rectangle([x0, y0, x1, y1], fill=rgb(RAISED), outline=rgb(RULE), width=1)
    quarter_face(d, 330, 290, 190, rgb(INK), rgb(INK3), rgb(ALARM), raised=rgb("#1c1c1c"))
    d.line([20, 966, 1900, 966], fill=rgb(RULE), width=1)
    d.line([20, 1020, 1180, 1020], fill=rgb(INK), width=1)
    for x in range(1188, 1900, 9): d.line([x, 1020, x + 4, 1020], fill=rgb(SIM), width=1)
    for x in range(60, 1180, 120): d.ellipse([x - 3, 1017, x + 3, 1023], fill=rgb(INK3))
    d.ellipse([1174, 1014, 1186, 1026], outline=rgb(INK), width=2)
    img = glow(img, 330, 100, 120, color=OX_DEEP, strength=0.8, power=1.2)
    img = vignette(img, strength=0.8, power=2.4)
    img = grain(img, 4)
    img.save(f"{OUT}/05-demo.png")


def slide6_track():
    """Track record: four raised statement cards, each with a pixel quarter face, on a ground that
    falls away to black. The Bulletin's statement grid, at night."""
    img = to_img(new_canvas(GROUND))
    cards = [(100 + i * 440, 380, 100 + i * 440 + 400, 800) for i in range(4)]
    img = soft_shadow(img, cards, blur=34, alpha=0.7); d = ImageDraw.Draw(img)
    for (x0, y0, x1, y1) in cards: d.rectangle([x0, y0, x1, y1], fill=rgb(RAISED))
    for i, (x0, y0, x1, y1) in enumerate(cards):
        small = Image.new("RGB", (44, 30), rgb(RAISED)); ds = ImageDraw.Draw(small)
        quarter_face(ds, 30, 27, 24, rgb("#6a6a6a"), rgb("#3a3a3a"), rgb(ALARM), hand_min=[85 / 60, 2.5, 1.6, 1.8][i])
        big = upscale(small, 4); img.paste(big, (x0 + (x1 - x0 - big.width) // 2, y0 + 28))
    img = vignette(img, strength=0.95, power=1.8)
    img = grain(img, 4)
    img.save(f"{OUT}/06-track.png")


def slide7_close():
    """Paper: the sheet where the clock makes its statement. Two oxblood rules centred; a large pixel
    quarter face in paper greys bleeding off the bottom right, its midnight point the one red dot."""
    cell = 10; w, h = W // cell, H // cell
    small = Image.new("RGB", (w, h), rgb(P_GROUND)); ds = ImageDraw.Draw(small)
    quarter_face(ds, 176, 118, 92, rgb("#b0b0b0"), rgb(P_RULE), rgb("#a71d1f"), raised=rgb("#e6e6e6"))
    img = upscale(small, cell)
    g = np.clip((1250 - np.arange(W)) / 1250, 0, 1) ** 1.3
    gm = dither_mask(np.tile(g[::cell], (h, 1)))
    scrim = Image.fromarray((gm * 255).astype(np.uint8), "L").resize((W, H), Image.NEAREST)
    base = np.array(img).astype(float); s = np.array(scrim).astype(float)[..., None] / 255
    img = Image.fromarray((base * (1 - s) + np.array(rgb(P_GROUND)) * s).astype(np.uint8))
    d = ImageDraw.Draw(img)
    for y in (300, 640): d.rectangle([W // 2 - 180, y, W // 2 + 180, y + 2], fill=rgb(OXBLOOD))
    img.save(f"{OUT}/07-close.png")


if __name__ == "__main__":
    import os; os.makedirs(OUT, exist_ok=True)
    polys = load_land()
    slide1_title(polys); print(1)
    slide2_promise(); print(2)
    slide3_data(); print(3)
    print(4, slide4_model())
    slide5_demo(polys); print(5)
    slide6_track(); print(6)
    slide7_close(); print(7)
