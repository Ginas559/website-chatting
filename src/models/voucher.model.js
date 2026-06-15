// Tien - Model định nghĩa Voucher do Admin quản lý
import mongoose from 'mongoose';

const voucherSchema = new mongoose.Schema(
    {
        code: { 
            type: String, 
            required: true, 
            unique: true, 
            trim: true, 
            uppercase: true 
        },
        description: { 
            type: String, 
            required: true, 
            trim: true 
        },
        discountType: { 
            type: String, 
            enum: ['PERCENT', 'AMOUNT'], 
            required: true 
        },
        discountValue: { 
            type: Number, 
            required: true, 
            min: 0 
        },
        maxDiscountAmount: { 
            type: Number, 
            default: 0, 
            min: 0 
        },
        minOrderAmount: { 
            type: Number, 
            default: 0, 
            min: 0 
        },
        startDate: { 
            type: Date, 
            required: true 
        },
        endDate: { 
            type: Date, 
            required: true 
        },
        usageLimit: { 
            type: Number, 
            required: true, 
            min: 1 
        },
        usedCount: { 
            type: Number, 
            default: 0, 
            min: 0 
        },
        isActive: { 
            type: Boolean, 
            default: true 
        }
    },
    {
        timestamps: true
    }
);

// Tien - Đánh index cho code để tìm kiếm nhanh hơn
voucherSchema.index({ code: 1 });

const Voucher = mongoose.model('Voucher', voucherSchema);

export default Voucher;
