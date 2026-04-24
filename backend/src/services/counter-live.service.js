const { Op } = require('sequelize');
const { sequelize } = require('../config/db');
const Transaction = require('../models/Transaction');
const Counter = require('../models/Counter');
const CounterSession = require('../models/CounterSession');
const CounterPriorityService = require('../models/CounterPriorityService');
const Service = require('../models/Service');
const Customer = require('../models/Customer');
const User = require('../models/User');
const TransactionOffice = require('../models/TransactionOffice');
const { emitQueueUpdate, emitTicketCalled, emitOfficeQueueUpdate } = require('../socket');

/**
 * Counter Live Service
 * Handles all business logic for counter staff operations
 */

class CounterLiveService {
    /**
     * Get session info from session_token
     */
    async getSessionInfo(sessionToken) {
        const session = await CounterSession.findOne({
            where: {
                session_token: sessionToken,
                status: 'active',
            },
            include: [
                {
                    model: Counter,
                    as: 'Counter',
                    required: true,
                },
                {
                    model: User,
                    as: 'User',
                    required: true,
                },
                {
                    model: TransactionOffice,
                    as: 'TransactionOffice',
                    required: true,
                },
            ],
        });

        if (!session) {
            const error = new Error('Session not found or inactive');
            error.statusCode = 401;
            error.isExpectedSessionError = true;
            throw error;
        }

        if (!session.Counter || session.Counter.is_active === false) {
            const error = new Error('Counter is inactive');
            error.statusCode = 401;
            error.isExpectedSessionError = true;
            throw error;
        }

        if (!session.TransactionOffice || session.TransactionOffice.is_active === false) {
            const error = new Error('Phòng giao dịch đang tạm ngưng hoạt động');
            error.statusCode = 403;
            error.isExpectedSessionError = true;
            throw error;
        }

        return session;
    }

    /**
     * Get services that this counter is responsible for
     */
    async getCounterServices(counterId) {
        const services = await CounterPriorityService.findAll({
            where: { counter_id: counterId },
            include: [
                {
                    model: Service,
                    as: 'Service',
                    where: { is_active: true },
                    required: true,
                },
            ],
            order: [['priority_level', 'ASC']],
        });

        return services.map((ps) => ({
            service_id: ps.service_id,
            priority_level: ps.priority_level,
            service: ps.Service,
        }));
    }

