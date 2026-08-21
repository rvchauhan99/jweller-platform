"""Jeweler tax invoice PDF (ReportLab) — GST-inclusive jewellery composite @ 3%."""
from __future__ import annotations

import io
import re
from datetime import datetime, timezone
from typing import Any, Optional
from zoneinfo import ZoneInfo

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

IST = ZoneInfo("Asia/Kolkata")
DEFAULT_HSN = "7113"
GST_RATE = 0.03  # jewellery composite GST


def _norm_state(s: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (s or "").strip().lower())


def _money(n: float) -> str:
    return f"INR {n:,.2f}"


def _fmt_date(iso: Optional[str]) -> str:
    if not iso:
        return ""
    try:
        raw = str(iso).replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(IST).strftime("%d %b %Y, %I:%M %p IST")
    except Exception:
        return str(iso)[:19]


def enrich_line(item: dict, product: Optional[dict] = None) -> dict:
    """Merge order line with product snapshot / live product for invoice columns."""
    prod = product or {}
    weight = item.get("weight_grams")
    if weight is None:
        weight = prod.get("weight_grams", 0) or 0
    purity = item.get("purity") or prod.get("purity") or "—"
    making = item.get("making_charge")
    if making is None:
        making = prod.get("making_charge", 0) or 0
    making_type = item.get("making_charge_type") or prod.get("making_charge_type") or "flat"
    hsn = item.get("hsn") or prod.get("hsn") or DEFAULT_HSN
    return {
        "name": item.get("name") or prod.get("name") or "Item",
        "qty": int(item.get("qty") or 1),
        "price": float(item.get("price") or 0),
        "weight_grams": float(weight or 0),
        "purity": str(purity),
        "making_charge": float(making or 0),
        "making_charge_type": str(making_type),
        "hsn": str(hsn),
        "product_id": item.get("product_id") or prod.get("id"),
    }


def snapshot_fields_from_product(prod: dict) -> dict:
    """Fields to persist on order line at create time."""
    return {
        "weight_grams": float(prod.get("weight_grams") or 0),
        "purity": prod.get("purity") or "",
        "making_charge": float(prod.get("making_charge") or 0),
        "making_charge_type": prod.get("making_charge_type") or "flat",
        "hsn": prod.get("hsn") or DEFAULT_HSN,
    }


def gst_breakup(*, grand_total: float, bill_state: str, seller_state: str) -> dict:
    """Reverse-compute taxable + tax from GST-inclusive total @ 3%."""
    total = round(float(grand_total or 0), 2)
    if total <= 0:
        return {
            "taxable": 0.0,
            "cgst": 0.0,
            "sgst": 0.0,
            "igst": 0.0,
            "tax": 0.0,
            "mode": "cgst_sgst",
            "grand_total": 0.0,
        }
    taxable = round(total / (1 + GST_RATE), 2)
    tax = round(total - taxable, 2)
    same_state = _norm_state(bill_state) and _norm_state(bill_state) == _norm_state(seller_state)
    if same_state or not _norm_state(bill_state):
        # Default intra-state when buyer state missing (common on older orders)
        half = round(tax / 2, 2)
        # Adjust rounding so halves sum to tax
        cgst, sgst = half, round(tax - half, 2)
        return {
            "taxable": taxable,
            "cgst": cgst,
            "sgst": sgst,
            "igst": 0.0,
            "tax": tax,
            "mode": "cgst_sgst",
            "grand_total": total,
        }
    return {
        "taxable": taxable,
        "cgst": 0.0,
        "sgst": 0.0,
        "igst": tax,
        "tax": tax,
        "mode": "igst",
        "grand_total": total,
    }


