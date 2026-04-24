const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const pdfPrinter = require('pdf-to-printer');

// Ticket counters by series and date
// Structure: { "YYYYMMDD": { A: number, B: number, C: number } }
const ticketCounters = {};

function getSeriesByServiceKey(serviceKey) {
  if (!serviceKey) return 'A';
  const key = serviceKey.toString();
  if (key === 'tra-soat-khieu-nai') return 'A';
  if (
    key === 'hop-dong-cho-vay-hmtc' ||
    key === 'giay-de-nghi-dieu-chinh-hmtc' ||
    key === 'phu-luc-hop-dong-cho-vay-hmtc' ||
    key === 'de-nghi-tam-dung-mo-lai-cham-dut-hmtc'
  ) {
    return 'B';
  }
  if (key === 'thoa-thuan-mo-ho-so-thong-tin-khach-hang') return 'C';
  return 'A';
}

function generateTicketNumberBySeries(serviceKey) {
  const series = getSeriesByServiceKey(serviceKey);
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  if (!ticketCounters[dateStr]) {
    ticketCounters[dateStr] = { A: 0, B: 0, C: 0 };
  }
  ticketCounters[dateStr][series] = (ticketCounters[dateStr][series] || 0) + 1;
  const count = ticketCounters[dateStr][series];
  const numberStr = count.toString().padStart(3, '0');
  return `${series}${numberStr}`;
}

// Template tối ưu cho máy in nhiệt
const template_printer = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
   body { 
  font-family: 'Courier New', monospace; 
  font-size: 14px;
  line-height: 1.3;
  width: 200px;           
  background: white;
  color: black;
  padding: 5px;
  text-align: center;
  margin-left: 40px;   /* dịch toàn bộ sang phải */
  margin-top: -10px;  /* dịch toàn bộ sang phải */
    }
    
    .bold { 
      font-weight: bold; 
      font-size: 16px; 
    }
    
    .ticket-header { 
      border-bottom: 1px solid #000;
      padding-bottom: 8px; 
      margin-bottom: 8px; 
    }
    
    .ticket-number {
      font-size: 22px;
      font-weight: bold;
      margin: 8px 0;
      letter-spacing: 1px;
    }
    
    .ticket-info { 
      margin: 4px 0; 
      font-size: 13px;
      line-height: 1.4;
      text-align: left;             /* Phần thông tin căn trái cho dễ đọc */
    }
    
    .ticket-footer { 
      border-top: 1px solid #000;
      padding-top: 8px; 
      margin-top: 10px;
      font-size: 12px;
    }
    
    .info-line {
      margin: 2px 0;
      display: block;
    }
    
    strong {
      font-weight: bold;
      color: #000;
    }
  </style>
</head>
<body>
  <div class="ticket-header">
    <div class="bold">NGÂN HÀNG COOpBank</div>
    <div style="font-size: 13px;">Phiếu Số Thứ Tự</div>
  </div>
  
  <div class="ticket-number">
    SỐ: $ticketNumber
  </div>
  
  <div class="ticket-info">
    <div class="info-line"><strong>Họ tên:</strong> $fullname</div>
    <div class="info-line"><strong>Số CCCD:</strong> $cardnumber</div>
    <div class="info-line"><strong>Năm sinh:</strong> $dateofbirth</div>
    <div class="info-line"><strong>Địa chỉ:</strong> $sex</div>
    <div class="info-line"><strong>Thời gian:</strong> $time</div>
  </div>
  
  <div class="ticket-footer">
    <div>Vui lòng chờ gọi số</div>
    <div style="margin-top: 3px;">Cảm ơn quý khách!</div>
  </div>
