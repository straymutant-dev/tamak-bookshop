# STRAYMUTANT.DEV — Tamak Bookshop
# Path: tools/measure-notification-panel.py
# Dev tool, not part of the app. Needs: pip install playwright && playwright install chromium
# Run from the project root: python tools/measure-notification-panel.py   (writes results.json)
import json, sys
from playwright.sync_api import sync_playwright

# Hand-written equivalents of the Tailwind v4 utilities used by the real components (rem = 16px, md = 768px).
CSS = """
*,::before,::after{box-sizing:border-box;margin:0;padding:0;border:0 solid #e2ddd1}
html{font-family:Arial,sans-serif;line-height:1.5}
button{background:none;font:inherit;color:inherit}
svg,img{display:block}
header{border-bottom-width:1px;background:#fff}
.container{margin:0 auto;display:flex;height:4rem;max-width:72rem;align-items:center;justify-content:space-between;padding:0 1.5rem}
.brand{height:2.25rem;width:150px;background:#ccc;flex-shrink:0}
.desknav{display:none}
.cluster{display:flex;align-items:center;gap:1rem}
.bell{position:relative;border-radius:9999px;padding:.5rem}
.avatar{display:none;width:2.25rem;height:2.25rem;border-radius:9999px;background:#164a41}
.menu{display:block}
.panel-inner{border-radius:.375rem;border-width:1px;background:#faf7f0;box-shadow:0 10px 15px rgba(0,0,0,.1)}
.row{padding:.75rem 1rem;height:70px;border-top-width:1px}
.head{padding:.75rem 1rem;height:49px}
/* --- utilities (declaration order follows Tailwind's: inset-x, then right/top, then variants) --- */
.relative{position:relative}.absolute{position:absolute}
.inset-x-3{left:.75rem;right:.75rem}
.right-0{right:0}.top-full{top:100%}.z-30{z-index:30}.mt-2{margin-top:.5rem}.ml-auto{margin-left:auto}
.w-80{width:20rem}.max-w-sm{max-width:24rem}.max-w-\\[90vw\\]{max-width:90vw}
.overflow-y-auto{overflow-y:auto}.max-h-96{max-height:24rem}
.max-h-\\[min\\(24rem\\,calc\\(100dvh-9rem\\)\\)\\]{max-height:min(24rem,calc(100dvh - 9rem))}
@media (min-width:768px){
 .desknav{display:flex;gap:1.5rem}.avatar{display:block}.menu{display:none}
 .md\\:relative{position:relative}
 .md\\:inset-x-auto{left:auto;right:auto}
 .md\\:right-0{right:0}.md\\:top-full{top:100%}.md\\:w-80{width:20rem}
}
"""
VARIANTS = {
  # exactly the classes in components/notifications/NotificationsList.tsx today
  "before": dict(
    wrap="relative",
    panel="absolute right-0 top-full z-30 mt-2 w-80 max-w-[90vw] panel-inner",
    list="max-h-96 overflow-y-auto"),
  # the proposed classes
  "after": dict(
    wrap="md:relative",
    panel="absolute inset-x-3 z-30 mt-2 ml-auto max-w-sm md:inset-x-auto md:right-0 md:top-full md:w-80 panel-inner",
    list="max-h-[min(24rem,calc(100dvh-9rem))] overflow-y-auto"),
}
BELL = '<svg width="20" height="20"><rect width="20" height="20"/></svg>'

def page(variant, header):
    v = VARIANTS[variant]
    rows = "".join('<div class="row">item</div>' for _ in range(6))
    panel = f'<div id="panel" class="{v["panel"]}"><div class="head">Notifications</div><div id="list" class="{v["list"]}">{rows}</div></div>'
    bell = f'<div class="{v["wrap"]}"><button class="bell">{BELL}</button>{panel}</div>'
    cart = '<a style="display:block"><svg width="22" height="22"><rect width="22" height="22"/></svg></a>'
    menu = '<button class="menu"><svg width="22" height="22"><rect width="22" height="22"/></svg></button>'
    avatar = '<button class="avatar"></button>'
    cluster = (cart + bell + avatar + menu) if header == "navbar" else (bell + avatar + menu)
    return f'<!doctype html><meta name="viewport" content="width=device-width"><style>{CSS}</style><header><div class="container"><div class="brand"></div><nav class="desknav"><a>Home</a><a>Books</a><a>About</a></nav><div class="cluster">{cluster}</div></div></header><main style="height:3000px"></main>'

VIEWPORTS = [
 ("iPhone 18 Pro (402x874)",402,874,True),("iPhone Duo folded (466x678)",466,678,True),("MacBook Pro 14 (1512x982)",1512,982,True),
 ("320x568",320,568,False),("360x780",360,780,False),("375x667",375,667,False),("381x800",381,800,False),("382x800",382,800,False),
 ("390x844",390,844,False),("430x932",430,932,False),("600x900",600,900,False),("767x1024",767,1024,False),("768x1024",768,1024,False),
 ("820x1180",820,1180,False),("1024x768",1024,768,False),("1280x800",1280,800,False),
 ("landscape 874x402",874,402,False),("landscape 667x375",667,375,False),("landscape 568x320",568,320,False),
]

def run():
    out = []
    with sync_playwright() as p:
        b = p.chromium.launch()
        for header in ("navbar","admin"):
            for variant in ("before","after"):
                for name,w,h,listed in VIEWPORTS:
                    pg = b.new_page(viewport={"width":w,"height":h})
                    pg.set_content(page(variant, header))
                    r = pg.evaluate("""() => {
                      const el = document.getElementById('panel').getBoundingClientRect();
                      const root = document.documentElement;
                      return {left:el.left,right:el.right,top:el.top,bottom:el.bottom,width:el.width,
                              cw:root.clientWidth, ch:root.clientHeight, sw:root.scrollWidth};
                    }""")
                    r.update(header=header, variant=variant, name=name, listed=listed, w=w, h=h)
                    r["off_left"] = r["left"] < -0.5
                    r["off_right"] = r["right"] > r["cw"] + 0.5 or r["sw"] > r["cw"]
                    r["off_bottom"] = r["bottom"] > r["ch"] + 0.5
                    out.append(r); pg.close()
        b.close()
    return out

if __name__ == "__main__":
    json.dump(run(), open("results.json","w"))
    print("measured", len(run.__code__.co_consts) and "ok")