const express = require('express');
const router = express.Router();
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { print } = require('pdf-to-printer');

// Allow CORS for this router as well (inherits from app but safe)
router.use(cors());
router.use(express.json({ limit: '50mb' }));
router.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Uploads directory (outside src folder)
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

function getMonthlyUploadDir() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthDir = `${year}-${month}`;
  const monthlyDir = path.join(uploadsDir, monthDir);
  if (!fs.existsSync(monthlyDir)) {
    fs.mkdirSync(monthlyDir, { recursive: true });
    console.log(`📁 [PDF] Created monthly folder: ${monthDir}`);
  }
  return monthlyDir;
}

function findPdfFile(fileName) {
  const mainPath = path.join(uploadsDir, fileName);
  if (fs.existsSync(mainPath)) return mainPath;
  const subdirs = fs.readdirSync(uploadsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
  for (const sub of subdirs) {
    const filePath = path.join(uploadsDir, sub, fileName);
    if (fs.existsSync(filePath)) return filePath;
  }
  return null;
}

// Multer storage
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) { cb(null, uploadsDir); },
  filename: function (_req, file, cb) { cb(null, `${Date.now()}-${file.originalname}`); }
});
const upload = multer({ storage });

// Static serve PDF from any month folder
router.get('/pdfs/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = findPdfFile(filename);
    if (!filePath) return res.status(404).json({ error: 'PDF file not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.sendFile(filePath);
  } catch (e) {
    console.error('[PDF] serve error:', e);
    res.status(500).json({ error: 'Failed to serve PDF file' });
  }
});

// Template dots config
const templateDotsConfig = {
  mau_1: { full_name: '.......................................................', date_of_birth: '.......................', nation_no: '...............................', place_of_issue: '..................................', date_of_issue: '........................', address: '........................................', phone_number: '...............................' },
  mau_4: { full_name: '&hellip;'.repeat(15), date_of_birth: '&hellip;'.repeat(10), nation_no: '&hellip;'.repeat(5), place_of_issue: '&hellip;'.repeat(12), date_of_issue: '&hellip;'.repeat(7), address: '&hellip;'.repeat(60), phone_number: '................................' },
  mau_5: { full_name: '&hellip;'.repeat(10), date_of_birth: '&hellip;'.repeat(10), nation_no: '&hellip;'.repeat(9), place_of_issue: '&hellip;'.repeat(10), date_of_issue: '&hellip;'.repeat(7), address: '&hellip;'.repeat(60), phone_number: '................................' },
  mau_7: { full_name: '&hellip;'.repeat(15), date_of_birth: '&hellip;'.repeat(10), nation_no: '&hellip;'.repeat(5), place_of_issue: '&hellip;'.repeat(10), date_of_issue: '&hellip;'.repeat(7), address: '&hellip;'.repeat(60), phone_number: '................................' },
  mau_8: { full_name: '&hellip;'.repeat(30), date_of_birth: '&hellip;'.repeat(12), nation_no: '&hellip;'.repeat(24), place_of_issue: '&hellip;'.repeat(18), date_of_issue: '&hellip;'.repeat(8), address: '&hellip;'.repeat(70), phone_number: '................................' },
  mau_nhht: { full_name: '&hellip;'.repeat(30), date_of_birth: '&hellip;'.repeat(24), nation_no: '&hellip;'.repeat(30), place_of_issue: '&hellip;'.repeat(18), date_of_issue: '&hellip;'.repeat(12), address: '&hellip;'.repeat(80), phone_number: '................................' },
};

