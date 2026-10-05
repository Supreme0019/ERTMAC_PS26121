// =============================================================================
// NWIS Backend — Event Controller
// =============================================================================

const eventService = require('../services/event.service');
const auditService = require('../services/audit.service');
const { success, paginated, notFound } = require('../utils/response');
const { parsePagination, buildPaginationMeta } = require('../utils/pagination');

const eventController = {
  async create(req, res, next) {
    try {
      const event = await eventService.createEvent(req.body);
      await auditService.log({ userId: req.user.id, action: 'CREATE_EVENT', resourceType: 'event', resourceId: event.id, newData: event, req });
      return success(res, { event }, 201);
    } catch (err) { next(err); }
  },

  async getById(req, res, next) {
    try {
      const event = await eventService.getEvent(req.params.eventId || req.params.id);
      return success(res, { event });
    } catch (err) {
      if (err.code === 'EVENT_NOT_FOUND') return notFound(res, 'Event');
      next(err);
    }
  },

  async getByWell(req, res, next) {
    try {
      const { page, limit, offset } = parsePagination(req.query);
      const { events, total } = await eventService.getEventsByWell(req.params.id, { ...req.query, limit, offset });
      return paginated(res, { events }, buildPaginationMeta(total, page, limit));
    } catch (err) { next(err); }
  },

  async update(req, res, next) {
    try {
      const event = await eventService.updateEvent(req.params.eventId || req.params.id, req.body);
      await auditService.log({ userId: req.user.id, action: 'UPDATE_EVENT', resourceType: 'event', resourceId: event.id, newData: req.body, req });
      return success(res, { event });
    } catch (err) {
      if (err.code === 'EVENT_NOT_FOUND') return notFound(res, 'Event');
      next(err);
    }
  },

  async delete(req, res, next) {
    try {
      await eventService.deleteEvent(req.params.eventId || req.params.id);
      return success(res, { message: 'Event deleted' });
    } catch (err) {
      if (err.code === 'EVENT_NOT_FOUND') return notFound(res, 'Event');
      next(err);
    }
  },

  async getMitigations(req, res, next) {
    try {
      const mitigations = await eventService.getMitigations(req.params.eventId || req.params.id);
      return success(res, { mitigations });
    } catch (err) { next(err); }
  },

  async addMitigation(req, res, next) {
    try {
      const mitigation = await eventService.addMitigation(req.body);
      await auditService.log({ userId: req.user.id, action: 'ADD_MITIGATION', resourceType: 'mitigation', resourceId: mitigation.id, newData: mitigation, req });
      return success(res, { mitigation }, 201);
    } catch (err) {
      if (err.code === 'EVENT_NOT_FOUND') return notFound(res, 'Event');
      next(err);
    }
  },

  async getSummary(req, res, next) {
    try {
      const summary = await eventService.getEventSummary(req.params.id);
      return success(res, { wellId: req.params.id, summary });
    } catch (err) { next(err); }
  },
};

module.exports = eventController;
