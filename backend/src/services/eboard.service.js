const { sequelize, Op } = require('../config/db');
const { EBoard, EBoardMedia, EBoardCounter, TransactionOffice, Counter, Province, District } = require('../models');
const fs = require('fs');
const path = require('path');
const { emitEBoardStateChanged } = require('../socket');

const OFFICE_REACTIVATE_GUARD_MESSAGE = 'Không thể khôi phục thiết bị/nhân viên này vì Phòng Giao Dịch trực thuộc đang bị vô hiệu hóa. Vui lòng khôi phục Phòng Giao Dịch trước.';

const validateActiveCountersForOffice = async (counterIds, officeId, transaction) => {
    if (!counterIds || counterIds.length === 0) {
        return;
    }

    const validCounters = await Counter.findAll({
        where: {
            id: { [Op.in]: counterIds },
            transaction_office_id: officeId,
            is_active: true,
        },
        attributes: ['id'],
        transaction,
    });

    const validCounterIds = new Set(validCounters.map((counter) => counter.id));
    const invalidCounterIds = counterIds.filter((counterId) => !validCounterIds.has(counterId));

    if (invalidCounterIds.length > 0) {
        throw new Error(`Counter không hợp lệ hoặc đã bị vô hiệu hóa: ${invalidCounterIds.join(', ')}`);
    }
};

/**
 * Extract filename from file URL and delete file from filesystem
 * Handles both relative paths (/uploads/media/...) and absolute URLs (http://...)
 * @param {string} fileUrl - File URL or path
 */
const deleteMediaFile = (fileUrl) => {
    if (!fileUrl) return;

    try {
        let filePath;

        // Check if it's an absolute URL
        if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
            // Extract filename from URL (e.g., http://localhost:5000/uploads/media/file.jpg -> uploads/media/file.jpg)
            const urlParts = fileUrl.split('/uploads/media/');
            if (urlParts.length === 2) {
                filePath = path.join(__dirname, '../../uploads/media', urlParts[1]);
            } else {
                return;
            }
        } else if (fileUrl.startsWith('/uploads/media/')) {
            // Relative path
            filePath = path.join(__dirname, '../../', fileUrl);
        } else {
            return;
        }

        // Delete file if it exists
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (err) {
        console.error(`Error deleting file ${fileUrl}:`, err);
        // Don't throw error, just log it
    }
};

/**
 * Get all e-boards with related data
 * @param {number|null} officeId - Filter by office ID (optional)
 */
const getAllEBoards = async (officeId = null) => {
    const whereClause = {};
    if (officeId) {
        whereClause.transaction_office_id = officeId;
    }

    const eboards = await EBoard.findAll({
        where: whereClause,
        include: [
            {
                model: TransactionOffice,
                attributes: ['id', 'name', 'district_id'],
                include: [
                    {
                        model: District,
                        attributes: ['id', 'name', 'province_id'],
                        include: [
                            {
                                model: Province,
                                attributes: ['id', 'name'],
                            },
                        ],
                    },
                ],
            },
            {
                model: Counter,
                as: 'counters',
                through: { attributes: [] }, // Exclude junction table
                attributes: ['id', 'code', 'name', 'is_active'],
                where: { is_active: true },
                required: false,
            },
            {
                model: EBoardMedia,
                attributes: ['id', 'file_type', 'file_url', 'description', 'sort_order'],
                order: [['sort_order', 'ASC']],
            },
        ],
        order: [['created_at', 'DESC']],
    });

    return eboards;
};

/**
 * Get e-board by ID
 * @param {number} id - E-Board ID
 */
const getEBoardById = async (id) => {
    const eboard = await EBoard.findByPk(id, {
        include: [
            {
                model: TransactionOffice,
                attributes: ['id', 'name'],
            },
            {
                model: Counter,
                as: 'counters',
                through: { attributes: [] },
                attributes: ['id', 'code', 'name', 'is_active'],
                where: { is_active: true },
                required: false,
            },
            {
                model: EBoardMedia,
                attributes: ['id', 'file_type', 'file_url', 'description', 'sort_order'],
                order: [['sort_order', 'ASC']],
            },
        ],
    });

    return eboard;
};

/**
 * Get e-board config by code (Public API for TV Client)
 * @param {string} code - E-Board code
 */
