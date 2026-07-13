const { catchAsync, AppError } = require('../middleware/errorHandler');
const { createPageUseCases } = require('../src/modules/pages/page.useCases');

const pageUseCases = createPageUseCases();

const normalizePageError = (error) => new AppError(
  error.publicMessage || error.message || 'Failed to load page',
  error.statusCode || 500
);

const renderCatalog = catchAsync(async (req, res) => {
  try {
    res.render('public/catalog', await pageUseCases.publicCatalog({ query: req.query }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

const renderTitle = catchAsync(async (req, res) => {
  try {
    res.render('streamer/details', await pageUseCases.publicTitle({
      slugOrId: req.params.slugOrId,
      user: req.session?.user,
    }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

const renderProgram = catchAsync(async (req, res) => {
  try {
    res.render('public/program', await pageUseCases.publicProgram({ slug: req.params.slug }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

const renderCollection = catchAsync(async (req, res) => {
  try {
    res.render('public/collection', await pageUseCases.publicCollection({ slug: req.params.slug }));
  } catch (error) {
    throw normalizePageError(error);
  }
});

module.exports = {
  renderCatalog,
  renderCollection,
  renderProgram,
  renderTitle,
};
