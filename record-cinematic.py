#!/usr/bin/env /tmp/venv/bin/python3
"""
Nodi Professional Trailer — Cinematic Quality
Smooth easing, color grading, text callouts, zoom effects.
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
    print("→ Creating sample data...")
    base = f"{NODI_DIR}/nodi_files"
    for d in ["Documents", "Photos", "Videos", "Projects/Web", "Archive", "Designs"]:
        os.makedirs(f"{base}/{d}", exist_ok=True)

    with open(f"{base}/Documents/README.md", "w") as f:
        f.write("# Project Roadmap Q3\n\n- [x] Chunked uploads\n- [x] Session management\n- [ ] Share links v2\n")
    with open(f"{base}/Documents/budget_2025.csv", "w") as f:
        f.write("Month,Revenue,Expenses,Profit\nJanuary,12500,8200,4300\nFebruary,14200,8900,5300\n")
    with open(f"{base}/Projects/Web/index.html", "w") as f:
        f.write('<!DOCTYPE html>\n<html lang="en">\n<head><meta charset="UTF-8"><title>Nodi</title></head>\n<body><h1>Hello Nodi</h1></body>\n</html>\n')

    subprocess.run(
        f"convert -size 1400x900 xc:none -fill '#0c0e14' -draw 'roundrectangle 0,0 1400,900 28,28' "
        f"-fill '#22d3ee' -pointsize 56 -gravity center -annotate +0+0 'Nodi Dashboard' "
        f"-fill '#64748b' -pointsize 22 -gravity center -annotate +0+80 'Dark Mode' "
        f"'{base}/Photos/dashboard_dark.png'",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        f"convert -size 1200x800 xc:none -fill '#1e293b' -draw 'roundrectangle 0,0 1200,800 24,24' "
        f"-fill '#22d3ee' -pointsize 48 -gravity center -annotate +0+0 'Screenshot' "
        f"'{base}/Photos/screenshot_01.png'",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        f"convert -size 900x700 xc:none -fill '#fafbfc' -draw 'roundrectangle 0,0 900,700 20,20' "
        f"-fill '#1e293b' -pointsize 28 -gravity center -annotate +0+0 'Design' "
        f"'{base}/Designs/mockup_01.png'",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    subprocess.run(
        f"ffmpeg -y -f lavfi -i 'color=c=#0c0e14:s=1280x720:d=6' "
        f"-vf \"drawtext=text='Nodi Intro':fontsize=52:fontcolor=#22d3ee:x=(w-text_w)/2:y=(h-text_h)/2\" "
        f"-c:v libx264 -preset fast -crf 22 -an -shortest '{base}/Videos/intro.mp4'",
        shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    print("→ Sample data ready.")


def lerp(a, b, t):
    return a + (b - a) * t


def ease_out(t):
    return 1 - (1 - t) ** 3


def smooth_move(page, x, y, dur=0.8):
    steps = max(int(dur * 60), 1)
    for i in range(steps + 1):
        t = ease_out(i / steps)
        page.mouse.move(lerp(960, x, t), lerp(540, y, t))
        time.sleep(dur / steps)


def main():
    create_sample_data()

    print("→ Starting Nodi server...")
    env = os.environ.copy()
    env.update({
        "QL_USER": "admin",
        "QL_PASS_HASH": "$2b$10$giD/vH5ZWt26q8GEN0PdZejq/ZdpxdMci5bK4U2fnLHj1mfqZXmCy",
        "QL_COOKIE_SECRET": "demo-secret-key-that-is-long-enough-for-nodi-42",
        "QL_ROOT": "./nodi_files",
        "QL_THEME": "system",
    })

    nodi_proc = subprocess.Popen("go run ./cmd/server", shell=True, cwd=NODI_DIR, env=env,
                                  stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    if not wait_for_server():
        print("ERROR: Nodi failed to start")
        nodi_proc.kill()
        sys.exit(1)
    print("→ Nodi running")

    upload_file = tempfile.NamedTemporaryFile(mode='w', suffix='.md', delete=False)
    upload_file.write("# Hello Nodi\n\nProfessional demo file.\n\n- Fast uploads\n- Chunked transfers\n")
    upload_file.close()

    print("→ Recording cinematic trailer...")
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=[
            "--no-sandbox", "--disable-setuid-sandbox",
            "--disable-dev-shm-usage", "--disable-gpu",
            "--window-size=1920,1080",
        ])
        context = browser.new_context(
            viewport={"width": 1920, "height": 1080},
            record_video_dir="/tmp/nodi-trailer",
            record_video_size={"width": 1920, "height": 1080},
        )
        page = context.new_page()

        def w(t=1.0):
            time.sleep(t)

        # === ACT 1: LOGIN ===
        print("  → Act 1: Login")
        page.goto(LOGIN_URL)
        w(3)
        smooth_move(page, 800, 520, 1.0)
        w(0.3)
        page.click('input[type="text"]')
        page.type('input[type="text"]', "admin", delay=100)
        w(0.4)
        smooth_move(page, 800, 590, 0.6)
        w(0.3)
        page.click('input[type="password"]')
        page.type('input[type="password"]', "admin", delay=100)
        w(0.6)
        smooth_move(page, 960, 670, 0.7)
        w(0.3)
        page.get_by_role("button", name="Sign in").click()
        w(4)

        # === ACT 2: DASHBOARD PAN ===
        print("  → Act 2: Dashboard")
        w(3)
        smooth_move(page, 400, 320, 1.0)
        w(0.5)
        smooth_move(page, 1500, 320, 1.5)
        w(2.5)

        # === ACT 3: DOCUMENTS ===
        print("  → Act 3: Documents")
        smooth_move(page, 500, 500, 1.0)
        w(0.3)
        page.get_by_text("Documents", exact=False).first.click()
        w(2.5)
        smooth_move(page, 500, 420, 0.7)
        w(0.3)
        page.get_by_text("README.md", exact=False).first.click()
        w(3)
        page.keyboard.press("Escape")
        w(1)
        page.goto(APP_URL)
        w(2)

        # === ACT 4: PHOTOS ===
        print("  → Act 4: Photos")
        smooth_move(page, 960, 500, 1.0)
        w(0.3)
        page.get_by_text("Photos", exact=False).first.click()
        w(2.5)
        smooth_move(page, 1780, 280, 0.8)
        w(0.3)
        page.get_by_title("Grid view").click()
        w(2)
        smooth_move(page, 600, 480, 0.7)
        w(0.3)
        page.get_by_text("dashboard_dark.png", exact=False).first.click()
        w(3.5)
        page.keyboard.press("Escape")
        w(1)
        page.goto(APP_URL)
        w(2)

        # === ACT 5: UPLOAD ===
        print("  → Act 5: Upload")
        smooth_move(page, 1780, 280, 0.8)
        w(0.3)
        page.get_by_role("button", name="Upload").first.click()
        w(0.5)
        page.set_input_files('input[aria-label="Upload files"]', upload_file.name)
        w(5)

        # === ACT 6: NEW FOLDER ===
        print("  → Act 6: New Folder")
        smooth_move(page, 1700, 280, 0.7)
        w(0.3)
        page.get_by_role("button", name="New Folder").first.click()
        w(1.5)
        page.locator('input[placeholder="Folder name"]').first.fill("New Project")
        w(0.5)
        page.get_by_role("button", name="Create").first.click()
        w(3)
        smooth_move(page, 600, 480, 0.7)
        w(0.3)
        page.get_by_text("New Project", exact=False).first.click()
        w(2)
        page.goto(APP_URL)
        w(2)

        # === ACT 7: SEARCH ===
        print("  → Act 7: Search")
        smooth_move(page, 1720, 280, 0.7)
        w(0.3)
        page.get_by_role("button", name="Search").first.click()
        w(0.5)
        page.locator('input[placeholder="Search files..."]').first.type("screen", delay=80)
        w(2.5)
        page.locator('input[placeholder="Search files..."]').first.fill("")
        w(0.5)
        page.keyboard.press("Escape")
        w(1.5)

        # === ACT 8: PROJECTS ===
        print("  → Act 8: Projects")
        smooth_move(page, 600, 650, 0.9)
        w(0.3)
        page.get_by_text("Projects", exact=False).first.click()
        w(2)
        smooth_move(page, 600, 480, 0.7)
        w(0.3)
        page.get_by_text("Web", exact=False).first.click()
        w(2.5)
        page.goto(APP_URL)
        w(2)

        # === ACT 9: LIST VIEW ===
        print("  → Act 9: List view")
        smooth_move(page, 1780, 280, 0.7)
        w(0.3)
        page.get_by_title("List view").click()
        w(2)
        smooth_move(page, 1700, 280, 0.5)
        w(0.3)
        page.locator('select').first.select_option("size")
        w(2)
        page.locator('select').first.select_option("name")
        w(2)
        page.get_by_title("Grid view").click()
        w(2)

        # === ACT 10: FINALE ===
        print("  → Act 10: Finale")
        smooth_move(page, 960, 600, 1.0)
        for _ in range(25):
            page.mouse.wheel(0, 12)
            time.sleep(0.04)
        w(2)
        for _ in range(25):
            page.mouse.wheel(0, -12)
            time.sleep(0.04)
        w(5)

        print("→ Closing browser...")
        context.close()
        browser.close()

        video_path = page.video.path()
        print(f"→ Raw: {video_path}")

        # ============================================================
        # POST-PROCESSING
        # ============================================================
        print("→ Post-processing...")

        # Step 1: Convert to MP4
        print("  → Converting to MP4")
        subprocess.run(
            f"ffmpeg -y -i '{video_path}' -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p "
            f"-movflags +faststart '/tmp/t_s1.mp4'",
            shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        # Step 2: Get duration
        probe = subprocess.run(
            "ffprobe -v error -show_entries format=duration -of csv=p=0 /tmp/t_s1.mp4",
            shell=True, capture_output=True, text=True
        )
        duration = float(probe.stdout.strip())

        # Step 3: Create text callout overlay images with timing
        print("  → Creating text callouts")
        callouts = [
            (2, 5, "Self-hosted file manager"),
            (12, 15, "Browse with ease"),
            (22, 25, "Grid & List views"),
            (32, 35, "Fast uploads"),
            (42, 45, "Create folders instantly"),
            (52, 55, "Search everything"),
            (62, 65, "Your files. Your server."),
        ]

        # Generate overlay images for each callout
        overlay_inputs = []
        for i, (start, end, text) in enumerate(callouts):
            # Create transparent PNG with text
            safe_text = text.replace("'", "\\'")
            subprocess.run(
                f"convert -size 1920x1080 xc:none "
                f"-fill 'rgba(12,14,20,0.75)' -draw 'roundrectangle 60,940 800,1010 12,12' "
                f"-fill '#22d3ee' -pointsize 28 -gravity west -annotate +80+975 '{safe_text}' "
                f"'/tmp/callout_{i}.png'",
                shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            )
            overlay_inputs.append(f"-i /tmp/callout_{i}.png")

        # Step 4: Build complex overlay filter
        print("  → Compositing callouts")
        filter_parts = ["[0:v]copy[v0]"]
        for i in range(len(callouts)):
            start, end, _ = callouts[i]
            # Fade in/out: opacity 0->1 over 0.5s, hold, then 1->0
            fade_in_start = start
            fade_in_dur = 0.5
            fade_out_start = end - 0.5
            fade_out_dur = 0.5
            
            filter_parts.append(
                f"[{i+1}:v]fade=t=in:st={fade_in_start}:d={fade_in_dur}:alpha=1,"
                f"fade=t=out:st={fade_out_start}:d={fade_out_dur}:alpha=1[ov{i}]"
            )
        
        # Chain overlays
        current = "v0"
        for i in range(len(callouts)):
            filter_parts.append(f"[{current}][ov{i}]overlay=0:0:format=auto[v{i+1}]")
            current = f"v{i+1}"
        
        filter_parts.append(f"[{current}]eq=brightness=0.01:contrast=1.03:saturation=1.06,unsharp=3:3:0.5:3:3:0.2[vfinal]")
        
        filter_complex = ";".join(filter_parts)
        inputs = " ".join(overlay_inputs)
        
        subprocess.run(
            f"ffmpeg -y -i /tmp/t_s1.mp4 {inputs} "
            f"-filter_complex '{filter_complex}' "
            f"-map '[vfinal]' -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p "
            f"-movflags +faststart '/tmp/t_s2.mp4'",
            shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        # Step 5: Final output
        print("  → Final render")
        subprocess.run(
            f"ffmpeg -y -i /tmp/t_s2.mp4 -c:v libx264 -preset slow -crf 18 "
            f"-pix_fmt yuv420p -movflags +faststart '{OUTPUT_PATH}'",
            shell=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )

        # Cleanup
        for f in ["/tmp/t_s1.mp4", "/tmp/t_s2.mp4"]:
            if os.path.exists(f):
                os.remove(f)
        for i in range(len(callouts)):
            f = f"/tmp/callout_{i}.png"
            if os.path.exists(f):
                os.remove(f)

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
        dur = subprocess.run(
            f"ffprobe -v error -show_entries format=duration -of csv=p=0 '{OUTPUT_PATH}'",
            shell=True, capture_output=True, text=True
        ).stdout.strip()
        print(f"\n✅ Cinematic trailer saved!")
        print(f"   File: {OUTPUT_PATH}")
        print(f"   Size: {size}")
        print(f"   Duration: {float(dur):.1f}s")
    else:
        print("\n❌ Failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
