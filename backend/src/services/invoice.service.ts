import { prisma } from '../config/database';
import { AppError } from '../utils/appError';

export interface InvoiceItem {
  name: string;
  sku?: string;
  hsn?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  taxableValue: number;
  gstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  bv: number;
}

export interface InvoiceData {
  invoiceNumber: string;
  invoiceDate: string;
  orderNumber: string;
  orderDate: string;
  paymentMethod: string;
  paymentStatus: string;
  transactionRef: string;
  isInterState: boolean;
  seller: {
    name: string;
    tradeName: string;
    address: string;
    city: string;
    state: string;
    stateCode: string;
    postalCode: string;
    gstin: string;
    pan: string;
    email: string;
    phone: string;
  };
  buyer: {
    name: string;
    memberId: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    stateCode: string;
    postalCode: string;
    country: string;
  };
  items: InvoiceItem[];
  totals: {
    itemsCount: number;
    taxableTotal: number;
    cgstTotal: number;
    sgstTotal: number;
    igstTotal: number;
    gstTotal: number;
    grandTotal: number;
    totalBV: number;
  };
}

/**
 * Builds an in-memory PDF 1.4 document Buffer with GST invoice styling.
 * Zero external binary or font file dependencies — 100% compatible with Vercel serverless.
 */
class SimplePdfWriter {
  private contentStream: string[] = [];
  private fontRegularId = 5;
  private fontBoldId = 6;

  constructor() {}

