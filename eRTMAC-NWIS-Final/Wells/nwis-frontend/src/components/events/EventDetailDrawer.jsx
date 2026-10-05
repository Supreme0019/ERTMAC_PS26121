import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Drawer } from '../ui/Drawer';
import { eventsAPI } from '../../api/client';
import { formatDepth, formatEventType } from '../../utils/formatters';
import SourceDocumentLink from '../evidence/SourceDocumentLink';
import { LoadingState } from '../ui/LoadingState';
import './EventDetailDrawer.css';

const EventDetailDrawer = ({ event, isOpen, onClose }) => {
  const eventId = event?.id || event?._id;

  const { data: mitigationsData, isLoading } = useQuery({
    queryKey: ['mitigations', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const res = await eventsAPI.getMitigations(eventId);
      return res.data?.data || res.data || [];
    },
    enabled: !!eventId && isOpen
  });

  const mitigations = Array.isArray(mitigationsData) ? mitigationsData : mitigationsData?.mitigations || [];

  if (!event) return null;

  return (
    <Drawer isOpen={isOpen} onClose={onClose} title="Event Details" position="right" width="450px">
      <div className="event-drawer-content">
        <div className="event-header-info">
          <div className="event-drawer-badge severity">
            {event.severity}
          </div>
          <h3 className="event-drawer-type">{formatEventType(event.event_type)}</h3>
        </div>

        <div className="event-detail-grid">
          <div className="event-detail-item">
            <span className="label">Depth</span>
            <span className="value">{formatDepth(event.depth)}</span>
          </div>
          <div className="event-detail-item">
            <span className="label">Formation</span>
            <span className="value">{event.formation || 'Unknown'}</span>
          </div>
          <div className="event-detail-item">
            <span className="label">Start Time</span>
            <span className="value">{event.start_time ? new Date(event.start_time).toLocaleString() : 'N/A'}</span>
          </div>
          <div className="event-detail-item">
            <span className="label">Confidence</span>
            <span className="value">{event.confidence ? `${(event.confidence * 100).toFixed(0)}%` : 'N/A'}</span>
          </div>
        </div>

        <div className="event-drawer-section">
          <h4>Description</h4>
          <p className="event-drawer-desc">{event.description || 'No description available.'}</p>
          {event.source_document && (
            <div className="event-drawer-source">
              <SourceDocumentLink document={event.source_document} />
            </div>
          )}
        </div>

        <div className="event-drawer-section">
          <div className="historical-warning">
            <strong>Historical record — not an operational instruction</strong>
          </div>
          <h4>Mitigations</h4>
          
          {isLoading ? (
            <LoadingState message="Loading mitigations..." />
          ) : mitigations.length > 0 ? (
            <div className="mitigation-list">
              {mitigations.map((mit, i) => (
                <div key={i} className="mitigation-card">
                  <div className="mitigation-action"><strong>Action:</strong> {mit.action}</div>
                  <div className="mitigation-outcome"><strong>Outcome:</strong> {mit.outcome}</div>
                  {mit.notes && <div className="mitigation-notes"><strong>Notes:</strong> {mit.notes}</div>}
                  {mit.source_document && (
                    <div className="mitigation-source">
                      <SourceDocumentLink document={mit.source_document} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-mitigations">No historical mitigations recorded for this event.</p>
          )}
        </div>
      </div>
    </Drawer>
  );
};

export default EventDetailDrawer;