def build_tax_invoice_pdf(
    *,
    tenant: dict,
    order: dict,
    products_by_id: Optional[dict[str, dict]] = None,
) -> bytes:
    """Build an A4 jeweler TAX INVOICE PDF."""
    products_by_id = products_by_id or {}
    business = tenant.get("business_name") or "Jeweler"
    gstin = tenant.get("gstin") or "GSTIN not set"
    prefix = tenant.get("invoice_prefix") or "INV"
    inv_no = order.get("invoice_no") or f"{prefix}-{order.get('order_no', order.get('id', ''))}"
    seller_state = tenant.get("state") or tenant.get("business_state") or "Maharashtra"
    seller_phone = tenant.get("phone") or tenant.get("business_phone") or ""
    seller_addr = tenant.get("address") or tenant.get("business_address") or ""

    contact = order.get("contact") or {}
    address = order.get("address") or {}
    bill_state = address.get("state") or ""

    lines = [
        enrich_line(it, products_by_id.get(str(it.get("product_id") or "")))
        for it in (order.get("items") or [])
    ]
    grand = float(order.get("subtotal") or 0)
    if grand <= 0 and lines:
        grand = round(sum(L["price"] * L["qty"] for L in lines), 2)
    tax = gst_breakup(grand_total=grand, bill_state=bill_state, seller_state=seller_state)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "InvTitle",
        parent=styles["Heading1"],
        fontSize=16,
        alignment=TA_CENTER,
        spaceAfter=4,
        textColor=colors.HexColor("#1a1a1a"),
    )
    h_style = ParagraphStyle(
        "InvBiz",
        parent=styles["Normal"],
        fontSize=13,
        leading=16,
        alignment=TA_LEFT,
        textColor=colors.HexColor("#111111"),
    )
    small = ParagraphStyle(
        "InvSmall",
        parent=styles["Normal"],
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#333333"),
    )
    small_r = ParagraphStyle("InvSmallR", parent=small, alignment=TA_RIGHT)
    cell = ParagraphStyle("InvCell", parent=styles["Normal"], fontSize=8, leading=10)
    footer_style = ParagraphStyle(
        "InvFoot",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#666666"),
        alignment=TA_CENTER,
    )

    story: list[Any] = []
    story.append(Paragraph("TAX INVOICE", title_style))
    story.append(Paragraph(business, h_style))
    meta_bits = [f"<b>GSTIN:</b> {gstin}"]
    if seller_addr:
        meta_bits.append(seller_addr)
    if seller_phone:
        meta_bits.append(f"Phone: {seller_phone}")
    meta_bits.append(f"Place of supply state: {seller_state}")
    story.append(Paragraph("<br/>".join(meta_bits), small))
    story.append(Spacer(1, 8))

    bill_lines = [
        f"<b>{contact.get('name') or 'Customer'}</b>",
        contact.get("phone") or "",
        contact.get("email") or "",
        address.get("line1") or "",
        ", ".join(
            x for x in [address.get("city"), address.get("state"), address.get("pincode")] if x
        ),
    ]
    bill_html = "<br/>".join(x for x in bill_lines if x)

    inv_meta = [
        f"<b>Invoice No:</b> {inv_no}",
        f"<b>Order No:</b> {order.get('order_no') or ''}",
        f"<b>Date:</b> {_fmt_date(order.get('paid_at') or order.get('created_at'))}",
        f"<b>Payment:</b> {order.get('payment_status') or ''}",
        f"<b>Gateway Ref:</b> {order.get('gateway_payment_id') or '—'}",
        f"<b>Channel:</b> {order.get('channel') or 'online'}",
    ]
    head = Table(
        [
            [
                Paragraph("<b>Bill To</b><br/>" + bill_html, small),
                Paragraph("<br/>".join(inv_meta), small_r),
            ]
        ],
        colWidths=[95 * mm, 75 * mm],
    )
    head.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("BOX", (0, 0), (-1, -1), 0.4, colors.HexColor("#cccccc")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fafafa")),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(head)
    story.append(Spacer(1, 10))

    table_data = [
        [
            Paragraph("<b>#</b>", cell),
            Paragraph("<b>Description</b>", cell),
            Paragraph("<b>HSN</b>", cell),
            Paragraph("<b>Purity</b>", cell),
            Paragraph("<b>Wt (g)</b>", cell),
            Paragraph("<b>Qty</b>", cell),
            Paragraph("<b>Making</b>", cell),
            Paragraph("<b>Rate</b>", cell),
            Paragraph("<b>Amount</b>", cell),
        ]
    ]
    for i, L in enumerate(lines, start=1):
        amt = round(L["price"] * L["qty"], 2)
        making_txt = (
            f"{L['making_charge']:.0f}%"
            if L["making_charge_type"] == "percent"
            else _money(L["making_charge"])
        )
        table_data.append(
            [
                Paragraph(str(i), cell),
                Paragraph(L["name"], cell),
                Paragraph(L["hsn"], cell),
                Paragraph(L["purity"], cell),
                Paragraph(f"{L['weight_grams']:.3f}", cell),
                Paragraph(str(L["qty"]), cell),
                Paragraph(making_txt, cell),
                Paragraph(_money(L["price"]), cell),
                Paragraph(_money(amt), cell),
            ]
        )

    col_w = [8 * mm, 48 * mm, 14 * mm, 14 * mm, 16 * mm, 10 * mm, 22 * mm, 22 * mm, 24 * mm]
    items_tbl = Table(table_data, colWidths=col_w, repeatRows=1)
    items_tbl.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a1a")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cccccc")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (4, 1), (-1, -1), "RIGHT"),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("LEFTPADDING", (0, 0), (-1, -1), 3),
                ("RIGHTPADDING", (0, 0), (-1, -1), 3),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7f7f7")]),
            ]
        )
    )
    story.append(items_tbl)
    story.append(Spacer(1, 10))

    if tax["mode"] == "igst":
        tax_rows = [
            ["Taxable value", _money(tax["taxable"])],
            ["IGST @ 3%", _money(tax["igst"])],
            ["Grand total", _money(tax["grand_total"])],
        ]
    else:
        tax_rows = [
            ["Taxable value", _money(tax["taxable"])],
            ["CGST @ 1.5%", _money(tax["cgst"])],
            ["SGST @ 1.5%", _money(tax["sgst"])],
            ["Grand total", _money(tax["grand_total"])],
        ]
    totals = Table(tax_rows, colWidths=[40 * mm, 35 * mm], hAlign="RIGHT")
    totals.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("LINEABOVE", (0, -1), (-1, -1), 0.6, colors.HexColor("#333333")),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]
        )
    )
    story.append(totals)
    story.append(Spacer(1, 14))
    story.append(
        Paragraph(
            "Prices are GST-inclusive (jewellery composite 3%). "
            "E-invoice IRN not generated. This is a computer-generated tax invoice.",
            footer_style,
        )
    )
    story.append(Paragraph(f"Thank you for shopping with {business}.", footer_style))

    doc.build(story)
    return buf.getvalue()


