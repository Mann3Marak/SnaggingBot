from __future__ import annotations
from pathlib import Path
import time

APP = Path(__file__).resolve().parents[1]
MIG_DIR = APP / 'supabase' / 'migrations'

RAW = r'''Hall

Hall - Walls / wood panels
Hall - Ceiling
Hall - Floor & skirting
Hall - Door
Hall - Lights
Hall - Other

Kitchen

Kitchen - Microwave
Kitchen - Fridge & Wine fridge
Kitchen - Cooker/Hob/CookTop
Kitchen - Oven
Kitchen - Dishwasher
Kitchen - Washer/Dryer
Kitchen - Walls
Kitchen - Ceiling
Kitchen - Counters
Kitchen - Cabinets
Kitchen - Sliding door
Kitchen - Blinds
Kitchen - Floor & skirting
Kitchen - Lights
Kitchen - Other

Dining Room

Dining Room - Walls / wood panels
Dining Room - Ceiling
Dining Room - Floor & skirting
Dining Room - Sliding door
Dining Room - Plugs
Dining Room - Blinds
Dining Room - Lights
Dining Room - Other

Living Room

Living Room - Walls
Living Room - Ceiling
Living Room - Floor & skirting
Living Room - Sliding door
Living Room - Plugs
Living Room - Blinds
Living Room - Lights
Living Room - Other

Balcony - Pool side

Balcony - Pool side - Walls
Balcony - Pool side - Ceiling
Balcony - Pool side - Tiles
Balcony - Pool side - Glass railing
Balcony - Pool side - Lights
Balcony - Pool side - Other

Suite Bedroom

Suite Bedroom - Walls
Suite Bedroom - Ceiling
Suite Bedroom - Floor & skirting
Suite Bedroom - Wardrobe
Suite Bedroom - Plugs
Suite Bedroom - Blinds
Suite Bedroom - Door
Suite Bedroom - Sliding door
Suite Bedroom - Lights
Suite Bedroom - Other

Suite Bathroom

Suite Bathroom - Shower Cubicle
Suite Bathroom - Shower Doors
Suite Bathroom - Toilet
Suite Bathroom - Mirror
Suite Bathroom - Cabinet & drawers
Suite Bathroom - Basin
Suite Bathroom - Taps
Suite Bathroom - Ceiling
Suite Bathroom - Walls & Tiles
Suite Bathroom - Floor & skirting
Suite Bathroom - Door
Suite Bathroom - Lights
Suite Bathroom - Other

Bedroom 2

Bedroom 2 - Walls
Bedroom 2 - Ceiling
Bedroom 2 - Floor & skirting
Bedroom 2 - Wardrobe
Bedroom 2 - Plugs
Bedroom 2 - Blinds
Bedroom 2 - Door
Bedroom 2 - Sliding door
Bedroom 2 - Lights
Bedroom 2 - Other

Bathroom 2

Bathroom 2 - Shower Cubicle
Bathroom 2 - Shower Doors
Bathroom 2 - Toilet
Bathroom 2 - Mirror
Bathroom 2 - Cabinet & drawers
Bathroom 2 - Basin
Bathroom 2 - Taps
Bathroom 2 - Ceiling
Bathroom 2 - Walls & Tiles
Bathroom 2 - Floor & skirting
Bathroom 2 - Door
Bathroom 2 - Lights
Bathroom 2 - Other

Balcony - Back

Balcony - Back - Walls
Balcony - Back - Ceiling
Balcony - Back - Tiles
Balcony - Back - Glass railing
Balcony - Back - Outside Patio Storage
Balcony - Back - Lights
'''

def parse_items(raw: str):
    out = []
    order = 0
    for line in raw.splitlines():
        t = line.strip()
        if not t:
            continue
        # Skip pure headings: lines without ' - '
        if ' - ' not in t:
            continue
        # Split into room and item after first ' - '
        room, item = t.split(' - ', 1)
        order += 1
        out.append((room.strip(), item.strip(), order))
    return out

items = parse_items(RAW)
stamp = time.strftime('%Y%m%d%H%M%S')
out = MIG_DIR / f'{stamp}_checklists_T2_reset_from_text.sql'
lines = [
    '-- Reset T2 checklist from PO-provided list (EN only, normalized)',
    'begin;',
    "delete from checklist_templates where apartment_type = 'T2';",
]
for room, item, i in items:
    room_sql = room.replace("'","''")
    item_sql = item.replace("'","''")
    lines.append(
        "insert into checklist_templates (apartment_type, room_type, item_description, item_description_pt, order_sequence) "
        f"values ('T2', '{room_sql}', '{item_sql}', null, {i});"
    )
lines.append('commit;')
out.write_text('\n'.join(lines)+'\n', encoding='utf-8')
print('Wrote', out)
