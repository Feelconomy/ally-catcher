"""Split a 2x2 pose sheet into four transparent PNGs.

Reading order is idle / grabbed / drop / win — top-left, top-right,
bottom-left, bottom-right. The grid lines are found from the alpha channel
(the widest fully-empty band near the middle) rather than assumed at 50%,
and each cell is then trimmed to the artwork's own bounding box so poses
that lean or sprawl still come out centred.
"""
import struct
import sys
import zlib


def read_png(path):
    d = open(path, 'rb').read()
    assert d[:8] == b'\x89PNG\r\n\x1a\n', 'not a png'
    i, idat, hdr = 8, b'', None
    while i < len(d):
        ln = struct.unpack('>I', d[i:i + 4])[0]
        typ = d[i + 4:i + 8]
        if typ == b'IHDR':
            hdr = struct.unpack('>IIBBBBB', d[i + 8:i + 8 + ln])
        elif typ == b'IDAT':
            idat += d[i + 8:i + 8 + ln]
        i += 12 + ln
    w, h, depth, ctype = hdr[0], hdr[1], hdr[2], hdr[3]
    assert depth == 8 and ctype in (2, 6), f'need 8-bit RGB/RGBA, got depth={depth} ctype={ctype}'
    chans = 4 if ctype == 6 else 3
    raw = zlib.decompress(idat)
    stride = w * chans + 1
    prev = bytearray(w * chans)
    rows = []
    for y in range(h):
        f = raw[y * stride]
        line = bytearray(raw[y * stride + 1:(y + 1) * stride])
        for x in range(len(line)):
            a = line[x - chans] if x >= chans else 0
            b = prev[x]
            c = prev[x - chans] if x >= chans else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if (pa <= pb and pa <= pc) else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        rows.append(bytes(line))
        prev = line
    if chans == 3:                       # widen to RGBA so the rest is uniform
        rows = [bytes(b for i in range(w) for b in (r[i*3], r[i*3+1], r[i*3+2], 255))
                for r in rows]
    return w, h, rows


def write_png(path, w, h, rows):
    raw = b''.join(b'\x00' + r for r in rows)
    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data
                + struct.pack('>I', zlib.crc32(typ + data) & 0xffffffff))
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    open(path, 'wb').write(png)


def alpha_profiles(w, h, rows, thresh=8):
    """Opaque-pixel counts per row and per column."""
    col = [0] * w
    row = [0] * h
    for y in range(h):
        r = rows[y]
        n = 0
        for x in range(w):
            if r[x * 4 + 3] > thresh:
                n += 1
                col[x] += 1
        row[y] = n
    return row, col


def widest_gap(profile, lo, hi):
    """Midpoint of the longest empty run inside [lo, hi)."""
    best = (0, None)
    run = 0
    for i in range(lo, hi):
        if profile[i] == 0:
            run += 1
            if run > best[0]:
                best = (run, i)
        else:
            run = 0
    if best[1] is None:
        return (lo + hi) // 2          # no clean gap — fall back to the middle
    end = best[1]
    return end - best[0] // 2


def bbox(rows, x0, x1, y0, y1, thresh=8):
    minx, maxx, miny, maxy = x1, x0, y1, y0
    for y in range(y0, y1):
        r = rows[y]
        hit = False
        for x in range(x0, x1):
            if r[x * 4 + 3] > thresh:
                if x < minx: minx = x
                if x > maxx: maxx = x
                hit = True
        if hit:
            if y < miny: miny = y
            if y > maxy: maxy = y
    if maxx < minx or maxy < miny:
        return None
    return minx, miny, maxx + 1, maxy + 1


def crop(rows, box, pad, w, h):
    x0, y0, x1, y1 = box
    x0 = max(0, x0 - pad); y0 = max(0, y0 - pad)
    x1 = min(w, x1 + pad); y1 = min(h, y1 + pad)
    return x1 - x0, y1 - y0, [rows[y][x0 * 4:x1 * 4] for y in range(y0, y1)]


def main(src, out_prefix, names=('idle', 'grabbed', 'drop', 'win'), pad=12):
    w, h, rows = read_png(src)
    rowp, colp = alpha_profiles(w, h, rows)
    opaque = sum(rowp)
    if opaque < w * h * 0.01:
        sys.exit('이미지에 불투명 픽셀이 거의 없습니다 — 배경이 투명한 원본인지 확인하세요.')

    # Grid lines: the widest empty band in the middle third of each axis.
    cx = widest_gap(colp, w // 3, w * 2 // 3)
    cy = widest_gap(rowp, h // 3, h * 2 // 3)
    print(f'시트 {w}x{h} · 분할선 x={cx} y={cy}')

    cells = [(0, cx, 0, cy), (cx, w, 0, cy), (0, cx, cy, h), (cx, w, cy, h)]
    for name, (x0, x1, y0, y1) in zip(names, cells):
        box = bbox(rows, x0, x1, y0, y1)
        if not box:
            sys.exit(f'{name} 칸이 비어 있습니다 — 분할선을 확인하세요.')
        cw, ch, cropped = crop(rows, box, pad, w, h)
        path = f'{out_prefix}-{name}.png'
        write_png(path, cw, ch, cropped)
        print(f'  {name:8s} -> {cw}x{ch}  {path}')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