</body>
</html>
`;

router.post('/printer', async (req, res) => {
  let browser = null;

  try {
    console.log('🌡️ Starting thermal printer ticket generation...');

    const data_input = req.body;
    const fullname = (data_input.fullname || data_input.name || 'Khách hàng').toString().trim();
    const dateofbirth = (data_input.dateofbirth || data_input.year || '').toString().trim();
    const sex = data_input.sex ? data_input.sex.toString().trim() : '';
    const service = data_input.service || 'Dịch vụ ngân hàng';
    const serviceKey = data_input.serviceKey || '';
    const cardnumber = data_input.cardnumber ? data_input.cardnumber.toString().trim() : '';
    const ticketNumber = generateTicketNumberBySeries(serviceKey);

    console.log('📋 Thermal ticket data:', { fullname, dateofbirth, sex, service, ticketNumber, cardnumber });

    // Replace template variables
    const htmlContent = template_printer
      .replace('$fullname', fullname)
      .replace('$dateofbirth', dateofbirth)
      .replace('$sex', sex)
      .replace('$time', new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }))
      .replace('$ticketNumber', ticketNumber)
      .replace('$service', service)
      .replace('$cardnumber', cardnumber);

    console.log('🖥️ Launching browser for thermal printing...');

    // Generate PDF using Puppeteer
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows'
      ]
    });

    const page = await browser.newPage();

    // Set viewport cho máy in nhiệt
    await page.setViewport({
      width: 240,           // khớp với width trong CSS để hiển thị rộng hơn
      height: 500,
      deviceScaleFactor: 2  // High DPI cho text rõ nét
    });

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Tính chiều cao content động
    const contentHeight = await page.evaluate(() => {
      return document.body.scrollHeight;
    });

    console.log('📏 Content height for thermal printer:', contentHeight, 'px');

    // Create temp directory
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('📁 Created temp directory:', tempDir);
    }

    // Generate PDF tối ưu cho máy in nhiệt
    const timestamp = Date.now();
    const pdfPath = path.join(tempDir, `thermal_ticket_${timestamp}.pdf`);

    console.log('📄 Generating thermal printer PDF...');
    await page.pdf({
      path: pdfPath,
      width: '58mm',                    // Giữ 58mm; phần viewport rộng hơn giúp layout ít xuống dòng
      height: `${contentHeight + 2}px`, // Chiều cao động + buffer
      printBackground: true,             // Cần để in border
      margin: {
        top: '0mm',      // Không margin trên/dưới
        right: '0mm',    // Margin tối thiểu bên
        bottom: '0mm',
        left: '0mm'
      },
      scale: 1,                         // Không scale
      preferCSSPageSize: false,         // Dùng size được set
      displayHeaderFooter: false        // Không header/footer
    });

    await browser.close();
    browser = null;

    console.log('✅ Thermal printer PDF generated:', pdfPath);

    // Get available printers
    console.log('🖨️ Getting thermal printers...');
    const printers = await pdfPrinter.getPrinters();
    console.log('📋 Available printers:', printers.map(p => ({
      name: p.name,
      isDefault: p.isDefault
    })));

    if (!printers || printers.length === 0) {
      console.error('❌ No thermal printers found');
      return res.status(500).json({
        error: 'No thermal printers available',
        ticketNumber,
        pdfGenerated: true
      });
    }

    // Select printer (prefer default, fallback to first)
    const selectedPrinter = printers.find(p => p.isDefault) || printers[0];
    console.log('🎯 Selected thermal printer:', selectedPrinter.name);

    // Print với settings tối ưu cho máy in nhiệt
    console.log('🌡️ Sending to thermal printer...');

    // Luôn lấy SumatraPDF từ node_modules ở thư mục chạy server (tránh lệ thuộc __dirname trong dist)
    const sumatraPdfPath = path.resolve(
      process.cwd(),
      'node_modules',
      'pdf-to-printer',
      'dist',
      'SumatraPDF-3.4.6-32.exe'
    );

    // Kiểm tra xem file SumatraPDF có tồn tại không
    if (!fs.existsSync(sumatraPdfPath)) {
      console.error('❌ SumatraPDF executable not found at:', sumatraPdfPath);
      return res.status(500).json({
        error: 'SumatraPDF executable not found',
        details: `Expected path: ${sumatraPdfPath}`
      });
    }

    await pdfPrinter.print(pdfPath, {
      printer: selectedPrinter.name,
      scale: 'noscale',        // Không scale - quan trọng!
      orientation: 'portrait',
      monochrome: true,        // Đen trắng cho thermal printer
      silent: true,            // Không hiện dialog
      paperSize: undefined,    // Để máy in tự quyết định
      sumatraPdfPath           // Đường dẫn đầy đủ đến SumatraPDF
    });

    console.log('✅ Thermal print job sent successfully');

    // Cleanup nhanh hơn cho thermal printer
    setTimeout(() => {
      try {
        if (fs.existsSync(pdfPath)) {
          fs.unlinkSync(pdfPath);
          console.log('🗑️ Cleaned up thermal PDF:', pdfPath);
        }
      } catch (cleanupError) {
        console.warn('⚠️ Thermal cleanup warning:', cleanupError.message);
      }
    }, 10000); // 10 giây cho thermal printer

    res.json({
      success: true,
      message: 'Thermal ticket printed successfully',
      data: {
        ticketNumber,
        printer: selectedPrinter.name,
        customerName: fullname,
        service: service,
        serviceKey: serviceKey || undefined,
        printerType: 'thermal',
        contentHeight: contentHeight,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ [THERMAL PRINT] Error:', error);

    // Cleanup browser
    if (browser) {
      try {
        await browser.close();
        console.log('🔒 Thermal browser closed');
      } catch (e) {
        console.warn('⚠️ Thermal browser cleanup warning:', e.message);
      }
    }

    res.status(500).json({
      success: false,
      error: 'Failed to print thermal ticket',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint kiểm tra thermal printer
router.get('/thermal-status', async (req, res) => {
  try {
    console.log('🔍 Checking thermal printer status...');

    const printers = await pdfPrinter.getPrinters();

    // Filter potential thermal printers
    const thermalPrinters = printers.filter(p => {
      const name = p.name.toLowerCase();
      return name.includes('thermal') ||
        name.includes('pos') ||
        name.includes('receipt') ||
        name.includes('58mm') ||
        name.includes('80mm');
    });

    res.json({
      success: true,
      allPrinters: printers.length,
      thermalPrinters: thermalPrinters.length,
      printers: printers.map(p => ({
        name: p.name,
        isDefault: p.isDefault || false,
        isThermal: thermalPrinters.some(tp => tp.name === p.name)
      })),
      recommendations: {
        'For 58mm thermal': 'Set scale: noscale, monochrome: true',
        'For 80mm thermal': 'Adjust width to 80mm in PDF generation',
        'Paper size': 'Let printer decide, do not force A4/Letter'
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Thermal status check error:', error);

    res.status(500).json({
      success: false,
      error: 'Failed to check thermal printer status',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test thermal print
router.get('/thermal-test', async (req, res) => {
  try {
    // Redirect to main printer endpoint with test data
    const testParams = new URLSearchParams({
      name: 'Test User',
      year: '1990',
      address: 'Ha Noi, Vietnam',
      service: 'Thermal Print Test'
    });

    res.redirect(`/api/print/printer?${testParams.toString()}`);

  } catch (error) {
    res.status(500).json({
      error: 'Thermal test failed',
      details: error.message
    });
  }
});

// Old daily sequential ticket number is replaced by series-based numbering above

module.exports = router;