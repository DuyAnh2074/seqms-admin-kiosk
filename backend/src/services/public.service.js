const { Op } = require('sequelize');
const {
    EBoard,
    EBoardMedia,
    EBoardCounter,
    Transaction,
    Counter,
    Service,
    User,
    TransactionOffice,
} = require('../models');

/**
 * Get EBoard configuration by code (for TV Display)
 * @param {string} code - Board code
 * @returns {object} EBoard config with counters and media
 */
const getEBoardConfigByCode = async (code) => {
    // 1. Query bảng e_boards
    const eboard = await EBoard.findOne({
        where: { code, is_active: true },
        include: [
            {
                model: TransactionOffice,
                attributes: ['id', 'name', 'is_active'],
            },
        ],
    });

    if (!eboard) {
        throw new Error('E-Board not found');
    }

    if (!eboard.TransactionOffice || eboard.TransactionOffice.is_active === false) {
        const officeError = new Error('Phòng giao dịch đang tạm ngưng hoạt động');
        officeError.statusCode = 403;
        throw officeError;
    }

    // 2. Query bảng e_board_counters để lấy danh sách counter_id
    const eboardCounters = await EBoardCounter.findAll({
        where: { e_board_id: eboard.id },
        include: [
            {
                model: Counter,
                attributes: ['id', 'code', 'name'],
                where: { is_active: true },
                required: true,
            },
        ],
        attributes: [],
    });

    const counters = eboardCounters.map((ec) => ({
        id: ec.Counter.id,
        code: ec.Counter.code,
        name: ec.Counter.name,
    }));

    // 3. Query bảng e_board_media để lấy danh sách video/ảnh
    const media = await EBoardMedia.findAll({
        where: { e_board_id: eboard.id },
        attributes: ['id', 'file_type', 'file_url', 'description', 'sort_order'],
        order: [['sort_order', 'ASC']],
        raw: true,
    });

    // 4. Return object cấu hình đầy đủ
    return {
        id: eboard.id,
        code: eboard.code,
        name: eboard.name,
        transaction_office_id: eboard.transaction_office_id,
        office_name: eboard.TransactionOffice?.name,
        display_video: eboard.display_video,
        voice_call_number: eboard.voice_call_number,
        counters,
        counter_ids: counters.map((c) => c.id),
        media,
        created_at: eboard.created_at,
    };
};

/**
 * Get monitor tickets for display
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {number} officeId - Office ID (optional)
 * @param {array} counterIds - Counter IDs to filter (optional)
 * @returns {array} List of tickets
 */
const getMonitorTickets = async (date, officeId = null, counterIds = null) => {
    const whereClause = {
        status: {
            [Op.in]: ['waiting', 'called', 'serving'],
        },
    };

    // Filter by date (printed_at)
    if (date) {
        const startDate = new Date(`${date}T00:00:00`);
        const endDate = new Date(`${date}T23:59:59`);
        whereClause.printed_at = {
            [Op.between]: [startDate, endDate],
        };
    }

    // Filter by office if provided
    if (officeId) {
        whereClause.transaction_office_id = officeId;
    }

    // Filter by counter IDs if provided
    // Logic: Chỉ lấy vé thuộc các quầy này HOẶC vé đang chờ chưa gán quầy (counter_id IS NULL)
    if (counterIds && counterIds.length > 0) {
        whereClause[Op.and] = [
            {
                [Op.or]: [
                    { counter_id: { [Op.in]: counterIds } },
                    { counter_id: null }, // Vé chưa gán quầy
                ],
            },
        ];
    }

    const tickets = await Transaction.findAll({
        where: whereClause,
        include: [
            {
                model: Service,
                as: 'Service',
                attributes: ['id', 'name'],
                required: false,
            },
            {
                model: Counter,
                as: 'Counter',
                attributes: ['id', 'code', 'name'],
                required: false,
            },
            {
                model: User,
                as: 'User',
                attributes: ['id', 'full_name'],
                required: false,
            },
        ],
        attributes: [
            'id',
            'ticket_number',
            'service_id',
            'counter_id',
            'user_id',
            'status',
            'printed_at',
            'called_at',
            'started_at',
            'finished_at',
        ],
        order: [
            ['called_at', 'DESC'], // Mới gọi lên đầu
            ['printed_at', 'DESC'], // Sau đó sắp xếp theo lấy phiếu
        ],
        raw: false,
    });

    // Format response
    return tickets.map((t) => ({
        id: t.id,
        ticket_number: t.ticket_number,
        service_id: t.service_id,
        service_name: t.Service?.name || '',
        counter_id: t.counter_id,
        counter_code: t.Counter?.code || '',
        counter_name: t.Counter?.name || '',
        user_id: t.user_id,
        staff_name: t.User?.full_name || '',
        status: t.status,
        printed_at: t.printed_at,
        called_at: t.called_at,
        started_at: t.started_at,
        finished_at: t.finished_at,
    }));
};

