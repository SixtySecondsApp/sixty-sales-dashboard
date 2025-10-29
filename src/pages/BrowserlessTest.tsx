/**
 * Simple test page for Browserless access
 * This page is completely public and doesn't use any authentication
 */
export default function BrowserlessTest() {
  // No hooks, no auth, just simple HTML
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      fontFamily: 'sans-serif'
    }}>
      <h1 style={{ fontSize: '48px', margin: '0' }}>Browserless Test Page</h1>
      <p style={{ fontSize: '24px', marginTop: '20px' }}>
        If you can see this, Browserless can access the app!
      </p>
      <div
        id="browserless-marker"
        data-test="browserless-accessible"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '1px',
          height: '1px',
          opacity: 0
        }}
      >
        BROWSERLESS_SUCCESS
      </div>
    </div>
  );
}