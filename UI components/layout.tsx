import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import '@/styles/VapiWidget.css'; // Import VapiWidget CSS
import '@/styles/joWidget.css'; // Import Jo Widget CSS
//// Temporarily disable broken imports until components exist
// import Navbar from '@/components/Navbar';
// import Footer from '@/components/Footer';
// import VapiWidget from '@/components/VapiWidget'; // Import VapiWidget component
import Script from 'next/script'; // Needed for client-side scripts

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'NHome - Professional Property Setup in Algarve',
  description: 'Expert property setup services in the Algarve region. Specializing in comprehensive property care, project oversight, and vendor coordination for international property owners.',
  keywords: 'property management, Algarve, Portugal, real estate management, property maintenance, vendor coordination, project oversight, property setup, home setup',
  authors: [{ name: 'Natalie O\'Kelly' }],
  creator: 'NHome',
  publisher: 'NHome',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: '/NHome_Icon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://nhomesetup.com',
    siteName: 'NHome Setup Services',
    title: 'NHome - Professional Property Setup in Algarve',
    description: 'Expert property setup services in the Algarve region. Specializing in comprehensive property care, project oversight, and vendor coordination.',
    images: [
      {
        url: '/NHome_V4__Logo.png',
        width: 1200,
        height: 630,
        alt: 'NHome Property Setup',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NHome - Professional Property Setup in Algarve',
    description: 'Expert property setup services in the Algarve region. Specializing in comprehensive property care and vendor coordination.',
    images: ['/NHome_V4__Logo.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'add-your-verification-code',
  },
};

// JSON-LD structured data
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'NHome Property Management',
  image: '/NHome_V4__Logo.png',
  '@id': 'https://nhomesetup.com',
  url: 'https://nhomesetup.com',
  telephone: '+351 966 318 871',
  address: {
    '@type': 'PostalAddress',
    streetAddress: 'Rua du Viveiro',
    addressLocality: 'Lagoa',
    addressRegion: 'Algarve',
    addressCountry: 'PT'
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 37.1367,
    longitude: -8.4518
  },
  description: 'Expert property setup services in the Algarve region. Specializing in comprehensive property care, project oversight, and vendor coordination.',
  areaServed: {
    '@type': 'GeoCircle',
    geoMidpoint: {
      '@type': 'GeoCoordinates',
      latitude: 37.1367,
      longitude: -8.4518
    },
    geoRadius: '50000'
  },
  priceRange: '€€€',
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday'
    ],
    opens: '09:00',
    closes: '17:00'
  }
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/NHome_Icon.ico" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="canonical" href="https://nhomesetup.com" />
        {/* Vapi SDK script removed from here, will be added using next/script below */}
      </head>
      <body className={inter.className}>
        {/* Navbar removed until component exists */}
        {children}
        {/* Footer removed until component exists */}
        {/* <VapiWidget />  Removed to prevent duplicate widget */}
        {/* Add script to initialize Jo agent */}
        <Script id="jo-agent-init" strategy="afterInteractive">
          {`
            console.log('Natalie agent script starting...');
            
            // Create the Natalie widget directly in the script
            function createNatalieWidget() {
              console.log('Creating Natalie widget manually...');
              
              // Create widget HTML - with minimized state as default
              const widgetHTML = \`
                <div class="jo-widget minimized">
                  <div class="jo-widget-minimized">
                    <div class="jo-minimized-button">
                      <img src="/Nats1.png" alt="Natalie" class="jo-minimized-image">
                      <div class="jo-minimized-indicator"></div>
                    </div>
                    <div class="jo-minimized-name">Natalie</div>
                  </div>
                  <div class="jo-widget-expanded">
                    <div class="jo-widget-header">
                      <div class="jo-widget-title">
                        <img src="/Nats1.png" alt="Natalie" class="jo-header-image">
                        <span>Natalie</span>
                      </div>
                      <button class="jo-widget-close">&times;</button>
                    </div>
                    <div class="jo-widget-body">
                      <div class="jo-message">Hi there! I'm Natalie. How can I help you today?</div>
                      <div class="jo-controls">
                        <button class="jo-call-button" style="background-color: #bcae69; hover:background-color: #a59a5e;">
                          <span class="jo-button-icon">🎤</span>
                          <span class="jo-button-text">Talk to Natalie</span>
                        </button>
                        <div class="jo-status">Ready to assist</div>
                      </div>
                    </div>
                  </div>
                </div>
              \`;
              
              // Add widget to the DOM
              const widgetContainer = document.createElement('div');
              widgetContainer.innerHTML = widgetHTML;
              document.body.appendChild(widgetContainer.firstElementChild);
              
              // Get widget elements
              const widget = document.querySelector('.jo-widget');
              const closeButton = document.querySelector('.jo-widget-close');
              const minimizedButton = document.querySelector('.jo-minimized-button');
              
              // Set up hover effect for the call button
              const callButton = document.querySelector('.jo-call-button');
              if (callButton) {
                callButton.addEventListener('mouseenter', () => {
                  callButton.style.backgroundColor = '#a59a5e';
                });
                callButton.addEventListener('mouseleave', () => {
                  callButton.style.backgroundColor = '#bcae69';
                });
              }
              
              // Toggle between expanded and minimized states
              if (closeButton) {
                closeButton.addEventListener('click', () => {
                  widget.classList.remove('expanded');
                  widget.classList.add('minimized');
                });
              }
              
              if (minimizedButton) {
                minimizedButton.addEventListener('click', () => {
                  widget.classList.remove('minimized');
                  widget.classList.add('expanded');
                });
              }
              
              console.log('Natalie widget created successfully');
            }
            
            // Wait for DOM to be fully loaded
            if (document.readyState === 'loading') {
              document.addEventListener('DOMContentLoaded', createNatalieWidget);
            } else {
              // DOM already loaded, create widget immediately
              createNatalieWidget();
            }
          `}
        </Script>
      </body>
    </html>
  );
}
