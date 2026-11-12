"""Adds the Android permissions the app needs to the Capacitor-generated manifest.
Run after `npx cap add android`. Safe to run twice."""
import pathlib, sys

PERMS = [
    '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',   # weather (approximate location is enough)
    '<uses-permission android:name="android.permission.CAMERA" />',                   # photographing clothes
    '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.location" android:required="false" />',
]

def patch(path: pathlib.Path) -> int:
    text = path.read_text(encoding="utf-8")
    added = 0
    for line in PERMS:
        key = line.split('android:name="')[1].split('"')[0]
        if key in text:
            continue
        text = text.replace("</manifest>", f"    {line}\n</manifest>")
        added += 1
    path.write_text(text, encoding="utf-8")
    return added

if __name__ == "__main__":
    p = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else "android/app/src/main/AndroidManifest.xml")
    if not p.exists():
        sys.exit(f"{p} not found. Run `npx cap add android` first.")
    print(f"added {patch(p)} manifest entries")
