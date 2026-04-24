const { Op } = require('sequelize');
const Transaction = require('../models/Transaction');
const TransactionOffice = require('../models/TransactionOffice');
const Counter = require('../models/Counter');
const Service = require('../models/Service');
const User = require('../models/User');

/**
 * Format duration in seconds to HH:MM:SS
 */
function formatDuration(seconds) {
    if (!seconds || seconds < 0) return '00:00:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Format date to DD/MM/YYYY
 */
function formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

/**
 * Format time to HH:mm:ss
 */
function formatTime(date) {
    if (!date) return '';
    const d = new Date(date);
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

/**
 * Build WHERE conditions for transaction queries
 */
function buildWhereConditions(filters) {
    const whereConditions = {};
    const { from_date, to_date, office_id, ticket_number, staff_id } = filters;

    // Date range filter
    if (from_date || to_date) {
        whereConditions.printed_at = {};
        if (from_date) {
            whereConditions.printed_at[Op.gte] = new Date(from_date);
        }
        if (to_date) {
            const toDate = new Date(to_date);
            toDate.setHours(23, 59, 59, 999);
            whereConditions.printed_at[Op.lte] = toDate;
        }
    }

    // Office filter
    if (office_id) {
        whereConditions.transaction_office_id = parseInt(office_id);
    }

    // Ticket number search
    if (ticket_number) {
        whereConditions.ticket_number = {
            [Op.iLike]: `%${ticket_number}%`,
        };
    }

    // Staff filter
    if (staff_id) {
        whereConditions.user_id = parseInt(staff_id);
    }

    return whereConditions;
}

/**
 * Transform transaction data to report format
 */
function transformTransactionToReport(transaction, index, offset = 0) {
    const t = transaction.toJSON ? transaction.toJSON() : transaction;

    // Calculate waiting time (called_at - printed_at)
    let waitingTimeSeconds = 0;
    if (t.called_at && t.printed_at) {
        waitingTimeSeconds = Math.floor(
            (new Date(t.called_at) - new Date(t.printed_at)) / 1000
        );
    }

    // Calculate serving time (finished_at - started_at or called_at)
    let servingTimeSeconds = 0;
    if (t.finished_at) {
        const startTime = t.started_at || t.called_at;
        if (startTime) {
            servingTimeSeconds = Math.floor(
                (new Date(t.finished_at) - new Date(startTime)) / 1000
            );
        }
    }

    // Determine waiting status based on office configuration
    let waitingStatus = 'Bình thường';
    const warningMinutes = t.TransactionOffice?.waiting_warning_minutes || 15;
    const overdueMinutes = t.TransactionOffice?.waiting_overdue_minutes || 30;
    const waitingMinutes = waitingTimeSeconds / 60;

    if (waitingMinutes > overdueMinutes) {
        waitingStatus = 'Quá hạn';
    } else if (waitingMinutes > warningMinutes) {
        waitingStatus = 'Cảnh báo';
    }

    // Status mapping
    const statusMap = {
        waiting: 'Đang chờ',
        called: 'Đã gọi',
        serving: 'Đang phục vụ',
        completed: 'Hoàn thành',
        cancelled: 'Đã hủy',
        missed: 'Bỏ qua',
        transferred: 'Đã chuyển',
    };

    // Parse rating from extra_info if exists
    let rating = '';
    if (t.extra_info) {
        try {
            const extraInfo = JSON.parse(t.extra_info);
            rating = extraInfo.rating || '';
        } catch (e) {
            rating = '';
        }
    }

    return {
        no: offset + index + 1,
        office_name: t.TransactionOffice?.name || '',
        counter_name: t.Counter?.name || '',
        employee_name: t.User?.full_name || '',
        job_title: t.User?.job_title || '',
        service_name: t.Service?.name || '',
        ticket_number: t.ticket_number,
        ticket_type: t.ticket_type,
        print_date: formatDate(t.printed_at),
        print_time: formatTime(t.printed_at),
        called_at: formatTime(t.called_at),
        waiting_time: formatDuration(waitingTimeSeconds),
        waiting_status: waitingStatus,
        finished_at: formatTime(t.finished_at),
        serving_time: formatDuration(servingTimeSeconds),
        rating: rating,
        status: statusMap[t.status] || t.status,
        // Raw data for export
        _raw: {
            transaction_office_id: t.transaction_office_id,
            counter_id: t.counter_id,
            user_id: t.user_id,
            service_id: t.service_id,
            printed_at: t.printed_at,
            called_at: t.called_at,
            finished_at: t.finished_at,
            status: t.status,
        },
    };
}

/**
 * Get transaction reports with pagination
 */
async function getTransactionReports(filters) {
    const { page = 1, limit = 20 } = filters;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    const whereConditions = buildWhereConditions(filters);

    // Get transactions with all related data
    const { count, rows: transactions } = await Transaction.findAndCountAll({
        where: whereConditions,
        include: [
            {
                model: TransactionOffice,
                as: 'TransactionOffice',
                attributes: ['id', 'code', 'name', 'waiting_warning_minutes', 'waiting_overdue_minutes'],
            },
            {
                model: Counter,
                as: 'Counter',
                attributes: ['id', 'code', 'name'],
            },
            {
                model: Service,
                as: 'Service',
                attributes: ['id', 'code', 'name'],
            },
            {
                model: User,
                as: 'User',
                attributes: ['id', 'username', 'full_name', 'job_title'],
            },
        ],
        order: [['printed_at', 'DESC']],
        limit: parseInt(limit),
        offset: offset,
    });

    // Transform data
    const reportData = transactions.map((transaction, index) =>
        transformTransactionToReport(transaction, index, offset)
    );

    return {
        data: reportData,
        pagination: {
            total: count,
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(count / parseInt(limit)),
        },
    };
}

/**
 * Get all transactions for export (no pagination)
 */
async function getAllTransactionsForExport(filters) {
    const whereConditions = buildWhereConditions(filters);

    const transactions = await Transaction.findAll({
        where: whereConditions,
        include: [
            {
                model: TransactionOffice,
                as: 'TransactionOffice',
                attributes: ['id', 'code', 'name', 'waiting_warning_minutes', 'waiting_overdue_minutes'],
            },
            {
                model: Counter,
                as: 'Counter',
                attributes: ['id', 'code', 'name'],
            },
            {
                model: Service,
                as: 'Service',
                attributes: ['id', 'code', 'name'],
            },
            {
                model: User,
                as: 'User',
                attributes: ['id', 'username', 'full_name', 'job_title'],
            },
        ],
        order: [['printed_at', 'DESC']],
    });

    return transactions.map((transaction, index) =>
        transformTransactionToReport(transaction, index, 0)
    );
}

/**
 * Get summary statistics
 */
async function getSummaryStatistics(filters) {
    const whereConditions = buildWhereConditions(filters);

    // Get total transactions count
    const totalTransactions = await Transaction.count({ where: whereConditions });

    // Get count by status
    const completed = await Transaction.count({
        where: { ...whereConditions, status: 'completed' },
    });
    const cancelled = await Transaction.count({
        where: { ...whereConditions, status: 'cancelled' },
    });
    const missed = await Transaction.count({
        where: { ...whereConditions, status: 'missed' },
    });
    const waiting = await Transaction.count({
        where: { ...whereConditions, status: 'waiting' },
    });

    return {
        total: totalTransactions,
        completed,
        cancelled,
        missed,
        waiting,
    };
}

module.exports = {
    getTransactionReports,
    getAllTransactionsForExport,
    getSummaryStatistics,
    formatDuration,
    formatDate,
    formatTime,
    transformTransactionToReport,
};
