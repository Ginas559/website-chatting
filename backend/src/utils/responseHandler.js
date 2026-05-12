/**
 * Utility class để xử lý response một cách consistent
 */

class ResponseHandler {
  /**
   * Success response
   */
  static success(res, data, message = 'Operation successful', statusCode = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Error response
   */
  static error(res, message = 'Operation failed', error = null, statusCode = 400) {
    return res.status(statusCode).json({
      success: false,
      message,
      error: error instanceof Error ? error.message : error,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Validation error response
   */
  static validationError(res, errors, statusCode = 422) {
    return res.status(statusCode).json({
      success: false,
      message: 'Validation error',
      errors: errors,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Not found error
   */
  static notFound(res, message = 'Resource not found') {
    return res.status(404).json({
      success: false,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = ResponseHandler;
