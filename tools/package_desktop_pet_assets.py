"""Split generated transparent 4x4 sheets into aligned desktop-pet PNGs."""

from pathlib import Path
from PIL import Image
import json
import sys

POSES = [
    "idle", "blink", "breathe", "walk_left_1",
    "walk_left_2", "wave", "jump", "sit",
    "sleep", "surprised", "sad", "angry",
    "eat", "heart", "announce", "baseball",
]
PROPS = [
    "heart", "sparkles", "sleep_z", "speech_bubble",
    "megaphone", "cookie", "carrot", "bat_ball",
    "medal", "baseball_cap", "straw_hat", "sign",
    "cloud", "anger", "blush", "shadow",
]


def split(source, names, folder, size, chunky=False):
    sheet = Image.open(source).convert("RGBA")
    atlas = Image.new("RGBA", (size * 4, size * 4))
    for n, name in enumerate(names):
        col, row = n % 4, n // 4
        cell = sheet.crop((round(col * sheet.width / 4), round(row * sheet.height / 4),
                           round((col + 1) * sheet.width / 4), round((row + 1) * sheet.height / 4)))
        alpha = cell.getchannel("A")
        box = alpha.point(lambda v: 255 if v >= 128 else 0).getbbox()
        if not box:
            raise ValueError(f"Empty cell: {name}")
        art = cell.crop(box)
        art.putalpha(art.getchannel("A").point(lambda v: 255 if v >= 128 else 0))
        scale = min((size - 8) / art.width, (size - 8) / art.height)
        art = art.resize((round(art.width * scale), round(art.height * scale)), Image.Resampling.NEAREST)
        frame = Image.new("RGBA", (size, size))
        x = (size - art.width) // 2
        y = size - 4 - art.height if folder.name == "poses" else (size - art.height) // 2
        frame.alpha_composite(art, (x, y))
        if chunky:
            logical = size // 4
            frame = frame.resize((logical, logical), Image.Resampling.NEAREST).resize(
                (size, size), Image.Resampling.NEAREST)
        frame.save(folder / f"{name}.png")
        atlas.alpha_composite(frame, (col * size, row * size))
    atlas.save(folder.parent / f"{folder.name}_atlas.png")


def main():
    if len(sys.argv) not in (4, 5):
        raise SystemExit("usage: package_desktop_pet_assets.py POSE_SHEET PROP_SHEET OUTPUT_DIR [chunky]")
    root = Path(sys.argv[3])
    chunky = len(sys.argv) == 5 and sys.argv[4] == "chunky"
    for name in ("poses", "props"):
        (root / name).mkdir(parents=True, exist_ok=True)
    split(sys.argv[1], POSES, root / "poses", 128, chunky)
    split(sys.argv[2], PROPS, root / "props", 96, chunky)
    manifest = {
        "format": "RGBA PNG", "pixel_rendering": "nearest-neighbor",
        "poses": {name: {"file": f"poses/{name}.png", "size": [128, 128]} for name in POSES},
        "props": {name: {"file": f"props/{name}.png", "size": [96, 96]} for name in PROPS},
        "atlases": {"poses": "poses_atlas.png", "props": "props_atlas.png"},
        "suggested_animations": {
            "idle": ["idle", "breathe", "idle", "blink"],
            "walk_left": ["walk_left_1", "walk_left_2"],
            "walk_right": ["walk_left_1", "walk_left_2"],
            "happy": ["wave", "jump"],
            "sleep": ["sleep"],
        },
    }
    (root / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
