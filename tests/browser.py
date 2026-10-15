from pathlib import Path
import argparse
import json
from urllib.parse import urlparse, urljoin
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--url", default="http://127.0.0.1:4371")
args = parser.parse_args()
ROOT = Path(__file__).resolve().parents[1]
ARTIFACTS = ROOT / "verification"
ARTIFACTS.mkdir(exist_ok=True)
origin = args.url.rstrip("/")
assert urlparse(origin).hostname in ("127.0.0.1", "localhost"), "Local preview only"
report = {"viewports": [], "accessibility": [], "browserErrors": [], "externalRequests": []}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900}, reduced_motion="reduce")
    page = context.new_page()
    page.on("pageerror", lambda error: report["browserErrors"].append(str(error)))
    page.on("request", lambda request: report["externalRequests"].append(request.url)
            if urlparse(request.url).scheme in ("http", "https") and not request.url.startswith(origin + "/") else None)
    try:
        page.goto(origin, wait_until="networkidle")
        page.evaluate("() => document.fonts.ready")
        assert page.locator("h1").count() == 1
        assert "Strasbourg" in page.locator("h1").inner_text()
        assert page.locator('[data-gallery-index]').count() == 23
        schema = page.locator('script[type="application/ld+json"]').text_content()
        nodes = json.loads(schema)["@graph"]
        assert next(node for node in nodes if node["@type"] == "Offer")["price"] == 630000
        assert next(node for node in nodes if node["@type"] == "Apartment")["floorSize"]["value"] == 92.35
        assert page.locator('meta[name="robots"]').get_attribute("content") == "noindex,nofollow"
        assert page.locator('link[rel="canonical"]').count() == 0
        assert page.locator('form').count() == 0
        assert page.locator('a[href^="tel:"], a[href^="mailto:"]').count() == 0
        assert page.locator("#contact button:disabled").count() == 2
        assert page.locator('[fetchpriority="high"]').count() == 1
        original_downloads = page.evaluate("""() => {
            const originals = new Set([...document.querySelectorAll('[data-gallery-index]')].map(a => a.href));
            return performance.getEntriesByType('resource').filter(entry => originals.has(entry.name)).length;
        }""")
        assert original_downloads == 0, "Full-size images must load only after deliberate gallery use"
        report["initialFullSizePhotoDownloads"] = original_downloads

        for width, height in [(320, 844), (360, 844), (390, 844), (768, 900), (1024, 900), (1440, 900)]:
            print(f"Viewport {width}x{height}", flush=True)
            page.set_viewport_size({"width": width, "height": height})
            page.evaluate("window.scrollTo(0, 0)")
            page.wait_for_load_state("networkidle")
            page.evaluate("() => document.fonts.ready")
            page.wait_for_function("""() =>
                [...document.images].filter(image => {
                    const bounds = image.getBoundingClientRect();
                    return bounds.top < innerHeight && bounds.bottom > 0 && bounds.width > 0;
                }).every(image => image.complete && image.naturalWidth > 0)
            """)
            overflow = page.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            assert overflow <= 1, f"Horizontal overflow at {width}: {overflow}px"
            hero = page.locator(".hero-visual > figure img").bounding_box()
            assert hero and hero["y"] + hero["height"] <= height, f"Hero below fold at {width}: {hero}"
            assert page.locator(".nav-contact").is_visible()
            report["viewports"].append({"width": width, "height": height, "overflow": overflow, "hero": hero})
            if width in (390, 1440):
                page.screenshot(path=str(ARTIFACTS / f"accueil-{width}.png"))
                page.screenshot(path=str(ARTIFACTS / f"page-complete-{width}.png"), full_page=True)
                page.add_script_tag(path=str(ROOT / "node_modules/axe-core/axe.min.js"))
                result = page.evaluate("""async () => await axe.run(document, {
                  runOnly: {type:'tag', values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}
                })""")
                violations = [{"id": v["id"], "impact": v["impact"], "nodes": [node["target"] for node in v["nodes"]]}
                              for v in result["violations"]]
                report["accessibility"].append({"width": width, "violations": violations})

        print("Gallery keyboard and focus", flush=True)
        page.set_viewport_size({"width": 1440, "height": 900})
        page.locator('a[data-photo="14"]').first.click()
        dialog = page.locator("#photo-viewer")
        assert dialog.is_visible()
        page.wait_for_function("document.querySelector('#viewer-image').complete && document.querySelector('#viewer-image').naturalWidth > 0")
        assert page.locator("#viewer-position").inner_text() == "Photo 1 sur 23"
        page.keyboard.press("ArrowRight")
        assert page.locator("#viewer-position").inner_text() == "Photo 2 sur 23"
        page.keyboard.press("ArrowLeft")
        page.keyboard.press("ArrowLeft")
        assert page.locator("#viewer-position").inner_text() == "Photo 23 sur 23"
        page.get_by_role("button", name="Photo suivante", exact=True).click()
        assert page.locator("#viewer-position").inner_text() == "Photo 1 sur 23"
        for _ in range(6):
            page.keyboard.press("Tab")
            assert page.evaluate("document.querySelector('#photo-viewer').contains(document.activeElement)")
        for _ in range(6):
            page.keyboard.press("Shift+Tab")
            assert page.evaluate("document.querySelector('#photo-viewer').contains(document.activeElement)")
        page.keyboard.press("Escape")
        assert not dialog.is_visible()
        assert page.evaluate("document.activeElement.dataset.photo") == "14"
        page.locator(".more-photos summary").click()
        assert page.locator('.more-photos[open]').count() == 1
        assert page.locator('[data-gallery-index="22"]').is_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        photo_links = page.locator("[data-gallery-index]").evaluate_all("(links) => links.map(link => link.href)")
        assert len(set(photo_links)) == 23
        for url in photo_links:
            response = context.request.get(url)
            assert response.status == 200, url
            assert response.headers["content-type"].startswith("image/jpeg"), url

        print("Internal links and all 23 images", flush=True)
        internal_links = {}
        for route in ("/", "/mentions-legales/", "/confidentialite/"):
            page.goto(origin + route, wait_until="networkidle")
            for href in page.locator("a[href]").evaluate_all("(links) => links.map(link => link.href)"):
                parts = urlparse(href)
                if parts.netloc == urlparse(origin).netloc and parts.scheme in ("http", "https"):
                    path = parts.path
                    internal_links.setdefault(path, set())
                    if parts.fragment:
                        internal_links[path].add(parts.fragment)
        for path, anchors in internal_links.items():
            url = urljoin(origin, path)
            response = context.request.get(url)
            assert response.status == 200, (url, response.status)
            if anchors:
                page.goto(url, wait_until="networkidle")
                for anchor in anchors:
                    assert page.locator(f'[id="{anchor}"]').count() == 1, (url, anchor)
        report["internalLinks"] = len(internal_links)
        page.goto(origin, wait_until="networkidle")

        print("Local map variants", flush=True)
        page.locator("#quartier").scroll_into_view_if_needed()
        page.wait_for_function("document.querySelector('#quartier img').complete && document.querySelector('#quartier img').naturalWidth > 0")
        assert "/maps/quartier-jacques-kable.svg" in page.locator("#quartier img").evaluate("(image) => image.currentSrc")
        assert page.locator("#quartier a").first.get_attribute("href") == "https://www.openstreetmap.org/#map=15/48.5932/7.7530"
        page.locator("#quartier").screenshot(path=str(ARTIFACTS / "quartier-bureau.png"))
        page.set_viewport_size({"width": 390, "height": 844})
        page.locator("#quartier").scroll_into_view_if_needed()
        page.wait_for_function("""() => {
            const image = document.querySelector('#quartier img');
            return image.complete && image.naturalWidth > 0 && image.currentSrc.includes('quartier-jacques-kable-mobile.svg');
        }""")
        assert "quartier-jacques-kable-mobile.svg" in page.locator("#quartier img").evaluate("(image) => image.currentSrc")
        page.locator("#quartier").screenshot(path=str(ARTIFACTS / "quartier-mobile.png"))

        print("Legal pages and crawler instructions", flush=True)
        for route in ("/mentions-legales/", "/confidentialite/", "/404/"):
            response = page.goto(origin + route, wait_until="networkidle")
            assert response and response.status in (200, 404)
            assert page.locator("h1").count() == 1
            assert page.locator('html').get_attribute('lang') == 'fr'
            assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        assert "Disallow: /" in context.request.get(origin + "/robots.txt").text()
        assert "<url>" not in context.request.get(origin + "/sitemap.xml").text()

        print("Fallback without JavaScript", flush=True)
        no_js = browser.new_context(java_script_enabled=False, viewport={"width": 390, "height": 844})
        no_js_page = no_js.new_page()
        no_js_page.goto(origin, wait_until="networkidle")
        no_js_page.locator(".more-photos summary").click()
        assert no_js_page.locator("[data-gallery-index]").count() == 23
        assert no_js_page.locator('[data-gallery-index="22"]').is_visible()
        fallback = no_js_page.locator('a[data-photo="14"]').first
        original_url = fallback.evaluate("(anchor) => anchor.href")
        fallback.click()
        no_js_page.wait_for_url(original_url)
        assert no_js_page.url.endswith(".jpg")
        no_js_page.go_back(wait_until="networkidle")
        assert no_js_page.locator("h1").count() == 1
        no_js.close()
        report["noJavaScriptFallback"] = True

        print("Mobile touch gallery", flush=True)
        touch = browser.new_context(viewport={"width": 390, "height": 844}, has_touch=True)
        touch_page = touch.new_page()
        touch_page.goto(origin, wait_until="networkidle")
        touch_page.locator('a[data-photo="14"]').first.tap()
        assert touch_page.locator("#photo-viewer").is_visible()
        touch_page.get_by_role("button", name="Photo suivante", exact=True).tap()
        assert touch_page.locator("#viewer-position").inner_text() == "Photo 2 sur 23"
        touch_page.get_by_role("button", name="Photo précédente", exact=True).tap()
        assert touch_page.locator("#viewer-position").inner_text() == "Photo 1 sur 23"
        touch_page.wait_for_function("document.querySelector('#viewer-image').complete && document.querySelector('#viewer-image').naturalWidth > 0")
        assert touch_page.locator("#photo-viewer").evaluate("(dialog) => dialog.scrollWidth <= dialog.clientWidth + 1")
        touch_page.screenshot(path=str(ARTIFACTS / "galerie-mobile.png"))
        touch_page.get_by_role("button", name="Fermer la galerie", exact=True).tap()
        assert not touch_page.locator("#photo-viewer").is_visible()
        touch.close()
        report["galleryTouch"] = True

        print("Zoom 200%", flush=True)
        page.goto(origin, wait_until="networkidle")
        page.set_viewport_size({"width": 1440, "height": 900})
        page.evaluate("document.documentElement.style.zoom = '2'")
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), "Overflow at CSS zoom 200%"
        assert page.locator(".nav-contact").is_visible()
        page.screenshot(path=str(ARTIFACTS / "zoom-css-200.png"))
        page.evaluate("document.documentElement.style.zoom = '1'")
        zoom = browser.new_context(viewport={"width": 720, "height": 450}, device_scale_factor=2)
        zoom_page = zoom.new_page()
        zoom_page.goto(origin, wait_until="networkidle")
        assert zoom_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
        zoom_page.locator(".mobile-menu summary").click()
        assert zoom_page.get_by_role("link", name="Carte du quartier", exact=True).is_visible()
        zoom_page.screenshot(path=str(ARTIFACTS / "zoom-200-equivalent.png"))
        zoom.close()
        report["zoom200Percent"] = "CSS zoom 2 + equivalent 720x450 CSS viewport at device scale factor 2"
        report["galleryKeyboardAndFocus"] = True
        assert not report["browserErrors"], report["browserErrors"]
        assert not report["externalRequests"], report["externalRequests"]
    finally:
        (ARTIFACTS / "browser-report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
        browser.close()

assert all(not item["violations"] for item in report["accessibility"]), report["accessibility"]
print(json.dumps(report, ensure_ascii=True, indent=2))
