from __future__ import annotations

import json
import math
from collections import defaultdict
from html import escape
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
SOURCE_URL = "https://api.openstreetmap.org/api/0.6/map?bbox=7.7380,48.5870,7.7680,48.5994"
BOUNDS = (7.7380, 48.5870, 7.7680, 48.5994)
LINK = "https://www.openstreetmap.org/#map=15/48.5932/7.7530"
ALLOWED_TAGS = {"name", "highway", "waterway", "natural", "landuse", "leisure", "railway"}
DATA_FILE = ROOT / "osm-quartier-cartographie.json"


def load_data():
    if DATA_FILE.exists():
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    root = ET.parse(ROOT / "osm-quartier-source.osm").getroot()
    nodes = {
        node.attrib["id"]: [float(node.attrib["lon"]), float(node.attrib["lat"])]
        for node in root.findall("node")
    }
    features = []
    for way in root.findall("way"):
        tags = {
            tag.attrib["k"]: tag.attrib["v"]
            for tag in way.findall("tag")
            if tag.attrib["k"] in ALLOWED_TAGS
        }
        if not (
            tags.get("highway")
            or tags.get("waterway")
            or tags.get("railway") in {"rail", "tram", "light_rail"}
            or tags.get("natural") == "water"
            or tags.get("leisure") in {"park", "garden", "pitch"}
            or tags.get("landuse") in {"grass", "forest", "meadow", "recreation_ground"}
        ):
            continue
        refs = [node.attrib["ref"] for node in way.findall("nd")]
        if len(refs) < 2 or any(ref not in nodes for ref in refs):
            raise ValueError(f"Incomplete OSM geometry: {way.attrib['id']}")
        geometry = [nodes[ref] for ref in refs]
        features.append({"id": way.attrib["id"], "tags": tags, "geometry": geometry})
    result = {
        "source": SOURCE_URL,
        "attribution": "© les contributeurs OpenStreetMap",
        "license": "https://opendatacommons.org/licenses/odbl/1-0/",
        "copyright": "https://www.openstreetmap.org/copyright",
        "bounds": BOUNDS,
        "externalMapUrl": LINK,
        "scope": "Public neighbourhood only; no apartment location or property marker.",
        "features": features,
    }
    DATA_FILE.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    return result


def mercator(lon, lat):
    return math.radians(lon), math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def joined_chains(segments):
    remaining = [list(segment) for segment in segments]
    chains = []
    while remaining:
        chain = remaining.pop()
        changed = True
        while changed:
            changed = False
            for index, other in enumerate(remaining):
                if chain[-1] == other[0]:
                    chain += other[1:]
                elif chain[-1] == other[-1]:
                    chain += other[-2::-1]
                elif chain[0] == other[-1]:
                    chain = other[:-1] + chain
                elif chain[0] == other[0]:
                    chain = other[:0:-1] + chain
                else:
                    continue
                remaining.pop(index)
                changed = True
                break
        chains.append(chain)
    return chains


