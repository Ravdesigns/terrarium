#!/usr/bin/env python3
# Capture the REAL terrarium WebGL plant: inject a deterministic stripe.com DNA + force the
# plant fully grown inside the ES module, serve locally, screenshot with new-headless (WebGL).
import subprocess, time, os, tempfile, signal, sys
TD = "/Users/zop.dev/rav/terrarium"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
DN = subprocess.DEVNULL
ANGLE = float(sys.argv[1]) if len(sys.argv) > 1 else 0.0
OUT = sys.argv[2] if len(sys.argv) > 2 else "/Users/zop.dev/Linkedin Posts/terr-real-test.png"

html = open(TD + "/index.html", encoding="utf-8").read()
i = html.index('<script type="module">'); j = html.index('</script>', i)
inject = """
;(function(){try{
const dna={host:'stripe.com',title:'Stripe',description:'',themeColor:'#635bff',ogImage:'',
colors:[{hex:'#635bff',count:160},{hex:'#7a73ff',count:70},{hex:'#00d4ff',count:50},{hex:'#a960ee',count:40},{hex:'#11efe3',count:25},{hex:'#0a2540',count:90},{hex:'#ffffff',count:220}],
families:['sohne','sans-serif'],fontClass:'sans',tagCount:2600,linkCount:190,imgCount:64,scriptCount:30,https:true,ms:300,bytes:880000};
growFromDNA(dna);growing=false;plant.scale.set(fitScale,fitScale,fitScale);
try{controls.autoRotate=false;controls.update&&controls.update();}catch(e){}
try{plant.rotation.y=%ANGLE%;}catch(e){}
const s=document.getElementById('scrim');if(s){s.style.opacity='0';s.style.display='none';}
const d=document.getElementById('dna');if(d)d.classList.add('on');
const b=document.getElementById('bar');if(b)b.classList.add('on');
}catch(e){document.title='AUTOERR '+(e&&e.message);}})();
""".replace("%ANGLE%", str(ANGLE))
open(TD + "/_cap.html", "w", encoding="utf-8").write(html[:j] + inject + html[j:])

srv = subprocess.Popen(["python3", "-m", "http.server", "8402"], cwd=TD, stdout=DN, stderr=DN)
time.sleep(1.6)
try: os.remove(OUT)
except OSError: pass
prof = tempfile.mkdtemp(prefix="cc-terr-")
args = [CHROME, "--headless=new", "--hide-scrollbars", "--no-first-run", "--no-default-browser-check", "--mute-audio",
        "--ignore-gpu-blocklist", "--enable-webgl", "--enable-unsafe-swiftshader", f"--user-data-dir={prof}",
        "--force-device-scale-factor=2", "--window-size=1600,1000", f"--screenshot={OUT}", "http://localhost:8402/_cap.html"]
p = subprocess.Popen(args, stdout=DN, stderr=DN, start_new_session=True)
deadline = time.time() + 30; last = -1; st = 0
while time.time() < deadline:
    if p.poll() is not None: break
    if os.path.exists(OUT):
        sz = os.path.getsize(OUT); st = st + 1 if (sz > 0 and sz == last) else 0; last = sz
        if st >= 3: break
    time.sleep(0.5)
try: os.killpg(os.getpgid(p.pid), signal.SIGKILL)
except Exception: pass
try: srv.terminate()
except Exception: pass
print("ok" if (os.path.exists(OUT) and os.path.getsize(OUT) > 40000) else "FAIL/BLANK", os.path.getsize(OUT) if os.path.exists(OUT) else 0)
