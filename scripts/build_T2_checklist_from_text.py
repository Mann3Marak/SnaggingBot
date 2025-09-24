from __future__ import annotations
from pathlib import Path
import re, time

APP = Path(__file__).resolve().parents[1]
MIG_DIR = APP / 'supabase' / 'migrations'

RAW = r'''
Hall
Walls / wood panels
Ceiling 
Floor & skirting
Door
Lights
Other
Kitchen
Microwave
Fridge & Wine fridge
Cooker/Hob/CookTop
Oven
Dishwasher
Washer/Dryer
Walls 
Ceiling 
Counters
Cabinets
Sliding door
Blinds
Floor & skirting
Lights
Other
Dining Room
Walls / wood panels
Ceiling 
Floor & skirting
Sliding door 
Plugs
Blinds
Lights
Other
Living Room
Walls 
Ceiling 
Floor & skirting
Sliding door
Plugs
Blinds
Lights
Other
Balcony - Pool side
Walls 
Ceiling 
Tiles
Glass railing
Lights
Other
Suite Bedroom
Walls 
Ceiling 
Floor & skirting
Wardrobe
Plugs
Blinds
Door
Sliding door
Lights
Other
Suite Bathroom
Shower Cubicle
Shower Doors
Toilet
Mirror
Cabinet & drawers
Basin
Taps
Ceiling 
Walls & Tiles
Floor & skirting
Door
Lights
Other
Bedroom 2
Walls 
Ceiling 
Floor & skirting
Wardrobe
Plugs
Blinds
Door
Sliding door
Lights
Other
Bathroom 2
Shower Cubicle
Shower Doors
Toilet
Mirror
Cabinet & drawers
Basin
Taps
Ceiling 
Walls & Tiles
Floor & skirting
Door
Lights
Other
Balcony  - Back
Walls 
Ceiling 
Tiles
Glass railing
Outside Patio Storage
Lights
'''

_ws = re.compile(r"\s+")
_dash = re.compile(r"\s*[–—-]\s*")

def norm(s: str) -> str:
    s = s.replace('\u00a0', ' ')
    s = _dash.sub(' - ', s)
    s = _ws.sub(' ', s).strip()
    if s.endswith(':'):
        s = s[:-1].strip()
    return s

# Parse
headings_order = []
items_by_room: dict[str, list[str]] = {}
current = None
for line in RAW.splitlines():
    t = norm(line)
    if not t:
        continue
    # heading if line is in the set of known headings
    if t in [
        'Hall','Kitchen','Dining Room','Living Room','Balcony - Pool side','Suite Bedroom','Suite Bathroom','Bedroom 2','Bathroom 2','Balcony - Back','Outside Patio Storage']:
        current = t
        if t not in items_by_room:
            items_by_room[t] = []
            headings_order.append(t)
    else:
        if current is None:
            current = 'Hall'
            items_by_room.setdefault(current, [])
            if current not in headings_order:
                headings_order.append(current)
        items_by_room[current].append(t)

# Build SQL migration: delete T2 rows and insert in heading then item order
stamp = time.strftime('%Y%m%d%H%M%S')
out = MIG_DIR / f'{stamp}_checklists_T2_from_text.sql'
lines = [
    '-- Rebuild T2 checklist from PO-provided list (EN only)',
    'begin;',
    "delete from checklist_templates where apartment_type = 'T2';",
]
order = 0
for room in headings_order:
    for item in items_by_room.get(room, []):
        order += 1
        lines.append(
            "insert into checklist_templates (apartment_type, room_type, item_description, item_description_pt, order_sequence) "
            f"values ('T2', '{room.replace("'","''")}', '{item.replace("'","''")}', null, {order});"
        )
lines.append('commit;')
out.write_text('\n'.join(lines)+'\n', encoding='utf-8')
print('Wrote', out)
