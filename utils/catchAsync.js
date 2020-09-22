module.exports = fn => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
    /*long-hand notation:- catch(err => next(err))*/
  };
};
