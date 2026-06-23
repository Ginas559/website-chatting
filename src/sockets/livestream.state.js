export const MAX_VIEWERS = 20;

let activeAdminSocketId = '';
let activeLivestreamId = '';
const viewersByLive = new Map();

export const setActiveLivestreamAdmin = ({ socketId, livestreamId }) => {
    activeAdminSocketId = socketId || '';
    activeLivestreamId = livestreamId || '';
    if (activeLivestreamId && !viewersByLive.has(activeLivestreamId)) {
        viewersByLive.set(activeLivestreamId, new Map());
    }
};

export const clearActiveLivestreamAdmin = (socketId) => {
    if (!socketId || socketId === activeAdminSocketId) {
        if (activeLivestreamId) {
            viewersByLive.delete(activeLivestreamId);
        }
        activeAdminSocketId = '';
        activeLivestreamId = '';
    }
};

export const hasActiveLivestreamAdmin = (livestreamId) => {
    if (!activeAdminSocketId || !activeLivestreamId) return false;
    if (!livestreamId) return true;
    return String(activeLivestreamId) === String(livestreamId);
};

export const getActiveLivestreamState = () => ({
    activeAdminSocketId,
    activeLivestreamId,
    viewerCount: getViewerCount(activeLivestreamId),
});

export const addViewer = ({ liveId, userId, socketId }) => {
    const normalizedLiveId = String(liveId || '');
    const normalizedUserId = String(userId || '');

    if (!normalizedLiveId || !normalizedUserId || !socketId) {
        return { accepted: false, reason: 'INVALID_VIEWER', replacedSocketId: '' };
    }

    if (!viewersByLive.has(normalizedLiveId)) {
        viewersByLive.set(normalizedLiveId, new Map());
    }

    const viewers = viewersByLive.get(normalizedLiveId);
    const existingSocketId = viewers.get(normalizedUserId) || '';

    if (!existingSocketId && viewers.size >= MAX_VIEWERS) {
        return { accepted: false, reason: 'MAX_VIEWERS', replacedSocketId: '' };
    }

    viewers.set(normalizedUserId, socketId);

    return {
        accepted: true,
        reason: '',
        replacedSocketId: existingSocketId && existingSocketId !== socketId ? existingSocketId : '',
    };
};

export const removeViewer = ({ liveId, userId, socketId }) => {
    const normalizedLiveId = String(liveId || '');
    const normalizedUserId = String(userId || '');
    const viewers = viewersByLive.get(normalizedLiveId);

    if (!viewers) return false;

    if (normalizedUserId) {
        const currentSocketId = viewers.get(normalizedUserId);
        if (!socketId || currentSocketId === socketId) {
            viewers.delete(normalizedUserId);
            return true;
        }
        return false;
    }

    for (const [viewerUserId, viewerSocketId] of viewers.entries()) {
        if (viewerSocketId === socketId) {
            viewers.delete(viewerUserId);
            return true;
        }
    }

    return false;
};

export const getViewerCount = (liveId) => {
    const viewers = viewersByLive.get(String(liveId || ''));
    return viewers?.size || 0;
};

export const clearViewers = (liveId) => {
    if (liveId) {
        viewersByLive.delete(String(liveId));
    }
};
