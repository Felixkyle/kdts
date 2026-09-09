"""
qa_product_details.py

Scans product-details.js for data-quality problems before it gets baked into
the site. Does NOT modify the file — just produces a report so you can decide
what to fix and how.

Usage (PowerShell):
    python qa_product_details.py product-details.js

Outputs:
    qa_report.json   -- full machine-readable findings
    qa_report.txt     -- human-readable summary, printed to console too
"""

import sys
import re
import json
import hashlib
from collections import defaultdict

# ---------------------------------------------------------------------------
# Step 1: Parse the JS object literal into Python dicts.
# We do this with a hand-rolled scanner (not naive regex) because the `full`
# field contains escaped double quotes (e.g. class=\"card\") and can be very
# long / contain HTML. A naive regex would break on the first embedded quote.
# ---------------------------------------------------------------------------

def parse_js_string(text, i):
    """i points at the opening quote. Returns (decoded_string, index_after_closing_quote)."""
    assert text[i] == '"'
    i += 1
    out = []
    while True:
        c = text[i]
        if c == '\\':
            nxt = text[i + 1]
            # Handle common JS escapes
            mapping = {'"': '"', "'": "'", '\\': '\\', 'n': '\n', 't': '\t', 'r': '\r'}
            out.append(mapping.get(nxt, nxt))
            i += 2
            continue
        if c == '"':
            return ''.join(out), i + 1
        out.append(c)
        i += 1


def parse_product_details(js_text):
    """
    Finds entries of the form:
        "some-id": { brand: "...", full: "..." }, // Comment
    Order-independent for brand/full, tolerant of whitespace/newlines.
    Returns dict: { id: {"brand": str, "full": str, "comment": str} }
    """
    results = {}
    # Find each quoted key immediately followed by ':' and '{'
    key_pattern = re.compile(r'"([^"]+)"\s*:\s*\{')
    for m in key_pattern.finditer(js_text):
        pid = m.group(1)
        i = m.end()  # just after the '{'
        brand, full = "", ""
        # scan until matching closing '}'
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
                # figure out which field this string belongs to by looking
                # backward for 'brand' or 'full'
                start = i
                s, i = parse_js_string(js_text, i)
                lookback = js_text[max(0, start - 15):start]
                if 'brand' in lookback:
                    brand = s
                elif 'full' in lookback:
                    full = s
            else:
                i += 1
        # grab trailing // comment on the same line, if present
        rest_of_line = js_text[i:js_text.find('\n', i) if js_text.find('\n', i) != -1 else len(js_text)]
        comment_match = re.search(r'//\s*(.+)', rest_of_line)
        comment = comment_match.group(1).strip() if comment_match else ""
        results[pid] = {"brand": brand, "full": full, "comment": comment}
    return results


# ---------------------------------------------------------------------------
# Step 2: Run quality checks
# ---------------------------------------------------------------------------

# Signatures of content very likely copy-pasted from OTHER marketplaces
# rather than written for this site. Extend this list as you find more.
FOREIGN_SITE_SIGNATURES = {
    "Jiji.ng": [r'-mtm', r'-fs\d+', r'-phm', r'-pvxs', r'-oxa\b', r'class="card aim'],
    "Jumia": [r'-pvs\b', r'ItemPrice', r'sku-similar', r'-df\b'],
    "Konga": [r'konga-', r'k-atc'],
    "Alibaba/AliExpress": [r'ali-', r'j-product-detail', r'product-property'],
    "Generic WP page builder cruft": [r'elementor', r'wp-block-', r'et_pb_'],
}

BULLET_CHAR_PATTERN = re.compile(r'[\u00b7\u2022]\s*\S')  # · or • followed by text
HTML_TAG_PATTERN = re.compile(r'<[a-zA-Z/][^>]*>')
ENTITY_PATTERN = re.compile(r'&[a-zA-Z]+;|&#\d+;')

TAG_PAIRS = [('<div', '</div>'), ('<ul', '</ul>'), ('<ol', '</ol>'), ('<li', '</li>'),
             ('<p', '</p>'), ('<span', '</span>'), ('<table', '</table>')]


