const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const Transaction = require('../models/Transaction');
const Service = require('../models/Service');
const Counter = require('../models/Counter');
const User = require('../models/User');

/**
 * Monitor Service
 * Handles business logic for real-time monitoring dashboard
 */

class MonitorService {
    /**
     * Get statistics for dashboard
     */
    async getStats(officeId, date = null) {
        // If no date provided, use today in local timezone
        let targetDate;
        if (date) {
            targetDate = new Date(date);
        } else {
            // Get current date in local timezone (Vietnam UTC+7)
            const now = new Date();
            targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        }

        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        // Count tickets by status
        const stats = await Transaction.findAll({
            where: {
                transaction_office_id: officeId,
                printed_at: {
                    [Op.gte]: targetDate,
                    [Op.lt]: nextDay,
                },
            },
            attributes: [
                'status',
                [sequelize.fn('COUNT', sequelize.col('id')), 'count'],
            ],
            group: ['status'],
            raw: true,
        });

        // Transform to object format
        const result = {
            waiting: 0,
            serving: 0,
            completed: 0,
            cancelled: 0,
            skipped: 0,
        };

        stats.forEach((stat) => {
            if (result.hasOwnProperty(stat.status)) {
                result[stat.status] = parseInt(stat.count);
            }
        });

        // Calculate total
        result.total = result.waiting + result.serving + result.completed + result.cancelled + result.skipped;

        // Calculate average waiting time from unique transactions (daily accumulative stats)
        // Recalculate based on unique tickets to avoid over-weighting add-on services
        const statsResult = await Transaction.findAll({
            where: {
                transaction_office_id: officeId,
                printed_at: {
                    [Op.gte]: targetDate,
                    [Op.lt]: nextDay,
                },
                status: 'completed',
                waiting_time_seconds: {
                    [Op.not]: null,
                },
            },
            attributes: [
                'ticket_number',
                [sequelize.fn('MAX', sequelize.col('waiting_time_seconds')), 'wait_time']
            ],
            group: ['ticket_number'],
            raw: true,
        });

        const totalWaitTime = statsResult.reduce((sum, row) => sum + parseInt(row.wait_time || 0), 0);

        // Add average waiting seconds (rounded to integer)
        result.avg_waiting_seconds = statsResult.length > 0
            ? Math.round(totalWaitTime / statsResult.length)
            : 0;

        return result;
    }

    /**
     * Get live list of active tickets
     */
    async getLiveList(officeId, date = null) {
        // If no date provided, use today in local timezone
        let targetDate;
        if (date) {
            targetDate = new Date(date);
        } else {
            // Get current date in local timezone (Vietnam UTC+7)
            const now = new Date();
            targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        }

        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        // Get all tickets (waiting + serving + completed + cancelled + skipped)
        const tickets = await Transaction.findAll({
            where: {
                transaction_office_id: officeId,
                printed_at: {
                    [Op.gte]: targetDate,
                    [Op.lt]: nextDay,
                },
            },
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code'],
                },
                {
                    model: Counter,
                    as: 'Counter',
                    attributes: ['id', 'name', 'code'],
                    required: false,
                },
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username', 'full_name'],
                    required: false,
                },
            ],
            order: [['printed_at', 'ASC']],
        });

        // Format tickets
        const formattedTickets = tickets.map((ticket) => ({
            id: ticket.id,
            ticket_number: ticket.ticket_number,
            ticket_type: ticket.ticket_type,
            status: ticket.status,
            service_id: ticket.service_id,
            service_name: ticket.Service?.name || 'N/A',
            service_code: ticket.Service?.code || 'N/A',
            counter_id: ticket.counter_id,
            counter_name: ticket.Counter?.name || '-',
            counter_code: ticket.Counter?.code || '-',
            user_id: ticket.user_id,
            staff_name: ticket.User?.full_name || ticket.User?.username || '-',
            printed_at: ticket.printed_at,
            called_at: ticket.called_at,
            started_at: ticket.started_at,
            finished_at: ticket.finished_at,
        }));

        return formattedTickets;
    }

    /**
     * Get all tickets for detailed report
     */
    async getAllTickets(officeId, date = null) {
        // If no date provided, use today in local timezone
        let targetDate;
        if (date) {
            targetDate = new Date(date);
        } else {
            // Get current date in local timezone (Vietnam UTC+7)
            const now = new Date();
            targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        }

        const nextDay = new Date(targetDate);
        nextDay.setDate(nextDay.getDate() + 1);

        // Get all tickets
        const tickets = await Transaction.findAll({
            where: {
                transaction_office_id: officeId,
                printed_at: {
                    [Op.gte]: targetDate,
                    [Op.lt]: nextDay,
                },
            },
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code'],
                },
                {
                    model: Counter,
                    as: 'Counter',
                    attributes: ['id', 'name', 'code'],
                    required: false,
                },
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username', 'full_name'],
                    required: false,
                },
            ],
            order: [['printed_at', 'DESC']],
        });

        // Format tickets
        const formattedTickets = tickets.map((ticket) => ({
            id: ticket.id,
            ticket_number: ticket.ticket_number,
            ticket_type: ticket.ticket_type,
            status: ticket.status,
            service_name: ticket.Service?.name || 'N/A',
            counter_name: ticket.Counter?.name || '-',
            staff_name: ticket.User?.full_name || ticket.User?.username || '-',
            printed_at: ticket.printed_at,
            called_at: ticket.called_at,
            started_at: ticket.started_at,
            finished_at: ticket.finished_at,
        }));

        return formattedTickets;
    }

    /**
     * Get active counter sessions with avg_waiting_time for staff
     */
    async getCounterSessions(officeId) {
        const CounterSession = require('../models/CounterSession');
        const User = require('../models/User');
        const Counter = require('../models/Counter');

        // Get all active counter sessions for the office
        const sessions = await CounterSession.findAll({
            where: {
                transaction_office_id: officeId,
                status: 'active',
            },
            include: [
                {
                    model: User,
                    as: 'User',
                    attributes: ['id', 'username', 'full_name'],
                    required: false,
                },
                {
                    model: Counter,
                    as: 'Counter',
                    attributes: ['id', 'name', 'code'],
                    required: false,
                },
            ],
            order: [['login_time', 'DESC']],
        });

        // Format sessions
        const formattedSessions = sessions.map((session) => ({
            id: session.id,
            user_id: session.user_id,
            staff_name: session.User?.full_name || session.User?.username || '-',
            counter_id: session.counter_id,
            counter_name: session.Counter?.name || '-',
            counter_code: session.Counter?.code || '-',
            login_time: session.login_time,
            status: session.status,
            total_served: session.total_served || 0,
            avg_waiting_time: session.avg_waiting_time || 0,
        }));

        return formattedSessions;
    }
}

module.exports = new MonitorService();