# --- Back-compat aliases used by older tests / imports ---
def invoice_lines_for_order(*, tenant: dict, order: dict) -> list[str]:
    """Plain-text summary (tests / debug). Prefer build_tax_invoice_pdf for downloads."""
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
    lines.append("Tax: GST-inclusive 3% (jewellery)")
    contact = order.get("contact") or {}
    lines.append("")
    lines.append(f"Bill to: {contact.get('name', '')}  {contact.get('phone', '')}")
    return lines


def build_simple_pdf(lines: list[str], title: str = "Invoice") -> bytes:
    """Deprecated stub path — routes a minimal order through ReportLab for tests."""
    tenant = {"business_name": title, "gstin": "GSTIN not set", "invoice_prefix": "INV"}
    order = {
        "invoice_no": "INV-TEST",
        "order_no": "TEST",
        "subtotal": 0,
        "items": [],
        "contact": {"name": "", "phone": ""},
        "address": {},
        "payment_status": "paid",
    }
    # Put text lines into a single pseudo item description so content is searchable
    blob = " | ".join(lines[:20]) if lines else title
    order["items"] = [{"name": blob[:120], "price": 0, "qty": 1, "hsn": DEFAULT_HSN}]
    return build_tax_invoice_pdf(tenant=tenant, order=order, products_by_id={})