function replaceTemplateData(htmlContent, customerData, templateName) {
  let modifiedHtml = htmlContent;
  const dotsConfig = templateDotsConfig[templateName] || templateDotsConfig['mau_1'];
  const pairs = [
    ['NATION', 'nation'],
    ['EXPIRED_DATE', 'expired_date'],
    ['FULL_NAME', 'full_name'],
    ['DATE_OF_BIRTH', 'date_of_birth'],
    ['NATION_NO', 'nation_no'],
    ['PLACE_OF_ISSUE', 'place_of_issue'],
    ['DATE_OF_ISSUE', 'date_of_issue'],
    ['ADDRESS', 'address'],
    ['PHONE_NUMBER', 'phone_number'],
    ['PERSONAL_IDENTIFICATION', 'personal_identification'],
    ['SEX', 'sex'],
    ['RELIGION', 'religion'],
    ['ETHNICITY', 'ethnicity'],
    ['FATHER_NAME', 'father_name'],
    ['MOTHER_NAME', 'mother_name'],
    ['SPOUSE_NAME', 'spouse_name'],
    ['PLACE_OF_ORIGIN', 'place_of_origin'],
    ['AVATAR', 'avatar'],
    ['CURRENT_DAY', 'current_day'],
    ['CURRENT_MONTH', 'current_month'],
    ['CURRENT_YEAR', 'current_year'],
    ['PROVINCE', 'province'],
    ['DISTRICT', 'district'],
    ['WARD', 'ward'],
  ];
  // Gender
  if (Object.prototype.hasOwnProperty.call(customerData, 'sex')) {
    const sex = (customerData.sex || '').toString().toLowerCase();
    modifiedHtml = modifiedHtml
      .replace(/\{\{GENDER_NAM\}\}/g, sex === 'nam' || sex === 'male' ? 'checked' : '')
      .replace(/\{\{GENDER_NU\}\}/g, sex === 'nữ' || sex === 'nu' || sex === 'female' ? 'checked' : '');
  }
  // Replace simple fields
  for (const [placeholder, key] of pairs) {
    if (Object.prototype.hasOwnProperty.call(customerData, key)) {
      const value = customerData[key] || dotsConfig[key] || '';
      const re = new RegExp(`\\{\\{${placeholder}\\}\\}`, 'g');
      modifiedHtml = modifiedHtml.replace(re, value);
    }
  }
  return modifiedHtml;
}

// List PDFs by month
router.get('/list-pdfs', (req, res) => {
  try {
    const { month } = req.query;
    const targetDir = month ? path.join(uploadsDir, month) : getMonthlyUploadDir();
    if (!fs.existsSync(targetDir)) {
      return res.json({ success: true, month: month || 'current', files: [], message: 'No files found for this month' });
    }
    const files = fs.readdirSync(targetDir)
      .filter((f) => f.endsWith('.pdf'))
      .map((f) => {
        const fp = path.join(targetDir, f);
        const stats = fs.statSync(fp);
        return {
          fileName: f,
          filePath: fp,
          fileSize: stats.size,
          createdAt: stats.birthtime,
          pdfUrl: `${req.protocol}://${req.get('host')}${req.baseUrl}/view-pdf/${f}`,
          directPdfUrl: `${req.protocol}://${req.get('host')}${req.baseUrl}/pdfs/${f}`,
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);
    res.json({ success: true, month: month || 'current', directory: targetDir, fileCount: files.length, files });
  } catch (e) {
    console.error('[PDF] list error:', e);
    res.status(500).json({ error: 'Failed to list PDF files', details: e.message });
  }
});

// Fill template and generate PDF
router.post('/fill-template', async (req, res) => {
  try {
    const { templateName, customerData = {} } = req.body || {};
    if (!templateName) return res.status(400).json({ error: 'templateName is required' });
    const htmlFileName = `${templateName}.html`;
    const htmlFilePath = path.join(__dirname, '..', 'html', htmlFileName);
    if (!fs.existsSync(htmlFilePath)) {
      return res.status(404).json({ error: `Template file ${htmlFileName} not found` });
    }
    let htmlContent = fs.readFileSync(htmlFilePath, 'utf8');
    if (Object.keys(customerData).length) {
      htmlContent = replaceTemplateData(htmlContent, customerData, templateName);
    }

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    });
    await browser.close();

    // Save PDF file
    const fileName = `pdf-${templateName}-${Date.now()}.pdf`;
    const monthlyDir = getMonthlyUploadDir();
    const filePath = path.join(monthlyDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const hostBase = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
    res.json({
      success: true,
      message: 'PDF generated successfully',
      template: templateName,
      customerData,
      fileName,
      filePath,
      fileSize: pdfBuffer.length,
      pdfUrl: `${hostBase}/view-pdf/${fileName}`,
      directPdfUrl: `${hostBase}/pdfs/${fileName}`
    });
  } catch (e) {
    console.error('[PDF] fill-template error:', e);
    res.status(500).json({ error: 'Failed to fill template', details: e.message });
  }
});

// Generate PDF from raw HTML content (for edited forms)
router.post('/generate-pdf-from-html', async (req, res) => {
  try {
    const { htmlContent, templateName = 'edited-form' } = req.body || {};

    if (!htmlContent) {
      return res.status(400).json({ error: 'htmlContent is required' });
    }

    console.log('📄 Generating PDF from edited HTML content...');

    // Generate PDF using Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Set content with full HTML structure
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '1cm', right: '1cm', bottom: '1cm', left: '1cm' }
    });

    await browser.close();

    // Save PDF file
    const fileName = `pdf-${templateName}-${Date.now()}.pdf`;
    const monthlyDir = getMonthlyUploadDir();
    const filePath = path.join(monthlyDir, fileName);
    fs.writeFileSync(filePath, pdfBuffer);

    const hostBase = `${req.protocol}://${req.get('host')}${req.baseUrl}`;

    console.log('✅ PDF generated successfully from edited HTML');

    res.json({
      success: true,
      message: 'PDF generated from edited HTML successfully',
      fileName,
      filePath,
      fileSize: pdfBuffer.length,
      pdfUrl: `${hostBase}/view-pdf/${fileName}`,
      directPdfUrl: `${hostBase}/pdfs/${fileName}`
    });
  } catch (e) {
    console.error('[PDF] generate-pdf-from-html error:', e);
    res.status(500).json({ error: 'Failed to generate PDF from HTML', details: e.message });
  }
});

