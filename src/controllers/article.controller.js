import { getArticleDetailBySlug, getLatestArticles, createArticle } from '../services/article.service';

export const getHomeArticles = async (req, res) => {
    try {
        const limit = Number(req.query.limit) || 6;
        const safeLimit = Math.min(Math.max(limit, 1), 12);
        const articles = await getLatestArticles(safeLimit);

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy dữ liệu bài viết thành công',
            data: articles,
        });
    } catch (error) {
        console.error('Article Home Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy danh sách bài viết',
        });
    }
};

export const getArticleDetail = async (req, res) => {
    try {
        const data = await getArticleDetailBySlug(req.params.slug);

        if (!data) {
            return res.status(404).json({
                errCode: 1,
                errMessage: 'Không tìm thấy bài viết',
            });
        }

        return res.status(200).json({
            errCode: 0,
            errMessage: 'Lấy chi tiết bài viết thành công',
            data,
        });
    } catch (error) {
        console.error('Article Detail Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi lấy chi tiết bài viết',
        });
    }
};

export const createArticleController = async (req, res) => {
    try {
        const { title, category, author, coverImage, images, summary, content, tags, isLatest, isActive } = req.body;

        if (!title || !category || !author || !coverImage) {
            return res.status(400).json({
                errCode: 1,
                errMessage: 'Thiếu thông tin bắt buộc (title, category, author, coverImage)',
            });
        }

        const newArticle = await createArticle({
            title,
            category,
            author,
            coverImage,
            images,
            summary,
            content,
            tags,
            isLatest,
            isActive
        });

        return res.status(201).json({
            errCode: 0,
            errMessage: 'Tạo bài viết mới thành công',
            data: newArticle,
        });
    } catch (error) {
        console.error('Create Article Controller Error:', error);
        return res.status(500).json({
            errCode: -1,
            errMessage: 'Lỗi server khi tạo bài viết',
            error: error.message
        });
    }
};
