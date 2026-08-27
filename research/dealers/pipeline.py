"""Reusable, deterministic public-source extractor for dealer research.

The pipeline deliberately stores only Markdown. It discovers URLs in a Markdown
manifest, fetches them with Scrapling's HTTP fetcher, extracts public business
contacts and structured data, scores keyword signals, and emits an auditable log.
"""

from __future__ import annotations

import argparse
import html
import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup
from curl_cffi import requests as curl_requests
from scrapling.fetchers import Fetcher


POSITIVE_KEYWORDS = {
    "дистрибьютор": 12,
    "дистрибуция": 10,
    "оптовая": 8,
    "оптом": 7,
    "торговый представитель": 7,
    "супервайзер": 6,
    "мерчендайзер": 5,
    "склад": 5,
    "доставка": 4,
    "fmcg": 12,
    "продукты питания": 8,
    "напитки": 6,
    "кондитерские изделия": 8,
    "бакалея": 5,
    "снеки": 8,
    "магазины": 4,
    "торговые точки": 6,
    "horeca": 5,
    "азс": 5,
    "эксклюзивный дистрибьютор": 12,
    "официальный дистрибьютор": 12,
    "шымкент": 10,
}

NEGATIVE_KEYWORDS = {
    "ресторан": -8,
    "кафе": -7,
    "интернет-магазин": -4,
    "временно закрыто": -15,
    "ликвидирован": -30,
}

PHONE_RE = re.compile(
    r"(?<!\d)(?:\+?7|8)[\s\-(]*(?:\d[\s\-()]*){9,10}(?!\d)", re.IGNORECASE
)
EMAIL_RE = re.compile(r"(?<![\w.+-])[\w.+-]+@[\w.-]+\.[A-Za-zА-Яа-я]{2,}(?![\w.-])")
URL_RE = re.compile(r"https?://[^\s)>\]}`\"']+")


def normalize_phone(value: str) -> str | None:
    digits = re.sub(r"\D", "", value)
    if len(digits) == 11 and digits.startswith("8"):
        return "7" + digits[1:]
    if len(digits) == 11 and digits.startswith("7"):
        return digits
    if len(digits) == 10:
        return "7" + digits
    return None


