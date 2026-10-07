# STRAYMUTANT.DEV — Tamak Bookshop
# Run from the project root:   python3 apply_notifications.py
# 1. Makes the three layouts also listen for notifications (and show a pop-up).
# 2. Puts the notification panels on the admin, vendor and client dashboards.
# Safe to run twice. Run apply_live_updates.py first if you haven't.
import re
from pathlib import Path

def load(path):
    p = Path(path)
    if not p.exists():
        return None, None, None
    raw = p.read_bytes().decode('utf-8')
    return p, '\r\n' in raw, raw.replace('\r\n', '\n')

def save(p, crlf, t):
    p.write_bytes((t.replace('\n', '\r\n') if crlf else t).encode('utf-8'))

def add_import(t, line):
    if line in t:
        return t
    last = list(re.finditer(r"^import .*;$", t, flags=re.M))[-1]
    return t[:last.end()] + '\n' + line + t[last.end():]

# ---- layouts -------------------------------------------------------------
TOAST_IMPORT = "import NotificationToasts from '@/components/notifications/NotificationToasts';"

def layout(path):
    p, crlf, t = load(path)
    if p is None:
        print(f"MISSING FILE   {path}"); return
    if 'LiveRefresh' not in t:
        print(f"NOT FOUND      {path}  (run apply_live_updates.py first)"); return
    if 'NotificationToasts' in t:
        print(f"ALREADY DONE   {path}"); return

    def add_table(m):
        inner = m.group(1)
        return m.group(0) if "'notifications'" in inner else m.group(0).replace(inner, inner + ", 'notifications'")
    t = re.sub(r"<LiveRefresh tables=\{\[(.*?)\]\} />", add_table, t)
    t = re.sub(r"^([ \t]*)(<LiveRefresh .*/>)$", r"\1\2\n\1<NotificationToasts />", t, flags=re.M)
    t = add_import(t, TOAST_IMPORT)
    save(p, crlf, t)
    print(f"OK             {path}")

layout('src/app/(admin)/layout.tsx')
layout('src/app/vendor/layout.tsx')
layout('src/app/account/layout.tsx')

# ---- dashboards ----------------------------------------------------------
N_IMPORT = "import NotificationsPanel from '@/components/notifications/NotificationsPanel';"
A_IMPORT = "import AttentionPanel from '@/components/notifications/AttentionPanel';"

def dashboard(path, with_attention):
    p, crlf, t = load(path)
    if p is None:
        print(f"MISSING FILE   {path}"); return
    if 'NotificationsPanel' in t:
        print(f"ALREADY DONE   {path}"); return
    m = re.search(r'^([ \t]*)<p className="mb-6 text-sm text-ink-muted">.*</p>$', t, flags=re.M)
    if not m:
        print(f"NOT FOUND      {path}  (add the panels under the page's intro line by hand)"); return
    ind = m.group(1)
    add = f"\n\n{ind}<NotificationsPanel />"
    if with_attention:
        add = f"\n\n{ind}<AttentionPanel />" + add
    t = t[:m.end()] + add + t[m.end():]
    t = add_import(t, N_IMPORT)
    if with_attention:
        t = add_import(t, A_IMPORT)
    save(p, crlf, t)
    print(f"OK             {path}")

dashboard('src/app/(admin)/admin/dashboard/page.tsx', True)
dashboard('src/app/vendor/dashboard/page.tsx', False)
dashboard('src/app/account/dashboard/page.tsx', False)

print()
print("Run migration 32 in Supabase, then restart `pnpm dev`.")