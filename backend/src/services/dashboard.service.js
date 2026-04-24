const { sequelize } = require('../config/db');

/**
 * Get transaction status distribution for the current month
 * @param {number} month
 * @param {number} year
 * @returns {Promise<Array>}
 */
async function getTransactionStatusData(month, year) {
    try {
        const query = `
            SELECT 
                status,
                COUNT(*) as count
            FROM transactions
            WHERE EXTRACT(MONTH FROM printed_at) = :month
            AND EXTRACT(YEAR FROM printed_at) = :year
            AND status IN ('completed', 'cancelled')
            GROUP BY status
        `;

        const results = await sequelize.query(query, {
            replacements: { month, year },
            type: sequelize.QueryTypes.SELECT,
        });

        // Map to required format
        const statusMap = {
            completed: 'Hoàn thành',
            cancelled: 'Hủy',
        };

        return results.map(r => ({
            name: statusMap[r.status] || r.status,
            value: parseInt(r.count),
        }));
    } catch (error) {
        console.error('getTransactionStatusData error:', error);
        return [];
    }
}

/**
 * Get ticket trends for the selected month grouped by service groups
 * @param {number} month - Selected month
 * @param {number} year - Selected year
 * @returns {Promise<Array>}
 */
async function getTicketTrendsData(month, year) {
    try {
        const query = `
            SELECT 
                COALESCE(sg.name, 'Chưa phân loại') as service_group,
                COUNT(*) as count
            FROM transactions t
            LEFT JOIN services s ON t.service_id = s.id
            LEFT JOIN service_group_items sgi ON s.id = sgi.service_id
            LEFT JOIN service_groups sg ON sgi.service_group_id = sg.id
            WHERE EXTRACT(MONTH FROM t.printed_at) = :month
            AND EXTRACT(YEAR FROM t.printed_at) = :year
            GROUP BY COALESCE(sg.name, 'Chưa phân loại')
            ORDER BY count DESC
        `;

        const results = await sequelize.query(query, {
            replacements: { month, year },
            type: sequelize.QueryTypes.SELECT,
        });

        // Transform to format required by chart
        // Return as array with single object for the selected month
        if (results.length === 0) {
            return [];
        }

        const monthYear = `${String(month).padStart(2, '0')}/${year}`;
        const data = {
            name: monthYear,
        };

        results.forEach(r => {
            data[r.service_group] = parseInt(r.count);
        });

        return [data];
    } catch (error) {
        console.error('getTicketTrendsData error:', error);
        return [];
    }
}

/**
 * Get counter statistics for the current month
 * @param {number} month
 * @param {number} year
 * @returns {Promise<Array>}
 */
async function getCounterMonthlyData(month, year) {
    try {
        const query = `
            SELECT 
                c.id,
                c.name,
                COUNT(t.id) as transaction_count
            FROM counters c
            LEFT JOIN transactions t ON c.id = t.counter_id
            AND EXTRACT(MONTH FROM t.printed_at) = :month
            AND EXTRACT(YEAR FROM t.printed_at) = :year
            AND t.status = 'completed'
            GROUP BY c.id, c.name
            ORDER BY c.id ASC
        `;

        const results = await sequelize.query(query, {
            replacements: { month, year },
            type: sequelize.QueryTypes.SELECT,
        });

        return results.map(r => ({
            name: r.name || `Quầy ${r.id}`,
            value: parseInt(r.transaction_count) || 0,
        }));
    } catch (error) {
        console.error('getCounterMonthlyData error:', error);
        return [];
    }
}

/**
 * Get counter statistics for the current quarter (3 months)
 * @param {number} quarterStartMonth - Start month of quarter (1, 4, 7, or 10)
 * @param {number} quarterEndMonth - End month of quarter (3, 6, 9, or 12)
 * @param {number} year
 * @returns {Promise<Array>}
 */
