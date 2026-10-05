import React, { useState, useMemo } from 'react';
import './EventTimeline.css';
import { formatDepth, formatEventType } from '../../utils/formatters';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

const EventTimeline = ({ 
  events = [], 
  onSelectEvent,
  eventTypeFilter,
  severityFilter,
  fromDepthFilter,
  toDepthFilter
}) => {
  if (!events || events.length === 0) {
    return <div className="event-timeline empty">No events recorded</div>;
  }

  // Sort and filter events
  const filteredEvents = useMemo(() => {
    return events
      .filter(e => {
        if (eventTypeFilter && e.event_type !== eventTypeFilter) return false;
        if (severityFilter && e.severity !== severityFilter) return false;
        if (fromDepthFilter && e.depth < fromDepthFilter) return false;
        if (toDepthFilter && e.depth > toDepthFilter) return false;
        return true;
      })
      .sort((a, b) => b.depth - a.depth); // Sort by depth descending (deepest first)
  }, [events, eventTypeFilter, severityFilter, fromDepthFilter, toDepthFilter]);

  if (filteredEvents.length === 0) {
    return <div className="event-timeline empty">No events match the current filters</div>;
  }

  return (
    <div className="event-timeline-container">
      <div className="event-timeline-line"></div>
      
      {filteredEvents.map(event => (
        <div 
          key={event.id || event._id} 
          className={`timeline-item severity-${event.severity?.toLowerCase() || 'info'}`}
          onClick={() => onSelectEvent && onSelectEvent(event)}
        >
          <div className="timeline-marker"></div>
          
          <div className="timeline-content">
            <div className="timeline-header">
              <span className="timeline-depth">{formatDepth(event.depth)}</span>
              <span className="timeline-type">{formatEventType(event.event_type)}</span>
              <span className="timeline-date">
                {new Date(event.timestamp || event.start_time).toLocaleDateString()}
              </span>
            </div>
            
            <p className="timeline-description">{event.description}</p>
            
            {event.severity === 'CRITICAL' && (
              <div className="timeline-alert">
                <AlertTriangle size={14} /> High Risk Event
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default EventTimeline;
