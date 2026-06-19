const contentService = require('../services/contentService');
const { catchAsync, AppError } = require('../middleware/errorHandler');

const contentById = catchAsync(async (req, res, next) => {
  const result = await contentService.getContentById(req.params.id);

  if (!result.success) {
    return next(new AppError(result.error || 'Content not found', result.statusCode || 404));
  }

  res.json({ success: true, data: result.data });
});

module.exports = { contentById };
