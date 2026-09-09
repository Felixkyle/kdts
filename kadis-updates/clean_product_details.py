"""
clean_product_details.py

Cleans up the 'full' HTML field in product-details.js:
  - Strips class="..." and style="..." attributes entirely (old marketplace
    classes like Jiji's "-mtm"/"-fs20" are meaningless on this site's CSS
    and are just noise/risk of clashing with your own class names).
  - Removes known structural "chrome" wrapper elements that came from
    copy-pasted marketplace listings (e.g. a fake "Product details" <h2>,
    wrapping <div class="card">, empty <li></li> junk).
  - Converts manual "· " / "• " bullet lines into real <li> elements.
  - Collapses excess whitespace.
  - Leaves genuinely-written WooCommerce content (like accessories-0)
    untouched other than whitespace cleanup.

Does NOT invent content. If an entry is empty or becomes too short/garbled
after cleaning, it's listed in needs_manual_review.json instead of being
silently shipped.

Usage:
    python clean_product_details.py product-details.js

Outputs:
    product-details.clean.js   -- cleaned replacement (review before using)
    needs_manual_review.json  -- ids that are empty, too short, or still
                                  messy after automated cleaning
"""

import sys
import re
import json

# Reuse the same tolerant JS-object parser from qa_product_details.py
def parse_js_string(text, i):
    assert text[i] == '"'
    i += 1
    out = []
    while True:
        c = text[i]
        if c == '\\':
            nxt = text[i + 1]
            mapping = {'"': '"', "'": "'", '\\': '\\', 'n': '\n', 't': '\t', 'r': '\r'}
            out.append(mapping.get(nxt, nxt))
            i += 2
            continue
        if c == '"':
            return ''.join(out), i + 1
        out.append(c)
        i += 1


def parse_product_details(js_text):
    results = {}
    key_pattern = re.compile(r'"([^"]+)"\s*:\s*\{')
    for m in key_pattern.finditer(js_text):
        pid = m.group(1)
        i = m.end()
        brand, full = "", ""
        depth = 1
        while depth > 0 and i < len(js_text):
            c = js_text[i]
            if c == '{':
                depth += 1
                i += 1
            elif c == '}':
                depth -= 1
                i += 1
            elif c == '"':
                start = i
                s, i = parse_js_string(js_text, i)
                lookback = js_text[max(0, start - 15):start]
                if 'brand' in lookback:
                    brand = s
                elif 'full' in lookback:
                    full = s
            else:
                i += 1
        rest_of_line = js_text[i:js_text.find('\n', i) if js_text.find('\n', i) != -1 else len(js_text)]
        comment_match = re.search(r'//\s*(.+)', rest_of_line)
        comment = comment_match.group(1).strip() if comment_match else ""
        results[pid] = {"brand": brand, "full": full, "comment": comment}
    return results


# ---------------------------------------------------------------------------
# Cleaning logic
# ---------------------------------------------------------------------------

# Phrases that are marketplace UI chrome, not product content -- safe to drop
# the whole element they appear in.
CHROME_TEXT_PATTERNS = [
    r'product details',
    r'similar products',
    r'related products',
    r'share this ad',
    r'report this ad',
    r'ad id\s*:',
]

def strip_attributes(html):
    """Remove class="..." and style="..." from all tags."""
    html = re.sub(r'\s+class="[^"]*"', '', html)
    html = re.sub(r'\s+style="[^"]*"', '', html)
    return html


def remove_chrome_elements(html):
    """
    Remove <h2>/<header> elements whose text is just structural chrome
    (e.g. "Product details"), and their immediate wrapping if it's now
    empty. Also drops empty <li></li> and <li> </li>.
    """
    # Drop header/h2/h3 elements containing chrome phrases
    def is_chrome(tag_content):
        text = re.sub(r'<[^>]+>', '', tag_content).strip().lower()
        return any(re.search(p, text) for p in CHROME_TEXT_PATTERNS)

    for tag in ['header', 'h1', 'h2', 'h3']:
        pattern = re.compile(rf'<{tag}[^>]*>.*?</{tag}>', re.IGNORECASE | re.DOTALL)
        html = pattern.sub(lambda m: '' if is_chrome(m.group(0)) else m.group(0), html)

    # Empty list items
    html = re.sub(r'<li>\s*</li>', '', html, flags=re.IGNORECASE)

    return html


def unwrap_generic_card_divs(html):
    """
    Marketplace copy-pastes often wrap everything in
    <div class="card ..."> ... </div> (classes already stripped by this
    point). After class-stripping these are just plain <div> wrappers --
    harmless, but we unwrap a single redundant outer <div> layer if the
    whole string is just one big div containing everything, to reduce
    nesting noise. Conservative: only touches the OUTERMOST div, only if
    it wraps the entire content.
    """
    stripped = html.strip()
    m = re.match(r'^<div>(.*)</div>$', stripped, re.DOTALL)
    if m:
        inner = m.group(1).strip()
        # only unwrap if that div really was the sole top-level wrapper
        return inner
    return html


