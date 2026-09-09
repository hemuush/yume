from PIL import Image, ImageDraw
import os

SRC = r"C:\Users\heman\.claude\uploads\3d437eb0-9729-4e1e-bba0-0ec0152e84a1\9b328702-image.png"
OUT = "assets"

img = Image.open(SRC).convert("RGB")
w, h = img.size

# The generated image bakes its own rounded-square card shape onto a black
# canvas, leaving black triangles in the four corners outside the rounded
# rect. Flood-fill those from each corner with the icon's own cream fill so
# cropping to a plain square doesn't leave black wedges once the OS applies
# its own (different) mask shape.
cream = img.getpixel((w // 2, 5))
draw = ImageDraw.floodfill
for corner in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
    ImageDraw.floodfill(img, corner, cream, thresh=40)

img = img.resize((1024, 1024), Image.LANCZOS)
img.save(os.path.join(OUT, "icon.png"))
img.save(os.path.join(OUT, "favicon.png"))
print("icon.png saved", img.size, "cream=", cream)

# Adaptive background: solid fill matching the icon's own cream.
bg_layer = Image.new("RGBA", (1024, 1024), cream + (255,))
bg_layer.save(os.path.join(OUT, "android-icon-background.png"))

# Adaptive foreground: the icon scaled into Android's ~62% safe zone,
# centered, so no launcher mask shape crops the bird.
safe_scale = 0.62
fg_size = int(1024 * safe_scale)
fg_art = img.resize((fg_size, fg_size), Image.LANCZOS).convert("RGBA")
foreground = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
offset = ((1024 - fg_size) // 2, (1024 - fg_size) // 2)
foreground.paste(fg_art, offset, fg_art)
foreground.save(os.path.join(OUT, "android-icon-foreground.png"))

print("All icon assets written to assets/")
