const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Customer = sequelize.define(
    'Customer',
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        national_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            comment: 'Số CCCD/CMT',
        },
        full_name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Họ và tên',
        },
        dob: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Ngày sinh (format: DD/MM/YYYY)',
        },
        gender: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Giới tính',
        },
        address: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Địa chỉ thường trú',
        },
        avatar_url: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Đường dẫn ảnh khách hàng',
        },
        religion: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Tôn giáo',
        },
        ethnicity: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Dân tộc',
        },
        personal_identification: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Số CCCD/CMT (Giống national_id, lưu thêm để tương thích)',
        },
        date_of_issue: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Ngày cấp (format: DD/MM/YYYY)',
        },
        date_of_expiry: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Ngày hết hạn (format: DD/MM/YYYY)',
        },
        place_of_origin: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Quê quán',
        },
        father_name: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Tên cha',
        },
        mother_name: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Tên mẹ',
        },
    },
    {
        tableName: 'customers',
        timestamps: true,
        underscored: true,
    }
);

module.exports = Customer;
