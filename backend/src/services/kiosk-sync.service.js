const { sequelize } = require('../config/db');
const {
    Customer,
    Kiosk,
    Service,
    Transaction,
    KioskSyncLog,
    TicketFormat,
    ServiceGroupItem,
    ServiceGroup,
    TransactionOffice,
    KioskService,
    KioskServiceGroup,
} = require('../models');
const { Op } = require('sequelize');

const toIsoDateString = (value) => {
    if (!value) return null;

    const raw = String(value).trim();
    if (!raw) return null;

    // Already ISO date (YYYY-MM-DD)
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmyMatch = raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (dmyMatch) {
        const day = Number(dmyMatch[1]);
        const month = Number(dmyMatch[2]);
        const year = Number(dmyMatch[3]);

        const dt = new Date(year, month - 1, day);
        if (
            dt.getFullYear() === year &&
            dt.getMonth() === month - 1 &&
            dt.getDate() === day
        ) {
            return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day
                .toString()
                .padStart(2, '0')}`;
        }
    }

    // Fallback for parseable date strings
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return null;
};

const getAllowedActiveServiceIdsForKiosk = async (kioskId, transaction) => {
    const directMappings = await KioskService.findAll({
        where: { kiosk_id: kioskId },
        attributes: ['service_id'],
        transaction,
    });

    const groupMappings = await KioskServiceGroup.findAll({
        where: { kiosk_id: kioskId },
        attributes: ['service_group_id'],
        transaction,
    });

    const groupIds = groupMappings
        .map((item) => Number(item.service_group_id))
        .filter((id) => Number.isInteger(id));

    let activeGroupIds = [];
    if (groupIds.length > 0) {
        const activeGroups = await ServiceGroup.findAll({
            where: {
                id: { [Op.in]: groupIds },
                is_active: true,
            },
            attributes: ['id'],
            transaction,
        });
        activeGroupIds = activeGroups.map((item) => item.id);
    }

    let groupServiceMappings = [];
    if (activeGroupIds.length > 0) {
        groupServiceMappings = await ServiceGroupItem.findAll({
            where: {
                service_group_id: {
                    [Op.in]: activeGroupIds,
                },
            },
            attributes: ['service_id'],
            transaction,
        });
    }

    const candidateServiceIds = Array.from(new Set([
        ...directMappings.map((item) => Number(item.service_id)),
        ...groupServiceMappings.map((item) => Number(item.service_id)),
    ]));

    if (candidateServiceIds.length === 0) {
        return [];
    }

    const activeServices = await Service.findAll({
        where: {
            id: { [Op.in]: candidateServiceIds },
            is_active: true,
        },
        attributes: ['id'],
        transaction,
    });

    return activeServices.map((item) => item.id);
};

/**
 * Generate next ticket number based on ticket_formats range [min_number, max_number].
 * Rules:
 * - First ticket in day => min_number
 * - Next ticket => current max + 1
 * - If next > max_number => loop back to min_number
 */
const generateTicketNumber = async (serviceId, transactionOfficeId, transaction) => {
    try {
        // 1) Load service + ticket format configuration.
        const service = await Service.findByPk(serviceId, {
            include: [
                {
                    model: TicketFormat,
                    as: 'TicketFormat',
                    attributes: ['id', 'template_format', 'min_number', 'max_number'],
                },
            ],
            transaction,
        });

        if (!service) {
            throw new Error(`Service not found: ${serviceId}`);
        }

        if (!service.TicketFormat) {
            throw new Error(`Ticket format not found for service: ${serviceId}`);
        }

        const ticketFormatId = Number(service.TicketFormat.id);
        const templateFormat = String(service.TicketFormat.template_format || '%03d');
        const minNumber = Number(service.TicketFormat.min_number || 1);
        const maxNumber = Number(service.TicketFormat.max_number || 999);

        if (minNumber > maxNumber) {
            throw new Error(`Invalid ticket format range: min_number (${minNumber}) > max_number (${maxNumber})`);
        }

        // Prefix before formatter token, e.g. C%03d => C
        const prefix = (templateFormat.match(/^[^%]*/) || [''])[0];

        // 2) Find max numeric part of today's tickets for same office + same ticket_format.
        const [rows] = await sequelize.query(
            `
            SELECT MAX(CAST(NULLIF(regexp_replace(t.ticket_number, '\\D', '', 'g'), '') AS INTEGER)) AS last_number
            FROM transactions t
            JOIN services s ON s.id = t.service_id
            WHERE t.transaction_office_id = :officeId
              AND s.ticket_format_id = :ticketFormatId
              AND DATE(t.printed_at) = CURRENT_DATE
              AND (:prefix = '' OR t.ticket_number LIKE :prefixLike)
            `,
            {
                replacements: {
                    officeId: transactionOfficeId,
                    ticketFormatId,
                    prefix,
                    prefixLike: `${prefix}%`,
                },
                transaction,
            }
        );

        const lastNumberRaw = rows?.[0]?.last_number;
        const lastNumber = lastNumberRaw === null || lastNumberRaw === undefined
            ? null
            : Number(lastNumberRaw);

        // 3) Compute next number with loop-back.
        let nextNumber;
        if (lastNumber === null || Number.isNaN(lastNumber)) {
            nextNumber = minNumber;
        } else {
            nextNumber = lastNumber + 1;
            if (nextNumber < minNumber) {
                nextNumber = minNumber;
            }
            if (nextNumber > maxNumber) {
                nextNumber = minNumber;
            }
        }

        // 4) Format number into template.
        // Supports: %03d, %3d, %d
        const formatted = templateFormat
            .replace(/%0(\d+)d/, (_m, digits) => String(nextNumber).padStart(Number(digits), '0'))
            .replace(/%(\d+)d/, (_m, digits) => String(nextNumber).padStart(Number(digits), ' '))
            .replace(/%d/, String(nextNumber));

        return formatted;
    } catch (error) {
        console.error('Error generating ticket number:', error);
        const fallback = `T${Date.now().toString().slice(-6)}`;
        return fallback;
    }
};

/**
 * Xử lý đồng bộ dữ liệu từ Kiosk
 */
const processKioskSync = async (payload) => {
    const transaction = await sequelize.transaction();

    try {
        // Bước 1: Lưu log toàn bộ payload gốc
        await KioskSyncLog.create(
            {
                payload: payload,
            },
            { transaction }
        );

        // Chuẩn hóa dữ liệu từ nhiều format khác nhau
        let data;

        // Format 1: { data: {...} } - từ test script
        if (payload.data && typeof payload.data === 'object') {
            data = payload.data;
        }
        // Format 2: { kiosk_code, service_id, numEId, ... } - từ kiosk client
        else if (payload.kiosk_code && payload.numEId) {
            // Tạo transaction_id tự động nếu không có
            const transactionId = payload.transaction_id || `tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            // Hỗ trợ cả case viết hoa (từ chip CCCD: Religion, Ethnicity) và viết thường (từ client: religion, ethnicity)
            const religion = payload.religion || payload.Religion || '';
            const ethnicity = payload.ethnicity || payload.Ethnicity || '';

            data = {
                transaction_id: transactionId,
                kiosk_id: payload.kiosk_code,
                services: payload.service_id ? [payload.service_id] : [],
                state: payload.state || 'waiting',
                ctime: payload.ctime || Math.floor(Date.now() / 1000),
                face_image: payload.thumbnail_base64 || payload.face_image || '', // Ảnh chụp tại kiosk
                citizen: {
                    EidNumber: payload.numEId,
                    FullName: payload.fullName || payload.full_name || '',
                    DateOfBirth: payload.dateOfBirth || payload.date_of_birth || '',
                    Gender: payload.gender || payload.sex || '',
                    PlaceOfResidence: payload.address || payload.place_of_residence || '',
                    image: payload.citizen_image || '', // Ảnh thẻ CCCD
                    religion: religion,
                    ethnicity: ethnicity,
                    PersonalIdentification: payload.personal_identification || payload.PersonalIdentification || '',
                    DateOfIssue: payload.date_of_issue || payload.DateOfIssue || '',
                    DateOfExpiry: payload.date_of_expiry || payload.DateOfExpiry || '',
                    PlaceOfOrigin: payload.place_of_origin || payload.PlaceOfOrigin || '',
                    FatherName: payload.father_name || payload.FatherName || '',
                    MotherName: payload.mother_name || payload.MotherName || '',
                },
            };
        }
        // Format 3: Direct format với transaction_id
        else {
            data = payload;
        }

        // ✅ Normalize citizen object - ensure lowercase keys và xử lý Religion/Ethnicity từ chip CCCD
        if (data.citizen) {
            data.citizen.religion = data.citizen.religion || data.citizen.Religion || '';
            data.citizen.ethnicity = data.citizen.ethnicity || data.citizen.Ethnicity || '';
            data.citizen.personal_identification = data.citizen.personal_identification || data.citizen.PersonalIdentification || '';
            data.citizen.date_of_issue = data.citizen.date_of_issue || data.citizen.DateOfIssue || '';
            data.citizen.date_of_expiry = data.citizen.date_of_expiry || data.citizen.DateOfExpiry || '';
            data.citizen.place_of_origin = data.citizen.place_of_origin || data.citizen.PlaceOfOrigin || '';
            data.citizen.father_name = data.citizen.father_name || data.citizen.FatherName || '';
            data.citizen.mother_name = data.citizen.mother_name || data.citizen.MotherName || '';
        }

        // Validate required fields
        if (!data.kiosk_id) {
            throw new Error('Missing required field: kiosk_id or kiosk_code');
        }

        if (!data.citizen || !data.citizen.EidNumber) {
            throw new Error('Missing required field: citizen.EidNumber or numEId');
        }

        // Bước 2: Mapping Kiosk ID (từ string sang integer)
        const kiosk = await Kiosk.findOne({
            where: { code: data.kiosk_id, is_active: true },
            attributes: ['id', 'code', 'transaction_office_id', 'status'],
            include: [
                {
                    model: TransactionOffice,
                    as: 'TransactionOffice',
                    attributes: ['id', 'is_active'],
                    required: true,
                },
            ],
            transaction,
        });

        if (!kiosk) {
            throw new Error(`Kiosk with code "${data.kiosk_id}" not found in database`);
        }

        if (kiosk.status !== 'active') {
            throw new Error(`Kiosk "${data.kiosk_id}" is inactive`);
        }

        if (!kiosk.TransactionOffice || kiosk.TransactionOffice.is_active === false) {
            const officeError = new Error('Phòng giao dịch đang tạm ngưng hoạt động');
            officeError.statusCode = 403;
            throw officeError;
        }

        if (!kiosk.transaction_office_id) {
            throw new Error(`Kiosk "${data.kiosk_id}" does not have a valid transaction_office_id`);
        }

        const kioskId = kiosk.id;

        // Bước 3: Mapping Service IDs (từ array string/number sang array integer)
        let serviceIds = [];

        // Xử lý services có thể là array hoặc single value
        const servicesInput = data.services || (data.service_id ? [data.service_id] : []);

        if (servicesInput && servicesInput.length > 0) {
            // Kiểm tra xem input là số hay chuỗi
            const firstItem = servicesInput[0];
            const isNumeric = typeof firstItem === 'number' || !isNaN(parseInt(firstItem));

            let services;

            if (isNumeric) {
                // Nếu là số → tìm theo ID
                const numericIds = servicesInput.map(s => parseInt(s));
                services = await Service.findAll({
                    where: {
                        id: numericIds,
                        is_active: true,
                    },
                    attributes: ['id', 'code'],
                });
            } else {
                // Nếu là chuỗi → tìm theo code
                services = await Service.findAll({
                    where: {
                        code: servicesInput,
                        is_active: true,
                    },
                    attributes: ['id', 'code'],
                });
            }

            if (services.length === 0) {
                throw new Error(`No active services found matching: ${servicesInput.join(', ')}`);
            }

            if (services.length !== servicesInput.length) {
                throw new Error('Một hoặc nhiều dịch vụ đã bị vô hiệu hóa hoặc không tồn tại');
            }

            serviceIds = services.map((s) => s.id);

            const allowedServiceIds = await getAllowedActiveServiceIdsForKiosk(kioskId, transaction);
            const hasInvalidService = serviceIds.some((serviceId) => !allowedServiceIds.includes(serviceId));
            if (hasInvalidService) {
                throw new Error('Một hoặc nhiều dịch vụ không còn khả dụng cho kiosk này');
            }
        }

        // Bước 4A: Xử lý ảnh thẻ CCCD (lưu base64 vào customers.avatar_url)
        let avatarUrl = null;
        const dateOfBirth = toIsoDateString(data.citizen.DateOfBirth);
        const dateOfIssue = toIsoDateString(data.citizen.date_of_issue);
        const dateOfExpiry = toIsoDateString(data.citizen.date_of_expiry);

        if (data.citizen.image) {
            const imageData = data.citizen.image.trim();
            if (imageData.length > 100) {
                console.log('🆔 Processing CCCD image for customer:', data.citizen.EidNumber);
                // Chuẩn hóa base64 string (đảm bảo có data URI prefix)
                avatarUrl = imageData.startsWith('data:image')
                    ? imageData
                    : `data:image/jpeg;base64,${imageData.replace(/^data:image\/\w+;base64,/, '')}`;
                console.log('✅ CCCD image prepared (base64 length):', avatarUrl.length);
            }
        }

        // Bước 4B: Xử lý ảnh Face Capture (lưu base64 vào transactions.face_capture_url)
        let faceCaptureUrl = null;
        if (data.face_image) {
            const faceData = data.face_image.trim();
            if (faceData.length > 100) {
                console.log('📸 Processing Face Capture for transaction:', data.transaction_id || 'auto');
                // Chuẩn hóa base64 string (đảm bảo có data URI prefix)
                faceCaptureUrl = faceData.startsWith('data:image')
                    ? faceData
                    : `data:image/jpeg;base64,${faceData.replace(/^data:image\/\w+;base64,/, '')}`;
                console.log('✅ Face Capture prepared (base64 length):', faceCaptureUrl.length);
            }
        }

        // Bước 5: Upsert Customer (Idempotent)
        const [customer, customerCreated] = await Customer.findOrCreate({
            where: { national_id: data.citizen.EidNumber },
            defaults: {
                national_id: data.citizen.EidNumber,
                full_name: data.citizen.FullName,
                dob: dateOfBirth,
                gender: data.citizen.Gender || null,
                address: data.citizen.PlaceOfResidence || null,
                avatar_url: avatarUrl,
                religion: data.citizen.religion || null,
                ethnicity: data.citizen.ethnicity || null,
                personal_identification: data.citizen.personal_identification || null,
                date_of_issue: dateOfIssue,
                father_name: data.citizen.father_name || null,
                mother_name: data.citizen.mother_name || null,
                date_of_expiry: dateOfExpiry,
                place_of_origin: data.citizen.place_of_origin || null,
            },
            transaction,
        });

        // Update if customer already exists
        if (!customerCreated) {
            await customer.update(
                {
                    full_name: data.citizen.FullName,
                    dob: dateOfBirth || customer.dob,
                    gender: data.citizen.Gender || customer.gender,
                    address: data.citizen.PlaceOfResidence || customer.address,
                    avatar_url: avatarUrl || customer.avatar_url,
                    religion: data.citizen.religion || customer.religion,
                    ethnicity: data.citizen.ethnicity || customer.ethnicity,
                    personal_identification: data.citizen.personal_identification || customer.personal_identification,
                    date_of_issue: dateOfIssue || customer.date_of_issue,
                    father_name: data.citizen.father_name || customer.father_name,
                    mother_name: data.citizen.mother_name || customer.mother_name,
                    place_of_origin: data.citizen.place_of_origin || customer.place_of_origin,
                    date_of_expiry: dateOfExpiry || customer.date_of_expiry,
                },
                { transaction }
            );
        }

        const customerId = customer.id;

        // Bước 6: Kiểm tra Transaction đã tồn tại chưa (Idempotency)
        // Tự sinh transaction_id nếu không có (cho format kiosk client cũ)
        const transactionId = data.transaction_id || `tr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const existingTransaction = await Transaction.findOne({
            where: { kiosk_transaction_id: transactionId },
        });

        if (existingTransaction) {
            // Transaction đã tồn tại, return success ngay
            await transaction.commit();
            return {
                success: true,
                message: 'Transaction already exists (idempotent)',
                data: {
                    transaction_id: existingTransaction.id,
                    id: existingTransaction.id,
                    existing: true,
                },
            };
        }

        // Bước 7: Tạo Transaction mới
        const printedAt = data.ctime ? new Date(data.ctime * 1000) : new Date();
        const primaryServiceId = serviceIds[0] || 1;

        // Tự động sinh ticket number dựa theo ticket format
        const ticketNumber = await generateTicketNumber(
            primaryServiceId,
            kiosk.transaction_office_id,
            transaction
        );

        console.log(`🎫 Generated ticket number: ${ticketNumber} for service ${primaryServiceId}`);

        const newTransaction = await Transaction.create(
            {
                kiosk_transaction_id: transactionId,
                customer_id: customerId,
                kiosk_id: kioskId,
                transaction_office_id: kiosk.transaction_office_id,
                service_id: primaryServiceId,
                ticket_number: ticketNumber,
                ticket_type: 'kiosk',
                status: data.state || 'waiting',
                printed_at: printedAt,
                face_capture_url: faceCaptureUrl, // Ảnh chụp tại kiosk
            },
            { transaction }
        );

        const newTransactionId = newTransaction.id;

        // Commit transaction
        await transaction.commit();

        // Lấy thông tin đầy đủ để trả về response (bên ngoài transaction)
        try {
            const createdTransaction = await Transaction.findByPk(newTransactionId, {
                include: [
                    {
                        model: Customer,
                        as: 'Customer',
                        attributes: ['id', 'national_id', 'full_name', 'dob', 'gender', 'address', 'avatar_url', 'religion', 'ethnicity', 'personal_identification', 'date_of_issue', 'date_of_expiry', 'place_of_origin', 'father_name', 'mother_name'],
                    },
                    {
                        model: Kiosk,
                        as: 'Kiosk',
                        attributes: ['id', 'code', 'name'],
                    },
                    {
                        model: Service,
                        as: 'Service',
                        attributes: ['id', 'code', 'name'],
                    },
                ],
            });

            if (!createdTransaction) {
                throw new Error('Transaction not found after creation');
            }

            // Lấy danh sách service IDs từ mảng serviceIds
            // (Không cần query TransactionService vì service_id đã lưu trong Transaction)
            const serviceCodes = await Service.findAll({
                where: { id: serviceIds },
                attributes: ['id', 'code'],
                raw: true,
            });

            const serviceData = createdTransaction.Service || {};
            const kioskData = createdTransaction.Kiosk || {};
            const customerData = createdTransaction.Customer || {};

            return {
                success: true,
                message: 'Kiosk data synchronized successfully',
                data: {
                    transaction_id: createdTransaction.kiosk_transaction_id,
                    id: createdTransaction.id,
                    kiosk_id: kiosk.code,
                    kiosk_name: kioskData.name || '',
                    transaction_office_id: createdTransaction.transaction_office_id,
                    service_id: serviceData.code || '',
                    service_name: serviceData.name || '',
                    services: serviceCodes.map(s => s.code),
                    ticket_number: createdTransaction.ticket_number,
                    ticket_type: createdTransaction.ticket_type,
                    status: createdTransaction.status,
                    printed_at: createdTransaction.printed_at,
                    ctime: Math.floor(new Date(createdTransaction.printed_at).getTime() / 1000),
                    face_capture_url: createdTransaction.face_capture_url,
                    customer_id: customerId,
                    customer: {
                        id: customerId,
                        eid_number: customerData.national_id || '',
                        full_name: customerData.full_name || '',
                        date_of_birth: customerData.dob || '',
                        sex: customerData.gender || '',
                        place_of_residence: customerData.address || '',
                        avatar_url: customerData.avatar_url || '',
                        religion: customerData.religion || '',
                        ethnicity: customerData.ethnicity || '',
                        place_of_origin: customerData.place_of_origin || '',
                        personal_identification: customerData.personal_identification || '',
                        date_of_issue: customerData.date_of_issue || '',
                        date_of_expiry: customerData.date_of_expiry || '',
                        father_name: customerData.father_name || '',
                        mother_name: customerData.mother_name || '',
                    },
                    existing: false,
                },
            };
        } catch (queryError) {
            // Nếu query bị lỗi, vẫn trả về response cơ bản (transaction đã commit thành công)
            console.error('❌ Error querying transaction details:', queryError.message);
            console.error('Stack:', queryError.stack);
            return {
                success: true,
                message: 'Kiosk data synchronized successfully (basic response)',
                data: {
                    transaction_id: transactionId,
                    id: newTransactionId,
                    customer_id: customerId,
                    kiosk_id: kioskId,
                    ticket_number: 'N/A',
                    existing: false,
                },
            };
        }
    } catch (error) {
        // Rollback nếu có lỗi trong quá trình xử lý transaction
        if (transaction && !transaction.finished) {
            await transaction.rollback();
        }
        throw error;
    }
};

module.exports = {
    processKioskSync,
};
