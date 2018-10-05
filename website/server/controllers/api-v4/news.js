import {authWithHeaders} from '../../middlewares/auth';
import _ from 'lodash';
import apiError from '../../libs/apiError';
import {model as NewsPost} from '../../models/newsPost';
import {ensureAdmin} from '../../middlewares/ensureAccessRight';
import {
  NotFound,
} from '../../libs/errors';
let api = {};

// @TODO export this const, cannot export it from here because only routes are exported from controllers
const LAST_ANNOUNCEMENT_TITLE = 'LAST CHANCE FOR LAVA DRAGON SET AND SPOTLIGHT ON BACK TO SCHOOL';

/**
 * @api {get} /api/v3/news Get latest Bailey announcement
 * @apiName GetNews
 * @apiGroup News
 *
 *
 * @apiSuccess {Object} html Latest Bailey html
 *
 */
api.getNews = {
  method: 'GET',
  url: '/news',
  noLanguage: true,
  async handler (req, res) {
    let user = res.locals.user;
    let isAdmin = false;
    if (user && user.contributor) {
      isAdmin = user.contributor.admin;
    }
    let results = await NewsPost.getNews(isAdmin);
    res.respond(200, results);
  },
};

api.createNews = {
  method: 'POST',
  url: '/news',
  middlewares: [authWithHeaders(), ensureAdmin],
  async handler (req, res) {
    let validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    const postData = {
      title: req.body.title,
      publishDate: req.body.publishDate,
      published: req.body.published,
      credits: req.body.credits,
      text: req.body.text,
    };

    const newsPost = new NewsPost(postData);
    await newsPost.save();

    if (newsPost.published) {
      NewsPost.updateLastNewsPostID(newsPost.id, newsPost.publishDate);
    }

    res.respond(201, newsPost.toJSON());
  },
};

/**
 * @api {put} /api/v4/news/:postId Update news post
 * @apiName UpdateNewsPost
 * @apiGroup News
 *
 * @apiParam (Path) {String} postId The posts _id
 *
 * @apiSuccess {Object} data The updated group (See <a href="https://github.com/HabitRPG/habitica/blob/develop/website/server/models/group.js" target="_blank">/website/server/models/group.js</a>)
 *
 * @apiSuccessExample {json} Post:
 *     HTTP/1.1 200 OK
 *     {
 *       "title": "News Title",
 *       ...
 *     }
 *
 * @apiUse postIdRequired
 *
 * @apiPermission Admin
 */
api.updateNews = {
  method: 'PUT',
  url: '/news/:postId',
  middlewares: [authWithHeaders(), ensureAdmin],
  async handler (req, res) {
    req.checkParams('postId', apiError('postIdRequired')).notEmpty();
    let validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    let newsPost = await NewsPost.findById(req.params.postId);
    if (!newsPost) throw new NotFound(res.t('newsPostNotFound'));

    _.merge(newsPost, NewsPost.sanitize(req.body));
    let savedPost = await newsPost.save();

    if (newsPost.published) {
      NewsPost.updateLastNewsPostID(newsPost.id, newsPost.publishDate);
    }

    res.respond(200, savedPost.toJSON());
  },
};

api.deleteNews = {
  method: 'DELETE',
  url: '/news/:postId',
  middlewares: [authWithHeaders(), ensureAdmin],
  async handler (req, res) {
    let validationErrors = req.validationErrors();
    if (validationErrors) throw validationErrors;

    let newsPost = await NewsPost.findById(req.params.postId);
    if (!newsPost) throw new NotFound(res.t('newsPostNotFound'));

    await NewsPost.remove({_id: req.params.postId}).exec();

    res.respond(200, {});
  },
};

/**
 * @api {post} /api/v3/news/read Mark latest Bailey announcement as read
 * @apiName MarkNewsRead
 * @apiGroup News
 *
 *
 * @apiSuccess {Object} data An empty Object
 *
 */
api.MarkNewsRead = {
  method: 'POST',
  middlewares: [authWithHeaders()],
  url: '/news/read',
  async handler (req, res) {
    const user = res.locals.user;

    user.flags.lastNewStuffRead = await NewsPost.lastNewsPostID();

    await user.save();
    res.respond(200, {});
  },
};

/**
 * @api {post} /api/v3/news/tell-me-later Get latest Bailey announcement in a second moment
 * @apiName TellMeLaterNews
 * @apiGroup News
 *
 *
 * @apiSuccess {Object} data An empty Object
 *
 */
api.tellMeLaterNews = {
  method: 'POST',
  middlewares: [authWithHeaders()],
  url: '/news/tell-me-later',
  async handler (req, res) {
    const user = res.locals.user;

    user.flags.lastNewStuffRead = await NewsPost.lastNewsPostID();

    const existingNotificationIndex = user.notifications.findIndex(n => {
      return n && n.type === 'NEW_STUFF';
    });
    if (existingNotificationIndex !== -1) user.notifications.splice(existingNotificationIndex, 1);
    user.addNotification('NEW_STUFF', { title: LAST_ANNOUNCEMENT_TITLE }, true); // seen by default

    await user.save();
    res.respond(200, {});
  },
};

module.exports = api;
