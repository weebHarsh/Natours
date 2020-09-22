class AppError extends Error {
  // Remember the constructor method is called each time we create a new object out of this class.
  constructor(message, statusCode) {
    //
    super(message);

    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
