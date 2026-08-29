import json

content = """Lektion 3 Veränderungen

Hören Sie Track 12. Beantworten Sie die Fragen.

1. Die Firma _____ ihre Produktion.
2. Die Preise _____ stark.

Grammatik: Präsens
"""
with open("Kursbuch.txt", "w", encoding="utf-8") as f:
    f.write(content)

wb = """Übungsbuch

Aufgabe 5
Lektion 3
1. Ergänzen Sie: Die Firma _____ ihre Produktion.
2. Wiederholen Sie nach.

Lösung: 1. produziert 2. steigen
"""
with open("Ubungsbuch.txt", "w", encoding="utf-8") as f:
    f.write(wb)

import woodpacker_extraction as w
g = w.build_graph(["Kursbuch.txt", "Ubungsbuch.txt"], refine=False)
d = g.model_dump(by_alias=True, exclude_none=True)
print(json.dumps({
    "classifications": d["classifications"],
    "exercises_count": len(d["exercises"]),
    "items_count": len(d["items"]),
    "links": [(l["from"], l["to"], l["type"], l["confidence"]) for l in d["resourceLinks"]],
    "quality": d["quality"],
}, indent=2, ensure_ascii=False))
