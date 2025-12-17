-- ============================================================================
-- ADD WAITLIST WELCOME EMAIL TEMPLATE
-- Template for welcoming users who join the waitlist
-- ============================================================================

-- Insert waitlist welcome template
INSERT INTO encharge_email_templates (template_name, template_type, subject_line, html_body, text_body, variables, is_active) VALUES
  (
    'Welcome to the Waitlist',
    'waitlist_welcome',
    'Welcome to the Waitlist! 🎉',
    '<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Thank You for Joining the Waitlist</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style type="text/css">
    /* Reset */
    body, table, td, p, a, li, blockquote { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    
    /* Base styles - Desktop */
    html { 
      color-scheme: light !important; 
      background-color: #030712 !important;
      margin: 0 !important;
      padding: 0 !important;
      height: 100% !important;
    }
    body { 
      color-scheme: light !important; 
      background-color: #030712 !important;
      margin: 0 !important;
      padding: 0 !important;
      height: 100% !important;
      width: 100% !important;
      -webkit-text-fill-color: #F3F4F6 !important;
    }
    
    /* Desktop: Prevent dark mode auto-inversion */
    * { 
      color-scheme: light !important;
      forced-color-adjust: none !important;
    }
    
    /* Gmail Dark Mode Prevention - Ultra Aggressive for iOS */
    /* Gmail wraps content in specific divs - target them with maximum brightness */
    u + .body .gmail-blend-screen,
    u + .body .gmail-blend-difference,
    .msg-html-content,
    .msg-html-content *,
    [data-ogsc] .msg-html-content,
    [data-ogsc] .msg-html-content * {
      background-color: #111827 !important;
      color: #FFFFFF !important;
      -webkit-text-fill-color: #FFFFFF !important;
      forced-color-adjust: none !important;
    }
    
    /* Gmail specific: Force light color scheme */
    u + .body {
      background-color: #111827 !important;
      color-scheme: light !important;
    }
    
    /* Gmail iOS specific fixes - Maximum brightness */
    @media screen and (-webkit-min-device-pixel-ratio: 0) {
      .msg-html-content,
      .msg-html-content table,
      .msg-html-content td {
        background-color: #111827 !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      .msg-html-content h1,
      .msg-html-content h2,
      .msg-html-content h3,
      .msg-html-content .email-title {
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      .msg-html-content p,
      .msg-html-content .email-welcome-text,
      .msg-html-content .email-list-text,
      .msg-html-content .email-subtitle {
        color: #F3F4F6 !important;
        -webkit-text-fill-color: #F3F4F6 !important;
      }
    }
    
    /* Additional Gmail iOS dark mode override */
    [data-ogsc] * {
      color: #FFFFFF !important;
      -webkit-text-fill-color: #FFFFFF !important;
    }
    
    [data-ogsc] p,
    [data-ogsc] .email-welcome-text,
    [data-ogsc] .email-list-text,
    [data-ogsc] .email-subtitle {
      color: #F3F4F6 !important;
      -webkit-text-fill-color: #F3F4F6 !important;
    }
    
    /* Mobile Styles - Force Dark Mode Always on Mobile */
    @media only screen and (max-width: 600px) {
      /* Force dark mode appearance on mobile regardless of system preference */
      html, body {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        height: auto !important;
        min-height: auto !important;
        background-color: #111827 !important;
        color-scheme: dark !important;
        forced-color-adjust: none !important;
        overflow-x: hidden !important;
        /* Override system dark mode - always show dark */
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      /* Force dark mode even if system is in light mode */
      @media (prefers-color-scheme: light) {
        html, body {
          background-color: #111827 !important;
          color: #FFFFFF !important;
          -webkit-text-fill-color: #FFFFFF !important;
          color-scheme: dark !important;
        }
      }
      
      /* Force dark background on all containers - always dark on mobile */
      body > table,
      body > table > tbody > tr > td {
        background-color: #111827 !important;
        padding: 0 !important;
        margin: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      /* Override light mode on mobile - force dark */
      @media (prefers-color-scheme: light) {
        body > table,
        body > table > tbody > tr > td {
          background-color: #111827 !important;
          color: #FFFFFF !important;
          -webkit-text-fill-color: #FFFFFF !important;
        }
      }
      
      /* Remove padding from outer table cell on mobile */
      body > table > tbody > tr > td[align="center"] {
        padding: 0 !important;
      }
      
      /* Ensure no height constraints cause extra space */
      body > table,
      body > table > tbody,
      body > table > tbody > tr {
        height: auto !important;
        min-height: auto !important;
        max-height: none !important;
      }
      
      /* Email container - full width, no extra space, always dark on mobile */
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 !important;
        border-radius: 0 !important;
        background-color: #111827 !important;
        forced-color-adjust: none !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      /* Force dark container even in light mode */
      @media (prefers-color-scheme: light) {
        .email-container {
          background-color: #111827 !important;
          color: #FFFFFF !important;
          -webkit-text-fill-color: #FFFFFF !important;
        }
      }
      
      /* Header - mobile optimized, always dark */
      .email-header {
        padding: 32px 20px 24px !important;
        background-color: #111827 !important;
        background: linear-gradient(135deg, #111827 0%, #1F2937 100%) !important;
        forced-color-adjust: none !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      /* Force dark header even in light mode */
      @media (prefers-color-scheme: light) {
        .email-header {
          background-color: #111827 !important;
          background: linear-gradient(135deg, #111827 0%, #1F2937 100%) !important;
          color: #FFFFFF !important;
          -webkit-text-fill-color: #FFFFFF !important;
        }
      }
      
      .email-logo {
        width: 64px !important;
        height: 64px !important;
        max-width: 64px !important;
      }
      
      .email-title {
        font-size: 24px !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
        forced-color-adjust: none !important;
      }
      
      /* Force header title to be white on mobile - especially for Gmail iOS */
      .email-header .email-title,
      .email-header h1 {
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
        background-color: transparent !important;
        forced-color-adjust: none !important;
      }
      
      /* Gmail iOS specific header title override */
      .msg-html-content .email-header .email-title,
      .msg-html-content .email-header h1,
      [data-ogsc] .email-header .email-title,
      [data-ogsc] .email-header h1 {
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
        background-color: transparent !important;
        forced-color-adjust: none !important;
      }
      
      .email-subtitle {
        font-size: 16px !important;
        color: #F3F4F6 !important;
        -webkit-text-fill-color: #F3F4F6 !important;
        forced-color-adjust: none !important;
      }
      
      /* Content area - force dark, always dark on mobile */
      .email-content {
        padding: 24px 20px !important;
        background-color: #111827 !important;
        forced-color-adjust: none !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      /* All nested tables and cells in content - always dark */
      .email-content table,
      .email-content table tr,
      .email-content table td {
        background-color: #111827 !important;
        forced-color-adjust: none !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      /* Force dark content even in light mode */
      @media (prefers-color-scheme: light) {
        .email-content,
        .email-content table,
        .email-content table tr,
        .email-content table td {
          background-color: #111827 !important;
          color: #FFFFFF !important;
          -webkit-text-fill-color: #FFFFFF !important;
        }
      }
      
      /* Text elements - force maximum brightness for Gmail iOS */
      .email-welcome-text {
        font-size: 15px !important;
        color: #F3F4F6 !important;
        -webkit-text-fill-color: #F3F4F6 !important;
        background-color: #111827 !important;
        forced-color-adjust: none !important;
      }
      
      .email-section-title {
        font-size: 11px !important;
        margin-bottom: 16px !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
        background-color: #111827 !important;
        forced-color-adjust: none !important;
      }
      
      .email-list-item {
        padding-bottom: 12px !important;
        background-color: #111827 !important;
        forced-color-adjust: none !important;
      }
      
      .email-list-text {
        font-size: 13px !important;
        line-height: 1.6 !important;
        color: #F3F4F6 !important;
        -webkit-text-fill-color: #F3F4F6 !important;
        background-color: #111827 !important;
        forced-color-adjust: none !important;
      }
      
      /* Gmail iOS specific text color overrides - Maximum brightness */
      .msg-html-content .email-welcome-text,
      .msg-html-content .email-list-text,
      [data-ogsc] .email-welcome-text,
      [data-ogsc] .email-list-text {
        color: #F3F4F6 !important;
        -webkit-text-fill-color: #F3F4F6 !important;
      }
      
      .msg-html-content .email-title,
      .msg-html-content .email-section-title,
      [data-ogsc] .email-title,
      [data-ogsc] .email-section-title {
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      .msg-html-content .email-subtitle,
      [data-ogsc] .email-subtitle {
        color: #F3F4F6 !important;
        -webkit-text-fill-color: #F3F4F6 !important;
      }
      
      /* Button */
      .email-button {
        padding: 12px 24px !important;
        font-size: 15px !important;
      }
      
      /* Footer - always dark on mobile */
      .email-footer {
        padding: 20px !important;
        background-color: #111827 !important;
        forced-color-adjust: none !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      /* Force dark footer even in light mode */
      @media (prefers-color-scheme: light) {
        .email-footer {
          background-color: #111827 !important;
          color: #FFFFFF !important;
          -webkit-text-fill-color: #FFFFFF !important;
        }
      }
      
      .email-footer-text {
        font-size: 13px !important;
        color: #D1D5DB !important;
        -webkit-text-fill-color: #D1D5DB !important;
        forced-color-adjust: none !important;
      }
      
      .email-footer-small {
        font-size: 11px !important;
        color: #9CA3AF !important;
        -webkit-text-fill-color: #9CA3AF !important;
        forced-color-adjust: none !important;
      }
      
      /* Remove any min-height that could cause extra space */
      body > div,
      body > table > tbody > tr > td > div {
        min-height: auto !important;
        height: auto !important;
      }
    }
    
    /* Mobile Dark Mode Prevention - Ultra Aggressive - Force Dark Always */
    @media only screen and (max-width: 600px) {
      /* Force every element to dark - always show dark theme on mobile */
      html, body, table, tbody, tr, td, div, p, a, span, h1, h2, h3 {
        color-scheme: dark !important;
        background-color: #111827 !important;
        forced-color-adjust: none !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      /* Override light mode - always show dark */
      @media (prefers-color-scheme: light) {
        html, body, table, tbody, tr, td, div, p, a, span, h1, h2, h3 {
          color-scheme: dark !important;
          background-color: #111827 !important;
          color: #FFFFFF !important;
          -webkit-text-fill-color: #FFFFFF !important;
        }
      }
      
      /* Explicitly force header title to be white on mobile */
      .email-header h1,
      .email-header .email-title,
      .email-header h1.email-title,
      .email-header td h1,
      .email-header td .email-title {
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
        background-color: transparent !important;
        forced-color-adjust: none !important;
        text-shadow: none !important;
      }
      
      /* Override any white backgrounds - force dark wrapper */
      body > div[style*="background-color: #FFFFFF"],
      body > div[style*="background-color: #fff"],
      body > div[style*="background-color: white"] {
        background-color: #111827 !important;
      }
      
      /* Mobile dark wrapper - ensure its always dark */
      body > div:first-child {
        background-color: #111827 !important;
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
      }
      
      /* Force dark wrapper even in light mode */
      @media (prefers-color-scheme: light) {
        body > div:first-child {
          background-color: #111827 !important;
          color: #FFFFFF !important;
          -webkit-text-fill-color: #FFFFFF !important;
        }
      }
      
      /* Force dark even when system is in light mode - all containers */
      @media (prefers-color-scheme: light) {
        html, body,
        body > table,
        body > table > tbody > tr > td,
        .email-container,
        .email-header,
        .email-content,
        .email-footer {
          background-color: #111827 !important;
          color: #FFFFFF !important;
          -webkit-text-fill-color: #FFFFFF !important;
        }
      }
      
      /* Gmail iOS dark mode - force white title */
      .msg-html-content .email-header h1,
      .msg-html-content .email-header .email-title,
      [data-ogsc] .email-header h1,
      [data-ogsc] .email-header .email-title {
        color: #FFFFFF !important;
        -webkit-text-fill-color: #FFFFFF !important;
        background-color: transparent !important;
        forced-color-adjust: none !important;
        text-shadow: none !important;
      }
    }
  </style>
</head>
<body style="margin: 0 !important; padding: 0 !important; font-family: ''Inter'', -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, sans-serif; background-color: #030712 !important; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; color-scheme: light !important; forced-color-adjust: none !important; -webkit-text-fill-color: #FFFFFF !important; color: #FFFFFF !important; width: 100% !important;">
  <!-- Mobile Dark Mode Wrapper - Forces dark appearance on mobile regardless of system preference -->
  <div style="background-color: #111827 !important; min-height: 100vh; width: 100% !important; margin: 0 !important; padding: 0 !important;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #030712 !important; padding: 0; margin: 0 auto; width: 100% !important; forced-color-adjust: none !important;">
    <tr style="background-color: #030712 !important;">
      <td align="center" style="padding: 20px 0; background-color: #030712 !important; forced-color-adjust: none !important;">
        <!--[if mso]><table width="600" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" class="email-container" style="max-width: 600px; width: 100%; background-color: #111827 !important; border-radius: 16px; overflow: hidden; border: 1px solid #374151 !important; forced-color-adjust: none !important; -webkit-text-fill-color: #F3F4F6 !important; mso-table-lspace: 0pt; mso-table-rspace: 0pt;">
          <!-- Header with Logo -->
          <tr style="background-color: #111827 !important;">
            <td class="email-header" style="padding: 48px 40px 32px; text-align: center; background-color: #111827 !important; background: linear-gradient(135deg, #111827 0%, #1F2937 100%) !important; forced-color-adjust: none !important; -webkit-text-fill-color: #FFFFFF !important; color: #FFFFFF !important;">
              <img src="https://ygdpgliavpxeugaajgrb.supabase.co/storage/v1/object/public/Logos/ac4efca2-1fe1-49b3-9d5e-6ac3d8bf3459/Icon.png" alt="Sixty Seconds" width="80" height="80" class="email-logo" style="display: block; margin: 0 auto 24px; border: 0; max-width: 80px; width: 80px; height: auto; forced-color-adjust: none !important; background-color: transparent !important;" />
              <h1 class="email-title" style="color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; font-size: 28px; font-weight: 700; margin: 0 0 12px 0; line-height: 1.2; letter-spacing: -0.02em; background-color: transparent !important; forced-color-adjust: none !important; text-shadow: none !important;">Welcome to 60, {{user_name}}!</h1>
              <p class="email-subtitle" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 18px; margin: 0; line-height: 1.5; font-weight: 400; background-color: transparent !important; forced-color-adjust: none !important;">Thank you for joining our waitlist.</p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
            <td class="email-content" style="padding: 40px 40px; background-color: #111827 !important; forced-color-adjust: none !important; -webkit-text-fill-color: #F3F4F6 !important; color: #F3F4F6 !important;">
              <!-- Welcome Message -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px; background-color: #111827 !important; forced-color-adjust: none !important;">
                <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
                  <td style="background-color: #111827 !important; forced-color-adjust: none !important;">
                    <p class="email-welcome-text" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 16px; line-height: 1.7; margin: 0 0 20px 0; text-align: center; background-color: #111827 !important; forced-color-adjust: none !important;">We''re thrilled to have you on board! Your interest in revolutionizing your sales process means the world to us.</p>
                    <p class="email-welcome-text" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 16px; line-height: 1.7; margin: 0; text-align: center; background-color: #111827 !important; forced-color-adjust: none !important;">We''re working hard to bring you the most powerful meeting intelligence platform that will help you close more deals and build stronger relationships.</p>
                  </td>
                </tr>
              </table>
              
              <!-- What Happens Next Section -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom: 32px; background-color: #111827 !important; forced-color-adjust: none !important;">
                <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
                  <td style="background-color: #111827 !important; forced-color-adjust: none !important;">
                    <h3 class="email-section-title" style="color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 20px 0; line-height: 1.4; background-color: #111827 !important; forced-color-adjust: none !important;">WHAT HAPPENS NEXT?</h3>
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111827 !important; forced-color-adjust: none !important;">
                      <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
                        <td class="email-list-item" style="padding-bottom: 16px; background-color: #111827 !important; forced-color-adjust: none !important;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111827 !important; forced-color-adjust: none !important;">
                            <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
                              <td width="28" valign="top" style="padding-top: 2px; padding-right: 12px; background-color: #111827 !important; forced-color-adjust: none !important;">
                                <span style="color: #10B981 !important; -webkit-text-fill-color: #10B981 !important; font-size: 18px; font-weight: bold; line-height: 1.5; display: block; background-color: #111827 !important; forced-color-adjust: none !important;">✓</span>
                              </td>
                              <td valign="top" style="background-color: #111827 !important; forced-color-adjust: none !important;">
                                <p class="email-list-text" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 14px; line-height: 1.8; margin: 0; background-color: #111827 !important; forced-color-adjust: none !important;">We''ll keep you updated on our progress</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
                        <td class="email-list-item" style="padding-bottom: 16px; background-color: #111827 !important; forced-color-adjust: none !important;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111827 !important; forced-color-adjust: none !important;">
                            <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
                              <td width="28" valign="top" style="padding-top: 2px; padding-right: 12px; background-color: #111827 !important; forced-color-adjust: none !important;">
                                <span style="color: #10B981 !important; -webkit-text-fill-color: #10B981 !important; font-size: 18px; font-weight: bold; line-height: 1.5; display: block; background-color: #111827 !important; forced-color-adjust: none !important;">✓</span>
                              </td>
                              <td valign="top" style="background-color: #111827 !important; forced-color-adjust: none !important;">
                                <p class="email-list-text" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 14px; line-height: 1.8; margin: 0; background-color: #111827 !important; forced-color-adjust: none !important;">You''ll be among the first to get early access</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
                        <td style="background-color: #111827 !important; forced-color-adjust: none !important;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111827 !important; forced-color-adjust: none !important;">
                            <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
                              <td width="28" valign="top" style="padding-top: 2px; padding-right: 12px; background-color: #111827 !important; forced-color-adjust: none !important;">
                                <span style="color: #10B981 !important; -webkit-text-fill-color: #10B981 !important; font-size: 18px; font-weight: bold; line-height: 1.5; display: block; background-color: #111827 !important; forced-color-adjust: none !important;">✓</span>
                              </td>
                              <td valign="top" style="background-color: #111827 !important; forced-color-adjust: none !important;">
                                <p class="email-list-text" style="color: #F3F4F6 !important; -webkit-text-fill-color: #F3F4F6 !important; font-size: 14px; line-height: 1.8; margin: 0; background-color: #111827 !important; forced-color-adjust: none !important;">Exclusive 50% lifetime discount when we launch</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #111827 !important; forced-color-adjust: none !important;">
                <tr style="background-color: #111827 !important; forced-color-adjust: none !important;">
                  <td align="center" style="padding-bottom: 24px; background-color: #111827 !important; forced-color-adjust: none !important;">
                    <a href="https://www.use60.com" class="email-button" style="display: inline-block; padding: 14px 32px; background-color: #10B981 !important; background: linear-gradient(135deg, #10B981 0%, #059669 100%) !important; color: #FFFFFF !important; -webkit-text-fill-color: #FFFFFF !important; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3); line-height: 1.4; forced-color-adjust: none !important;">Got It!</a>
                  </td>
                </tr>
              </table>
              
            </td>
          </tr>
          
          <!-- Footer -->
          <tr style="background-color: #111827 !important;">
            <td class="email-footer" style="padding: 24px 40px; text-align: center; background-color: #111827 !important; border-top: 1px solid #374151 !important; forced-color-adjust: none !important; -webkit-text-fill-color: #D1D5DB !important;">
              <p class="email-footer-text" style="color: #D1D5DB !important; -webkit-text-fill-color: #D1D5DB !important; font-size: 14px; margin: 0 0 8px 0; font-weight: 500; line-height: 1.4; background-color: transparent !important; forced-color-adjust: none !important;">Sent by Sixty Seconds</p>
              <p class="email-footer-small" style="color: #9CA3AF !important; -webkit-text-fill-color: #9CA3AF !important; font-size: 12px; margin: 0; line-height: 1.4; background-color: transparent !important; forced-color-adjust: none !important;">We''ll keep you updated on your waitlist status</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
  </div>
  <!-- End Mobile Dark Mode Wrapper -->
</body>
</html>',
    'Welcome to 60, {{user_name}}!\n\nThank you for joining our waitlist.\n\nWe''re thrilled to have you on board! Your interest in revolutionizing your sales process means the world to us. We''re working hard to bring you the most powerful meeting intelligence platform that will help you close more deals and build stronger relationships.\n\nWHAT HAPPENS NEXT?\n✓ We''ll keep you updated on our progress\n✓ You''ll be among the first to get early access\n✓ Exclusive 50% lifetime discount when we launch\n\nSent by Sixty Seconds',
    '{"user_name": "User''s first name", "full_name": "User''s full name", "company_name": "User''s company name", "first_name": "User''s first name", "email": "User''s email address"}',
    true
  )
ON CONFLICT (template_name) DO UPDATE
SET
  template_type = EXCLUDED.template_type,
  subject_line = EXCLUDED.subject_line,
  html_body = EXCLUDED.html_body,
  text_body = EXCLUDED.text_body,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

COMMENT ON TABLE encharge_email_templates IS 'Email templates for Encharge email journeys - includes waitlist welcome template';
