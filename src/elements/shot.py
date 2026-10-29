"""لقطة شاشة لصفحة معاينة: python3 src/elements/shot.py <in.html> <out.png> [width]"""
import sys, asyncio, pathlib
from playwright.async_api import async_playwright
async def main(src, out, width="1400"):
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1243/chrome-linux64/chrome")
        pg = await b.new_page(viewport={"width": int(width), "height": 800})
        await pg.goto(pathlib.Path(src).resolve().as_uri())
        await pg.wait_for_timeout(300)
        await pg.screenshot(path=out, full_page=True)
        await b.close()
asyncio.run(main(*sys.argv[1:]))
