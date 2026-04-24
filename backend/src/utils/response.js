const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
    res.status(statusCode).json({
        success: true,
        message: message,
        data: data,
    });
};

const sendError = (res, message = 'Error', statusCode = 500, error = null) => {
    res.status(statusCode).json({
        success: false,
        message: message,
        error: error,
    });
};

// Wrapper function to handle both success and error responses
const response = (res, statusCode, data, message) => {
    if (statusCode >= 200 && statusCode < 300) {
        // Success response
        return res.status(statusCode).json({
            code: statusCode,
            data: data,
            message: message,
        });
    } else {
        // Error response
        return res.status(statusCode).json({
            code: statusCode,
            data: data,
            message: message,
        });
    }
};

module.exports = {
    sendSuccess,
    sendError,
    response,
};
