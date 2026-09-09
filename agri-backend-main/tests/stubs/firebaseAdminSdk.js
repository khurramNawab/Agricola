// Jest stub for the firebase-admin modular subpaths (`firebase-admin/app` and
// `firebase-admin/auth`).
//
// The real SDK pulls in `jose`, which ships as ESM only; Jest (CommonJS, no Babel
// transform configured) cannot load it, so requiring src/server.js — which mounts the
// auth routes — used to fail every route-level suite with "Unexpected token 'export'".
//
// Phone-auth token verification is never exercised by the route tests (they mint their
// own JWTs), so a stub is enough. A test that needs real verification should mock
// src/utils/firebaseAdmin directly instead.
const notStubbed = () => {
  throw new Error('firebase-admin is stubbed in tests (see tests/stubs/firebaseAdminSdk.js)');
};

module.exports = {
  // firebase-admin/app
  initializeApp: () => ({ name: 'test-stub-app' }),
  cert: (serviceAccount) => ({ serviceAccount }),
  // firebase-admin/auth
  getAuth: () => ({ verifyIdToken: notStubbed })
};
