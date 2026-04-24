const ExcelJS = require('exceljs');
const reportsService = require('../services/reports.service');

/**
 * GET /api/reports/transactions
 * Get transaction reports with filters and pagination
 */
async function getTransactionReports(req, res, next) {
    try {
        const filters = req.query;
        const result = await reportsService.getTransactionReports(filters);

        res.json({
            success: true,
            data: result.data,
            pagination: result.pagination,
        });
    } catch (error) {
        console.error('Get transaction reports error:', error);
        next(error);
    }
}

/**
 * GET /api/reports/export
 * Export transaction reports to Excel
 */
async function exportTransactionReports(req, res, next) {
    try {
        const filters = req.query;
        const transactions = await reportsService.getAllTransactionsForExport(filters);

        // Create workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Báo cáo giao dịch');

        // Define columns
        worksheet.columns = [
            { header: 'STT', key: 'no', width: 8 },
            { header: 'Phòng giao dịch', key: 'office_name', width: 25 },
            { header: 'Quầy', key: 'counter_name', width: 15 },
            { header: 'Nhân viên', key: 'employee_name', width: 20 },
            { header: 'Chức danh', key: 'job_title', width: 15 },
            { header: 'Dịch vụ', key: 'service_name', width: 25 },
            { header: 'Số vé', key: 'ticket_number', width: 12 },
            { header: 'Loại vé', key: 'ticket_type', width: 12 },
            { header: 'Ngày in', key: 'print_date', width: 15 },
            { header: 'Giờ in', key: 'print_time', width: 12 },
            { header: 'Giờ gọi', key: 'called_at', width: 12 },
            { header: 'Thời gian chờ', key: 'waiting_time', width: 15 },
            { header: 'Trạng thái chờ', key: 'waiting_status', width: 15 },
            { header: 'Giờ kết thúc', key: 'finished_at', width: 12 },
            { header: 'Thời gian phục vụ', key: 'serving_time', width: 18 },
            { header: 'Trạng thái', key: 'status', width: 15 },
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF1E40AF' }, // Blue
        };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Add data rows
        transactions.forEach((report) => {
            worksheet.addRow({
                no: report.no,
                office_name: report.office_name,
                counter_name: report.counter_name,
                employee_name: report.employee_name,
                job_title: report.job_title,
                service_name: report.service_name,
                ticket_number: report.ticket_number,
                ticket_type: report.ticket_type,
                print_date: report.print_date,
                print_time: report.print_time,
                called_at: report.called_at,
                waiting_time: report.waiting_time,
                waiting_status: report.waiting_status,
                finished_at: report.finished_at,
                serving_time: report.serving_time,
                status: report.status,
            });
        });

        // Apply zebra striping
        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber > 1 && rowNumber % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF3F4F6' }, // Light gray
                    };
                });
            }
        });

        // Set response headers for file download
        const fileName = `BaoCaoGiaoDich_${new Date().toISOString().split('T')[0]}.xlsx`;
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

        // Write to response
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export transaction reports error:', error);
        next(error);
    }
}

/**
 * GET /api/reports/summary
 * Get summary statistics for dashboard
 */
async function getSummaryStatistics(req, res, next) {
    try {
        const filters = req.query;
        const summary = await reportsService.getSummaryStatistics(filters);

        res.json({
            success: true,
            data: summary,
        });
    } catch (error) {
        console.error('Get summary statistics error:', error);
        next(error);
    }
}

module.exports = {
    getTransactionReports,
    exportTransactionReports,
    getSummaryStatistics,
};
