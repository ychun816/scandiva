import { jsPDF } from 'jspdf';

// Shared A4 layout — used by the PDF export and the Letters page-break preview,
// so the dashed markers match where the exported file actually paginates.
export const PDF = { margin: 64, fontSize: 12, lineHeight: 12 * 1.6, paraGap: 12 * 1.6 * 0.5 };

export const makePdfDoc = () => {
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    doc.setFont('times', 'normal');
    doc.setFontSize(PDF.fontSize);
    return doc;
};

// Renders the letter paragraphs onto A4 pages and triggers the download.
export function downloadLetterPdf(name: string, paragraphs: string[]) {
    const paras = paragraphs.map(p => p.trim()).filter(Boolean);
    if (!paras.length) return;
    const doc = makePdfDoc();
    const pageH = doc.internal.pageSize.getHeight();
    const maxW = doc.internal.pageSize.getWidth() - PDF.margin * 2;

    let y = PDF.margin;
    paras.forEach((para, pi) => {
        const lines: string[] = doc.splitTextToSize(para, maxW);
        for (const line of lines) {
            if (y + PDF.lineHeight > pageH - PDF.margin) {
                doc.addPage();
                y = PDF.margin;
            }
            doc.text(line, PDF.margin, y);
            y += PDF.lineHeight;
        }
        if (pi < paras.length - 1) y += PDF.paraGap;
    });

    const safeName = name
        .replace(/[^\p{L}\p{N} _-]/gu, '')
        .trim()
        .replace(/\s+/g, '-') || 'motivation-letter';
    doc.save(`${safeName}.pdf`);
}
