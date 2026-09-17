"""Recover transparency when an image generator draws a checkerboard backdrop."""

from PIL import Image, ImageDraw
from pathlib import Path
import sys
from collections import deque


def clear(source, destination):
    image = Image.open(source).convert("RGB")
    pixels = image.load()
    mask = Image.new("L", image.size)
    marks = mask.load()
    for y in range(image.height):
        for x in range(image.width):
            r, g, b = pixels[x, y]
            # Colored art and dark outlines; gray/white checker tiles are background.
            marks[x, y] = 255 if max(r, g, b) - min(r, g, b) > 28 or max(r, g, b) < 145 else 0
    # Closed outlines protect white eyes, head nub, bubbles, and baseballs.
    for row in range(4):
        for col in range(4):
            left, top = round(col * image.width / 4), round(row * image.height / 4)
            right, bottom = round((col + 1) * image.width / 4), round((row + 1) * image.height / 4)
            tile = mask.crop((left, top, right, bottom))
            colors = image.crop((left, top, right, bottom)).load()
            data = tile.load()
            seen_white = bytearray(tile.width * tile.height)
            for sy in range(tile.height):
                for sx in range(tile.width):
                    start = sy * tile.width + sx
                    if seen_white[start]:
                        continue
                    seen_white[start] = 1
                    r, g, b = colors[sx, sy]
                    chroma = max(r, g, b) - min(r, g, b)
                    if not ((min(r, g, b) >= 245 and chroma <= 10) or
                            (min(r, g, b) >= 225 and 12 <= chroma <= 28)):
                        continue
                    queue = deque([(sx, sy)])
                    component = []
                    while queue:
                        x, y = queue.popleft()
                        component.append((x, y))
                        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                            if 0 <= nx < tile.width and 0 <= ny < tile.height:
                                index = ny * tile.width + nx
                                if not seen_white[index]:
                                    seen_white[index] = 1
                                    rr, gg, bb = colors[nx, ny]
                                    cc = max(rr, gg, bb) - min(rr, gg, bb)
                                    if ((min(rr, gg, bb) >= 245 and cc <= 10) or
                                            (min(rr, gg, bb) >= 225 and 12 <= cc <= 28)):
                                        queue.append((nx, ny))
                    if len(component) >= 140:
                        for x, y in component:
                            data[x, y] = 255
            for point in ((0, 0), (tile.width - 1, 0), (0, tile.height - 1), (tile.width - 1, tile.height - 1)):
                if tile.getpixel(point) == 0:
                    ImageDraw.floodfill(tile, point, 127, thresh=0)
            tile = tile.point(lambda v: 0 if v == 127 else 255)
            # Remove isolated checker artifacts while retaining the smallest effects.
            data = tile.load()
            visited = bytearray(tile.width * tile.height)
            for sy in range(tile.height):
                for sx in range(tile.width):
                    start = sy * tile.width + sx
                    if visited[start] or data[sx, sy] == 0:
                        continue
                    queue = deque([(sx, sy)])
                    visited[start] = 1
                    component = []
                    while queue:
                        x, y = queue.popleft()
                        component.append((x, y))
                        for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1)):
                            if 0 <= nx < tile.width and 0 <= ny < tile.height:
                                index = ny * tile.width + nx
                                if not visited[index] and data[nx, ny]:
                                    visited[index] = 1
                                    queue.append((nx, ny))
                    if len(component) < 55:
                        for x, y in component:
                            data[x, y] = 0
            mask.paste(tile, (left, top))
    rgba = image.convert("RGBA")
    rgba.putalpha(mask)
    Path(destination).parent.mkdir(parents=True, exist_ok=True)
    rgba.save(destination)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: clear_sprite_sheet_background.py SOURCE DESTINATION")
    clear(sys.argv[1], sys.argv[2])
