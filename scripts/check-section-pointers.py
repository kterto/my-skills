#!/usr/bin/env python3
"""
check-section-pointers.py — resolve every cross-file "`file.md` -> *Section*" pointer
in the orchestrator skill against the file that actually owns that heading.

Exists because splitting SKILL.md and config.md into parallel/ and config-parallel/
references left 18 pointers naming a file that no longer held the section — including
the normative definition of `span_base`, which the parallel path prints on every run.
Step pointers were swept by hand and section pointers were not; this makes the whole
class mechanical instead of remembered.

  python3 scripts/check-section-pointers.py        # exit 1 on any broken pointer

Run from the repo root. PROJECT-CONTEXT.md is skipped: it is materialized from
PROJECT-CONTEXT.template.md, so its headings legitimately live under another name.
"""
import os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..",
                      "plugins", "my-skills", "skills", "orchestrator"))
import re,glob,sys

files=glob.glob('SKILL.md')+glob.glob('references/*.md')+glob.glob('templates/*.md')
head={}
for f in files:
    for l in open(f,encoding='utf-8'):
        m=re.match(r'#{2,4}\s+(.*?)\s*$',l)
        if m: head.setdefault(m.group(1).strip(),set()).add(f)
def norm(s): return re.sub(r'[`*]','',s).strip()
byname={}
for h,fs in head.items(): byname.setdefault(norm(h),set()).update(fs)
names=sorted(byname)

def owners_of(sec):
    """Resolve a pointer's section name to the files that own it.

    Exact match first. Failing that, treat the pointer as a PREFIX of the heading:
    headings here routinely carry an em-dash gloss ("`PACT` ID resolution — receiving
    a contract ID as a role input") that pointers name without. Skipping those was a
    blind spot big enough to hide a whole file split -- 15 pointers into moved
    sections resolved to nothing and were silently passed.
    """
    hit = byname.get(sec)
    if hit: return {os.path.basename(x) for x in hit}
    out = set()
    for n in names:
        if n.startswith(sec):
            out |= {os.path.basename(x) for x in byname[n]}
    return out
# The section name may be fenced (*`PACT` ID resolution*), so backticks must be
# allowed INSIDE it and stripped by norm() — excluding them silently dropped every
# pointer whose section begins with one, which was the whole `PACT` family.
pat=re.compile(r'`?(?:\.orchestrator/|references/)?([A-Za-z0-9_.-]+\.md)`?\s*(?:→|->)\s*\*{0,2}([^*\n.,;)]+)')
bad=[]
for f in files:
    for i,l in enumerate(open(f,encoding='utf-8'),1):
        for m in pat.finditer(l):
            tgt,sec=m.group(1),norm(m.group(2))
            if not sec or len(sec)<4: continue
            if tgt=='PROJECT-CONTEXT.md': continue   # materialized from PROJECT-CONTEXT.template.md
            owners=owners_of(sec)
            if not owners: continue                    # section name not a heading anywhere
            if tgt not in owners:
                bad.append((f,i,tgt,sec,sorted(owners)))
for b in bad: print(f"{b[0]}:{b[1]}  says {b[2]} -> *{b[3]}*  but lives in {b[4]}")
print(f"\n{len(bad)} broken section pointer(s)")
sys.exit(1 if bad else 0)
