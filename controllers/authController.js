const crypto = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const User = require('./../models/userModel');
const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const Email = require('./../utils/email');

const signToken = id => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);
  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
    ),
    httpOnly: true
  };
  if (process.env.NODE_ENV === 'production') cookieOptions.secure = true;

  res.cookie('jwt', token, cookieOptions);

  // Remove the password from the output.
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    token,
    data: {
      user
    }
  });
};

exports.signup = catchAsync(async (req, res, next) => {
  const newUser = await User.create({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    passwordConfirm: req.body.passwordConfirm,
    passwordChangedAt: req.body.passwordChangedAt,
    role: req.body.role,
    passwordResetToken: req.body.passwordResetToken,
    passwordResetExpires: req.body.passwordResetExpires
  });

  const url = `${req.protocol}://${req.get('host')}/me`;
  // console.log(url);
  await new Email(newUser, url).sendWelcome();

  createSendToken(newUser, 201, res);
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // 1. Check if email and password are provided in req.body.
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // 2. Check if the user exits && password is correct.
  const user = await User.findOne({ email }).select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  // console.log(user);
  // 'pass1234' = '$2a$12$77iNIH9FRTWdcbqGtWvM4OhfDuJVTcRlLw2WTrGCIBQ9eWz5WTWc';

  // 3. Send token to client.
  createSendToken(user, 200, res);
});

exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedOut', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true
  });
  res.status(200).json({ status: 'success' });
};

exports.protect = catchAsync(async (req, res, next) => {
  // 1. Getting token and check if its there.
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }
  // console.log(token);

  if (!token) {
    return next(
      new AppError('You are not logged in! Please login to get access.')
    );
  }

  // 2. Verification of token.
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  // console.log(decoded);

  // 3. Check if user still exists.
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError('The user belonging to the token no longer exists.', 401)
    );
  }

  // 4. Check if user changed password after the token was issued.
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password! please log in again.', 401)
    );
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = currentUser;
  res.locals.user = currentUser;
  next();
});

// Only for rendered pages, no errors
exports.isLoggedIn = async (req, res, next) => {
  // 1. Getting token and check if its there.
  try {
    if (req.cookies.jwt) {
      // 2. Verification of token.
      const decoded = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRET
      );
      // console.log(decoded);

      // 3. Check if user still exists.
      const currentUser = await User.findById(decoded.id);
      if (!currentUser) {
        return next();
      }

      // 4. Check if user changed password after the token was issued.
      if (currentUser.changedPasswordAfter(decoded.iat)) {
        return next(new AppError());
      }

      // THERE IS A LOGGED IN USER.
      res.locals.user = currentUser;
      return next();
    }
  } catch (err) {
    return next();
  }
  next();
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    // roles = ['admin', 'lead-guide']. role='user'
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action.', 403)
      );
    }

    next();
  };
};

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1. Get user based on POSTed email. And verify if the user exits in the database.
  const user = await User.findOne({ email: req.body.email });
  if (!user) {
    return next(new AppError('There is no user with this email address.', 404));
  }

  // 2. Generate the random reset token.
  const resetToken = user.createPasswordResetToken();
  // await user.save();
  await user.save({ validateBeforeSave: false });

  try {
    // 3. Send it to user's email.
    const resetURL = `${req.protocol}://${req.get(
      'host'
    )}/api/v1/users/resetPassword/${resetToken}`;
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: 'success',
      message: 'Token is successfully sent to email'
    });
  } catch (err) {
    user.passwordResetExpires = undefined;
    user.passwordResetToken = undefined;
    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        'There was an error sending the email. Please try again later!'
      ),
      500
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  // 1) Get the user based on token.
  const hashedToken = crypto
    .createHash('sha256')
    .update(req.params.token)
    .digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() }
  });
  // 2) If random token has not expired, and there is a user, then set the new password.
  if (!user) {
    return next(new AppError('Token is invalid or has expired', 400));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  // 3) Update changedPasswordAt property for the user.
  // 4) Log the user in and, send the JWT.
  createSendToken(user, 200, res);
});

// exports.updatePassword = catchAsync(async (req, res, next) => {
//   // 1) Get the user from the collection.
//   const decoded = await promisify(jwt.verify)(
//     req.headers.authorization,
//     process.env.JWT_SECRET
//   );

//   const user = await User.findById(decoded.sub);
//   // console.log(decoded.sub);

//   // 2) Check if POSTed current password is correct.
//   if (!user || (await user.correctPassword(req.body.password, user.password))) {
//     return next(new AppError('The current password is incorrect', 400));
//   }

//   // 3) IF so, update password.
//   const newPassword = await bcrypt.hash(req.body.password, 12);
//   user.password = newPassword;
//   await user.save();

//   // 4) Log user in, send JWT.
//   const token = signToken(user._id);

//   res.status(200).json({
//     status: 'success',
//     token
//   });
// });

exports.updatePassword = catchAsync(async (req, res, next) => {
  // 1) Get user from collection.
  // The user id of current user is comming from the protect middleware.
  const user = await User.findById(req.user.id).select('+password');
  console.log(req.user.id);

  // 2) Check if POSTed current password is correct.
  // req.body.passwordCurrent=is the password that the user put to update his password.
  // user.password=is the password which is coming from the login or the database.
  if (!(await user.correctPassword(req.body.passwordCurrent, user.password))) {
    return next(new AppError('Your current password is incorrect', 401));
  }
  // console.log(req.body.passwordCurrent);
  // console.log(user.password);
  // 3) If so, update password.
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;
  await user.save();
  // User.findByIdAndUpdate will not work as INTENDED.

  // 4) log user in, send JWT.
  createSendToken(user, 200, res);
});
