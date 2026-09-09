#!/usr/bin/env python3
"""
KADIS migration scraper
========================
Pulls every real product from the OLD kadis.com.ng WooCommerce site and
writes out two files in the same format the new static site already uses:

  kadis-updates/product-index-data.js   (search index: id/name/price/cat/img/page)
  kadis-updates/product-details.js      (real per-product description, pulled
                                          from each product's own Description tab)

Run this on YOUR machine (needs internet access to kadis.com.ng), not in a
sandboxed environment. It respects a small delay between requests so it
doesn't hammer the live site.

Requirements:
    pip install requests beautifulsoup4 --break-system-packages

Usage:
    python3 scrape_kadis.py
"""

import json
import re
import time
import sys
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://kadis.com.ng"
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; KADIS-migration-script/1.0)"}
DELAY_SECONDS = 0.6  # be polite to your own server

SITEMAP_CANDIDATES = [
    f"{BASE}/product-sitemap.xml",
    f"{BASE}/sitemap_index.xml",
    f"{BASE}/wp-sitemap-posts-product-1.xml",
    f"{BASE}/wp-sitemap.xml",
]


def fetch(url):
    r = requests.get(url, headers=HEADERS, timeout=20)
    r.raise_for_status()
    return r.text


def is_real_product_page(url):
    """Sitemaps often list image URLs (e.g. Jumia CDN photos) alongside the
    actual product pages, and those image URLs can ALSO contain the text
    "/product/" somewhere in their path — so a naive substring check isn't
    enough. Only accept URLs that are actually a kadis.com.ng product page."""
    if not url.startswith(f"{BASE}/product/"):
        return False
    if re.search(r"\.(jpg|jpeg|png|gif|webp|svg)$", url, re.IGNORECASE):
        return False
    return True


def discover_product_urls():
    """Try known sitemap locations first; fall back to crawling category pages."""
    urls = set()

    for sm_url in SITEMAP_CANDIDATES:
        try:
            xml = fetch(sm_url)
        except Exception:
            continue
        soup = BeautifulSoup(xml, "xml")

        # If this is a sitemap INDEX, it lists other sitemaps — recurse once.
        sub_sitemaps = [loc.text for loc in soup.find_all("loc")
                         if "sitemap" in loc.text and loc.text != sm_url]
        product_links = [loc.text for loc in soup.find_all("loc")
                          if is_real_product_page(loc.text)]

        urls.update(product_links)

        for sub in sub_sitemaps:
            if "product" not in sub:
                continue  # skip page/post sitemaps, we only want products
            try:
                sub_xml = fetch(sub)
            except Exception:
                continue
            sub_soup = BeautifulSoup(sub_xml, "xml")
            urls.update(loc.text for loc in sub_soup.find_all("loc") if is_real_product_page(loc.text))

        if urls:
            print(f"Found {len(urls)} product URLs via sitemap: {sm_url}")
            return sorted(urls)

    print("No usable sitemap found — falling back to crawling shop/category pages.")
    return discover_via_category_crawl()


def discover_via_category_crawl():
    """Fallback: crawl /shop/ (or /?post_type=product) with pagination."""
    urls = set()
    page = 1
    while True:
        shop_url = f"{BASE}/shop/page/{page}/" if page > 1 else f"{BASE}/shop/"
        try:
            html = fetch(shop_url)
        except Exception:
            break
        soup = BeautifulSoup(html, "html.parser")
        links = [a["href"] for a in soup.select("a.woocommerce-LoopProduct-link, li.product a")
                 if a.get("href") and is_real_product_page(a["href"])]
        if not links:
            break
        before = len(urls)
        urls.update(links)
        if len(urls) == before:
            break  # no new links found, likely past the last page
        page += 1
        time.sleep(DELAY_SECONDS)
        if page > 60:  # safety cap
            break
    print(f"Found {len(urls)} product URLs via category crawl.")
    return sorted(urls)


def slugify(text, fallback):
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return slug or fallback


