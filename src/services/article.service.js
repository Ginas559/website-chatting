import Article from '../models/article.model';
import { createNotification } from '../utils/notification';

const ARTICLE_SELECT_FIELDS = 'title slug category author coverImage images summary content tags views isLatest';

const mapArticle = (article) => ({
    id: article._id,
    slug: article.slug,
    title: article.title,
    category: article.category,
    author: article.author,
    coverImage: article.coverImage,
    images: Array.isArray(article.images) && article.images.length ? article.images : [article.coverImage].filter(Boolean),
    summary: article.summary,
    content: article.content || article.summary,
    tags: article.tags || [],
    views: article.views || 0,
});

export const getLatestArticles = async (limit = 6) => {
    const articles = await Article.find({ isActive: true, isLatest: true })
        .sort({ createdAt: -1 })
        .limit(limit)
        .select(ARTICLE_SELECT_FIELDS)
        .lean();

    return articles.map(mapArticle);
};

export const getArticleDetailBySlug = async (slug) => {
    const article = await Article.findOneAndUpdate(
        { slug, isActive: true },
        { $inc: { views: 1 } },
        { new: true }
    )
        .select(ARTICLE_SELECT_FIELDS)
        .lean();

    if (!article) {
        return null;
    }

    const related = await Article.find({
        isActive: true,
        slug: { $ne: slug },
        category: article.category,
    })
        .sort({ views: -1, createdAt: -1 })
        .limit(6)
        .select(ARTICLE_SELECT_FIELDS)
        .lean();

    return {
        article: mapArticle(article),
        related: related.map(mapArticle),
    };
};

export const createArticle = async (articleData) => {
    const slug = articleData.slug || articleData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const newArticle = await Article.create({
        ...articleData,
        slug,
    });
    
    const mapped = mapArticle(newArticle);
    
    // Trigger notification for all users
    const isEvent = articleData.category?.toLowerCase() === 'event' || articleData.category?.toLowerCase() === 'sự kiện';
    const notifyType = isEvent ? 'NEW_EVENT' : 'NEW_ARTICLE';
    const notifyTitle = isEvent ? 'Sự kiện mới' : 'Bài viết mới';
    
    createNotification({
        type: notifyType,
        title: notifyTitle,
        content: `SmartZone vừa đăng tải ${notifyTitle.toLowerCase()}: "${mapped.title}". Đọc ngay để không bỏ lỡ thông tin!`,
        link: `/article/${mapped.slug}`
    }).catch(err => console.error('Article creation notification error:', err));
    
    return mapped;
};
