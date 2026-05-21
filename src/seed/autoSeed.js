import bcrypt from 'bcryptjs';
import User from '../models/user';
import Article from '../models/article.model';

const articleSeed = [
    {
        slug: 'top-5-dien-thoai-5g-dang-mua-nhat-2026',
        title: 'Top 5 điện thoại 5G đáng mua nhất 2026',
        category: 'Đánh giá',
        author: 'Tech Team',
        coverImage: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
        images: [
            'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?auto=format&fit=crop&w=900&q=80',
        ],
        summary: 'Danh sách smartphone nổi bật về hiệu năng, camera, pin và mức giá dễ tiếp cận.',
        content: 'Năm 2026 thị trường điện thoại 5G tiếp tục bùng nổ với nhiều lựa chọn mạnh ở cả phân khúc cao cấp lẫn tầm trung. Bài viết này tổng hợp những mẫu đáng chú ý nhất dựa trên hiệu năng, camera, pin và trải nghiệm sử dụng thực tế.',
        tags: ['5G', 'điện thoại', 'đánh giá'],
        views: 1280,
        isLatest: true,
    },
    {
        slug: 'meo-chon-laptop-cho-sinh-vien-va-dan-van-phong',
        title: 'Mẹo chọn laptop cho sinh viên và dân văn phòng',
        category: 'Tư vấn',
        author: 'Tech Team',
        coverImage: 'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=900&q=80',
        images: [
            'https://images.unsplash.com/photo-1517336714739-489689fd1ca8?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1593642634367-d91a135587b5?auto=format&fit=crop&w=900&q=80',
        ],
        summary: 'Tiêu chí quan trọng khi chọn laptop theo nhu cầu học tập, làm việc và di chuyển.',
        content: 'Khi chọn laptop, bạn nên cân nhắc trọng lượng, thời lượng pin, hiệu năng và cổng kết nối. Với sinh viên và dân văn phòng, một chiếc ultrabook mỏng nhẹ là lựa chọn tối ưu hơn máy quá nặng hoặc cấu hình quá cao.',
        tags: ['laptop', 'tư vấn', 'sinh viên'],
        views: 980,
        isLatest: true,
    },
    {
        slug: 'tai-nghe-chong-on-co-dang-tien-khong',
        title: 'Tai nghe chống ồn có đáng tiền không?',
        category: 'Công nghệ',
        author: 'Tech Team',
        coverImage: 'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80',
        images: [
            'https://images.unsplash.com/photo-1606220945770-b5b6c2c55bf1?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1606400082777-ef05f3c5f89a?auto=format&fit=crop&w=900&q=80',
        ],
        summary: 'Phân tích lợi ích thực tế của tai nghe ANC trong học tập, làm việc và di chuyển.',
        content: 'Tai nghe chống ồn rất hữu ích nếu bạn thường xuyên làm việc ở quán cà phê, văn phòng mở hoặc đi lại nhiều. Mức giá hiện nay đã dễ chịu hơn trước, nhưng cần ưu tiên khả năng đeo thoải mái và chất âm phù hợp.',
        tags: ['tai nghe', 'ANC', 'phụ kiện'],
        views: 760,
        isLatest: true,
    },
    {
        slug: 'so-sanh-iphone-16-pro-max-va-galaxy-s25-ultra',
        title: 'So sánh iPhone 16 Pro Max và Galaxy S25 Ultra',
        category: 'So sánh',
        author: 'Tech Team',
        coverImage: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80',
        images: [
            'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?auto=format&fit=crop&w=900&q=80',
            'https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?auto=format&fit=crop&w=900&q=80',
        ],
        summary: 'Hai flagship đầu bảng với thế mạnh riêng về hệ sinh thái, camera và trải nghiệm AI.',
        content: 'Nếu bạn đang cân nhắc giữa iPhone và Galaxy, hãy xem xét hệ sinh thái, thời lượng cập nhật phần mềm, camera và thói quen sử dụng của mình. Mỗi dòng máy đều có lợi thế rõ ràng cho từng nhóm người dùng.',
        tags: ['so sánh', 'flagship', 'Apple', 'Samsung'],
        views: 1560,
        isLatest: true,
    },
];

const decorateArticleSeed = (item) => ({
    ...item,
    images: item.images?.length ? item.images : [item.coverImage],
    content: item.content || item.summary,
});

export const seedInitialData = async () => {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@smartzone.vn';
    const adminPassword = process.env.ADMIN_PASSWORD || '123456';

    const adminExisted = await User.findOne({ email: adminEmail.toLowerCase().trim() });
    if (!adminExisted) {
        const passwordHash = await bcrypt.hash(adminPassword, 10);

        await User.create({
            email: adminEmail.toLowerCase().trim(),
            password: passwordHash,
            firstName: 'Super',
            lastName: 'Admin',
            address: 'Ho Chi Minh',
            phoneNumber: '0900000000',
            gender: true,
            roleId: 'R1',
            positionId: 'P0',
            isActive: true,
        });
        console.log('Da seed tai khoan admin R1 mac dinh.');
    }

    await Article.bulkWrite(
        articleSeed.map((item) => ({
            updateOne: {
                filter: { slug: item.slug },
                update: { $set: decorateArticleSeed(item) },
                upsert: true,
            },
        })),
        { ordered: false }
    );

    console.log('Da seed tai khoan admin R1 va dong bo bai viet.');
};
