import { notificationHandlers } from './notification-handlers';
import { messagingHandlers } from './messaging-handlers';
import { announcementHandlers } from './announcement-handlers';
import { admissionHandlers } from './admission-handlers';
import { behaviourHandlers } from './behaviour-handlers';
import { collectionHandlers } from './collection-handlers';

/**
 * engagement routes, grouped one file per area.
 *
 * MSW resolves handlers in order, so the spread below preserves the original
 * sequence exactly.
 */
export const engagementHandlers = [
  ...notificationHandlers,
  ...messagingHandlers,
  ...announcementHandlers,
  ...admissionHandlers,
  ...behaviourHandlers,
  ...collectionHandlers,
];