def extract_description(soup):
    """Try the standard WooCommerce description-tab selectors, in order."""
    selectors = [
        "#tab-description .woocommerce-Tabs-panel--description",
        "#tab-description",
        ".woocommerce-Tabs-panel--description",
        ".woocommerce-product-details__short-description",
        "[itemprop='description']",
    ]
    for sel in selectors:
        node = soup.select_one(sel)
        if node and node.get_text(strip=True):
            for heading in node.find_all(["h1", "h2", "h3"]):
                if heading.get_text(strip=True).lower() == "description":
                    heading.decompose()
            return node.decode_contents().strip()
    return ""


def scrape_product(url):
    try:
        html = fetch(url)
    except Exception as e:
        print(f"  ! failed to fetch {url}: {e}")
        return None

    soup = BeautifulSoup(html, "html.parser")

    name_el = soup.select_one("h1.product_title, h1.entry-title")
    name = name_el.get_text(strip=True) if name_el else ""

    price_el = soup.select_one("p.price, span.price")
    price = price_el.get_text(" ", strip=True) if price_el else ""

    cat_el = soup.select_one("span.posted_in a, nav.woocommerce-breadcrumb a:last-of-type")
    cat = cat_el.get_text(strip=True) if cat_el else ""

    img_el = soup.select_one(
        "div.woocommerce-product-gallery img, img.wp-post-image"
    )
    img = img_el.get("src") or img_el.get("data-src") if img_el else ""

    full_desc = extract_description(soup)

    return {
        "name": name,
        "price": price,
        "cat": cat,
        "img": img or "",
        "url": url,
        "full": full_desc,
    }


def main():
    product_urls = discover_product_urls()
    if not product_urls:
        print("No product URLs found at all — check SITEMAP_CANDIDATES / discover_via_category_crawl selectors.")
        sys.exit(1)

    print(f"Scraping {len(product_urls)} products...\n")
    results = []
    for i, url in enumerate(product_urls, 1):
        print(f"[{i}/{len(product_urls)}] {url}")
        data = scrape_product(url)
        if data and data["name"]:
            results.append(data)
        time.sleep(DELAY_SECONDS)

    print(f"\nScraped {len(results)} products successfully.")

    # ---- write raw JSON (handy for debugging / re-processing) ----
    with open("kadis_scraped_products.json", "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    # ---- write product-index-data.js (search index format) ----
    seen_slugs = {}
    index_entries = []
    details_lines = [
        "// Auto-migrated from kadis.com.ng — real descriptions, not generated.",
        "// Fill in `brand` by hand where you know it; `full` already has the",
        "// real description pulled from the old site.",
        "const KADIS_PRODUCT_DETAILS = {",
    ]

    for item in results:
        cat_slug = slugify(item["cat"], "misc")
        seen_slugs.setdefault(cat_slug, 0)
        idx = seen_slugs[cat_slug]
        seen_slugs[cat_slug] += 1
        pid = f"{cat_slug}-{idx}"

        index_entries.append({
            "id": pid,
            "name": item["name"],
            "price": item["price"],
            "cat": item["cat"],
            "img": item["img"],
            "page": "",  # fill in once you decide which new .html page it belongs on
        })

        full_escaped = item["full"].replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ")
        details_lines.append(
            f'  "{pid}": {{ brand: "", full: "{full_escaped}" }}, // {item["name"]}'
        )

    details_lines.append("};")

    with open("product-index-data.js", "w", encoding="utf-8") as f:
        f.write("const KADIS_PRODUCT_INDEX = ")
        f.write(json.dumps(index_entries, ensure_ascii=False, indent=2))
        f.write(";\n")

    with open("product-details.js", "w", encoding="utf-8") as f:
        f.write("\n".join(details_lines) + "\n")

    print("\nWrote:")
    print("  kadis_scraped_products.json  (raw scrape, for reference)")
    print("  product-index-data.js        (drop into kadis-updates/, replacing the old one)")
    print("  product-details.js           (drop into kadis-updates/, replacing the scaffold)")
    print("\nNote: `page` is blank in product-index-data.js for each entry —")
    print("you'll need to assign which .html page each product belongs on")
    print("(or write a follow-up script to auto-sort by category into the right file).")


if __name__ == "__main__":
    main()