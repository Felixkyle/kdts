"""
list_categories.py

Prints every distinct category value (and id-prefix) found in
product-index-data.js, with counts, sorted by frequency. This is the input
needed to build the category -> target .html page mapping table.

Usage:
    python list_categories.py product-index-data.js
"""

import sys
import re
import json
from collections import Counter

def main():
    if len(sys.argv) < 2:
        print("Usage: python list_categories.py product-index-data.js")
        sys.exit(1)

    with open(sys.argv[1], "r", encoding="utf-8") as f:
        text = f.read()

    # Strip the `const KADIS_PRODUCT_INDEX = ... ;` wrapper so it's valid JSON
    match = re.search(r'=\s*(\[.*\])\s*;?\s*$', text, re.DOTALL)
    if not match:
        print("Could not find the array literal in the file.")
        sys.exit(1)

    data = json.loads(match.group(1))

    cat_counter = Counter()
    prefix_counter = Counter()

    for item in data:
        cat = item.get("cat", "").strip()
        cat_counter[cat] += 1

        pid = item.get("id", "")
        prefix = re.sub(r'-\d+$', '', pid)  # strip trailing "-N"
        prefix_counter[prefix] += 1

    print(f"Total products: {len(data)}\n")

    print("=" * 60)
    print(f"DISTINCT 'cat' VALUES ({len(cat_counter)} unique)")
    print("=" * 60)
    for cat, count in cat_counter.most_common():
        print(f"  {count:>4}  {cat!r}")

    print()
    print("=" * 60)
    print(f"DISTINCT ID PREFIXES ({len(prefix_counter)} unique)")
    print("=" * 60)
    for prefix, count in prefix_counter.most_common():
        print(f"  {count:>4}  {prefix}")

    # Flag where 'cat' and id-prefix disagree in an interesting way
    # (helps spot cases where cat casing/spacing differs from the slug used
    # for ids -- useful for the mapping table).
    print()
    print("=" * 60)
    print("SAMPLE cat -> id-prefix PAIRS (first occurrence of each cat)")
    print("=" * 60)
    seen = set()
    for item in data:
        cat = item.get("cat", "").strip()
        if cat not in seen:
            seen.add(cat)
            pid = item.get("id", "")
            prefix = re.sub(r'-\d+$', '', pid)
            print(f"  cat={cat!r:<45} -> id-prefix={prefix!r}")

if __name__ == "__main__":
    main()