    /**
     * API 1: Get Queue Data
     * Returns waiting, missed, and booking lists
     */
    async getQueueData(sessionToken) {
        const session = await this.getSessionInfo(sessionToken);
        const counterId = session.counter_id;
        const officeId = session.transaction_office_id;

        // Get services this counter handles
        const counterServices = await CounterPriorityService.findAll({
            where: { counter_id: counterId },
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code', 'is_active'],
                    where: { is_active: true },
                    required: true,
                },
            ],
            attributes: ['service_id', 'priority_level'],
        });

        const serviceIds = counterServices.map((cs) => cs.service_id);
        const allowedServices = counterServices.map((cs) => ({
            service_id: cs.service_id,
            priority_level: cs.priority_level,
            service: cs.Service
                ? {
                    id: cs.Service.id,
                    name: cs.Service.name,
                    code: cs.Service.code,
                }
                : null,
        }));

        if (serviceIds.length === 0) {
            return {
                waiting: [],
                missed: [],
                booking: [],
                currentTicket: null,
                allowed_service_ids: [],
                allowed_services: [],
            };
        }

        // Create a priority map for sorting
        const priorityMap = {};
        counterServices.forEach((cs) => {
            priorityMap[cs.service_id] = cs.priority_level;
        });

        // Get current date in local timezone
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // 1. Waiting tickets (status = 'waiting')
        // Priority: priority tickets first, then FIFO by printed_at
        const waiting = await Transaction.findAll({
            where: {
                transaction_office_id: officeId,
                service_id: { [Op.in]: serviceIds },
                status: 'waiting',
                [Op.or]: [
                    { counter_id: null },        // Unassigned tickets
                    { counter_id: counterId },   // Tickets assigned to this counter
                ],
                printed_at: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow,
                },
            },
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code'],
                    where: { is_active: true },
                    required: true,
                },
                {
                    model: Customer,
                    as: 'Customer',
                    // ✅ Include all customer fields needed for form filling
                    attributes: ['id', 'full_name', 'national_id', 'dob', 'gender', 'address', 'avatar_url', 'religion', 'ethnicity', 'personal_identification', 'date_of_issue', 'date_of_expiry', 'place_of_origin', 'father_name', 'mother_name'],
                    required: false,
                },
            ],
            attributes: {
                include: ['face_capture_url']
            },
            order: [
                ['printed_at', 'ASC'],
            ],
        });

        // Sort by priority_level first (ascending), then by printed_at (FIFO)
        const sortedWaiting = waiting.sort((a, b) => {
            const priorityA = priorityMap[a.service_id] || 999;
            const priorityB = priorityMap[b.service_id] || 999;
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }
            return new Date(a.printed_at).getTime() - new Date(b.printed_at).getTime();
        });

        // 2. Missed tickets (status = 'skipped' or 'cancelled')
        const missed = await Transaction.findAll({
            where: {
                transaction_office_id: officeId,
                service_id: { [Op.in]: serviceIds },
                status: { [Op.in]: ['skipped', 'cancelled'] },
                printed_at: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow,
                },
            },
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code'],
                    where: { is_active: true },
                    required: true,
                },
                {
                    model: Customer,
                    as: 'Customer',
                    // ✅ Include all customer fields needed for form filling
                    attributes: ['id', 'full_name', 'national_id', 'dob', 'gender', 'address', 'avatar_url', 'religion', 'ethnicity', 'personal_identification', 'date_of_issue', 'date_of_expiry', 'place_of_origin', 'father_name', 'mother_name'],
                    required: false,
                },
            ],
            attributes: {
                include: ['face_capture_url']
            },
            order: [['called_at', 'DESC']],
        });

        // Get current serving ticket for this counter
        const currentTicket = await Transaction.findOne({
            where: {
                counter_id: counterId,
                service_id: { [Op.in]: serviceIds },
                status: 'serving',
                printed_at: {
                    [Op.gte]: today,
                    [Op.lt]: tomorrow,
                },
            },
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code'],
                    where: { is_active: true },
                    required: true,
                },
                {
                    model: Customer,
                    as: 'Customer',
                    // ✅ Include all customer fields needed for form filling
                    attributes: ['id', 'full_name', 'national_id', 'dob', 'gender', 'address', 'avatar_url', 'religion', 'ethnicity', 'personal_identification', 'date_of_issue', 'date_of_expiry', 'place_of_origin', 'father_name', 'mother_name'],
                    required: false,
                },
            ],
            attributes: {
                include: ['face_capture_url']
            },
        });

        return {
            waiting: sortedWaiting.map((t) => this.formatTransaction(t)),
            missed: missed.map((t) => this.formatTransaction(t)),
            currentTicket: currentTicket ? this.formatTransaction(currentTicket) : null,
            allowed_service_ids: serviceIds,
            allowed_services: allowedServices,
        };
    }

    /**
     * API 2: Call Ticket
     * Action: NEXT (call next) or CALL_SPECIFIC (call specific ticket)
     */
    async callTicket(sessionToken, action, transactionId = null) {
        const session = await this.getSessionInfo(sessionToken);
        const counterId = session.counter_id;
        const userId = session.user_id;
        const officeId = session.transaction_office_id;

        // Check if counter is already serving another ticket
        const currentServing = await Transaction.findOne({
            where: {
                counter_id: counterId,
                status: 'serving',
            },
        });

        if (currentServing) {
            throw new Error('Please complete or cancel the current ticket before calling a new one');
        }

        // Only allow active services that are assigned to this counter
        const counterServices = await CounterPriorityService.findAll({
            where: { counter_id: counterId },
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id'],
                    where: { is_active: true },
                    required: true,
                },
            ],
            attributes: ['service_id', 'priority_level'],
        });

        const serviceIds = counterServices.map((cs) => cs.service_id);

        if (serviceIds.length === 0) {
            throw new Error('No active services assigned to this counter');
        }

        const priorityMap = {};
        counterServices.forEach((cs) => {
            priorityMap[cs.service_id] = cs.priority_level;
        });

        let ticket = null;

        if (action === 'NEXT') {
            // Find next waiting ticket

            // Get current date in local timezone
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            // Get all waiting tickets for these services
            const waitingTickets = await Transaction.findAll({
                where: {
                    transaction_office_id: officeId,
                    service_id: { [Op.in]: serviceIds },
                    status: 'waiting',
                    printed_at: {
                        [Op.gte]: today,
                        [Op.lt]: tomorrow,
                    },
                },
                include: [
                    {
                        model: Service,
                        as: 'Service',
                        attributes: ['id'],
                        where: { is_active: true },
                        required: true,
                    },
                ],
                order: [['printed_at', 'ASC']],
            });

            if (waitingTickets.length === 0) {
                throw new Error('Không có vé đang đợi');
            }

            // Sort by priority_level first (ascending), then by printed_at (FIFO)
            ticket = waitingTickets.sort((a, b) => {
                const priorityA = priorityMap[a.service_id] || 999;
                const priorityB = priorityMap[b.service_id] || 999;
                if (priorityA !== priorityB) {
                    return priorityA - priorityB;
                }
                return new Date(a.printed_at).getTime() - new Date(b.printed_at).getTime();
            })[0];
        } else if (action === 'CALL_SPECIFIC') {
            if (!transactionId) {
                throw new Error('Transaction ID is required for CALL_SPECIFIC action');
            }

            ticket = await Transaction.findByPk(transactionId);

            if (!ticket) {
                throw new Error('Ticket not found');
            }

            if (ticket.status !== 'waiting' && ticket.status !== 'skipped' && ticket.status !== 'cancelled') {
                throw new Error(`Cannot call ticket with status: ${ticket.status}`);
            }

            // Ensure ticket service is still active and assigned to this counter
            const allowedServiceIds = serviceIds;
            if (!allowedServiceIds.includes(ticket.service_id)) {
                throw new Error('Dịch vụ của vé đã bị vô hiệu hóa hoặc không còn thuộc quầy này');
            }
        } else {
            throw new Error('Hành động không hợp lệ. Sử dụng NEXT hoặc CALL_SPECIFIC');
        }

        const now = new Date();

        // Update ticket to 'serving' and start timer immediately
        await ticket.update({
            status: 'serving',
            counter_id: counterId,
            user_id: userId,
            called_at: now,
            started_at: now, // Set started_at when ticket is called
            recall_count: ticket.status === 'called' ? ticket.recall_count : 0, // Reset if not recall
        });

        // Reload with associations
        await ticket.reload({
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code'],
                },
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'full_name', 'national_id', 'avatar_url'],
                    required: false,
                },
            ],
            attributes: {
                include: ['face_capture_url']
            },
        });

        const formattedTicket = this.formatTransaction(ticket);

        // Emit socket event for ticket called (for TV display)
        emitTicketCalled(officeId, {
            transaction_id: ticket.id,
            ticket_number: ticket.ticket_number,
            counter_id: counterId,
            counter_code: session.Counter?.code,
            counter_name: session.Counter?.name,
            service_name: ticket.Service?.name,
        });

        // Emit queue update to the counter
        const updatedQueueData = await this.getQueueData(sessionToken);
        emitQueueUpdate(counterId, updatedQueueData);

        // Also emit to entire office so other counters see the ticket being called and removed from waiting list
        emitOfficeQueueUpdate(officeId, updatedQueueData);

        return {
            message: 'Ticket called successfully',
            ticket: formattedTicket,
        };
    }

    /**
     * API 3: Ticket Action
     * Actions: START, END, CANCEL, SKIP, RECALL
     */
    async ticketAction(sessionToken, transactionId, action, note = null) {
        const session = await this.getSessionInfo(sessionToken);
        const counterId = session.counter_id;
        const officeId = session.transaction_office_id;

        const ticket = await Transaction.findByPk(transactionId);

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        // Permission checks based on action and ticket status
        if (action === 'CANCEL' && ticket.status === 'waiting') {
            // CANCEL from waiting list: check office
            if (ticket.transaction_office_id !== officeId) {
                throw new Error('This ticket does not belong to your office');
            }
        } else if (action === 'RESTORE' && (ticket.status === 'cancelled' || ticket.status === 'skipped')) {
            // RESTORE cancelled/skipped: check office
            if (ticket.transaction_office_id !== officeId) {
                throw new Error('This ticket does not belong to your office');
            }
        } else {
            // For other actions (START, END, RECALL, SKIP): verify ticket belongs to this counter
            if (ticket.counter_id !== counterId) {
                throw new Error('This ticket does not belong to your counter');
            }
        }

        const now = new Date();

        switch (action) {
            case 'START':
                if (ticket.status !== 'called') {
                    throw new Error('Can only start tickets with status "called"');
                }
                await ticket.update({
                    status: 'serving',
                    started_at: ticket.started_at || now, // Ensure started_at is set if not already
                });
                break;

            case 'END':
                if (ticket.status !== 'serving') {
                    throw new Error('Can only end tickets with status "serving"');
                }
                // Calculate service time based on started_at, fallback to called_at
                const startTime = ticket.started_at || ticket.called_at;
                const serviceTimeSeconds = startTime
                    ? Math.floor((now - new Date(startTime)) / 1000)
                    : 0;

                const waitingTimeSeconds = ticket.called_at && ticket.printed_at
                    ? Math.floor((new Date(ticket.called_at) - new Date(ticket.printed_at)) / 1000)
                    : 0;

                await ticket.update({
                    status: 'completed',
                    finished_at: now,
                    service_time_seconds: serviceTimeSeconds,
                    waiting_time_seconds: waitingTimeSeconds,
                });

                // Update session stats: total_served and avg_waiting_time
                // Recalculate based on unique tickets to avoid over-weighting add-on services
                const statsResult = await Transaction.findAll({
                    where: {
                        user_id: session.user_id,
                        counter_id: session.counter_id,
                        status: 'completed',
                        waiting_time_seconds: { [Op.not]: null },
                        finished_at: { [Op.gte]: session.login_time }
                    },
                    attributes: [
                        'ticket_number',
                        [sequelize.fn('MAX', sequelize.col('waiting_time_seconds')), 'wait_time']
                    ],
                    group: ['ticket_number'],
                    raw: true
                });

                const newTotalServed = statsResult.length;
                const totalWaitTime = statsResult.reduce((sum, row) => sum + parseInt(row.wait_time || 0), 0);
                const newAvgWaitingTime = newTotalServed > 0 ? Math.round(totalWaitTime / newTotalServed) : 0;

                await session.update({
                    total_served: newTotalServed,
                    avg_waiting_time: newAvgWaitingTime,
                });

                break;

            case 'RECALL':
                if (ticket.status !== 'called' && ticket.status !== 'serving') {
                    throw new Error('Can only recall tickets with status "called" or "serving"');
                }
                await ticket.update({
                    recall_count: ticket.recall_count + 1,
                });

                // TODO: Send Socket.IO signal again
                // io.emit('ticket-recalled', { ticket_number: ticket.ticket_number, counter_id: counterId });
                break;

            case 'SKIP':
                if (ticket.status !== 'called' && ticket.status !== 'serving') {
                    throw new Error('Can only skip tickets with status "called" or "serving"');
                }
                await ticket.update({
                    status: 'skipped',
                    note: note || 'Customer did not respond',
                });
                break;

            case 'CANCEL':
                await ticket.update({
                    status: 'cancelled',
                    note: note || 'Cancelled by staff',
                    finished_at: now,
                });
                break;

            case 'RESTORE':
                if (ticket.status !== 'cancelled' && ticket.status !== 'skipped') {
                    throw new Error('Can only restore tickets with status "cancelled" or "skipped"');
                }
                await ticket.update({
                    started_at: null,
                    status: 'waiting',
                    counter_id: null,
                    called_at: null,
                    finished_at: null,
                    note: note || 'Khôi phục vé về hàng đợi',
                });
                break;

            default:
                throw new Error('Hành động không hợp lệ. Sử dụng START, END, CANCEL, SKIP, RECALL hoặc RESTORE');
        }

        // Reload with associations
        await ticket.reload({
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code'],
                },
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'full_name', 'national_id', 'avatar_url'],
                    required: false,
                },
            ],
            attributes: {
                include: ['face_capture_url']
            },
        });

        // Update transaction's service and reset the timer

        // Get updated queue data
        const updatedQueueData = await this.getQueueData(sessionToken);
        emitQueueUpdate(counterId, updatedQueueData);

        // Also emit to entire office so other counters see the change in waiting list
        emitOfficeQueueUpdate(officeId, updatedQueueData);

        const formattedTicket = this.formatTransaction(ticket);

        return {
            message: `Ticket ${action.toLowerCase()} successfully`,
            ticket: formattedTicket,
        };
    }

    /**
     * API 4: Transfer Ticket
     * Transfer to another service or counter
     */
    async transferTicket(sessionToken, transactionId, targetServiceId = null, targetCounterId = null, note = null) {
        const session = await this.getSessionInfo(sessionToken);
        const counterId = session.counter_id;
        const officeId = session.transaction_office_id;

        const ticket = await Transaction.findByPk(transactionId);

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        // Allow transfer from waiting list (same office) or from current counter or from called/serving
        if (ticket.status === 'waiting' || ticket.counter_id === null) {
            // Transferring from waiting list - check office
            if (ticket.transaction_office_id !== officeId) {
                throw new Error('This ticket does not belong to your office');
            }
        } else if (ticket.counter_id && ticket.counter_id !== counterId) {
            // Ticket is assigned to another counter
            throw new Error('This ticket does not belong to your counter');
        }

        if (!targetServiceId && !targetCounterId) {
            throw new Error('Must specify either target_service_id or target_counter_id');
        }

        const updateData = {
            status: 'waiting',
            transfer_from_counter_id: ticket.counter_id || counterId,
            note: note || 'Transferred',
            called_at: null,
            counter_id: null, // Reset counter assignment
        };

        // Save original service if not already saved
        if (!ticket.original_service_id) {
            updateData.original_service_id = ticket.service_id;
        }

        if (targetServiceId) {
            // Transfer to different service
            const targetService = await Service.findByPk(targetServiceId);
            if (!targetService) {
                throw new Error('Target service not found');
            }
            if (targetService.is_active === false) {
                const error = new Error('Dịch vụ này hiện đang tạm ngưng cung cấp.');
                error.statusCode = 400;
                throw error;
            }
            updateData.service_id = targetServiceId;
        }

        if (targetCounterId) {
            // Transfer to specific counter (optional - prioritize this counter)
            const targetCounter = await Counter.findByPk(targetCounterId);
            if (!targetCounter) {
                throw new Error('Target counter not found');
            }

            // ===== NEW VALIDATION: Check if target counter supports the ticket's service =====
            // Determine which service to check: new service or original service
            const serviceToCheck = targetServiceId || ticket.service_id;

            // Check if target counter has this service in counter_priority_services
            const counterService = await CounterPriorityService.findOne({
                where: {
                    counter_id: targetCounterId,
                    service_id: serviceToCheck,
                },
            });

            if (!counterService) {
                // Target counter does not support this service
                throw new Error('Quầy được chọn không hỗ trợ dịch vụ này');
            }

            updateData.counter_id = targetCounterId;
        }

        await ticket.update(updateData);

        // Reload with associations
        await ticket.reload({
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code'],
                },
                {
                    model: Customer,
                    as: 'Customer',
                    attributes: ['id', 'full_name', 'national_id', 'avatar_url'],
                    required: false,
                },
            ],
            attributes: {
                include: ['face_capture_url']
            },
        });

        const formattedTicket = this.formatTransaction(ticket);

        // Get updated queue data
        const updatedQueueData = await this.getQueueData(sessionToken);
        emitQueueUpdate(counterId, updatedQueueData);

        // Emit to entire office so all counters see the change
        emitOfficeQueueUpdate(officeId, updatedQueueData);

        if (targetCounterId && targetCounterId !== counterId) {
            // Also notify the target counter specifically
            emitQueueUpdate(targetCounterId, updatedQueueData);
        }

        return {
            message: 'Ticket transferred successfully',
            ticket: formattedTicket,
        };
    }

    /**
     * Pause/Resume Counter Session
     */
    async toggleSessionStatus(sessionToken) {
        const session = await this.getSessionInfo(sessionToken);

        const newStatus = session.status === 'active' ? 'paused' : 'active';

        await session.update({ status: newStatus });

        return {
            message: `Counter ${newStatus === 'paused' ? 'paused' : 'resumed'} successfully`,
            status: newStatus,
        };
    }

    /**
     * Helper: Format Transaction for API response
     */
    formatTransaction(transaction) {
        const waitingMinutes = transaction.printed_at
            ? Math.floor((new Date() - new Date(transaction.printed_at)) / 60000)
            : 0;

        return {
            id: transaction.id,
            ticket_number: transaction.ticket_number,
            ticket_type: transaction.ticket_type,
            status: transaction.status,
            service: transaction.Service
                ? {
                    id: transaction.Service.id,
                    name: transaction.Service.name,
                    code: transaction.Service.code,
                }
                : null,
            customer: transaction.Customer
                ? {
                    id: transaction.Customer.id,
                    name: transaction.Customer.full_name,
                    phone: transaction.Customer.phone,  // Actual phone number (if available)
                    // ✅ Add all ID card related fields
                    eid_number: transaction.Customer.national_id,      // Số CCCD
                    date_of_birth: transaction.Customer.dob,           // Ngày sinh
                    sex: transaction.Customer.gender,                  // Giới tính
                    place_of_residence: transaction.Customer.address,  // Địa chỉ
                    date_of_issue: transaction.Customer.date_of_issue,  // Ngày cấp
                    date_of_expiry: transaction.Customer.date_of_expiry,  // Ngày hết hạn
                    personal_identification: transaction.Customer.personal_identification,  // Số CCCD (lặp)
                    avatar_url: transaction.Customer.avatar_url,
                    religion: transaction.Customer.religion,            // Tôn giáo
                    ethnicity: transaction.Customer.ethnicity,          // Dân tộc
                    place_of_origin: transaction.Customer.place_of_origin,  // Quê quán
                    father_name: transaction.Customer.father_name,    // Tên cha
                    mother_name: transaction.Customer.mother_name,    // Tên mẹ
                }
                : null,
            printed_at: transaction.printed_at,
            called_at: transaction.called_at,
            started_at: transaction.started_at,
            finished_at: transaction.finished_at,
            waiting_minutes: waitingMinutes,
            recall_count: transaction.recall_count,
            note: transaction.note,
            face_capture_url: transaction.face_capture_url,
        };
    }

    async addService(sessionToken, transactionId, newServiceId) {
        const session = await this.getSessionInfo(sessionToken);
        const counterId = session.counter_id;
        const officeId = session.transaction_office_id;
        const userId = session.user_id;

        // Use database transaction for atomicity
        const t = await sequelize.transaction();

        try {
            // Step 1: Fetch old transaction
            const oldTicket = await Transaction.findByPk(transactionId, { transaction: t });

            if (!oldTicket) {
                await t.rollback();
                throw new Error('Ticket not found');
            }

            // Verify ticket belongs to this counter
            if (oldTicket.counter_id !== counterId) {
                await t.rollback();
                throw new Error('This ticket does not belong to your counter');
            }

            // Verify ticket is being served
            if (oldTicket.status !== 'serving') {
                await t.rollback();
                throw new Error('Can only add service to tickets that are being served');
            }

            // Verify new service exists
            const newService = await Service.findByPk(newServiceId, { transaction: t });
            if (!newService) {
                await t.rollback();
                throw new Error('Service not found');
            }
            if (newService.is_active === false) {
                await t.rollback();
                const error = new Error('Dịch vụ này hiện đang tạm ngưng cung cấp.');
                error.statusCode = 400;
                throw error;
            }

            const now = new Date();

            // Step 2: Complete old transaction
            // Calculate waiting_time_seconds and service_time_seconds for old transaction
            const oldWaitingTimeSeconds = oldTicket.called_at && oldTicket.printed_at
                ? Math.floor((new Date(oldTicket.called_at) - new Date(oldTicket.printed_at)) / 1000)
                : 0;

            const oldServiceTimeSeconds = oldTicket.called_at
                ? Math.floor((now - new Date(oldTicket.called_at)) / 1000)
                : 0;

            await oldTicket.update({
                status: 'completed',
                finished_at: now,
                waiting_time_seconds: oldWaitingTimeSeconds,
                service_time_seconds: oldServiceTimeSeconds,
            }, { transaction: t });

            // Step 3: Create new transaction (split transaction)
            // Calculate initial waiting_time_seconds for new transaction (from original print time to now)
            const newWaitingTimeSeconds = oldTicket.called_at && oldTicket.printed_at
                ? Math.floor((new Date(oldTicket.called_at) - new Date(oldTicket.printed_at)) / 1000)
                : 0;

            const newTicket = await Transaction.create({
                // Copy from old transaction
                ticket_number: oldTicket.ticket_number,
                ticket_type: oldTicket.ticket_type,
                customer_id: oldTicket.customer_id,
                kiosk_id: oldTicket.kiosk_id,
                transaction_office_id: oldTicket.transaction_office_id,
                face_capture_url: oldTicket.face_capture_url, // Copy face capture

                // New service
                service_id: newServiceId,

                // Staff and counter
                user_id: userId,
                counter_id: counterId,

                // Status and timing
                status: 'serving',
                printed_at: oldTicket.printed_at, // Keep original print time to preserve waiting time
                called_at: oldTicket.called_at, // Keep original called_at to preserve waiting time
                started_at: new Date(), // Start new timer for new service
                finished_at: null,

                // Waiting and service times
                waiting_time_seconds: newWaitingTimeSeconds, // Preserve waiting time from original
                service_time_seconds: 0, // Reset service time for new service

                // Optional: Mark as add-on service
                // You can add a field 'parent_transaction_id' or use extra_info
                // extra_info: JSON.stringify({ parent_id: transactionId, is_addon: true }),
            }, { transaction: t });

            // Commit transaction
            await t.commit();

            // Update session stats: total_served and avg_waiting_time
            // Recalculate based on unique tickets to avoid over-weighting add-on services
            const statsResult = await Transaction.findAll({
                where: {
                    user_id: userId,
                    counter_id: counterId,
                    status: 'completed',
                    waiting_time_seconds: { [Op.not]: null },
                    finished_at: { [Op.gte]: session.login_time }
                },
                attributes: [
                    'ticket_number',
                    [sequelize.fn('MAX', sequelize.col('waiting_time_seconds')), 'wait_time']
                ],
                group: ['ticket_number'],
                raw: true
            });

            const newTotalServed = statsResult.length;
            const totalWaitTime = statsResult.reduce((sum, row) => sum + parseInt(row.wait_time || 0), 0);
            const newAvgWaitingTime = newTotalServed > 0 ? Math.round(totalWaitTime / newTotalServed) : 0;

            await session.update({
                total_served: newTotalServed,
                avg_waiting_time: newAvgWaitingTime,
            });

            // Reload new ticket with associations
            await newTicket.reload({
                include: [
                    {
                        model: Service,
                        as: 'Service',
                        attributes: ['id', 'name', 'code'],
                    },
                    {
                        model: Customer,
                        as: 'Customer',
                        attributes: ['id', 'full_name', 'national_id', 'avatar_url'],
                        required: false,
                    },
                ],
                attributes: {
                    include: ['face_capture_url']
                },
            });

            const formattedTicket = this.formatTransaction(newTicket);

            // Get updated queue data
            const updatedQueueData = await this.getQueueData(sessionToken);
            emitQueueUpdate(counterId, updatedQueueData);

            // Also emit to entire office
            emitOfficeQueueUpdate(officeId, updatedQueueData);

            return {
                message: 'Service added successfully - New transaction created',
                ticket: formattedTicket,
                old_transaction_id: transactionId,
                new_transaction_id: newTicket.id,
            };
        } catch (error) {
            await t.rollback();
            throw error;
        }
    }

    /**
     * Recall Ticket - Re-announce ticket that was already called
     */
    async recallTicket(sessionToken, transactionId) {
        const session = await this.getSessionInfo(sessionToken);
        const counterId = session.counter_id;
        const officeId = session.transaction_office_id;

        // Find the ticket
        const ticket = await Transaction.findByPk(transactionId, {
            include: [
                {
                    model: Service,
                    as: 'Service',
                    attributes: ['id', 'name', 'code'],
                },
            ],
        });

        if (!ticket) {
            throw new Error('Ticket not found');
        }

        // Verify ticket belongs to this counter
        if (ticket.counter_id !== counterId) {
            throw new Error('This ticket does not belong to your counter');
        }

        // Only allow recall for tickets in 'serving' status
        if (ticket.status !== 'serving') {
            throw new Error('Can only recall tickets that are currently being served');
        }

        // Increment recall_count (do NOT update called_at to preserve waiting time calculation)
        await ticket.update({
            recall_count: ticket.recall_count + 1,
        });

        // Emit socket event for ticket recall (for TV display with blinking effect)
        emitTicketCalled(officeId, {
            transaction_id: ticket.id,
            ticket_number: ticket.ticket_number,
            counter_id: counterId,
            counter_code: session.Counter?.code,
            counter_name: session.Counter?.name,
            service_name: ticket.Service?.name,
            isRecall: true, // Flag to indicate this is a recall
        });

        // Emit queue update to the counter
        const updatedQueueData = await this.getQueueData(sessionToken);
        emitQueueUpdate(counterId, updatedQueueData);

        // Also emit to entire office so other counters see the recall
        emitOfficeQueueUpdate(officeId, updatedQueueData);

        return {
            message: 'Ticket recalled successfully',
            ticket_number: ticket.ticket_number,
            recall_count: ticket.recall_count,
        };
    }

    /**
     * Update Session Status - Pause/Resume counter session
     */
    async updateSessionStatus(sessionToken, newStatus) {
        // Validate status
        if (!['active', 'paused'].includes(newStatus)) {
            throw new Error('Trạng thái không hợp lệ. Phải là "active" hoặc "paused"');
        }

        // Find session without status filter (to allow paused -> active transition)
        const session = await CounterSession.findOne({
            where: {
                session_token: sessionToken,
            },
            include: [
                {
                    model: Counter,
                    as: 'Counter',
                    required: true,
                },
                {
                    model: User,
                    as: 'User',
                    required: true,
                },
            ],
        });

        if (!session) {
            throw new Error('Session not found');
        }

        // If trying to pause, check if there's a customer being served
        if (newStatus === 'paused') {
            const servingTicket = await Transaction.findOne({
                where: {
                    counter_id: session.counter_id,
                    status: 'serving',
                },
            });

            if (servingTicket) {
                throw new Error('Không thể tạm nghỉ khi còn khách hàng đang phục vụ. Vui lòng hoàn thành hoặc chuyển vé trước.');
            }
        }

        // Update session status
        await session.update({
            status: newStatus,
        });

        // TODO: Send signal to physical LED board if connected
        // Example: await ledController.setCounterStatus(session.counter_id, newStatus);

        return {
            message: `Session ${newStatus === 'paused' ? 'paused' : 'resumed'} successfully`,
            status: newStatus,
            counter_id: session.counter_id,
        };
    }
}

module.exports = new CounterLiveService();
