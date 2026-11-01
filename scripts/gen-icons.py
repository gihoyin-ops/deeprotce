import math
import os
import xml.etree.ElementTree as ET

ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")
os.makedirs(ROOT, exist_ok=True)


def fmt(n):
    s = f"{n:.2f}".rstrip("0").rstrip(".")
    return s if s else "0"


def polar(cx, cy, r, deg):
    rad = math.radians(deg)
    return (cx + r * math.cos(rad), cy + r * math.sin(rad))


def gear_path(cx=12, cy=12, teeth=8, r_root=7.4, r_tip=10.2):
    pts = []
    step = 360 / teeth
    for i in range(teeth):
        base = i * step - step / 2
        a1 = polar(cx, cy, r_root, base + step * 0.10)
        a2 = polar(cx, cy, r_tip, base + step * 0.22)
        a3 = polar(cx, cy, r_tip, base + step * 0.78)
        a4 = polar(cx, cy, r_root, base + step * 0.90)
        pts += [a1, a2, a3, a4]
    return "M" + " ".join(f"{fmt(x)} {fmt(y)}" for x, y in pts) + "Z"


def svg(inner, vb="0 0 24 24"):
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" fill="none" '
        'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
        + inner + "</svg>\n"
    )


ICONS = {
    "alert-circle": '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
    "archive": '<rect x="2" y="3" width="20" height="5" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>',
    "arrow-left": '<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>',
    "arrow-left-to-line": '<path d="M6 5v14"/><path d="M21 12h-9"/><path d="M15 8l-4 4 4 4"/>',
    "arrow-right": '<path d="M5 12h14"/><path d="M12 5l7 7-7 7"/>',
    "arrow-right-to-line": '<path d="M18 5v14"/><path d="M3 12h9"/><path d="M9 8l4 4-4 4"/>',
    "arrow-up": '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
    "bar-chart-3": '<path d="M3 3v18h18"/><path d="M8 17v-3"/><path d="M13 17V5"/><path d="M18 17V9"/>',
    "bell": '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    "bell-ring": (
        '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>'
        '<path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>'
        '<path d="M4 2C2.8 3.7 2 5.7 2 8"/>'
        '<path d="M22 8c0-2.3-.8-4.3-2-6"/>'
    ),
    "book-open": '<path d="M2 4h6a4 4 0 0 1 4 4v12a3 3 0 0 0-3-3H2z"/><path d="M22 4h-6a4 4 0 0 0-4 4v12a3 3 0 0 1 3-3h7z"/>',
    "bot": (
        '<rect x="4" y="8" width="16" height="12" rx="3"/>'
        '<path d="M12 8V4"/><circle cx="12" cy="3" r="1"/>'
        '<path d="M2 13h2"/><path d="M20 13h2"/>'
        '<path d="M9 13v2"/><path d="M15 13v2"/>'
    ),
    "brain": (
        '<path d="M12 4.7C10.7 3.3 8.3 3.1 7 4.5 5.4 4.7 4.3 6.2 4.6 7.8 3.4 8.8 3.3 10.7 4.5 11.8 4.1 13.4 5.1 15 6.7 15.3 7.3 16.8 8.9 17.6 10.5 17.1 11 17 11.5 16.9 12 16.8Z"/>'
        '<path d="M12 4.7c1.3-1.4 3.7-1.6 5-.2 1.6.2 2.7 1.7 2.4 3.3 1.2 1 1.3 2.9.1 4 .4 1.6-.6 3.2-2.2 3.5-.6 1.5-2.2 2.3-3.8 1.8-.5-.1-1-.2-1.5-.3Z"/>'
        '<path d="M9.5 17.6c.5.9 1.4 1.4 2.5 1.4s2-.5 2.5-1.4"/>'
    ),
    "brain-circuit": (
        '<path d="M12 4.7C10.6 3.3 8.4 3.2 7.1 4.5 5.5 4.7 4.4 6.2 4.7 7.8 3.5 8.8 3.4 10.7 4.6 11.8 4.2 13.4 5.2 15 6.8 15.3 8.2 17.3 10.4 17.2 12 16.6"/>'
        '<path d="M12 4.7c1.4-1.4 3.6-1.5 4.9-.2 1.6.2 2.7 1.7 2.4 3.3 1.2 1 1.3 2.9.1 4 .4 1.6-.6 3.2-2.2 3.5-1.4 2-3.6 1.9-5.2 1.3"/>'
        '<circle cx="12" cy="11" r="2.2"/>'
        '<path d="M12 5.5V8.8"/><path d="M7.6 11H9.8"/><path d="M14.2 11h2.2"/><path d="M12 13.2v4.3"/>'
    ),
    "check": '<path d="M20 6L9 17l-5-5"/>',
    "check-circle-2": '<circle cx="12" cy="12" r="10"/><path d="M9 12l2 2 4-4"/>',
    "chevron-down": '<path d="M6 9l6 6 6-6"/>',
    "chevron-left": '<path d="M15 18l-6-6 6-6"/>',
    "chevron-right": '<path d="M9 18l6-6-6-6"/>',
    "code-2": '<path d="M18 16l4-4-4-4"/><path d="M6 8l-4 4 4 4"/><path d="M14.5 4l-5 16"/>',
    "corner-down-left": '<path d="M20 4v7a4 4 0 0 1-4 4H4"/><path d="M9 10l-5 5 5 5"/>',
    "cpu": (
        '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6" rx="1"/>'
        '<path d="M9 2v2"/><path d="M15 2v2"/><path d="M9 20v2"/><path d="M15 20v2"/>'
        '<path d="M2 9h2"/><path d="M2 15h2"/><path d="M20 9h2"/><path d="M20 15h2"/>'
    ),
    "database": '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    "download": '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>',
    "edit-3": '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    "ellipsis": (
        '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
        '<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
        '<circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
    ),
    "external-link": (
        '<path d="M15 3h6v6"/><path d="M10 14L21 3"/>'
        '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
    ),
    "file": '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>',
    "file-down": (
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
        '<path d="M14 2v6h6"/><path d="M12 12v6"/><path d="M9 15l3 3 3-3"/>'
    ),
    "file-spreadsheet": (
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
        '<path d="M14 2v6h6"/>'
        '<path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/>'
    ),
    "file-text": (
        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'
        '<path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M8 9h2"/>'
    ),
    "folder": '<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z"/>',
    "gauge": '<path d="M12 14l4-4"/><path d="M3.3 19a10 10 0 1 1 17.4 0"/>',
    "globe": '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
    "help-circle": '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    "image": '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    "layers": '<path d="M12 2l8.5 4.7L12 11.4 3.5 6.7z"/><path d="M3.5 12L12 16.7l8.5-4.7"/><path d="M3.5 17.2L12 21.9l8.5-4.7"/>',
    "library": '<path d="M4 4v16"/><path d="M8 8v12"/><path d="M12 6v14"/><path d="M16 6l4 14"/>',
    "lightbulb": (
        '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5a6 6 0 0 0-12 0c0 1.3.5 2.6 1.5 3.5.8.8 1.3 1.5 1.5 2.5"/>'
        '<path d="M9 18h6"/><path d="M10 22h4"/>'
    ),
    "link": (
        '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/>'
        '<path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>'
    ),
    "loader-2": '<path d="M21 12a9 9 0 1 1-9-9"/>',
    "maximize-2": '<path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/>',
    "message-square": '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    "mic": (
        '<rect x="9" y="2" width="6" height="13" rx="3"/>'
        '<path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>'
    ),
    "monitor": '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
    "more-horizontal": (
        '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
        '<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
        '<circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
    ),
    "more-vertical": (
        '<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/>'
        '<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/>'
        '<circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>'
    ),
    "mouse-pointer-2": '<path d="M5.5 3.5L19.5 9.8l-6.3 1.8-2.5 6z"/>',
    "paperclip": '<path d="M21.4 11l-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.5A4 4 0 0 1 18 8.8l-8.6 8.6a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    "palette": (
        '<path d="M12 22C6.5 22 2 17.5 2 12S6.5 2 12 2s10 4.5 10 10c0 1.7-1.3 3-3 3h-1.6a2.4 2.4 0 0 0-2.4 2.4c0 .5.2 1 .5 1.4.9 1.1.2 3.2-1.5 3.2z"/>'
        '<circle cx="7.5" cy="11" r="1.2" fill="currentColor" stroke="none"/>'
        '<circle cx="10.8" cy="6.9" r="1.2" fill="currentColor" stroke="none"/>'
        '<circle cx="15.2" cy="8.1" r="1.2" fill="currentColor" stroke="none"/>'
    ),
    "panel-bottom": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15h18"/>',
    "panel-left": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/>',
    "pen-line": '<path d="M12 20h9"/><path d="M17 3.5L20.5 7 8 19.5 4 20l.5-4z"/>',
    "pin": '<path d="M9.5 4.5h5l1.2 4.8L19 10.5l-3.3 1.1V17l-2.2 2.5L11.3 17v-5.4L8 10.5l3.3-1.2z"/>',
    "play": '<path d="M7 4.5l12.5 7.5L7 19.5z"/>',
    "plus": '<path d="M12 5v14"/><path d="M5 12h14"/>',
    "rectangle-horizontal": '<rect x="2" y="5" width="20" height="14" rx="2"/>',
    "rectangle-vertical": '<rect x="5" y="2" width="14" height="20" rx="2"/>',
    "refresh-cw": (
        '<path d="M21 12a9 9 0 0 0-9-9 9.8 9.8 0 0 0-6.7 2.7L3 8"/>'
        '<path d="M3 3v5h5"/>'
        '<path d="M3 12a9 9 0 0 0 9 9 9.8 9.8 0 0 0 6.7-2.7L21 16"/>'
        '<path d="M21 21v-5h-5"/>'
    ),
    "scan": (
        '<path d="M3 7V5a2 2 0 0 1 2-2h2"/>'
        '<path d="M17 3h2a2 2 0 0 1 2 2v2"/>'
        '<path d="M21 17v2a2 2 0 0 1-2 2h-2"/>'
        '<path d="M7 21H5a2 2 0 0 1-2-2v-2"/>'
    ),
    "search": '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
    "settings": '<path d="' + gear_path() + '"/><circle cx="12" cy="12" r="3.2"/>',
    "share-2": (
        '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>'
        '<path d="M8.6 13.5l6.8 4"/><path d="M15.4 6.5l-6.8 4"/>'
    ),
    "shield-alert": (
        '<path d="M20 13c0 5-3.5 7.5-7.7 8.9a1 1 0 0 1-.6 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.2-2.7a1.2 1.2 0 0 1 1.6 0C14.5 3.8 17 5 19 5a1 1 0 0 1 1 1z"/>'
        '<path d="M12 8v4"/><path d="M12 16h.01"/>'
    ),
    "sliders-horizontal": (
        '<path d="M21 4h-7"/><path d="M10 4H3"/>'
        '<path d="M21 12h-9"/><path d="M8 12H3"/>'
        '<path d="M21 20h-5"/><path d="M12 20H3"/>'
        '<path d="M14 2v4"/><path d="M8 10v4"/><path d="M16 18v4"/>'
    ),
    "sparkles": (
        '<path d="M12 3l-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>'
        '<path d="M5 3v4"/><path d="M3 5h4"/><path d="M19 17v4"/><path d="M17 19h4"/>'
    ),
    "square": '<rect x="4" y="4" width="16" height="16" rx="2"/>',
    "square-mouse-pointer": '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9.5 9.5l6.5 2.5-2.8 1-1 3.2z"/>',
    "square-pen": (
        '<path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>'
        '<path d="M18.4 2.6a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z"/>'
    ),
    "terminal": '<path d="M4 17l6-6-6-6"/><path d="M12 19h8"/>',
    "trash-2": (
        '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>'
        '<path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'
        '<path d="M10 11v6"/><path d="M14 11v6"/>'
    ),
    "user": '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    "video": '<path d="M22 8l-6 4 6 4V8z"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
    "volume-2": (
        '<path d="M11 5L6 9H2v6h4l5 4V5Z"/>'
        '<path d="M15.5 8.5a5 5 0 0 1 0 7"/>'
        '<path d="M19 5a9.5 9.5 0 0 1 0 14"/>'
    ),
    "x": '<path d="M18 6L6 18"/><path d="M6 6l12 12"/>',
    "zap": '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
}

