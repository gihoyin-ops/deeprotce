import subprocess, os, glob
from PIL import Image, ImageDraw, ImageFont

ROOT = "/home/Ved/Desktop/deepchat-main/public"
OUT = "/home/Ved/Desktop/deepchat-main/scripts/icons-render"
os.makedirs(OUT, exist_ok=True)

def render(svg_path, size=96, bg=None, color="#111111"):
    tmp = os.path.join(OUT, "tmp")
    os.makedirs(tmp, exist_ok=True)
    out = os.path.join(tmp, os.path.basename(svg_path).replace(".svg", ".png"))
    if os.path.exists(out):
        os.remove(out)
    # inject currentColor replacement
    with open(svg_path) as fh:
        data = fh.read()
    if "currentColor" in data and color is not None:
        data = data.replace("currentColor", color)
    tsvg = os.path.join(tmp, os.path.basename(svg_path).replace(".svg", "_c.svg"))
    with open(tsvg, "w") as fh:
        fh.write(data)
    args = ["rsvg-convert", "-w", str(size), "-h", str(size), tsvg, "-o", out]
    if bg:
        args += ["--background-color", bg]
    r = subprocess.run(args, capture_output=True)
    if r.returncode != 0:
        return None
    return Image.open(out).convert("RGBA")

files = sorted(glob.glob(f"{ROOT}/*.svg")) + sorted(glob.glob(f"{ROOT}/icons/*.svg"))
cols = 12
cell = 120
label_h = 18
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGBA", (cols * cell, rows * (cell + label_h)), (245, 245, 247, 255))
dr = ImageDraw.Draw(sheet)
try:
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 11)
except Exception:
    font = ImageFont.load_default()

for i, f in enumerate(files):
    r_, c_ = divmod(i, cols)
    x0, y0 = c_ * cell, r_ * (cell + label_h)
    img = render(f, bg="#111111" if f.endswith("vercel.svg") else None)
    if img is None:
        dr.text((x0 + 4, y0 + 4), "FAIL: " + os.path.basename(f), fill="red", font=font)
        continue
    img = img.resize((96, 96))
    sheet.alpha_composite(img, (x0 + 12, y0 + 6))
    name = os.path.basename(f).replace(".svg", "")
    dr.text((x0 + 4, y0 + cell - 2), name[:14], fill="#333", font=font)

sheet.save(os.path.join(OUT, "contact-sheet.png"))
print("rendered", len(files), "svgs")