def check_entry(pid, entry):
    issues = []
    full = entry["full"]
    brand = entry["brand"]

    if not full.strip():
        issues.append({"type": "EMPTY_FULL", "detail": "full description is empty"})
        return issues  # nothing else to check

    length = len(full)
    if length < 40:
        issues.append({"type": "VERY_SHORT", "detail": f"only {length} chars"})
    if length > 6000:
        issues.append({"type": "VERY_LONG", "detail": f"{length} chars — check for junk bloat"})

    if not brand.strip():
        issues.append({"type": "EMPTY_BRAND", "detail": "no brand set (may be legitimate for generics)"})

    for site, patterns in FOREIGN_SITE_SIGNATURES.items():
        for pat in patterns:
            if re.search(pat, full):
                issues.append({"type": "FOREIGN_SITE_MARKUP", "detail": f"matches {site} pattern /{pat}/"})
                break  # one hit per site is enough to flag it

    if BULLET_CHAR_PATTERN.search(full):
        issues.append({"type": "MANUAL_BULLET_CHARS", "detail": "uses · or • instead of real <li> list"})

    if ENTITY_PATTERN.search(full) and re.search(r'&nbsp;|&amp;amp;', full):
        issues.append({"type": "DOUBLE_ENCODED_ENTITIES", "detail": "possible double-encoded HTML entities"})

    if '<li></li>' in full or '<li> </li>' in full:
        issues.append({"type": "EMPTY_LIST_ITEM", "detail": "contains an empty <li></li>"})

    # crude unbalanced-tag check (not a full HTML parser, just a smell test)
    for open_tag, close_tag in TAG_PAIRS:
        open_count = len(re.findall(re.escape(open_tag) + r'[ >]', full))
        close_count = full.count(close_tag)
        if open_count != close_count:
            issues.append({
                "type": "UNBALANCED_TAGS",
                "detail": f"{open_tag}...{close_tag}: {open_count} open vs {close_count} close (possible truncation)"
            })

    # does full look suspiciously identical to just the product name/comment?
    comment = entry.get("comment", "")
    if comment and full.strip().lower().replace(" ", "") == comment.strip().lower().replace(" ", ""):
        issues.append({"type": "FULL_EQUALS_TITLE", "detail": "full description is just the product name repeated"})

    return issues


def find_duplicates(details):
    """Flag products whose 'full' text is identical (copy-pasted description)."""
    hash_map = defaultdict(list)
    for pid, entry in details.items():
        if entry["full"].strip():
            h = hashlib.md5(entry["full"].strip().encode("utf-8")).hexdigest()
            hash_map[h].append(pid)
    return {h: ids for h, ids in hash_map.items() if len(ids) > 1}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    if len(sys.argv) < 2:
        print("Usage: python qa_product_details.py product-details.js")
        sys.exit(1)

    path = sys.argv[1]
    with open(path, "r", encoding="utf-8") as f:
        js_text = f.read()

    details = parse_product_details(js_text)
    print(f"Parsed {len(details)} product-detail entries.\n")

    report = {"total_entries": len(details), "entries_with_issues": {}, "summary_counts": defaultdict(int)}

    for pid, entry in details.items():
        issues = check_entry(pid, entry)
        if issues:
            report["entries_with_issues"][pid] = {
                "comment": entry.get("comment", ""),
                "issues": issues,
                "full_preview": entry["full"][:150] + ("..." if len(entry["full"]) > 150 else "")
            }
            for issue in issues:
                report["summary_counts"][issue["type"]] += 1

    dupes = find_duplicates(details)
    if dupes:
        report["duplicate_descriptions"] = dupes

    # write machine-readable report
    with open("qa_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    # write + print human-readable summary
    lines = []
    lines.append("=" * 70)
    lines.append("QUALITY REPORT SUMMARY")
    lines.append("=" * 70)
    lines.append(f"Total entries parsed: {report['total_entries']}")
    lines.append(f"Entries with at least one issue: {len(report['entries_with_issues'])}")
    lines.append("")
    lines.append("Issue counts by type:")
    for issue_type, count in sorted(report["summary_counts"].items(), key=lambda x: -x[1]):
        lines.append(f"  {issue_type:<28} {count}")
    if dupes:
        lines.append("")
        lines.append(f"Duplicate description groups found: {len(dupes)}")
        for h, ids in list(dupes.items())[:10]:
            lines.append(f"  - {ids}")
        if len(dupes) > 10:
            lines.append(f"  ... and {len(dupes) - 10} more (see qa_report.json)")
    lines.append("")
    lines.append("Top 15 flagged entries (see qa_report.json for the full list):")
    for pid, info in list(report["entries_with_issues"].items())[:15]:
        lines.append(f"\n  [{pid}] {info['comment']}")
        for issue in info["issues"]:
            lines.append(f"      - {issue['type']}: {issue['detail']}")

    summary_text = "\n".join(lines)
    with open("qa_report.txt", "w", encoding="utf-8") as f:
        f.write(summary_text)

    print(summary_text)
    print("\nFull details written to qa_report.json and qa_report.txt")


if __name__ == "__main__":
    main()