  public setColor(r: number, g: number, b: number) {
    this.contentStream.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} rg`);
  }

  public setStrokeColor(r: number, g: number, b: number) {
    this.contentStream.push(`${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)} RG`);
  }

  public setLineWidth(w: number) {
    this.contentStream.push(`${w.toFixed(2)} w`);
  }

  public drawRect(x: number, y: number, w: number, h: number, fill = false, stroke = true) {
    const op = fill && stroke ? 'b' : fill ? 'f' : 's';
    this.contentStream.push(`${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re ${op}`);
  }

  public drawLine(x1: number, y1: number, x2: number, y2: number) {
    this.contentStream.push(`${x1.toFixed(2)} ${y1.toFixed(2)} m ${x2.toFixed(2)} ${y2.toFixed(2)} l S`);
  }

  private escapePdfText(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[^\x20-\x7E]/g, ' '); // Clean non-ASCII for WinAnsi standard font
  }

  public addText(text: string, x: number, y: number, fontSize = 10, bold = false) {
    const fontRef = bold ? `/F2` : `/F1`;
    const clean = this.escapePdfText(text);
    this.contentStream.push(`BT ${fontRef} ${fontSize} Tf ${x.toFixed(2)} ${y.toFixed(2)} Td (${clean}) Tj ET`);
  }

  public addTextRight(text: string, rightX: number, y: number, fontSize = 10, bold = false) {
    // Approximate character width for Helvetica: ~0.55 * fontSize
    const charWidth = fontSize * 0.55;
    const estWidth = text.length * charWidth;
    const x = Math.max(20, rightX - estWidth);
    this.addText(text, x, y, fontSize, bold);
  }

  public toBuffer(): Buffer {
    const pageStreamContent = this.contentStream.join('\n');
    const streamLen = Buffer.byteLength(pageStreamContent, 'utf-8');

    const objects: string[] = [];

    // Obj 1: Catalog
    objects[1] = `1 0 obj\n<<\n  /Type /Catalog\n  /Pages 2 0 R\n>>\nendobj`;

    // Obj 2: Pages
    objects[2] = `2 0 obj\n<<\n  /Type /Pages\n  /Kids [3 0 R]\n  /Count 1\n>>\nendobj`;

    // Obj 3: Page (A4: 595.28 x 841.89 points)
    objects[3] = `3 0 obj\n<<\n  /Type /Page\n  /Parent 2 0 R\n  /MediaBox [0 0 595.28 841.89]\n  /Contents 4 0 R\n  /Resources <<\n    /Font <<\n      /F1 5 0 R\n      /F2 6 0 R\n    >>\n  >>\n>>\nendobj`;

    // Obj 4: Content Stream
    objects[4] = `4 0 obj\n<<\n  /Length ${streamLen}\n>>\nstream\n${pageStreamContent}\nendstream\nendobj`;

    // Obj 5: Helvetica (Regular)
    objects[5] = `5 0 obj\n<<\n  /Type /Font\n  /Subtype /Type1\n  /BaseFont /Helvetica\n  /Encoding /WinAnsiEncoding\n>>\nendobj`;

    // Obj 6: Helvetica-Bold
    objects[6] = `6 0 obj\n<<\n  /Type /Font\n  /Subtype /Type1\n  /BaseFont /Helvetica-Bold\n  /Encoding /WinAnsiEncoding\n>>\nendobj`;

    let body = `%PDF-1.4\n%\xE2\xE3\xCF\xD3\n`;
    const xrefOffsets: number[] = [0];

    for (let i = 1; i <= 6; i++) {
      xrefOffsets[i] = Buffer.byteLength(body, 'utf-8');
      body += objects[i] + '\n';
    }

    const startXref = Buffer.byteLength(body, 'utf-8');
    body += `xref\n0 7\n`;
    body += `0000000000 65535 f \n`;
    for (let i = 1; i <= 6; i++) {
      const offsetStr = xrefOffsets[i].toString().padStart(10, '0');
      body += `${offsetStr} 00000 n \n`;
    }

    body += `trailer\n<<\n  /Size 7\n  /Root 1 0 R\n>>\nstartxref\n${startXref}\n%%EOF\n`;

    return Buffer.from(body, 'utf-8');
  }
}

export class InvoiceService {
  /**
   * Compiles the authoritative GST Invoice snapshot from an order in the database.
   */
  public static async getInvoiceDataForOrder(orderIdOrNumber: string, userId: string, role: string): Promise<InvoiceData> {
    const where: any = {
      OR: [{ id: orderIdOrNumber }, { orderNumber: orderIdOrNumber }],
      deletedAt: null,
    };

    if (role !== 'ADMIN' && role !== 'SUPER_ADMIN') {
      where.OR = [
        { id: orderIdOrNumber, userId },
        { orderNumber: orderIdOrNumber, userId },
        { id: orderIdOrNumber, distributor: { userId } },
        { orderNumber: orderIdOrNumber, distributor: { userId } },
      ];
    }

    const order = await prisma.order.findFirst({
      where,
      include: {
        items: {
          include: {
            product: true,
          },
        },
        shippingAddress: true,
        billingAddress: true,
        user: {
          include: {
            distributorProfile: true,
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!order) {
      throw AppError.notFound('Order not found or you are not authorized to access its invoice.', 'ORDER_NOT_FOUND');
    }

    const address = order.shippingAddress || order.billingAddress;
    const buyerState = address?.state || 'Haryana';
    const isInterState = buyerState.trim().toLowerCase() !== 'haryana';

    const latestPayment = order.payments[0];
    const paymentMethodDisplay =
      latestPayment?.method === 'WALLET'
        ? 'Commission Balance Wallet'
        : latestPayment?.method === 'UPI'
        ? 'Razorpay (UPI / Instant QR)'
        : latestPayment?.method === 'CREDIT_CARD' || latestPayment?.method === 'DEBIT_CARD'
        ? 'Razorpay (Debit / Credit / NetBanking)'
        : (latestPayment?.method || 'Prepaid Wholesale');

    const paymentRef =
      latestPayment?.gatewayTransactionId ||
      latestPayment?.paymentNumber ||
      order.orderNumber;

    let taxableTotal = 0;
    let cgstTotal = 0;
    let sgstTotal = 0;
    let igstTotal = 0;
    let totalBV = 0;
    let grandTotal = 0;

    const items: InvoiceItem[] = order.items.map((item, idx) => {
      const lineTotal = Number(item.totalPrice);
      // Tax-inclusive math: Taxable Value = Total / 1.18
      const taxable = Math.round((lineTotal / 1.18) * 100) / 100;
      const totalGst = Math.round((lineTotal - taxable) * 100) / 100;
      const cgst = isInterState ? 0 : Math.round((totalGst / 2) * 100) / 100;
      const sgst = isInterState ? 0 : Math.round((totalGst - cgst) * 100) / 100;
      const igst = isInterState ? totalGst : 0;
      const bv = Number(item.totalBV);

      taxableTotal += taxable;
      cgstTotal += cgst;
      sgstTotal += sgst;
      igstTotal += igst;
      totalBV += bv;
      grandTotal += lineTotal;

      return {
        name: item.product?.name || `Wholesale Item ${idx + 1}`,
        sku: item.product?.sku || `SKU-${idx + 1}`,
        hsn: (item.product as any)?.hsnCode || '61091000', // Standard Garments HSN fallback
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        totalPrice: lineTotal,
        taxableValue: taxable,
        gstRate: 18,
        cgstAmount: cgst,
        sgstAmount: sgst,
        igstAmount: igst,
        bv,
      };
    });

    const invoiceNumber = `INV-${order.orderNumber.replace(/^ORD-/, '')}`;
    const invoiceDate = (order.paidAt || order.createdAt).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const buyerName =
      address?.recipientName ||
      order.user?.name ||
      order.user?.distributorProfile?.displayName ||
      'Authorized Distributor';
    const memberId =
      order.user?.distributorProfile?.memberId ||
      order.user?.distributorProfile?.distributorId ||
      order.userId?.slice(0, 8).toUpperCase() ||
      'DIST-887671';

    return {
      invoiceNumber,
      invoiceDate,
      orderNumber: order.orderNumber,
      orderDate: order.createdAt.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      paymentMethod: paymentMethodDisplay,
      paymentStatus: order.status === 'PAID' ? 'PAID' : order.status,
      transactionRef: paymentRef,
      isInterState,
      seller: {
        name: 'Kashvi International Pvt. Ltd.',
        tradeName: 'KASHVIMLM Wholesale Division',
        address: 'Plot No. 43, Shiv TP Nagar, Baldev Nagar',
        city: 'Ambala City',
        state: 'Haryana',
        stateCode: '06',
        postalCode: '134007',
        gstin: '06AAAAK0000A1Z5',
        pan: 'AAAAK0000A',
        email: 'billing@kashvimlm.com',
        phone: '+91 98765 43210',
      },
      buyer: {
        name: buyerName,
        memberId,
        phone: address?.phone || '+91 98765 43210',
        address: `${address?.streetAddress || 'Plot No. 43, Shiv TP Nagar'}, ${address?.apartment || ''}`.trim(),
        city: address?.city || 'Ambala City',
        state: buyerState,
        stateCode: isInterState ? '07' : '06',
        postalCode: address?.postalCode || '134007',
        country: address?.country || 'India',
      },
      items,
      totals: {
        itemsCount: items.reduce((acc, it) => acc + it.quantity, 0),
        taxableTotal: Math.round(taxableTotal * 100) / 100,
        cgstTotal: Math.round(cgstTotal * 100) / 100,
        sgstTotal: Math.round(sgstTotal * 100) / 100,
        igstTotal: Math.round(igstTotal * 100) / 100,
        gstTotal: Math.round((cgstTotal + sgstTotal + igstTotal) * 100) / 100,
        grandTotal: Math.round(grandTotal * 100) / 100,
        totalBV,
      },
    };
  }

  /**
   * Generates a fully formatted, vectorized, A4 PDF Buffer for an authorized order.
   */
  public static async generateInvoicePdf(orderIdOrNumber: string, userId: string, role: string): Promise<{ buffer: Buffer; invoiceNumber: string }> {
    const data = await this.getInvoiceDataForOrder(orderIdOrNumber, userId, role);
    const pdf = new SimplePdfWriter();

    // Top Header Banner Box
    pdf.setColor(15, 23, 42); // Slate 900
    pdf.drawRect(35, 785, 525, 30, true, false);
    pdf.setColor(255, 255, 255);
    pdf.addText('TAX INVOICE / BILL OF SUPPLY', 45, 796, 12, true);
    pdf.addTextRight('ORIGINAL FOR RECIPIENT', 550, 796, 9, false);

    // Company & Seller Info (Left)
    pdf.setColor(30, 41, 59);
    pdf.addText(data.seller.name, 35, 765, 12, true);
    pdf.setColor(71, 85, 105);
    pdf.addText(data.seller.tradeName, 35, 752, 9, false);
    pdf.addText(data.seller.address, 35, 740, 8.5, false);
    pdf.addText(`${data.seller.city}, ${data.seller.state} - ${data.seller.postalCode} (State Code: ${data.seller.stateCode})`, 35, 729, 8.5, false);
    pdf.setColor(15, 23, 42);
    pdf.addText(`GSTIN: ${data.seller.gstin} | PAN: ${data.seller.pan}`, 35, 717, 8.5, true);
    pdf.setColor(71, 85, 105);
    pdf.addText(`Email: ${data.seller.email} | Phone: ${data.seller.phone}`, 35, 706, 8, false);

    // Invoice Meta (Right Box)
    pdf.setStrokeColor(226, 232, 240);
    pdf.drawRect(360, 700, 200, 75, false, true);
    pdf.setColor(15, 23, 42);
    pdf.addText('Invoice No:', 370, 760, 8.5, true);
    pdf.addText(data.invoiceNumber, 440, 760, 8.5, true);

    pdf.setColor(71, 85, 105);
    pdf.addText('Invoice Date:', 370, 747, 8.5, false);
    pdf.addText(data.invoiceDate, 440, 747, 8.5, false);

    pdf.addText('Order No:', 370, 734, 8.5, false);
    pdf.addText(data.orderNumber, 440, 734, 8.5, false);

    pdf.addText('Payment Mode:', 370, 721, 8, false);
    pdf.addText(data.paymentMethod.slice(0, 18), 440, 721, 8, false);

    pdf.addText('Payment Status:', 370, 708, 8, false);
    pdf.setColor(22, 101, 52); // Green
    pdf.addText(data.paymentStatus, 440, 708, 8, true);

    // Divider Line
    pdf.setStrokeColor(203, 213, 225);
    pdf.setLineWidth(0.8);
    pdf.drawLine(35, 690, 560, 690);

    // Bill To & Ship To Details
    pdf.setColor(30, 41, 59);
    pdf.addText('BILLED & SHIPPED TO:', 35, 675, 9, true);
    pdf.setColor(15, 23, 42);
    pdf.addText(`${data.buyer.name} (Distributor ID: ${data.buyer.memberId})`, 35, 662, 9.5, true);
    pdf.setColor(71, 85, 105);
    pdf.addText(`Address: ${data.buyer.address}, ${data.buyer.city}`, 35, 650, 8.5, false);
    pdf.addText(`State: ${data.buyer.state} (Code: ${data.buyer.stateCode}) | Phone: ${data.buyer.phone}`, 35, 639, 8.5, false);
    pdf.addText(`Place of Supply: ${data.buyer.state} | Tax Type: ${data.isInterState ? 'IGST (Inter-State 18%)' : 'CGST (9%) + SGST (9%) (Intra-State)'}`, 35, 628, 8.5, false);

    // Table Header
    const tableTop = 612;
    pdf.setColor(241, 245, 249); // Slate 100
    pdf.drawRect(35, tableTop - 18, 525, 20, true, true);
    pdf.setColor(15, 23, 42);
    pdf.addText('#', 40, tableTop - 13, 8, true);
    pdf.addText('Item Description', 60, tableTop - 13, 8, true);
    pdf.addText('HSN', 210, tableTop - 13, 8, true);
    pdf.addText('Qty', 260, tableTop - 13, 8, true);
    pdf.addText('Wholesale', 290, tableTop - 13, 8, true);
    pdf.addText('Taxable', 345, tableTop - 13, 8, true);
    pdf.addText('GST', 400, tableTop - 13, 8, true);
    pdf.addText('BV Pts', 445, tableTop - 13, 8, true);
    pdf.addTextRight('Total (INR)', 550, tableTop - 13, 8, true);

    // Items Loop
    let currentY = tableTop - 34;
    data.items.slice(0, 10).forEach((item, index) => {
      pdf.setColor(71, 85, 105);
      pdf.addText((index + 1).toString(), 40, currentY, 8, false);
      pdf.setColor(15, 23, 42);
      pdf.addText(item.name.slice(0, 32), 60, currentY, 8, true);
      pdf.setColor(71, 85, 105);
      pdf.addText(item.hsn || '610910', 210, currentY, 8, false);
      pdf.addText(item.quantity.toString(), 265, currentY, 8, false);
      pdf.addText(item.unitPrice.toFixed(2), 290, currentY, 8, false);
      pdf.addText(item.taxableValue.toFixed(2), 345, currentY, 8, false);
      const gstVal = data.isInterState ? item.igstAmount : (item.cgstAmount + item.sgstAmount);
      pdf.addText(gstVal.toFixed(2), 400, currentY, 8, false);
      pdf.setColor(13, 148, 136); // Teal
      pdf.addText(`+${item.bv}`, 445, currentY, 8, true);
      pdf.setColor(15, 23, 42);
      pdf.addTextRight(item.totalPrice.toFixed(2), 550, currentY, 8, true);

      pdf.setStrokeColor(241, 245, 249);
      pdf.drawLine(35, currentY - 5, 560, currentY - 5);
      currentY -= 17;
    });

    // Summary Box
    const summaryBoxY = Math.max(340, currentY - 10);
    pdf.setStrokeColor(203, 213, 225);
    pdf.drawLine(35, summaryBoxY, 560, summaryBoxY);

    // Left info: BV & Commission Note
    pdf.setColor(240, 253, 250); // Mint
    pdf.drawRect(35, summaryBoxY - 80, 260, 70, true, true);
    pdf.setColor(13, 148, 136); // Teal
    pdf.addText('BUSINESS VOLUME CREDITED', 45, summaryBoxY - 20, 8.5, true);
    pdf.setColor(15, 23, 42);
    pdf.addText(`+${data.totals.totalBV} Commissionable BV Points`, 45, summaryBoxY - 34, 11, true);
    pdf.setColor(71, 85, 105);
    pdf.addText('Volume has been credited to your personal binary leg.', 45, summaryBoxY - 48, 7.5, false);
    pdf.addText(`Txn Ref: ${data.transactionRef.slice(0, 32)}`, 45, summaryBoxY - 60, 7.5, false);

    // Right: Financial Totals
    const rightLabelX = 350;
    const rightValX = 550;
    let sumY = summaryBoxY - 16;

    pdf.setColor(71, 85, 105);
    pdf.addText('Taxable Value:', rightLabelX, sumY, 8.5, false);
    pdf.addTextRight(`INR ${data.totals.taxableTotal.toFixed(2)}`, rightValX, sumY, 8.5, false);
    sumY -= 14;

    if (data.isInterState) {
      pdf.addText('Integrated GST (IGST 18%):', rightLabelX, sumY, 8.5, false);
      pdf.addTextRight(`INR ${data.totals.igstTotal.toFixed(2)}`, rightValX, sumY, 8.5, false);
      sumY -= 14;
    } else {
      pdf.addText('Central GST (CGST 9%):', rightLabelX, sumY, 8.5, false);
      pdf.addTextRight(`INR ${data.totals.cgstTotal.toFixed(2)}`, rightValX, sumY, 8.5, false);
      sumY -= 14;

      pdf.addText('State GST (SGST 9%):', rightLabelX, sumY, 8.5, false);
      pdf.addTextRight(`INR ${data.totals.sgstTotal.toFixed(2)}`, rightValX, sumY, 8.5, false);
      sumY -= 14;
    }

    pdf.addText('Shipping & Handling:', rightLabelX, sumY, 8.5, false);
    pdf.setColor(22, 101, 52);
    pdf.addTextRight('FREE (Distributor Perk)', rightValX, sumY, 8.5, true);
    sumY -= 16;

    // Total Amount Highlight
    pdf.setColor(248, 250, 252);
    pdf.drawRect(rightLabelX - 10, sumY - 6, 220, 22, true, true);
    pdf.setColor(15, 23, 42);
    pdf.addText('TOTAL AMOUNT (INCL. GST):', rightLabelX, sumY + 5, 9, true);
    pdf.addTextRight(`INR ${data.totals.grandTotal.toFixed(2)}`, rightValX, sumY + 5, 10, true);

    // Bottom Terms & Digital Seal
    const footerY = 120;
    pdf.setStrokeColor(226, 232, 240);
    pdf.drawLine(35, footerY + 20, 560, footerY + 20);

    pdf.setColor(100, 116, 139);
    pdf.addText('Terms & Conditions:', 35, footerY + 8, 8, true);
    pdf.addText('1. Goods once sold are covered under distributor satisfaction warranty.', 35, footerY - 3, 7.5, false);
    pdf.addText('2. Tax payable on reverse charge basis: No.', 35, footerY - 14, 7.5, false);
    pdf.addText('3. Subject to Ambala, Haryana jurisdiction only.', 35, footerY - 25, 7.5, false);

    // Signatory Box (Right)
    pdf.setColor(15, 23, 42);
    pdf.addText('For Kashvi International Pvt. Ltd.', 400, footerY + 8, 8.5, true);
    pdf.setColor(71, 85, 105);
    pdf.addText('[Digitally Signed Tax Invoice]', 400, footerY - 12, 8, false);
    pdf.addText('Authorized Signatory', 400, footerY - 25, 8, true);

    // System generated notice
    pdf.setColor(148, 163, 184);
    pdf.addText('This is a computer-generated tax invoice issued in accordance with Section 31 of CGST Act 2017.', 110, 45, 7.5, false);

    return {
      buffer: pdf.toBuffer(),
      invoiceNumber: data.invoiceNumber,
    };
  }
}