const getEBoardByCode = async (code) => {
    const eboard = await EBoard.findOne({
        where: { code, is_active: true },
        include: [
            {
                model: TransactionOffice,
                attributes: ['id', 'name'],
            },
            {
                model: Counter,
                as: 'counters',
                through: { attributes: [] },
                attributes: ['id', 'code', 'name', 'led_number', 'is_active'],
                where: { is_active: true },
                required: false,
            },
            {
                model: EBoardMedia,
                attributes: ['id', 'file_type', 'file_url', 'description', 'sort_order'],
                order: [['sort_order', 'ASC']],
            },
        ],
    });

    if (!eboard) {
        throw new Error('Không tìm thấy bảng điện tử');
    }

    return eboard;
};

/**
 * Create new e-board
 * @param {Object} data - E-Board data
 * @param {number} data.transaction_office_id
 * @param {string} data.code
 * @param {string} data.name
 * @param {boolean} data.display_video
 * @param {string} data.voice_call_number
 * @param {Array<number>} data.counter_ids - Array of counter IDs
 * @param {Array<Object>} data.media - Array of media objects
 */
const createEBoard = async (data) => {
    const transaction = await sequelize.transaction();

    try {
        // Check if code already exists
        const existingBoard = await EBoard.findOne({
            where: { code: data.code },
        });

        if (existingBoard) {
            throw new Error('Mã bảng điện tử đã tồn tại');
        }

        // Create e-board
        const eboard = await EBoard.create(
            {
                transaction_office_id: data.transaction_office_id,
                code: data.code,
                name: data.name,
                display_video: data.display_video || false,
                voice_call_number: data.voice_call_number || null,
            },
            { transaction }
        );

        await validateActiveCountersForOffice(data.counter_ids, data.transaction_office_id, transaction);

        // Create counter associations
        if (data.counter_ids && data.counter_ids.length > 0) {
            const counterAssociations = data.counter_ids.map((counterId) => ({
                e_board_id: eboard.id,
                counter_id: counterId,
            }));

            await EBoardCounter.bulkCreate(counterAssociations, { transaction });
        }

        // Create media files
        if (data.media && data.media.length > 0) {
            const mediaData = data.media.map((item, index) => ({
                e_board_id: eboard.id,
                file_type: item.file_type,
                file_url: item.file_url,
                description: item.description || null,
                sort_order: item.sort_order || index,
            }));

            await EBoardMedia.bulkCreate(mediaData, { transaction });
        }

        await transaction.commit();

        // Return created eboard with relations
        return await getEBoardById(eboard.id);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Update e-board
 * @param {number} id - E-Board ID
 * @param {Object} data - Update data
 */
const updateEBoard = async (id, data) => {
    const transaction = await sequelize.transaction();

    try {
        const eboard = await EBoard.findByPk(id);
        if (!eboard) {
            throw new Error('Không tìm thấy bảng điện tử');
        }

        // Check if code is being changed and if it already exists
        if (data.code && data.code !== eboard.code) {
            const existingBoard = await EBoard.findOne({
                where: { code: data.code },
            });

            if (existingBoard) {
                throw new Error('Mã bảng điện tử đã tồn tại');
            }
        }

        // Update e-board
        const targetOfficeId = data.transaction_office_id || eboard.transaction_office_id;

        await eboard.update(
            {
                transaction_office_id: targetOfficeId,
                code: data.code || eboard.code,
                name: data.name || eboard.name,
                display_video: data.display_video !== undefined ? data.display_video : eboard.display_video,
                voice_call_number: data.voice_call_number !== undefined ? data.voice_call_number : eboard.voice_call_number,
            },
            { transaction }
        );

        await validateActiveCountersForOffice(data.counter_ids, targetOfficeId, transaction);

        // Update counter associations
        if (data.counter_ids !== undefined) {
            // Delete old associations
            await EBoardCounter.destroy({
                where: { e_board_id: id },
                transaction,
            });

            // Create new associations
            if (data.counter_ids.length > 0) {
                const counterAssociations = data.counter_ids.map((counterId) => ({
                    e_board_id: id,
                    counter_id: counterId,
                }));

                await EBoardCounter.bulkCreate(counterAssociations, { transaction });
            }
        }

        // Update media files
        if (data.media !== undefined) {
            // Get old media from database
            const oldMedia = await EBoardMedia.findAll({ where: { e_board_id: id } });
            const oldMediaMap = new Map(oldMedia.map(m => [m.file_url, m]));

            // Get new media from payload
            const newMediaMap = new Map(data.media.map((item, index) => [
                item.file_url,
                {
                    file_type: item.file_type,
                    file_url: item.file_url,
                    description: item.description || null,
                    sort_order: item.sort_order !== undefined ? item.sort_order : index,
                }
            ]));

            // Find files to delete: exist in old but NOT in new
            const urlsToDelete = [];
            for (const [url] of oldMediaMap) {
                if (!newMediaMap.has(url)) {
                    urlsToDelete.push(url);
                }
            }

            // Find files to add: exist in new but NOT in old
            const filesToAdd = [];
            for (const [url, data] of newMediaMap) {
                if (!oldMediaMap.has(url)) {
                    filesToAdd.push(data);
                }
            }

            // Find files to update: exist in both but possibly with changed metadata
            const filesToUpdate = [];
            for (const [url, newData] of newMediaMap) {
                if (oldMediaMap.has(url)) {
                    const oldData = oldMediaMap.get(url);
                    // Check if any metadata changed
                    if (oldData.file_type !== newData.file_type ||
                        oldData.description !== newData.description ||
                        oldData.sort_order !== newData.sort_order) {
                        filesToUpdate.push(newData);
                    }
                }
            }

            // Add new media
            if (filesToAdd.length > 0) {
                await EBoardMedia.bulkCreate(
                    filesToAdd.map(item => ({ ...item, e_board_id: id })),
                    { transaction }
                );
            }

            // Update existing media
            if (filesToUpdate.length > 0) {
                for (const item of filesToUpdate) {
                    await EBoardMedia.update(
                        {
                            file_type: item.file_type,
                            description: item.description,
                            sort_order: item.sort_order,
                        },
                        {
                            where: { e_board_id: id, file_url: item.file_url },
                            transaction,
                        }
                    );
                }
            }

            // Delete old media records that are no longer needed
            if (urlsToDelete.length > 0) {
                await EBoardMedia.destroy({
                    where: { e_board_id: id, file_url: { [Op.in]: urlsToDelete } },
                    transaction,
                });
            }

            // Commit transaction first, then delete files
            await transaction.commit();

            // Delete files from filesystem ONLY after database is updated
            // This ensures we never delete files that are still referenced
            for (const fileUrl of urlsToDelete) {
                deleteMediaFile(fileUrl);
            }

            // Return updated eboard with relations
            return await getEBoardById(id);
        }

        await transaction.commit();

        // Return updated eboard with relations
        return await getEBoardById(id);
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
};

/**
 * Deactivate e-board (Soft Delete)
 * @param {number} id - E-Board ID
 */
const deleteEBoard = async (id) => {
    const eboard = await EBoard.findByPk(id);
    if (!eboard) {
        throw new Error('Không tìm thấy bảng điện tử');
    }

    await eboard.update({
        is_active: false,
    });

    emitEBoardStateChanged({
        id: eboard.id,
        code: eboard.code,
        name: eboard.name,
        transaction_office_id: eboard.transaction_office_id,
        is_active: false,
        message: 'E-Board đang bảo trì hoặc đã bị vô hiệu hóa',
    });

    return { message: 'Vô hiệu hóa bảng điện tử thành công' };
};

/**
 * Reactivate e-board
 * @param {number} id - E-Board ID
 */
const reactivateEBoard = async (id) => {
    const eboard = await EBoard.findByPk(id);
    if (!eboard) {
        throw new Error('Không tìm thấy bảng điện tử');
    }

    const office = await TransactionOffice.findByPk(eboard.transaction_office_id, {
        attributes: ['id', 'is_active'],
    });

    if (!office || office.is_active === false) {
        const error = new Error(OFFICE_REACTIVATE_GUARD_MESSAGE);
        error.statusCode = 400;
        throw error;
    }

    await eboard.update({
        is_active: true,
    });

    emitEBoardStateChanged({
        id: eboard.id,
        code: eboard.code,
        name: eboard.name,
        transaction_office_id: eboard.transaction_office_id,
        is_active: true,
        message: 'Bảng điện tử đã hoạt động trở lại',
    });

    return { message: 'Khôi phục bảng điện tử thành công' };
};

/**
 * Delete a single EBoard media item
 * @param {number} mediaId - Media ID
 */
const deleteEBoardMedia = async (mediaId) => {
    const media = await EBoardMedia.findByPk(mediaId);
    if (!media) {
        throw new Error('Không tìm thấy media');
    }

    const fileUrl = media.file_url;

    // Delete from database
    await media.destroy();

    // Delete file from filesystem AFTER database delete
    deleteMediaFile(fileUrl);

    return { message: 'Media deleted successfully' };
};

module.exports = {
    getAllEBoards,
    getEBoardById,
    getEBoardByCode,
    createEBoard,
    updateEBoard,
    deleteEBoard,
    reactivateEBoard,
    deleteEBoardMedia,
};