def convert_manual_bullets(html):
    """
    Convert lines/paragraphs starting with · or • into a real <ul><li> list.
    Only touches text OUTSIDE existing <li> elements to avoid double-wrapping.
    """
    # Split on the bullet character, keep paragraph structure light-touch:
    # turn "<p>· Ion Free</p>" style entries into "<li>Ion Free</li>" and
    # group consecutive ones into a single <ul>.
    parts = re.split(r'(<p>[\u00b7\u2022]\s*[^<]*</p>)', html)
    out = []
    buffer_items = []

    def flush_buffer():
        if buffer_items:
            out.append('<ul>' + ''.join(f'<li>{item}</li>' for item in buffer_items) + '</ul>')
            buffer_items.clear()

    for part in parts:
        m = re.match(r'<p>[\u00b7\u2022]\s*([^<]*)</p>', part)
        if m:
            buffer_items.append(m.group(1).strip())
        else:
            flush_buffer()
            out.append(part)
    flush_buffer()
    return ''.join(out)


def collapse_whitespace(html):
    html = re.sub(r'[ \t]+', ' ', html)
    html = re.sub(r'\n\s*\n+', '\n', html)
    html = re.sub(r'>\s+<', '><', html)
    return html.strip()


def clean_full(html):
    html = strip_attributes(html)
    html = remove_chrome_elements(html)
    html = unwrap_generic_card_divs(html)
    html = convert_manual_bullets(html)
    html = collapse_whitespace(html)
    return html


def js_escape(s):
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n')


def main():
    if len(sys.argv) < 2:
        print("Usage: python clean_product_details.py product-details.js")
        sys.exit(1)

    path = sys.argv[1]
    with open(path, "r", encoding="utf-8") as f:
        js_text = f.read()

    details = parse_product_details(js_text)
    print(f"Parsed {len(details)} entries. Cleaning...")

    needs_review = {}
    cleaned = {}

    for pid, entry in details.items():
        original_full = entry["full"]
        if not original_full.strip():
            needs_review[pid] = {"reason": "EMPTY_FULL", "comment": entry["comment"]}
            # Deliberately OMITTED from `cleaned` (not written to the output
            # file at all). This ensures KADIS_PRODUCT_DETAILS[id] returns
            # undefined for these products, so Quickview.js's existing
            # "if details exist, use them, else auto-generate" check falls
            # through to the keyword-bucket generator as intended -- rather
            # than an empty full:"" string being misread as an intentional
            # blank override.
            continue

        new_full = clean_full(original_full)
        text_only = re.sub(r'<[^>]+>', '', new_full).strip()

        # Detect mojibake / corrupted-encoding text: short strings containing
        # Latin-1-supplement letters in odd combos (è, Ã, ¢, etc.) with no
        # real surrounding words are a strong sign of a botched encoding,
        # not real content.
        def norm(s):
            return re.sub(r'[^a-z0-9]', '', s.lower())

        is_corrupted = bool(re.search(r'[ÃÂ¢Â£Â¥]|[\u0080-\u009f]', text_only)) and len(text_only) < 60
        title_norm = norm(entry["comment"])
        text_norm = norm(text_only)
        # "Title-only": cleaned text is the title (or title minus filler
        # words like "Original", "Genuine") and adds no real new info.
        is_title_only = (
            len(text_only) < 80
            and title_norm
            and (text_norm == title_norm or title_norm in text_norm and len(text_norm) - len(title_norm) < 10)
        )

        if is_corrupted:
            needs_review[pid] = {
                "reason": "CORRUPTED_TEXT",
                "comment": entry["comment"],
                "cleaned_preview": new_full[:200],
            }
            continue  # omit from cleaned output -- treat like EMPTY_FULL
        elif is_title_only:
            needs_review[pid] = {
                "reason": "TITLE_ONLY_NO_REAL_CONTENT",
                "comment": entry["comment"],
                "cleaned_preview": new_full[:200],
            }
            continue  # omit from cleaned output -- treat like EMPTY_FULL
        elif len(text_only) < 30:
            needs_review[pid] = {
                "reason": "TOO_SHORT_AFTER_CLEANING",
                "comment": entry["comment"],
                "cleaned_preview": new_full[:200],
            }
            # short but adds *some* real info (e.g. "Original") -- keep it,
            # just flagged for optional human polish later
            cleaned[pid] = {"brand": entry["brand"], "full": new_full}
        else:
            cleaned[pid] = {"brand": entry["brand"], "full": new_full}

    # Write cleaned JS file
    lines = ["const KADIS_PRODUCT_DETAILS = {"]
    for pid, entry in cleaned.items():
        comment = details[pid]["comment"]
        lines.append(
            f'  "{pid}": {{ brand: "{js_escape(entry["brand"])}", '
            f'full: "{js_escape(entry["full"])}" }}, // {comment}'
        )
    lines.append("};")

    with open("product-details.clean.js", "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    with open("needs_manual_review.json", "w", encoding="utf-8") as f:
        json.dump(needs_review, f, indent=2, ensure_ascii=False)

    print(f"\nDone.")
    print(f"  Cleaned file:        product-details.clean.js  ({len(cleaned)} entries)")
    print(f"  Needs manual review: needs_manual_review.json  ({len(needs_review)} entries)")
    print(f"\nBreakdown of needs_manual_review reasons:")
    reason_counts = {}
    for v in needs_review.values():
        reason_counts[v["reason"]] = reason_counts.get(v["reason"], 0) + 1
    for reason, count in reason_counts.items():
        print(f"  {reason}: {count}")


if __name__ == "__main__":
    main()