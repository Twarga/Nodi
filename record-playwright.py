#!/usr/bin/env /tmp/venv/bin/python3
"""
Nodi Screen Recorder using Playwright
Records a realistic demo of using the Nodi file manager.
"""
import subprocess
import time
import os
import signal
import sys
import tempfile

NODI_DIR = "/home/twarga/Nodi"
OUTPUT_PATH = f"{NODI_DIR}/landing-page/nodi-demo.mp4"
APP_URL = "http://localhost:7319/app/"
LOGIN_URL = "http://localhost:7319"

def wait_for_server(url="http://localhost:7319", timeout=30):
    import urllib.request
    start = time.time()
    while time.time() - start < timeout:
        try:
            urllib.request.urlopen(url, timeout=2)
            return True
        except Exception:
            time.sleep(0.5)
    return False

def create_sample_data():
    """Create realistic sample files for the demo."""
    print("→ Creating sample files...")
    base = f"{NODI_DIR}/nodi_files"
    for d in ["Documents", "Photos", "Videos", "Projects/Web", "Archive"]:
        os.makedirs(f"{base}/{d}", exist_ok=True)

    with open(f"{base}/Documents/README.md", "w") as f:
        f.write("# Project Notes\n\n- Review Q3 roadmap\n- Update deployment docs\n- Fix chunked upload edge case\n")
    with open(f"{base}/Documents/budget_2025.csv", "w") as f:
        f.write("Month,Revenue,Expenses\nJanuary,12500,8200\nFebruary,14200,8900\nMarch,13800,9100\n")
    with open(f"{base}/Projects/Web/index.html", "w") as f:
        f.write('<!DOCTYPE html>\n<html>\n<head><title>Demo</title></head>\n<body><h1>Hello Nodi</h1></body>\n</html>\n')
    with open(f"{base}/Projects/Web/styles.css", "w") as f:
        f.write('body { font-family: sans-serif; background: #fafbfc; color: #1e293b; }\n')
    with open(f"{base}/Archive/old_backup.sql", "w") as f:
        f.write("-- SQL backup dump\nCREATE TABLE users (id INT, name TEXT);\nINSERT INTO users VALUES (1, 'admin');\n")

    subprocess.run(
        f"convert -size 800x500 xc:none -fill '#22d3ee' -draw 'roundrectangle 0,0 800,500 20,20' "
        f"-fill '#0c0e14' -pointsize 32 -gravity center -annotate +0+0 'Screenshot 01\\n800 x 500' "
        f"'{base}/Photos/screenshot_01.png'",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        f"convert -size 800x500 xc:none -fill '#1e293b' -draw 'roundrectangle 0,0 800,500 20,20' "
        f"-fill '#22d3ee' -pointsize 28 -gravity center -annotate +0+0 'Dashboard Preview' "
        f"'{base}/Photos/dashboard.png'",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        f"convert -size 600x400 xc:none -fill '#0f172a' -draw 'roundrectangle 0,0 600,400 16,16' "
        f"-fill '#e2e8f0' -pointsize 24 -gravity center -annotate +0+0 'Wireframe v2' "
        f"'{base}/Photos/wireframe.png'",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        f"ffmpeg -y -f lavfi -i 'color=c=#0c0e14:s=960x540:d=4' "
        f"-vf \"drawtext=text='Nodi Intro':fontsize=40:fontcolor=#22d3ee:x=(w-text_w)/2:y=(h-text_h)/2\" "
        f"-c:v libx264 -preset fast -crf 26 -an -shortest '{base}/Videos/intro.mp4'",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        f"ffmpeg -y -f lavfi -i 'color=c=#1e293b:s=960x540:d=3' "
        f"-vf \"drawtext=text='Tutorial':fontsize=36:fontcolor=#e2e8f0:x=(w-text_w)/2:y=(h-text_h)/2\" "
        f"-c:v libx264 -preset fast -crf 26 -an -shortest '{base}/Videos/tutorial.mp4'",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print("→ Sample files ready.")

def main():
    create_sample_data()

    print("→ Starting Nodi server...")
    env = os.environ.copy()
    env["QL_USER"] = "admin"
    env["QL_PASS_HASH"] = "$2b$10$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy"
    env["QL_COOKIE_SECRET"] = "demo-secret-key-that-is-long-enough-for-nodi-42"
    env["QL_ROOT"] = "./nodi_files"
    env["QL_THEME"] = "system"

    nodi_proc = subprocess.Popen("go run ./cmd/server", shell=True, cwd=NODI_DIR, env=env,
                                  stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)

    if not wait_for_server():
        print("ERROR: Nodi failed to start")
        nodi_proc.terminate()
        try:
            out, _ = nodi_proc.communicate(timeout=5)
            print("Server output:", out[-2000:])
        except Exception:
            pass
        sys.exit(1)
    print("→ Nodi running on http://localhost:7319")

    # Create temp file for upload demo
    upload_file = tempfile.NamedTemporaryFile(mode='w', suffix='.txt', delete=False)
    upload_file.write("Hello from Nodi!\nThis file was uploaded during the demo.\n")
    upload_file.close()

    print("→ Starting browser recording...")
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=[
            "--no-sandbox", "--disable-setuid-sandbox",
            "--disable-dev-shm-usage", "--disable-gpu",
            "--window-size=1920,1080",
        ])
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir="/tmp/nodi-videos",
            record_video_size={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        def wait(t=1.0):
            time.sleep(t)

        def goto_app():
            page.goto(APP_URL)
            wait(1.5)

        # ─── Scene 1: Login ───
        print("  → Recording: Login page")
        page.goto(LOGIN_URL)
        wait(2.5)
        page.locator('input[type="text"]').first.fill("admin")
        wait(0.4)
        page.locator('input[type="password"]').first.fill("admin")
        wait(0.4)
        page.get_by_role("button", name="Sign in").click()
        wait(2.5)

        # ─── Scene 2: Root dashboard ───
        print("  → Recording: Root dashboard")
        wait(1.5)

        # ─── Scene 3: Documents ───
        print("  → Recording: Browse Documents")
        page.get_by_text("Documents", exact=False).first.click()
        wait(2)
        goto_app()

        # ─── Scene 4: Photos ───
        print("  → Recording: Browse Photos")
        page.get_by_text("Photos", exact=False).first.click()
        wait(2.5)
        goto_app()

        # ─── Scene 5: Videos ───
        print("  → Recording: Browse Videos")
        page.get_by_text("Videos", exact=False).first.click()
        wait(2.5)
        goto_app()

        # ─── Scene 6: View modes ───
        print("  → Recording: List view")
        page.get_by_title("List view").click()
        wait(1.5)
        page.get_by_title("Grid view").click()
        wait(1.5)

        # ─── Scene 7: Upload ───
        print("  → Recording: Upload file")
        page.get_by_role("button", name="Upload").first.click()
        wait(0.5)
        page.set_input_files('input[aria-label="Upload files"]', upload_file.name)
        wait(3)

        # ─── Scene 8: New Folder ───
        print("  → Recording: Create folder")
        page.get_by_role("button", name="New Folder").first.click()
        wait(1.5)
        page.locator('input[placeholder="Folder name"]').first.fill("My New Folder")
        wait(0.5)
        page.get_by_role("button", name="Create").first.click()
        wait(2.5)

        # ─── Scene 9: Open new folder ───
        print("  → Recording: Open new folder")
        page.get_by_text("My New Folder", exact=False).first.click()
        wait(2)
        goto_app()

        # ─── Scene 10: Search ───
        print("  → Recording: Search")
        page.get_by_role("button", name="Search").first.click()
        wait(0.5)
        page.locator('input[placeholder="Search files..."]').first.fill("screen")
        wait(2)
        page.locator('input[placeholder="Search files..."]').first.fill("")
        wait(0.5)
        page.keyboard.press("Escape")
        wait(1)

        # ─── Scene 11: Projects → Web ───
        print("  → Recording: Browse Projects/Web")
        page.get_by_text("Projects", exact=False).first.click()
        wait(1.5)
        page.get_by_text("Web", exact=False).first.click()
        wait(2)
        goto_app()

        # ─── Scene 12: Final overview ───
        print("  → Recording: Final overview")
        page.mouse.wheel(0, 200)
        wait(1)
        page.mouse.wheel(0, -200)
        wait(2)

        # Close
        print("→ Closing browser...")
        context.close()
        browser.close()

        video_path = page.video.path()
        print(f"→ Raw video: {video_path}")

        # Convert to MP4
        print("→ Converting to MP4...")
        result = subprocess.run(
            f"ffmpeg -y -i '{video_path}' -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p "
            f"-movflags +faststart -vf 'fps=30,scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black' "
            f"'{OUTPUT_PATH}'",
            shell=True, capture_output=True, text=True,
        )
        if result.returncode != 0:
            print(f"FFmpeg primary failed, trying fallback...")
            subprocess.run(
                f"ffmpeg -y -i '{video_path}' -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p "
                f"-movflags +faststart '{OUTPUT_PATH}'",
                shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )

    # Stop Nodi
    print("→ Stopping Nodi...")
    nodi_proc.send_signal(signal.SIGINT)
    try:
        nodi_proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        nodi_proc.kill()

    os.unlink(upload_file.name)

    if os.path.exists(OUTPUT_PATH) and os.path.getsize(OUTPUT_PATH) > 1000:
        size = subprocess.run(["du", "-sh", OUTPUT_PATH], capture_output=True, text=True).stdout.split()[0]
        print(f"\n✅ Demo video saved!")
        print(f"   File: {OUTPUT_PATH}")
        print(f"   Size: {size}")
    else:
        print("\n❌ Failed to create video")
        sys.exit(1)

if __name__ == "__main__":
    main()