/**
 * Get complete E-Board data for TV display
 * Queries: board info, display slots (counters with serving tickets), last called ticket, media
 * @param {string} code - Board code
 * @returns {object} Complete board data for TV display
 */
const getEBoardDataByCode = async (code) => {
    // Step 1: Get E-Board by code
    const eboard = await EBoard.findOne({
        where: { code, is_active: true },
        include: [
            {
                model: TransactionOffice,
                attributes: ['id', 'name', 'is_active'],
            },
        ],
    });

    if (!eboard) {
        throw new Error('E-Board not found');
    }

    if (!eboard.TransactionOffice || eboard.TransactionOffice.is_active === false) {
        const officeError = new Error('Phòng giao dịch đang tạm ngưng hoạt động');
        officeError.statusCode = 403;
        throw officeError;
    }

    // Step 2: Get ALL counters for this board (with counter info)
    const eboardCounters = await EBoardCounter.findAll({
        where: { e_board_id: eboard.id },
        include: [
            {
                model: Counter,
                attributes: ['id', 'code', 'name'],
                where: { is_active: true },
                required: true,
            },
        ],
        attributes: ['counter_id'],
        raw: false,
    });

    const counterIds = eboardCounters.map((ec) => ec.counter_id);
    const counterList = eboardCounters
        .map((ec) => ({
            id: ec.Counter.id,
            code: ec.Counter.code,
            name: ec.Counter.name,
        }))
        .sort((a, b) => a.code.localeCompare(b.code)); // Sort by code (quay-01, quay-02, ...)

    if (counterIds.length === 0) {
        // Board exists but has no counters assigned
        return {
            board_info: {
                id: eboard.id,
                code: eboard.code,
                name: eboard.name,
                office_name: eboard.TransactionOffice?.name,
                voice_call_number: eboard.voice_call_number,
            },
            display_slots: [],
            last_called_ticket: null,
            media: [],
        };
    }

    // Step 3: Run 2 queries in parallel
    const [servingTickets, mediaList] = await Promise.all([
        // Query A: All serving tickets for these counters
        Transaction.findAll({
            where: {
                status: 'serving',
                counter_id: { [Op.in]: counterIds },
            },
            attributes: ['id', 'ticket_number', 'counter_id'],
            raw: true,
        }),

        // Query B: Media list
        EBoardMedia.findAll({
            where: { e_board_id: eboard.id },
            attributes: ['id', 'file_type', 'file_url', 'description', 'sort_order'],
            order: [['sort_order', 'ASC']],
        }),
    ]);

    // Step 4: Create a map of counter_id -> serving_ticket
    const servingMap = {};
    servingTickets.forEach((ticket) => {
        servingMap[ticket.counter_id] = ticket.ticket_number;
    });

    // Step 5: Build display_slots - each counter with its serving ticket (or null)
    const displaySlots = counterList.map((counter) => ({
        counter_id: counter.id,
        counter_name: counter.code, // VD: "quay-01", "quay-02"
        serving_ticket: servingMap[counter.id] || null, // Vé đang phục vụ, hoặc null
    }));

    // Step 6: Get last called ticket
    const lastCalledTicket = await Transaction.findOne({
        where: {
            status: { [Op.in]: ['called', 'serving'] },
            counter_id: { [Op.in]: counterIds },
        },
        include: [
            {
                model: Counter,
                as: 'Counter',
                attributes: ['id', 'code', 'name'],
            },
            {
                model: Service,
                as: 'Service',
                attributes: ['id', 'name'],
            },
        ],
        attributes: ['id', 'ticket_number', 'counter_id', 'called_at', 'status'],
        order: [['called_at', 'DESC']], // Most recent first
    });

    // Step 7: Format response
    return {
        success: true,
        board_info: {
            id: eboard.id,
            code: eboard.code,
            name: eboard.name,
            office_name: eboard.TransactionOffice?.name,
            voice_call_number: eboard.voice_call_number,
            transaction_office_id: eboard.transaction_office_id,
        },
        display_slots: displaySlots,
        last_called_ticket: lastCalledTicket
            ? {
                id: lastCalledTicket.id,
                ticket_number: lastCalledTicket.ticket_number,
                counter_id: lastCalledTicket.counter_id,
                counter_code: lastCalledTicket.Counter?.code || '',
                counter_name: lastCalledTicket.Counter?.name || lastCalledTicket.Counter?.code || '',
                service_name: lastCalledTicket.Service?.name || '',
                called_at: lastCalledTicket.called_at,
                status: lastCalledTicket.status,
            }
            : null,
        media: mediaList.map((m) => ({
            id: m.id,
            file_type: m.file_type,
            file_url: m.file_url,
            description: m.description,
            sort_order: m.sort_order,
        })),
    };
};

module.exports = {
    getEBoardConfigByCode,
    getMonitorTickets,
    getEBoardDataByCode,
};
