const District = require('../models/District');
const Province = require('../models/Province');
const TransactionOffice = require('../models/TransactionOffice');

/**
 * Get all districts with province information
 * Sorted by id ASC (oldest first)
 */
const getAllDistricts = async () => {
    try {
        const districts = await District.findAll({
            include: [
                {
                    model: Province,
                    attributes: ['id', 'name'],
                    required: true,
                }
            ],
            order: [['id', 'ASC']],
        });
        return districts;
    } catch (error) {
        throw new Error(`Lỗi khi tải danh sách xã/phường: ${error.message}`);
    }
};

/**
 * Get district by ID with province information
 */
const getDistrictById = async (id) => {
    try {
        const district = await District.findByPk(id, {
            include: [
                {
                    model: Province,
                    attributes: ['id', 'name'],
                    required: true,
                }
            ],
        });
        if (!district) {
            throw new Error('Không tìm thấy xã/phường');
        }
        return district;
    } catch (error) {
        throw new Error(`Lỗi khi tải xã/phường: ${error.message}`);
    }
};

/**
 * Create new district
 */
const createDistrict = async (province_id, code, name) => {
    try {
        // Validation
        if (!province_id || !code || !name) {
            throw new Error('Mã tỉnh/thành phố, mã và tên là bắt buộc');
        }

        // Check if province exists
        const province = await Province.findByPk(province_id);
        if (!province) {
            throw new Error('Không tìm thấy tỉnh/thành phố');
        }

        // Check if code already exists for this province
        const existingDistrict = await District.findOne({
            where: {
                province_id: province_id,
                code: code
            }
        });

        if (existingDistrict) {
            throw new Error(`Mã "${code}" đã tồn tại trong tỉnh/thành phố này`);
        }

        // Create new district
        const newDistrict = await District.create({
            province_id: province_id,
            code: code,
            name: name,
        });

        // Return with province info
        return await getDistrictById(newDistrict.id);
    } catch (error) {
        throw new Error(`Lỗi khi tạo xã/phường: ${error.message}`);
    }
};

/**
 * Update district
 * Can update: province_id, code, name
 */
const updateDistrict = async (id, updateData) => {
    try {
        const district = await District.findByPk(id);
        if (!district) {
            throw new Error('Không tìm thấy xã/phường');
        }

        // If province_id is being updated, verify it exists
        if (updateData.province_id && updateData.province_id !== district.province_id) {
            const province = await Province.findByPk(updateData.province_id);
            if (!province) {
                throw new Error('Không tìm thấy tỉnh/thành phố');
            }
        }

        // Check for duplicate code in province (if code is being updated)
        if (updateData.code && updateData.code !== district.code) {
            const provinceId = updateData.province_id || district.province_id;
            const existingDistrict = await District.findOne({
                where: {
                    province_id: provinceId,
                    code: updateData.code
                }
            });
            if (existingDistrict) {
                throw new Error(`Mã "${updateData.code}" đã tồn tại trong tỉnh/thành phố này`);
            }
        }

        // Check for duplicate code when province changes (even if code stays same)
        if (updateData.province_id && updateData.province_id !== district.province_id) {
            const codeToCheck = updateData.code || district.code;
            const existingDistrict = await District.findOne({
                where: {
                    province_id: updateData.province_id,
                    code: codeToCheck
                }
            });
            if (existingDistrict) {
                throw new Error(`Mã "${codeToCheck}" đã tồn tại trong tỉnh/thành phố này`);
            }
        }

        // Update the district
        await district.update(updateData);

        // Return with province info
        return await getDistrictById(id);
    } catch (error) {
        throw new Error(`Lỗi khi cập nhật xã/phường: ${error.message}`);
    }
};

/**
 * Delete district
 * Check if any transaction offices belong to this district before deleting
 */
const deleteDistrict = async (id) => {
    try {
        const district = await District.findByPk(id);
        if (!district) {
            throw new Error('Không tìm thấy xã/phường');
        }

        // Check if any transaction offices belong to this district
        const officeCount = await TransactionOffice.count({
            where: { district_id: id }
        });

        if (officeCount > 0) {
            throw new Error(`Không thể xóa xã/phường này vì có ${officeCount} phòng giao dịch`);
        }

        // Delete the district
        await district.destroy();
        return { id, message: 'Xóa xã/phường thành công' };
    } catch (error) {
        throw new Error(`Lỗi khi xóa xã/phường: ${error.message}`);
    }
};

module.exports = {
    getAllDistricts,
    getDistrictById,
    createDistrict,
    updateDistrict,
    deleteDistrict,
};