def render(data, filename, width, height, bounds, mobile=False):
    west, south, east, north = bounds
    xmin, ymin = mercator(west, south)
    xmax, ymax = mercator(east, north)
    scale = min(width / (xmax - xmin), height / (ymax - ymin))
    offset_x = (width - (xmax - xmin) * scale) / 2
    offset_y = (height - (ymax - ymin) * scale) / 2

    def project(point):
        x, y = mercator(*point)
        return offset_x + (x - xmin) * scale, offset_y + (ymax - y) * scale

    def path(geometry):
        points = [project(point) for point in geometry]
        return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in points)

    layers = defaultdict(list)
    streets = defaultdict(list)
    parks = []
    for feature in data["features"]:
        geometry, tags = feature["geometry"], feature["tags"]
        if not any(west <= x <= east and south <= y <= north for x, y in geometry):
            continue
        d = path(geometry)
        closed = geometry[0] == geometry[-1]
        if closed and (
            tags.get("leisure") in {"park", "garden", "pitch"}
            or tags.get("landuse") in {"grass", "forest", "meadow", "recreation_ground"}
        ):
            layers["land"].append(f'<path d="{d}Z"/>')
            if tags.get("leisure") == "park" and tags.get("name"):
                parks.append(feature)
        if tags.get("natural") == "water" and closed:
            layers["water-area"].append(f'<path d="{d}Z"/>')
        if tags.get("waterway") in {"river", "canal", "stream"}:
            layers["water-line"].append(f'<path d="{d}"/>')
        if tags.get("railway") in {"rail", "tram", "light_rail"}:
            layers["rail"].append(f'<path d="{d}"/>')
        highway = tags.get("highway")
        if highway:
            if highway in {"trunk", "trunk_link", "primary", "primary_link", "secondary", "secondary_link"}:
                layer = "major"
            elif highway in {"residential", "tertiary", "tertiary_link", "unclassified", "living_street", "pedestrian"}:
                layer = "street"
            elif highway in {"footway", "cycleway", "path", "steps", "service", "track"}:
                layer = "minor"
            else:
                continue
            layers[layer].append(f'<path d="{d}"/>')
            if tags.get("name") and layer in {"major", "street"}:
                streets[tags["name"]].append(geometry)

    labels = []
    definitions = []
    label_names = {
        "Rue Jacques Kablé": "RUE JACQUES KABLÉ",
        "Avenue des Vosges": "AVENUE DES VOSGES",
        "Boulevard Clemenceau": "BOULEVARD CLEMENCEAU",
        "Avenue de la Paix - Simone Veil": "AVENUE DE LA PAIX",
        "Rue de Wissembourg": "RUE DE WISSEMBOURG",
        "Quai Finkmatt": "QUAI FINKMATT",
    }
    for index, (name, display) in enumerate(label_names.items()):
        chains = joined_chains(streets.get(name, []))
        if not chains:
            continue
        chain = max(chains, key=lambda item: sum(math.dist(project(a), project(b)) for a, b in zip(item, item[1:])))
        if project(chain[0])[0] > project(chain[-1])[0]:
            chain = list(reversed(chain))
        principal = name == "Rue Jacques Kablé"
        font_size = (34 if mobile else 29) if principal else (24 if mobile else 22)
        chain_length = sum(math.dist(project(a), project(b)) for a, b in zip(chain, chain[1:]))
        if chain_length < len(display) * font_size * 0.56:
            continue
        ident = f"road-label-{index}"
        definitions.append(f'<path id="{ident}" d="{path(chain)}"/>')
        labels.append(
            f'<text class="road-label{" principal" if principal else ""}" font-size="{font_size}">'
            f'<textPath href="#{ident}" startOffset="50%" text-anchor="middle">{escape(display)}</textPath></text>'
        )
    for park in parks:
        if park["id"] not in {"970095616", "23048790"}:
            continue
        points = [project(point) for point in park["geometry"][:-1]]
        x, y = sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)
        if not (50 < x < width - 50 and 50 < y < height - 50):
            continue
        text = "PARC CONTADES" if park["id"] == "970095616" else "PLACE DE HAGUENAU"
        labels.append(f'<text class="park-label" x="{x:.1f}" y="{y:.1f}" font-size="{24 if mobile else 23}" text-anchor="middle">{text}</text>')

    scale_length = 400 / (6371000 * math.cos(math.radians((south + north) / 2))) * scale
    content = [
        '<svg xmlns="http://www.w3.org/2000/svg"',
        f' width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title description">',
        '<title id="title">Secteur Jacques Kablé à Strasbourg</title>',
        '<desc id="description">Carte réelle du quartier : rue Jacques Kablé, parc Contades'
        + ('' if mobile else ', place de Haguenau')
        + ' et avenue des Vosges. Aucun repère ne désigne l’appartement.</desc>',
        f'<metadata>{escape(json.dumps({key: data[key] for key in ("source", "attribution", "license", "externalMapUrl")}, ensure_ascii=False))}</metadata>',
        "<defs>" + "".join(definitions) + "</defs>",
        """<style>
        .land{fill:#294b3c;stroke:#355a49;stroke-width:1}
        .water-area{fill:#345c69}.water-line{fill:none;stroke:#345c69;stroke-width:18;stroke-linecap:round;stroke-linejoin:round}
        .minor{fill:none;stroke:#3c5449;stroke-width:1.7;stroke-linecap:round}
        .street{fill:none;stroke:#768b7c;stroke-width:3.3;stroke-linecap:round;stroke-linejoin:round}
        .major{fill:none;stroke:#a2a99a;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}
        .rail{fill:none;stroke:#a08870;stroke-width:1.7;stroke-dasharray:7 6}
        text{font-family:Trebuchet MS,sans-serif}
        .road-label{fill:#e3e5d7;stroke:#152b22;stroke-width:7;paint-order:stroke;letter-spacing:1}
        .principal{fill:#ecd5b6;font-weight:bold;stroke-width:10}
        .park-label{fill:#c4d8b4;stroke:#294b3c;stroke-width:7;paint-order:stroke;letter-spacing:1}
        </style>""",
        f'<rect width="{width}" height="{height}" fill="#162b23"/>',
    ]
    for layer in ("land", "water-area", "water-line", "minor", "street", "major", "rail"):
        content.append(f'<g class="{layer}">{"".join(layers[layer])}</g>')
    content.extend(labels)
    content.append(f'<g transform="translate({width - 46},48)" fill="#dce2d2"><path d="M0,-15 L-7,8 L0,3 L7,8Z"/><text y="30" text-anchor="middle" font-size="18">N</text></g>')
    content.append(f'<g transform="translate(28,{height - 48})" stroke="#e1e4d7" fill="#e1e4d7"><path d="M0,-6 V0 H{scale_length:.1f} V-6" fill="none" stroke-width="3"/><text x="0" y="-16" stroke="none" font-size="17">400 m</text></g>')
    content.append(f'<text x="{width - 24}" y="{height - 18}" fill="#e1e4d7" font-size="15" text-anchor="end">© les contributeurs OpenStreetMap · ODbL</text></svg>')
    (ROOT / filename).write_text("\n".join(content), encoding="utf-8")
    return {"file": filename, "width": width, "height": height, "bounds": bounds, "features": sum(map(len, layers.values())), "labels": len(labels)}


data = load_data()
assert any(feature["tags"].get("name") == "Rue Jacques Kablé" for feature in data["features"])
outputs = [
    render(data, "quartier-jacques-kable.svg", 1440, 900, BOUNDS),
    render(data, "quartier-jacques-kable-mobile.svg", 900, 1000, (7.7445, 48.5870, 7.7615, 48.5994), True),
]
manifest = {
    "source": SOURCE_URL,
    "externalMapUrl": LINK,
    "attribution": data["attribution"],
    "license": data["license"],
    "copyright": data["copyright"],
    "description": "Emprise publique du quartier uniquement ; aucune adresse ou position de l'appartement utilisée.",
    "outputs": outputs,
}
(ROOT / "carte-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(outputs, ensure_ascii=True, indent=2))
