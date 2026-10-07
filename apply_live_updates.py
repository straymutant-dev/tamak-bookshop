# STRAYMUTANT.DEV — Tamak Bookshop
# Run from the project root:   python3 apply_live_updates.py
# Adds the live-update listener to the admin, vendor and account layouts.
# Safe to run twice.
import re
from pathlib import Path

IMPORT = "import LiveRefresh from '@/components/ui/LiveRefresh';"

def patch(path, tables):
    p = Path(path)
    if not p.exists():
        print(f"MISSING FILE   {path}")
        return
    raw = p.read_bytes().decode('utf-8')
    crlf = '\r\n' in raw
    t = raw.replace('\r\n', '\n')
    if 'LiveRefresh' in t:
        print(f"ALREADY DONE   {path}")
        return
    imports = list(re.finditer(r"^import .*;$", t, flags=re.M))
    mains = list(re.finditer(r"^([ \t]*)<main", t, flags=re.M))
    if not imports or not mains:
        print(f"NOT FOUND      {path}  (add <LiveRefresh tables={{{tables}}} /> before <main> by hand)")
        return
    tag = f"<LiveRefresh tables={{{tables}}} />"
    # insert from the bottom up so earlier positions stay valid
    for m in reversed(mains):
        t = t[:m.start()] + f"{m.group(1)}{tag}\n" + t[m.start():]
    last = list(re.finditer(r"^import .*;$", t, flags=re.M))[-1]
    t = t[:last.end()] + '\n' + IMPORT + t[last.end():]
    p.write_bytes((t.replace('\n', '\r\n') if crlf else t).encode('utf-8'))
    print(f"OK             {path}")

ADMIN = "['orders', 'profiles', 'books', 'repayment_requests', 'credit_repayments', 'audit_logs']"
CUSTOMER = "['orders', 'profiles', 'repayment_requests', 'credit_repayments']"

patch('src/app/(admin)/layout.tsx', ADMIN)
patch('src/app/vendor/layout.tsx', CUSTOMER)
patch('src/app/account/layout.tsx', CUSTOMER)
print()
print("Then run migration 31 in Supabase and restart `pnpm dev`.")