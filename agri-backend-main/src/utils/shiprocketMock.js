// Mocked Shiprocket API responses.
//
// Shiprocket has no sandbox, so this module returns payloads shaped exactly like the
// real API (see https://apidocs.shiprocket.in) without making any network call. The
// shiprocket client routes here whenever SHIPROCKET_MOCK=true, letting dev/test
// exercise the full create -> awb -> pickup -> track -> cancel flow safely.
//
// All mock ids are prefixed with "MOCK" so a mocked shipment can never be mistaken
// for a real one in the database.

let orderSeq = 1;
let shipmentSeq = 1;
let awbSeq = 1;

const nextAwb = () => `MOCK${String(awbSeq++).padStart(9, '0')}SR`;

// POST /v1/external/auth/login
const login = () => ({
  id: 1,
  first_name: 'Mock',
  last_name: 'ApiUser',
  email: 'mock-api@example.com',
  company_id: 1000000,
  token: 'mock-shiprocket-token'
});

// GET /v1/external/courier/serviceability/
// Cheapest-first is NOT guaranteed by the real API, so the mock returns them
// deliberately out of order to keep the client's sorting honest.
const serviceability = (params = {}) => {
  const weight = Math.max(0.5, Number(params.weight) || 0.5);
  const cod = Number(params.cod) === 1;
  const courier = (id, name, freight, surface) => ({
    courier_company_id: id,
    courier_name: name,
    freight_charge: freight,
    cod_charges: cod ? 35 : 0,
    rate: freight + (cod ? 35 : 0),
    cod: 1,
    etd: 'Jan 01, 2030',
    estimated_delivery_days: surface ? '5' : '2',
    is_surface: surface,
    city: 'Mock City',
    state: 'Maharashtra',
    postcode: String(params.delivery_postcode || '')
  });

  const base = Math.ceil(weight / 0.5) * 30;
  return {
    data: {
      available_courier_companies: [
        courier(1, 'Mock Air', base + 60, false),
        courier(51, 'Mock Surface', base + 25, true)
      ],
      recommended_courier_company_id: 1
    }
  };
};

// POST /v1/external/orders/create/adhoc
const createOrder = (payload = {}) => ({
  order_id: 9000000 + orderSeq++,
  channel_order_id: payload.order_id,
  shipment_id: 8000000 + shipmentSeq++,
  status: 'NEW',
  status_code: 1,
  onboarding_completed_now: 0
});

// POST /v1/external/courier/assign/awb
const assignAwb = (body = {}) => ({
  awb_assign_status: 1,
  response: {
    data: {
      courier_company_id: body.courier_id || 51,
      awb_code: nextAwb(),
      courier_name: body.courier_id === 1 ? 'Mock Air' : 'Mock Surface',
      shipment_id: body.shipment_id,
      freight_charge: 55,
      applied_weight: 0.5,
      assigned_date_time: { date: '2030-01-01 10:00:00.000000', timezone: 'Asia/Kolkata' }
    }
  }
});

// POST /v1/external/courier/generate/pickup
const requestPickup = (shipmentId) => ({
  pickup_status: 1,
  response: { pickup_scheduled_date: '2030-01-01 16:00:00', pickup_token_number: `MOCKPKP${shipmentId}` }
});

// POST /v1/external/courier/generate/label
const generateLabel = (shipmentId) => ({
  label_created: 1,
  label_url: `https://mock.shiprocket.local/labels/${shipmentId}.pdf`,
  response: 'Label has been generated successfully.'
});

// GET /v1/external/courier/track/awb/{awb}
const track = (awb) => {
  const day = (n) => `2030-01-0${n} 10:00:00`;
  return {
    tracking_data: {
      track_status: 1,
      shipment_status: 6,
      shipment_track: [
        {
          id: 1,
          awb_code: awb,
          courier_name: 'Mock Surface',
          current_status: 'In Transit',
          origin: 'Kaithal',
          destination: 'Mock City',
          edd: '2030-01-05 00:00:00'
        }
      ],
      shipment_track_activities: [
        { date: day(3), status: 'IT', activity: 'Shipment in transit at hub', location: 'Mock Hub', 'sr-status-label': 'IN TRANSIT' },
        { date: day(2), status: 'PKD', activity: 'Picked up from seller', location: 'Kaithal', 'sr-status-label': 'PICKED UP' },
        { date: day(1), status: 'NEW', activity: 'Shipment manifested', location: 'Kaithal', 'sr-status-label': 'NEW' }
      ],
      track_url: `https://mock.shiprocket.local/tracking/${awb}`
    }
  };
};

// POST /v1/external/orders/cancel  |  /v1/external/orders/cancel/shipment/awbs
const cancel = (body = {}) => ({
  status: 200,
  message: body.awbs ? 'Shipment cancelled successfully' : 'Order cancelled successfully'
});

// GET /v1/external/settings/company/pickup
const pickupLocations = () => ({
  data: {
    shipping_address: [
      {
        id: 1,
        pickup_location: 'Home-1',
        name: 'Amit Shrivastav',
        address: 'Naya tola line bazar',
        city: 'Purnia',
        state: 'Bihar',
        country: 'India',
        pin_code: '854301',
        phone: '9012659000',
        status: 1,
        phone_verified: 1,
        is_primary_location: 1
      },
      {
        id: 2,
        pickup_location: 'Home',
        name: 'Sanjay Raj Rana',
        address: 'VPO Nauch, near PNB',
        city: 'Kaithal',
        state: 'Haryana',
        country: 'India',
        pin_code: '136027',
        phone: '9012659000',
        status: 1,
        phone_verified: 1,
        is_primary_location: 0
      }
    ]
  }
});

module.exports = {
  login,
  serviceability,
  createOrder,
  assignAwb,
  requestPickup,
  generateLabel,
  track,
  cancel,
  pickupLocations
};
