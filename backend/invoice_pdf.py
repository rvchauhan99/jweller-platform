"""Minimal PDF builder (no reportlab) for GST stub invoices."""
from __future__ import annotations


def _escape_pdf_text(s: str) -> str:
    return (s or "").replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def build_simple_pdf(lines: list[str], title: str = "Invoice") -> bytes:
    """Build a single-page PDF with Helvetica text lines."""
    content_lines = [f"BT /F1 16 Tf 50 780 Td ({_escape_pdf_text(title)}) Tj"]
    y_offset = -28
    content_lines.append(f"/F1 11 Tf 0 {y_offset} Td ({_escape_pdf_text(lines[0] if lines else '')}) Tj" if lines else "")
    for i, line in enumerate(lines):
        if i == 0:
            continue
        content_lines.append(f"0 -16 Td ({_escape_pdf_text(line)}) Tj")
    content_lines.append("ET")
    stream = "\n".join([c for c in content_lines if c])
    stream_bytes = stream.encode("latin-1", errors="replace")

    objects: list[bytes] = []
    objects.append(b"1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n")
    objects.append(b"2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n")
    objects.append(
        b"3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n"
    )
    objects.append(
        f"4 0 obj<< /Length {len(stream_bytes)} >>stream\n".encode("latin-1")
        + stream_bytes
        + b"\nendstream\nendobj\n"
    )
    objects.append(b"5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n")

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for obj in objects:
        offsets.append(len(out))
        out.extend(obj)
    xref_pos = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("latin-1"))
    out.extend(
        f"trailer<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref_pos}\n%%EOF\n".encode(
            "latin-1"
        )
    )
    return bytes(out)


def invoice_lines_for_order(*, tenant: dict, order: dict) -> list[str]:
    business = tenant.get("business_name") or "Jeweler"
    gstin = tenant.get("gstin") or "GSTIN not set"
    prefix = tenant.get("invoice_prefix") or "INV"
    inv_no = order.get("invoice_no") or f"{prefix}-{order.get('order_no', order.get('id', ''))}"
    lines = [
        f"Business: {business}",
        f"GSTIN: {gstin}",
        f"Invoice: {inv_no}",
        f"Order: {order.get('order_no', '')}",
        f"Date: {order.get('paid_at') or order.get('created_at') or ''}",
        f"Payment: {order.get('payment_status', '')} / {order.get('gateway_payment_id') or '—'}",
        "",
        "Items:",
    ]
    for it in order.get("items") or []:
        name = it.get("name") or "Item"
        qty = it.get("qty") or 1
        price = it.get("price") or 0
        lines.append(f"  - {name} x{qty}  INR {price}")
    lines.append("")
    lines.append(f"Subtotal (INR): {order.get('subtotal', 0)}")
    lines.append("Tax: included / stub (e-invoice IRN not generated)")
    contact = order.get("contact") or {}
    lines.append("")
    lines.append(f"Bill to: {contact.get('name', '')}  {contact.get('phone', '')}")
    return lines
