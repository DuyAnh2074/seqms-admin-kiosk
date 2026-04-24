const Province = require('../models/Province');
const District = require('../models/District');

/**
 * Get all provinces
 * Sorted by id ASC (oldest first)
 */
const getAllProvinces = async () => {
    try {
        const provinces = await Province.findAll({
            order: [['id', 'ASC']],
        });
        return provinces;
    } catch (error) {
        throw new Error(`Lỗi khi tải danh sách tỉnh/thành phố: ${error.message}`);
    }
};

/**
 * Get province by ID
 */
const getProvinceById = async (id) => {
    try {
        const province = await Province.findByPk(id);
        if (!province) {
            throw new Error('Không tìm thấy tỉnh/thành phố');
        }
        return province;
    } catch (error) {
        throw new Error(`Lỗi khi tải tỉnh/thành phố: ${error.message}`);
    }
};

/**
 * Create new province
 */
const createProvince = async (code, name) => {
    try {
        // Validation
        if (!code || !name) {
            throw new Error('Mã và tên là bắt buộc');
        }

        // Check if code already exists
        const existingProvince = await Province.findOne({
            where: { code: code }
        });

        if (existingProvince) {
            throw new Error(`Mã "${code}" đã tồn tại`);
        }

        // Create new province
        const newProvince = await Province.create({
            code: code,
            name: name,
        });

        return newProvince;
    } catch (error) {
        throw new Error(`Lỗi khi tạo tỉnh/thành phố: ${error.message}`);
    }
};

/**
 * Update province
 * Can update: code, name
 */
const updateProvince = async (id, updateData) => {
    try {
        const province = await Province.findByPk(id);
        if (!province) {
            throw new Error('Không tìm thấy tỉnh/thành phố');
        }

        // If code is being updated, check for duplicates (excluding current record)
        if (updateData.code && updateData.code !== province.code) {
            const existingProvince = await Province.findOne({
                where: { code: updateData.code }
            });
            if (existingProvince) {
                throw new Error(`Mã "${updateData.code}" đã tồn tại`);
            }
        }

        // Update the province
        await province.update(updateData);
        return province;
    } catch (error) {
        throw new Error(`Lỗi khi cập nhật tỉnh/thành phố: ${error.message}`);
    }
};

/**
 * Delete province
 * Check if any districts belong to this province before deleting
 */
const deleteProvince = async (id) => {
    try {
        const province = await Province.findByPk(id);
        if (!province) {
            throw new Error('Không tìm thấy tỉnh/thành phố');
        }

        // Check if any districts belong to this province
        const districtCount = await District.count({
            where: { province_id: id }
        });

        if (districtCount > 0) {
            throw new Error(`Không thể xóa tỉnh/thành phố này vì có ${districtCount} xã/phường`);
        }

        // Delete the province
        await province.destroy();
        return { id, message: 'Xóa tỉnh/thành phố thành công' };
    } catch (error) {
        throw new Error(`Lỗi khi xóa tỉnh/thành phố: ${error.message}`);
    }
};

module.exports = {
    getAllProvinces,
    getProvinceById,
    createProvince,
    updateProvince,
    deleteProvince,
};
