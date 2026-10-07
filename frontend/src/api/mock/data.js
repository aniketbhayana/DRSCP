
export const mockRequests = [
  { request_id: 1, requester_name: 'John Doe', request_type: 'RESCUE', status: 'PENDING', priority_score: 95, district: 'Chennai', created_at: new Date().toISOString() },
  { request_id: 2, requester_name: 'Jane Smith', request_type: 'FOOD', status: 'ALLOCATED', priority_score: 50, district: 'Madurai', created_at: new Date().toISOString() },
];

export const mockShelters = [
  { shelter_id: 1, shelter_name: 'Central High School', agency_name: 'Govt', district: 'Chennai', total_capacity: 500, current_occupancy: 450, status: 'OPEN' },
];

export const mockStats = {
  pending_requests: 124,
  active_volunteers: 45,
  critical_shelters: 2,
};