def unique(values: list[str | None]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        cleaned = " ".join((value or "").split()).strip(" ,.;")
        key = cleaned.casefold()
        if cleaned and key not in seen:
            seen.add(key)
            result.append(cleaned)
    return result


def iter_json(value: Any):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from iter_json(child)
    elif isinstance(value, list):
        for child in value:
            yield from iter_json(child)


def structured_data(soup: BeautifulSoup) -> tuple[list[str], list[str], list[str], list[str]]:
    names: list[str] = []
    phones: list[str] = []
    emails: list[str] = []
    addresses: list[str] = []
    for script in soup.select('script[type="application/ld+json"]'):
        raw = script.string or script.get_text(" ", strip=True)
        try:
            payload = json.loads(raw)
        except (TypeError, json.JSONDecodeError):
            continue
        for node in iter_json(payload):
            if isinstance(node.get("name"), str):
                names.append(node["name"])
            if isinstance(node.get("telephone"), str):
                phones.append(node["telephone"])
            if isinstance(node.get("email"), str):
                emails.append(node["email"])
            address = node.get("address")
            if isinstance(address, str):
                addresses.append(address)
            elif isinstance(address, dict):
                address_text = ", ".join(
                    str(address[key])
                    for key in ("postalCode", "addressRegion", "addressLocality", "streetAddress")
                    if address.get(key)
                )
                if address_text:
                    addresses.append(address_text)
    return unique(names), unique(phones), unique(emails), unique(addresses)


def two_gis_contacts(
    page_url: str, raw: str
) -> tuple[list[str], list[str], list[str], list[str], list[str], list[str]]:
    """Extract public contacts through the catalog endpoint configured by 2GIS itself."""
    firm_match = re.search(r"/firm/(\d+)", page_url)
    key_match = re.search(r'"webApiOutsourceKey":"([^"]+)"', raw)
    if not firm_match or not key_match:
        return [], [], [], [], [], []
    api_url = (
        "https://catalog.api.2gis.ru/3.0/items/byid"
        f"?id={firm_match.group(1)}&key={key_match.group(1)}"
        "&fields=items.contact_groups,items.address_name,items.full_name,items.name"
    )
    response = curl_requests.get(api_url, impersonate="chrome", timeout=20)
    payload = response.json()
    items = payload.get("result", {}).get("items", [])
    if not items:
        return [], [], [], [], [], []
    item = items[0]
    names = [str(item.get("name", ""))]
    addresses = [str(item.get("full_name") or item.get("address_name") or "")]
    phones: list[str] = []
    whatsapp: list[str] = []
    emails: list[str] = []
    instagram: list[str] = []
    for group in item.get("contact_groups", []):
        for contact in group.get("contacts", []):
            kind = str(contact.get("type", "")).casefold()
            value = str(contact.get("value") or contact.get("text") or "")
            if kind == "phone":
                phones.append(value)
            elif kind == "whatsapp":
                wa_match = re.search(r"wa\.me/(\d{10,11})", value)
                whatsapp.append(wa_match.group(1) if wa_match else value)
            elif kind == "email":
                emails.append(value)
            elif kind == "instagram":
                instagram.append(value)
    return names, phones, whatsapp, emails, instagram, addresses


@dataclass
class PageResult:
    url: str
    final_url: str = ""
    status: int | None = None
    title: str = ""
    company_names: list[str] = field(default_factory=list)
    phones: list[str] = field(default_factory=list)
    whatsapp: list[str] = field(default_factory=list)
    emails: list[str] = field(default_factory=list)
    instagram: list[str] = field(default_factory=list)
    addresses: list[str] = field(default_factory=list)
    markers: list[str] = field(default_factory=list)
    keyword_score: int = 0
    error: str = ""


def extract_page(url: str) -> PageResult:
    result = PageResult(url=url)
    try:
        response = Fetcher.get(url, timeout=25, retries=1)
        result.status = int(response.status)
        result.final_url = str(response.url)
        raw = str(response.html_content)
        soup = BeautifulSoup(raw, "lxml")
        for tag in soup(["script", "style", "noscript", "template", "svg"]):
            tag.decompose()
        text = html.unescape(" ".join(soup.get_text(" ", strip=True).split()))
        lowered = text.casefold()

        result.title = " ".join((soup.title.get_text(" ", strip=True) if soup.title else "").split())
        names, schema_phones, schema_emails, addresses = structured_data(BeautifulSoup(raw, "lxml"))
        gis_names: list[str] = []
        gis_phones: list[str] = []
        gis_whatsapp: list[str] = []
        gis_emails: list[str] = []
        gis_instagram: list[str] = []
        gis_addresses: list[str] = []
        if "2gis." in urlparse(result.final_url or url).netloc.casefold():
            (
                gis_names,
                gis_phones,
                gis_whatsapp,
                gis_emails,
                gis_instagram,
                gis_addresses,
            ) = two_gis_contacts(result.final_url or url, raw)
        result.company_names = unique(names + gis_names)
        result.addresses = unique(addresses + gis_addresses)

        phone_candidates = schema_phones + gis_phones + PHONE_RE.findall(text)
        result.phones = unique([normalize_phone(item) for item in phone_candidates])
        result.emails = unique(schema_emails + gis_emails + EMAIL_RE.findall(text))

        for link in BeautifulSoup(raw, "lxml").select("a[href]"):
            href = urljoin(result.final_url or url, link.get("href", ""))
            host = urlparse(href).netloc.casefold()
            if "wa.me" in host or "whatsapp" in host:
                number = normalize_phone(href)
                result.whatsapp.extend([number] if number else [])
            if "instagram.com" in host:
                result.instagram.append(href.split("?")[0].rstrip("/"))
        result.whatsapp = unique(
            result.whatsapp + [normalize_phone(item) for item in gis_whatsapp]
        )
        result.instagram = unique(result.instagram + gis_instagram)

        signals = {**POSITIVE_KEYWORDS, **NEGATIVE_KEYWORDS}
        hits = [(keyword, weight) for keyword, weight in signals.items() if keyword in lowered]
        result.markers = [keyword for keyword, _ in hits]
        result.keyword_score = max(0, min(100, sum(weight for _, weight in hits)))
    except Exception as exc:  # network/parser failures belong in the audit log
        result.error = f"{type(exc).__name__}: {exc}"[:240]
    return result


def manifest_urls(path: Path) -> list[str]:
    urls = [match.rstrip(".,;") for match in URL_RE.findall(path.read_text(encoding="utf-8"))]
    return list(dict.fromkeys(urls))


def write_markdown(path: Path, results: list[PageResult]) -> None:
    fetched = sum(item.status is not None for item in results)
    successful = sum(item.status is not None and item.status < 400 for item in results)
    lines = [
        "# Dealer discovery extraction log",
        "",
        f"- Checked: {date.today().isoformat()}",
        f"- URLs: {len(results)}",
        f"- Fetched: {fetched}",
        f"- Successful HTTP responses: {successful}",
        "- Method: Scrapling Fetcher + BeautifulSoup/lxml + regex + JSON-LD + deterministic keyword scoring",
        "",
    ]
    for index, item in enumerate(results, 1):
        lines.extend(
            [
                f"## {index}. {item.title or urlparse(item.url).netloc}",
                "",
                f"- URL: {item.url}",
                f"- Final URL: {item.final_url or '—'}",
                f"- HTTP: {item.status if item.status is not None else 'error'}",
                f"- Company names (JSON-LD): {'; '.join(item.company_names) or '—'}",
                f"- Phones (normalized): {'; '.join(item.phones) or '—'}",
                f"- Confirmed WhatsApp links: {'; '.join(item.whatsapp) or '—'}",
                f"- Emails: {'; '.join(item.emails) or '—'}",
                f"- Instagram: {'; '.join(item.instagram) or '—'}",
                f"- Addresses (JSON-LD): {'; '.join(item.addresses) or '—'}",
                f"- Keyword score: {item.keyword_score}",
                f"- Markers: {', '.join(item.markers) or '—'}",
                f"- Error: {item.error or '—'}",
                "",
            ]
        )
    with path.open("w", encoding="utf-8", newline="\n") as output:
        output.write("\n".join(lines).rstrip() + "\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, default=Path(__file__).with_name("SOURCES.md"))
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("DISCOVERY_LOG.md"))
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args()

    urls = manifest_urls(args.manifest)
    results: list[PageResult] = []
    with ThreadPoolExecutor(max_workers=max(1, min(args.workers, 16))) as executor:
        future_map = {executor.submit(extract_page, url): url for url in urls}
        for future in as_completed(future_map):
            results.append(future.result())
    order = {url: index for index, url in enumerate(urls)}
    results.sort(key=lambda item: order[item.url])
    write_markdown(args.output, results)
    print(f"wrote {args.output}: {len(results)} URLs")


if __name__ == "__main__":
    main()
