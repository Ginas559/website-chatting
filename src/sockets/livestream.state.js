let activeAdminSocketId = '';
let activeLivestreamId = '';

export const setActiveLivestreamAdmin = ({ socketId, livestreamId }) => {
    activeAdminSocketId = socketId || '';
    activeLivestreamId = livestreamId || '';
};

export const clearActiveLivestreamAdmin = (socketId) => {
    if (!socketId || socketId === activeAdminSocketId) {
        activeAdminSocketId = '';
        activeLivestreamId = '';
    }
};

export const hasActiveLivestreamAdmin = (livestreamId) => {
    if (!activeAdminSocketId || !activeLivestreamId) return false;
    if (!livestreamId) return true;
    return String(activeLivestreamId) === String(livestreamId);
};
