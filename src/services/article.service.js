import Article from '../models/article.model';

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
