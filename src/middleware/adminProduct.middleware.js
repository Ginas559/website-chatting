import { body, param } from 'express-validator';

const statusValues = ['ACTIVE', 'INACTIVE'];

const field = (name, partial) => {
    const chain = body(name);
    return partial ? chain.optional({ nullable: true }) : chain;
};

const productBodyValidator = (partial = false) => [
    field('name', partial).trim().isLength({ min: 2 }).withMessage('Tên sản phẩm tối thiểu 2 ký tự'),
    field('brand', partial).trim().notEmpty().withMessage('Thương hiệu không được để trống'),
    field('category', partial).trim().notEmpty().withMessage('Danh mục không được để trống'),
    field('price', partial).isFloat({ gt: 0 }).withMessage('Giá phải lớn hơn 0'),
    body('salePrice').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('Giá khuyến mãi phải >= 0'),
    field('stock', partial).isInt({ min: 0 }).withMessage('Tồn kho không được âm'),
    body('description').optional().trim().isString(),
    body('shortDescription').optional().trim().isString(),
    body('images').optional().isArray().withMessage('images phải là mảng URL'),
    body('images.*').optional().trim().isString(),
    body('image').optional().trim().isString(),
    body('status').optional().isIn(statusValues).withMessage('Trạng thái chỉ nhận ACTIVE hoặc INACTIVE'),
    body('isPromotion').optional().isBoolean(),
    body('isLatest').optional().isBoolean(),
    body('isBestSeller').optional().isBoolean(),
    body().custom((value) => {
        if (partial && (value.price === undefined || value.price === null || value.price === '')) {
            return true;
        }

        const price = Number(value.price);
        const salePrice = value.salePrice === undefined || value.salePrice === null || value.salePrice === ''
            ? price
            : Number(value.salePrice);
        if (Number.isFinite(price) && Number.isFinite(salePrice) && salePrice > price) {
            throw new Error('Giá khuyến mãi phải nhỏ hơn hoặc bằng giá gốc');
        }
        return true;
    }),
];

export const createAdminProductValidator = productBodyValidator(false);

export const updateAdminProductValidator = [
    param('id').isMongoId().withMessage('ID sản phẩm không hợp lệ'),
    ...productBodyValidator(true),
];

export const updateAdminProductStatusValidator = [
    param('id').isMongoId().withMessage('ID sản phẩm không hợp lệ'),
    body('status').isIn(statusValues).withMessage('Trạng thái chỉ nhận ACTIVE hoặc INACTIVE'),
];

export const deleteAdminProductValidator = [
    param('id').isMongoId().withMessage('ID sản phẩm không hợp lệ'),
];
