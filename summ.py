#!/usr/bin/env python3
"""Throwaway summariser for ref.mjs logs."""
import re, json, sys

def summarize(path, sections=None, maxrows=12, full_filters=False):
    t = open(path).read()
    parts = re.split(r'\n===== ', t)
    for p in parts[1:]:
        head = p.split(' =====')[0]
        if sections and not any(s in head for s in sections):
            continue
        body = p.split(' =====', 1)[1]
        body = re.split(r'\nHOVER:', body)[0]
        body = re.split(r'\nDONE ', body)[0]
        body = re.split(r'\nhover probe failed', body)[0]
        body = re.split(r'\n!! screenshot', body)[0]
        try:
            obj, _end = json.JSONDecoder().raw_decode(body.lstrip())
        except Exception as e:
            print(f'\n#### {head}\n  [unparsed: {e}] {body[:300]}')
            continue
        meta = obj.get('meta', {})
        d = obj.get('data', obj)
        print(f'\n########## {head}')
        print('  status:', meta.get('status'), '| error:', meta.get('error'), '| dismissed:', meta.get('dismissed'))
        if meta.get('requests'): print('  HTTP>=400:', meta['requests'][:6])
        if meta.get('console'): print('  console errors:', meta['console'][:3])
        print('  title:', d.get('title'))
        print('  bodyBg:', d.get('bodyBg'), '| font:', str(d.get('bodyFont'))[:80], '| scrollH:', d.get('scrollHeight'), '| sheets:', d.get('stylesheetCount'))
        print('  fonts seen:', d.get('fonts'))
        hdr = d.get('header')
        if hdr: print('  HEADER:', json.dumps({k: v for k, v in hdr.items() if k != 'links'}))
        if hdr and hdr.get('links'): print('    header links:', hdr['links'][:40])
        print('  HEADINGS:')
        for h in (d.get('headings') or [])[:25]:
            print(f"    {h['tag']} {h['size']}/{h['weight']} {h['color']} {h['family']} :: {h['text'][:90]}")
        hero = d.get('hero')
        if hero:
            print('  HERO:', json.dumps({k: hero[k] for k in ('selector','w','h','background','radius','hasInput','fields') if k in hero}))
            print('    hero text:', str(hero.get('text'))[:300].replace('\n', ' | '))
        if d.get('formFields'): print('  FIELDS:', json.dumps(d['formFields'])[:900])
        if d.get('buttons'): print('  BUTTONS:', d['buttons'][:30])
        if d.get('labels'): print('  LABELS:', d['labels'][:20])
        for f in (d.get('filterish') or [])[:4]:
            txt = f['text'] if full_filters else f['text'][:600]
            print(f"  FILTERISH [{f['cls'][:60]}]: {txt}")
        for i, c in enumerate(d.get('cardReports') or []):
            if i > 1: break
            print(f"  CARD#{i} count={c['count']} sig={str(c.get('signature', '(mobile)'))[:110]}")
            print('    container:', json.dumps(c.get('container')))
            print('    hover:', str(c.get('hoverTransition'))[:200])
            for im in c.get('imgs') or []: print('    img:', json.dumps(im))
            for r in (c.get('textRows') or [])[:maxrows]:
                print(f"    row <{r.get('tag')}> {r['fontSize']}/{r['fontWeight']} lh={r['lineHeight']} ls={r['letterSpacing']} {r['color']} bg={r['background']} r={r['radius']} sh={r['shadow'][:40]} tr={str(r['transition'])[:60]} :: {r['text'][:100]}")
        if not (d.get('cardReports')):
            print('  NO CARD GROUPS DETECTED')
            print('  body preview:', str(d)[:600])

if __name__ == '__main__':
    summarize(sys.argv[1], sys.argv[2:] or None)