async function getCounterQuarterlyData(quarterStartMonth, quarterEndMonth, year) {
    try {
        const query = `
            SELECT 
                c.id,
                c.name,
                COUNT(t.id) as transaction_count
            FROM counters c
            LEFT JOIN transactions t ON c.id = t.counter_id
            AND EXTRACT(MONTH FROM t.printed_at) >= :quarterStartMonth
            AND EXTRACT(MONTH FROM t.printed_at) <= :quarterEndMonth
            AND EXTRACT(YEAR FROM t.printed_at) = :year
            AND t.status = 'completed'
            GROUP BY c.id, c.name
            ORDER BY c.id ASC
        `;

        const results = await sequelize.query(query, {
            replacements: {
                quarterStartMonth,
                quarterEndMonth,
                year,
            },
            type: sequelize.QueryTypes.SELECT,
        });

        return results.map(r => ({
            name: r.name || `Quầy ${r.id}`,
            value: parseInt(r.transaction_count) || 0,
        }));
    } catch (error) {
        console.error('getCounterQuarterlyData error:', error);
        return [];
    }
}

/**
 * Get total transactions count across all time
 * @returns {Promise<number>}
 */
async function getTotalTransactionsAllTime() {
    try {
        const query = `
            SELECT COUNT(*) as total
            FROM transactions
        `;

        const results = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT,
        });

        return parseInt(results[0]?.total) || 0;
    } catch (error) {
        console.error('getTotalTransactionsAllTime error:', error);
        return 0;
    }
}

/**
 * Get ticket status summary for summary cards
 * @param {number} month
 * @param {number} year
 * @returns {Promise<Object>}
 */
async function getTicketStatusSummary(month, year) {
    try {
        const query = `
            SELECT 
                status,
                COUNT(*) as count
            FROM transactions
            GROUP BY status
        `;

        const results = await sequelize.query(query, {
            type: sequelize.QueryTypes.SELECT,
        });

        const summary = {
            waiting: 0,
            completed: 0,
            cancelled: 0,
        };

        results.forEach(r => {
            if (r.status === 'waiting') {
                summary.waiting = parseInt(r.count) || 0;
            } else if (r.status === 'completed') {
                summary.completed = parseInt(r.count) || 0;
            } else if (r.status === 'cancelled') {
                summary.cancelled = parseInt(r.count) || 0;
            }
        });

        return summary;
    } catch (error) {
        console.error('getTicketStatusSummary error:', error);
        return {
            waiting: 0,
            completed: 0,
            cancelled: 0,
        };
    }
}

/**
 * Get all dashboard analytics data
 * @param {number} month
 * @param {number} year
 * @returns {Promise<Object>}
 */
async function getAnalyticsData(month, year) {
    try {
        // Calculate quarter start and end months
        // Q1: 1-3, Q2: 4-6, Q3: 7-9, Q4: 10-12
        const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
        const quarterEndMonth = quarterStartMonth + 2;

        // Fetch all data in parallel
        const [
            pieData,
            barTrendsData,
            barMonthlyData,
            barQuarterlyData,
            ticketStatusSummary,
            totalTransactionsAllTime,
        ] = await Promise.all([
            getTransactionStatusData(month, year),
            getTicketTrendsData(month, year),
            getCounterMonthlyData(month, year),
            getCounterQuarterlyData(quarterStartMonth, quarterEndMonth, year),
            getTicketStatusSummary(month, year),
            getTotalTransactionsAllTime(),
        ]);

        return {
            pie_transaction_status: pieData,
            bar_ticket_trends: barTrendsData,
            bar_counter_monthly: barMonthlyData,
            bar_counter_quarterly: barQuarterlyData,
            ticket_status_summary: ticketStatusSummary,
            total_transactions_all_time: totalTransactionsAllTime,
        };
    } catch (error) {
        console.error('getAnalyticsData error:', error);
        return {
            pie_transaction_status: [],
            bar_ticket_trends: [],
            bar_counter_monthly: [],
            bar_counter_quarterly: [],
            ticket_status_summary: {
                waiting: 0,
                completed: 0,
                cancelled: 0,
            },
        };
    }
}

module.exports = {
    getAnalyticsData,
    getTransactionStatusData,
    getTicketTrendsData,
    getCounterMonthlyData,
    getCounterQuarterlyData,
    getTicketStatusSummary,
    getTotalTransactionsAllTime,
};
