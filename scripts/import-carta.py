#!/usr/bin/env python3
"""Importa productos del HTML antiguo Gourmedia a menu-data.js."""
import json
import re
import html
import shutil
from pathlib import Path

HTML_PATH = Path(r"C:\Users\nicol\Downloads\html_antiguo")
IMAGES_SRC = Path(r"C:\Users\nicol\Downloads\carta_affter")
OUT_DIR = Path(r"D:\programas\demo_pub\imagenes_carta")
OUT_JS = Path(r"D:\programas\demo_pub\js\menu-data.js")

SECTION_RE = re.compile(
    r'<div class="section-title ([^"]+)" name="([^"]*)" id="([^"]+)"',
    re.IGNORECASE,
)
JSON_RE = re.compile(r"data-json='(\{.*?\})'", re.DOTALL)


def slugify(text: str) -> str:
    s = text.strip().lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-") or "item"


def clean_text(value: str) -> str:
    if not value:
        return ""
    value = html.unescape(value)
    value = re.sub(r"<[^>]+>", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def format_price(raw: str) -> str:
    if not raw:
        return "Consultar"
    digits = re.sub(r"[^\d]", "", raw)
    if not digits:
        return "Consultar"
    if len(digits) <= 3:
        return f"${int(digits):,}".replace(",", ".")
    return f"${digits[:-3]}.{digits[-3:]}"


def image_filename(image_url: str) -> str:
    if not image_url:
        return ""
    return Path(image_url.split("?")[0]).name


def main():
    content = HTML_PATH.read_text(encoding="utf-8", errors="replace")

    sections = []
    for m in SECTION_RE.finditer(content):
        sections.append({"id": m.group(3), "name": m.group(2).strip()})

    # Map category_id -> section id (order preserved)
    cat_to_section = {}
    for sec in sections:
        cat_m = re.search(
            rf'id="{re.escape(sec["id"])}"[^>]*data-cat=\'(\{{.*?\}})\'',
            content,
            re.DOTALL,
        )
        if cat_m:
            cat = json.loads(cat_m.group(1))
            cat_to_section[str(cat.get("id"))] = sec["id"]

    products_by_section = {s["id"]: [] for s in sections}
    seen_ids = set()

    for m in JSON_RE.finditer(content):
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError:
            continue

        pid = data.get("id")
        if pid in seen_ids:
            continue
        seen_ids.add(pid)

        cat_id = str(data.get("category_id", ""))
        section_id = cat_to_section.get(cat_id)
        if not section_id:
            continue

        fields = data.get("post_fields") or {}
        price_raw = fields.get("precio_1") or fields.get("custom_price_text") or ""
        img_name = image_filename(data.get("image_url") or "")

        desc = clean_text(data.get("content") or "")
        if not desc and fields.get("item_1"):
            desc = clean_text(fields.get("item_1"))

        tags = []
        if fields.get("bartender"):
            tags.append("barra")
        if fields.get("etiqueta") == "5":
            tags.append("promo")

        products_by_section[section_id].append({
            "name": clean_text(data.get("title") or ""),
            "desc": desc or "Consulta con tu garzón",
            "price": format_price(str(price_raw)),
            "img": img_name,
            "tags": tags[:2],
        })

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    copied = 0
    if IMAGES_SRC.exists():
        for f in IMAGES_SRC.iterdir():
            if f.is_file() and f.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"}:
                shutil.copy2(f, OUT_DIR / f.name)
                copied += 1

    tabs = []
    items = {}
    for sec in sections:
        prods = products_by_section.get(sec["id"], [])
        if not prods:
            continue
        tab_id = sec["id"]
        label = re.sub(r"\s+", " ", sec["name"].strip())
        tabs.append({"id": tab_id, "label": label})
        items[tab_id] = prods

    js_lines = ["var MENU = {\n  tabs: [\n"]
    for i, tab in enumerate(tabs):
        comma = "," if i < len(tabs) - 1 else ""
        js_lines.append(f"    {{ id: '{tab['id']}', label: {json.dumps(tab['label'], ensure_ascii=False)} }}{comma}\n")
    js_lines.append("  ],\n  items: {\n")

    tab_ids = list(items.keys())
    for ti, tab_id in enumerate(tab_ids):
        js_lines.append(f"    {json.dumps(tab_id, ensure_ascii=False)}: [\n")
        prods = items[tab_id]
        for pi, p in enumerate(prods):
            comma = "," if pi < len(prods) - 1 else ""
            js_lines.append(
                "      {"
                f" name: {json.dumps(p['name'], ensure_ascii=False)},"
                f" desc: {json.dumps(p['desc'], ensure_ascii=False)},"
                f" price: {json.dumps(p['price'], ensure_ascii=False)},"
                f" img: {json.dumps(p['img'], ensure_ascii=False)},"
                f" tags: {json.dumps(p['tags'], ensure_ascii=False)}"
                f" }}{comma}\n"
            )
        comma = "," if ti < len(tab_ids) - 1 else ""
        js_lines.append(f"    ]{comma}\n")

    js_lines.append("  }\n};\n")
    OUT_JS.write_text("".join(js_lines), encoding="utf-8")

    total_products = sum(len(v) for v in items.values())
    print(f"Secciones: {len(tabs)}")
    print(f"Productos: {total_products}")
    print(f"Imágenes copiadas: {copied}")
    print(f"Generado: {OUT_JS}")


if __name__ == "__main__":
    main()
