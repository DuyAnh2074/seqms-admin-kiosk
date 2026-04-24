const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const TransactionOffice = require('./TransactionOffice');
const Service = require('./Service');
const Kiosk = require('./Kiosk');
const Counter = require('./Counter');
const User = require('./User');
const Customer = require('./Customer');

const Transaction = sequelize.define(
    'Transaction',
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
        },
        transaction_office_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'transaction_offices',
                key: 'id',
            },
        },
        service_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'services',
                key: 'id',
            },
        },
        kiosk_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'kiosks',
                key: 'id',
            },
            comment: 'NULL nếu lấy vé Online',
        },
        counter_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'counters',
                key: 'id',
            },
            comment: 'Cập nhật khi nhân viên gọi số',
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'users',
                key: 'id',
            },
            comment: 'Nhân viên thực hiện',
        },
        kiosk_transaction_id: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true,
            comment: 'ID giao dịch từ kiosk (tr_xxx...)',
        },
        customer_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'customers',
                key: 'id',
            },
            comment: 'Liên kết với khách hàng',
        },
        ticket_number: {
            type: DataTypes.STRING(20),
            allowNull: false,
            comment: 'Số phiếu (VD: A001)',
        },
        ticket_type: {
            type: DataTypes.ENUM('kiosk', 'online', 'qrcode'),
            allowNull: false,
        },
        status: {
            type: DataTypes.STRING(20),
            defaultValue: 'waiting',
            comment: 'waiting, called, serving, completed, cancelled, missed, transferred',
        },
        printed_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            comment: 'Thời gian lấy phiếu',
        },
        called_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Thời gian gọi vào quầy',
        },
        started_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Thời gian bắt đầu phục vụ',
        },
        finished_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Thời gian hoàn thành giao dịch',
        },
        waiting_time_seconds: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Thời gian chờ (giây)',
        },
        service_time_seconds: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Thời gian phục vụ (giây)',
        },
        original_service_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'services',
                key: 'id',
            },
            comment: 'Lưu dịch vụ gốc trước khi bị chuyển',
        },
        transfer_from_counter_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'counters',
                key: 'id',
            },
            comment: 'Vé được chuyển từ quầy nào đến',
        },
        recall_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            comment: 'Số lần nhấn nút "Gọi lại" (Recall)',
        },
        note: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Ghi chú lý do hủy hoặc chuyển',
        },
        face_capture_url: {
            type: DataTypes.TEXT,
            allowNull: true,
            comment: 'Ảnh chụp Face Capture tại kiosk (base64 data URI)',
        },
    },
    {
        timestamps: false,
        tableName: 'transactions',
        indexes: [
            {
                fields: ['transaction_office_id', 'printed_at'],
                name: 'idx_transactions_date_office',
            },
            {
                fields: ['status'],
                name: 'idx_transactions_status',
            },
        ],
    }
);

module.exports = Transaction;