// View PDF optimized for iframe
router.get('/view-pdf/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = findPdfFile(filename);
    if (!filePath) return res.status(404).json({ error: 'PDF file not found' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(filePath);
  } catch (e) {
    console.error('[PDF] view error:', e);
    res.status(500).json({ error: 'Failed to serve PDF file' });
  }
});

// Print an existing PDF by filename
router.post('/convert-html-to-pdf', async (req, res) => {
  try {
    const { fileName, printOptions = {} } = req.body || {};
    if (!fileName) return res.status(400).json({ error: 'fileName is required' });
    const filePath = findPdfFile(fileName);
    if (!filePath) return res.status(404).json({ error: `PDF file ${fileName} not found in uploads directory` });
    try {
      const absolutePath = path.resolve(filePath);

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
        console.error('[PDF] SumatraPDF executable not found at:', sumatraPdfPath);
        return res.status(500).json({
          error: 'SumatraPDF executable not found',
          details: `Expected path: ${sumatraPdfPath}`,
          fileName
        });
      }

      const printOpts = {
        ...printOptions,
        sumatraPdfPath
      };

      await print(absolutePath, printOpts);
    } catch (printError) {
      console.error('[PDF] Failed to print PDF file:', printError);
      return res.status(500).json({ error: 'Failed to print PDF file', details: printError.message, fileName });
    }
    const stats = fs.statSync(filePath);
    res.json({ success: true, message: 'PDF file sent to printer successfully', fileName, filePath, fileSize: stats.size, printStatus: 'sent_to_printer', pdfUrl: `${req.protocol}://${req.get('host')}${req.baseUrl}/view-pdf/${fileName}`, directPdfUrl: `${req.protocol}://${req.get('host')}${req.baseUrl}/pdfs/${fileName}` });
  } catch (e) {
    console.error('[PDF] print error:', e);
    res.status(500).json({ error: 'Failed to print PDF file', details: e.message });
  }
});

module.exports = router;




