import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';

export const downloadCityReport = async ({
  cityName,
  panelData,
  insight,
  anomalies
}) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  let currentY = 20;

  // Helpers
  const addText = (text, size, isBold = false, x = 15, color = [0, 0, 0]) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(text, x, currentY);
    currentY += size * 0.4; // Advance Y approx based on font size
  };

  const addWrappedText = (text, size, isBold = false, x = 15, maxWidth = 180, color = [0, 0, 0]) => {
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, currentY);
    currentY += lines.length * (size * 0.4);
  };

  /* ─── 1. Header ─── */
  addText('NagarDrishti', 24, true, 15, [79, 110, 247]); // Accent color
  currentY += 2;
  addText('Official Environmental Intelligence Audit', 12, false, 15, [90, 97, 120]);
  currentY += 2;
  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  addText(`Generated on: ${timestamp} IST`, 10, false, 15, [150, 150, 160]);
  currentY += 10;
  
  doc.setDrawColor(220, 220, 220);
  doc.line(15, currentY - 5, pageWidth - 15, currentY - 5);

  /* ─── 2. City Overview ─── */
  const totalWards = anomalies?.length || 1; 
  const score = Math.max(0, 100 - (totalWards * 5)); // Mock health score logic

  addText(`City Profile: ${cityName.toUpperCase()}`, 16, true);
  currentY += 2;
  addText(`Total Anomalous Areas Detected: ${totalWards}`, 11);
  addText(`Overall City Health Score: ${score}/100`, 11, true, 15, score > 70 ? [67, 160, 71] : [239, 83, 80]);
  currentY += 10;

  /* ─── 3. Executive Summary (Gemini Input) ─── */
  if (insight) {
    // Check if we need a page break soon
    if (currentY > pageHeight - 60) {
      doc.addPage();
      currentY = 20;
    }

    addText('AI-Generated Action Plan', 16, true, 15, [30, 30, 30]);
    currentY += 2;

    addText(`Status: ${insight.status_label}`, 12, true, 15, [239, 83, 80]); // Label in Redish
    currentY += 2;
    addWrappedText(insight.risk_summary, 11);
    currentY += 5;

    addText('Immediate Risks & Actions', 13, true, 15, [249, 168, 37]); // Orange-yellow
    currentY += 2;
    insight.immediate_actions.forEach((act, idx) => {
      addWrappedText(`• ${act}`, 11, false, 20, 170);
    });
    currentY += 5;

    addText('Long-term Policy', 13, true, 15, [67, 160, 71]); // Green
    currentY += 2;
    addWrappedText(insight.long_term_policy, 11, false, 20, 170);
    currentY += 8;
  }

  /* ─── 4. Data Table (The 12-Month History) ─── */
  const monthsArr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const tableData = [];
  if (panelData && panelData.historical) {
    for (let i = 0; i < 12; i++) {
      const t = panelData.historical.lst?.[i];
      const a = panelData.historical.aqi?.[i];
      const n = panelData.historical.ndvi?.[i];
      if (t !== null || a !== null || n !== null) {
        tableData.push([
          monthsArr[i],
          t !== null ? t.toFixed(2) : 'N/A',
          a !== null ? a.toFixed(2) : 'N/A',
          n !== null ? n.toFixed(4) : 'N/A'
        ]);
      }
    }
  }

  if (tableData.length > 0) {
    currentY += 5;
    addText('12-Month Historical Data', 14, true);
    currentY += 2;

    autoTable(doc, {
      startY: currentY,
      head: [['Month', 'Temp (°C)', 'NO2 Proxy (µg/m³)', 'NDVI']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 110, 247] },
      didParseCell: function(data) {
        if (data.section === 'body' && data.row.index >= 0) {
          const colIndex = data.column.index;
          const val = parseFloat(data.cell.raw);
          // Highlight rows where values crossed safety thresholds
          // e.g. Temp > 40°C, NO2 > 60 µg/m³
          if ((colIndex === 1 && val > 40) || (colIndex === 2 && val > 60)) {
            data.cell.styles.textColor = [239, 83, 80]; // Red text
            data.cell.styles.fontStyle = 'bold';
          }
        }
      }
    });
    
    currentY = doc.lastAutoTable.finalY + 15;
  }

  /* ─── 5. Visual Proof (Map Screenshot) ─── */
  if (currentY > pageHeight - 90) {
    doc.addPage();
    currentY = 20;
  }
  
  addText('Visual Proof: Map Analysis', 14, true);
  currentY += 4;

  try {
    const mapElement = document.querySelector('.app-map');
    if (mapElement) {
      // Capture the map with HTML2Canvas
      // useCORS is crucial for map tiles
      const canvas = await html2canvas(mapElement, { 
        useCORS: true, 
        allowTaint: false,
        logging: false 
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.8);
      
      const imgWidth = 180;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      if (currentY + imgHeight > pageHeight - 20) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.rect(15, currentY, imgWidth, imgHeight); // Border around image
      doc.addImage(imgData, 'JPEG', 15, currentY, imgWidth, imgHeight);
      currentY += imgHeight + 15;
    }
  } catch (err) {
    console.error("Failed to capture map:", err);
    addText('(Map screenshot could not be captured due to CORS limitations on map tiles)', 10, false, 15, [150, 0, 0]);
    currentY += 10;
  }

  /* ─── 6. Footer ─── */
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      'Generated via Satellite Intelligence Platform. Confidential for Municipal Use Only.',
      15, pageHeight - 10
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 30, pageHeight - 10);
  }

  doc.save(`NagarDrishti_Report_${cityName.replace(/\s+/g, '_')}.pdf`);
};
