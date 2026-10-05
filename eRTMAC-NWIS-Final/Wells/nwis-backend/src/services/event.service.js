// =============================================================================
// NWIS Backend — Event Service
// =============================================================================

const eventRepository = require('../repositories/event.repository');
const logger = require('../utils/logger');

const eventService = {
  async createEvent(eventData) {
    const event = await eventRepository.create(eventData);
    logger.info({ eventId: event.id, type: event.event_type }, 'Drilling event created');
    return event;
  },

  async getEvent(id) {
    const event = await eventRepository.findById(id);
    if (!event) {
      throw Object.assign(new Error('Event not found'), { code: 'EVENT_NOT_FOUND', status: 404 });
    }
    return event;
  },

  async getEventsByWell(wellId, filters) {
    return await eventRepository.findByWell(wellId, filters);
  },

  async updateEvent(id, fields) {
    const event = await eventRepository.update(id, fields);
    if (!event) {
      throw Object.assign(new Error('Event not found'), { code: 'EVENT_NOT_FOUND', status: 404 });
    }
    return event;
  },

  async deleteEvent(id) {
    const deleted = await eventRepository.delete(id);
    if (!deleted) {
      throw Object.assign(new Error('Event not found'), { code: 'EVENT_NOT_FOUND', status: 404 });
    }
    return true;
  },

  async getMitigations(eventId) {
    return await eventRepository.getMitigations(eventId);
  },

  async addMitigation(mitigationData) {
    // Verify event exists
    await this.getEvent(mitigationData.event_id);
    return await eventRepository.addMitigation(mitigationData);
  },

  async getEventSummary(wellId) {
    return await eventRepository.getEventSummary(wellId);
  },

  /**
   * Get events across multiple wells for a given type and depth range.
   */
  async getEventsAcrossWells(wellIds, eventType, depthRange) {
    return await eventRepository.findByTypeAcrossWells(wellIds, eventType, depthRange);
  },
};

module.exports = eventService;
