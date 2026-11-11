"""Builds dist/preview.html: the whole app in one file (CSS + JS inlined, no service worker or manifest).
Handy for sharing a quick look. The real install path is www/ (PWA) or the APK."""
import pathlib, re

root = pathlib.Path(__file__).resolve().parent.parent
www = root / "www"
html = (www / "index.html").read_text(encoding="utf-8")
css = (www / "styles.css").read_text(encoding="utf-8")
scripts = re.findall(r'<script src="(js/[^"]+)"></script>', html)
js = "\n".join((www / s).read_text(encoding="utf-8") for s in scripts)
assert "</script" not in js.lower(), "a script contains a closing script tag"
out = f"""<title>Daily Outfit</title>
<style>
{css}
</style>
<div id="app" aria-live="polite"></div>
<div id="sheet-root"></div>
<div id="dialog-root"></div>
<div id="toast" role="status"></div>
<script>
{js}
</script>
"""
dist = root / "dist"
dist.mkdir(exist_ok=True)
(dist / "preview.html").write_text(out, encoding="utf-8")
print("wrote", dist / "preview.html", len(out) // 1024, "KB;", len(scripts), "scripts")
