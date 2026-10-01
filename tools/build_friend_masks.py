"""친구 실루엣 마스크(assets/friends/*.png) 만들기.

실제 인형 그림(dolls/<id>-idle.png)의 윤곽만 뽑고, 캐릭터를 알아보게 하는 특징
(뿔·귀·새싹)은 그 부분을 떼어 키운 뒤 다시 겹쳐 과장한다. 얼굴은 넣지 않는다.
  .venv/bin/python tools/build_friend_masks.py
"""
import sys
from PIL import Image, ImageChops, ImageFilter

# (x0, y0, x1, y1, 기준점x, 기준점y, 배율) — 모두 윤곽 상자 기준 0~1.
# 기준점은 특징이 몸에 붙은 자리라 키워도 그 자리에 붙어 있다.
FEATURES = {
    'olly': [(0.36, 0.0, 0.64, 0.14, 0.5, 0.13, 3.0)],                       # 뿔
    'pig':  [(0.08, 0.0, 0.44, 0.33, 0.30, 0.30, 1.4),                        # 귀
             (0.54, 0.0, 0.95, 0.33, 0.68, 0.30, 1.4)],
    'woni': [(0.38, 0.0, 0.64, 0.11, 0.5, 0.10, 2.4)],                       # 새싹
    'kori': [(0.0, 0.0, 0.40, 0.62, 0.34, 0.33, 1.3),                         # 큰 귀
             (0.60, 0.0, 1.0, 0.62, 0.66, 0.33, 1.3)],
    'dali': [(0.0, 0.0, 0.40, 0.33, 0.32, 0.14, 1.4),                         # 늘어진 귀
             (0.60, 0.0, 1.0, 0.34, 0.70, 0.12, 1.4)],
}
H = 200

def feather(part, edges, k=.2):
    """잘라낸 조각에서 몸 안쪽으로 잘린 가장자리(edges: l·r·t·b)만 서서히
    투명하게 — 키워 겹칠 때 직선 자국이 안 남게. 바깥 윤곽 쪽은 그대로 둔다."""
    w, h = part.size
    fx, fy = max(1, int(w * k)), max(1, int(h * k))
    ramp = Image.new('L', (w, h), 255)
    px = ramp.load()
    for y in range(h):
        for x in range(w):
            f = 1
            if 'l' in edges: f = min(f, x / fx)
            if 'r' in edges: f = min(f, (w - 1 - x) / fx)
            if 't' in edges: f = min(f, y / fy)
            if 'b' in edges: f = min(f, (h - 1 - y) / fy)
            px[x, y] = int(255 * f)
    return ImageChops.multiply(part, ramp)

def build(id):
    a = Image.open(f'dolls/{id}-idle.png').convert('RGBA').getchannel('A')
    a = a.crop(a.getbbox())
    w, h = a.size
    pad = int(max(w, h) * .6)
    canvas = Image.new('L', (w + pad * 2, h + pad * 2), 0)
    canvas.paste(a, (pad, pad))
    for x0, y0, x1, y1, ax, ay, s in FEATURES[id]:
        box = (round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h))
        edges = ('l' if x0 > 0 else '') + ('r' if x1 < 1 else '') + ('t' if y0 > 0 else '') + ('b' if y1 < 1 else '')
        part = feather(a.crop(box), edges)
        big = part.resize((round(part.width * s), round(part.height * s)), Image.LANCZOS)
        # 기준점이 제자리에 남도록 왼쪽 위를 옮긴다
        nx = pad + ax * w - (ax * w - box[0]) * s
        ny = pad + ay * h - (ay * h - box[1]) * s
        layer = Image.new('L', canvas.size, 0)
        layer.paste(big, (round(nx), round(ny)))
        canvas = ImageChops.lighter(canvas, layer)
    # 떼어 붙인 자리의 각진 이음매를 뭉갰다가 다시 또렷하게 — 둥근 윤곽만 남는다
    r = max(1, round(max(w, h) * .005))
    canvas = canvas.filter(ImageFilter.GaussianBlur(r)).point(lambda v: max(0, min(255, (v - 110) * 16 + 128)))
    canvas = canvas.crop(canvas.getbbox())
    out_w = round(canvas.width * H / canvas.height)
    canvas = canvas.resize((out_w, H), Image.LANCZOS)
    out = Image.new('LA', canvas.size, (0, 0))
    out.putalpha(canvas)
    out.save(f'assets/friends/{id}.png', optimize=True)
    return out

if __name__ == '__main__':
    outs = [build(id) for id in FEATURES]
    if len(sys.argv) > 1:   # 미리보기 한 장
        sheet = Image.new('RGB', (sum(o.width + 20 for o in outs) + 20, H + 40), (223, 241, 230))
        x = 20
        for o in outs:
            sheet.paste((14, 79, 44), (x, 20), o.getchannel('A')); x += o.width + 20
        sheet.save(sys.argv[1])
