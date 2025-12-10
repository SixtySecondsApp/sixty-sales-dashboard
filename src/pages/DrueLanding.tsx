/**
 * DrueLanding - Serves the static Drue landing page via iframe
 *
 * This component loads the pre-built static landing page
 * located in /public/landing-drue/index.html
 */
const DrueLanding = () => {
  return (
    <iframe
      src="/landing-drue/index.html"
      title="Drue Landing Page"
      className="w-full h-screen border-0"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        border: 'none'
      }}
    />
  );
};

export default DrueLanding;