# icons referenced explicitly by the user / existing usages
NEEDED = [
    "AlertCircle", "Archive", "ArrowLeft", "ArrowLeftToLine", "ArrowRight", "ArrowRightToLine",
    "ArrowUp", "BarChart3", "Bell", "BellRing", "BookOpen", "Bot", "Brain", "BrainCircuit",
    "Check", "CheckCircle2", "ChevronDown", "ChevronLeft", "ChevronRight", "Code2", "Copy",
    "CornerDownLeft", "Cpu", "Database", "Download", "Edit3", "Ellipsis", "ExternalLink", "File",
    "FileDown", "FileSpreadsheet", "FileText", "Folder", "Gauge", "Globe", "HelpCircle", "Image",
    "Layers", "Library", "Lightbulb", "Link", "Loader2", "Maximize2", "MessageSquare", "Mic",
    "Monitor", "MoreHorizontal", "MoreVertical", "MousePointer2", "Palette", "PanelBottom",
    "PanelLeft", "Paperclip", "PenLine", "Pin", "Play", "Plus", "RectangleHorizontal",
    "RectangleVertical", "RefreshCw", "Scan", "Search", "Settings", "Share2", "ShieldAlert",
    "SlidersHorizontal", "Sparkles", "Square", "SquareMousePointer", "SquarePen", "Terminal",
    "Trash2", "User", "Video", "Volume2", "X", "Zap",
]


def slug(name):
    import re as _re
    s = _re.sub(r"(?<=[a-z0-9])(?=[A-Z])|(?<=[a-zA-Z])(?=[0-9])", "-", name)
    return s.lower()


missing = []
for n in NEEDED:
    key = slug(n)
    if key not in ICONS:
        if n == "Copy":
            ICONS[key] = '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 3H5a2 2 0 0 0-2 2v11"/>'
        elif n == "Edit":
            ICONS[key] = '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'
        else:
            missing.append(n)

if missing:
    print("MISSING:", missing)
    raise SystemExit(1)

for key, inner in ICONS.items():
    data = svg(inner)
    try:
        ET.fromstring(data)
    except ET.ParseError as e:
        print("XML ERROR", key, e)
        raise
    with open(os.path.join(ROOT, f"{key}.svg"), "w") as fh:
        fh.write(data)

print(f"ok: wrote {len(ICONS)} icon files")
print(sorted(ICONS.keys()))
