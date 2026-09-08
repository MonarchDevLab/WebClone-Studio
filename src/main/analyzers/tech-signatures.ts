import { TechCategory } from '../../shared/types';

export interface TechSignatureRule {
  name: string;
  version?: string;
  category: TechCategory;
  icon?: string;
  website?: string;
  headers?: Record<string, RegExp>;
  cookies?: Record<string, RegExp>;
  meta?: Record<string, RegExp>;
  html?: RegExp[];
  scripts?: RegExp[];
  jsVars?: string[];
}

export const TECH_SIGNATURES: TechSignatureRule[] = [
  // CMS
  { name: 'WordPress', category: 'CMS', meta: { generator: /WordPress/i }, html: [/wp-content/i, /wp-includes/i] },
  { name: 'Drupal', category: 'CMS', headers: { 'x-generator': /Drupal/i }, jsVars: ['Drupal'] },
  { name: 'Joomla', category: 'CMS', meta: { generator: /Joomla/i } },
  { name: 'Shopify', category: 'CMS', jsVars: ['Shopify'], html: [/cdn\.shopify\.com/i] },
  { name: 'Magento', category: 'CMS', jsVars: ['Mage'], cookies: { frontend: /.*/ } },
  { name: 'Wix', category: 'CMS', headers: { 'x-wix-request-id': /.*/ }, jsVars: ['wixBiSession'] },
  { name: 'Squarespace', category: 'CMS', html: [/<!-- This is Squarespace. -->/i], jsVars: ['Squarespace'] },
  { name: 'Ghost', category: 'CMS', meta: { generator: /Ghost/i } },
  { name: 'Contentful', category: 'CMS', headers: { 'x-contentful-request-id': /.*/ } },
  { name: 'Strapi', category: 'CMS', headers: { 'x-powered-by': /Strapi/i } },
  { name: 'Webflow', category: 'CMS', html: [/data-wf-page/i, /data-wf-site/i], jsVars: ['Webflow'] },
  { name: 'Prismic', category: 'CMS', scripts: [/prismic\.io/i] },
  { name: 'Sanity', category: 'CMS', html: [/sanity/i] },
  { name: 'Payload', category: 'CMS', html: [/payload/i] },
  { name: 'KeystoneJS', category: 'CMS', headers: { 'x-keystone-version': /.*/ } },

  // Framework
  { name: 'Next.js', category: 'Framework', headers: { 'x-powered-by': /Next\.js/i }, html: [/_next/i], jsVars: ['__NEXT_DATA__'] },
  { name: 'Nuxt', category: 'Framework', jsVars: ['__NUXT__'], html: [/_nuxt/i] },
  { name: 'React', category: 'Framework', jsVars: ['React'], html: [/data-reactroot/i] },
  { name: 'Vue', category: 'Framework', jsVars: ['Vue', '__VUE__'] },
  { name: 'Angular', category: 'Framework', html: [/ng-version/i], jsVars: ['ng'] },
  { name: 'Svelte', category: 'Framework', html: [/svelte-/i] },
  { name: 'SvelteKit', category: 'Framework', html: [/%sveltekit/i] },
  { name: 'Gatsby', category: 'Framework', meta: { generator: /Gatsby/i }, html: [/gatsby-/i] },
  { name: 'Astro', category: 'Framework', meta: { generator: /Astro/i }, html: [/astro-/i] },
  { name: 'Remix', category: 'Framework', jsVars: ['__remixContext'] },
  { name: 'Ember', category: 'Framework', jsVars: ['Ember'] },
  { name: 'Backbone', category: 'Framework', jsVars: ['Backbone'] },
  { name: 'Alpine.js', category: 'Framework', html: [/x-data/i], jsVars: ['Alpine'] },
  { name: 'Preact', category: 'Framework', html: [/preact/i] },
  { name: 'SolidJS', category: 'Framework', html: [/solid-/i] },
  { name: 'Qwik', category: 'Framework', html: [/q:container/i] },
  { name: 'Express', category: 'Framework', headers: { 'x-powered-by': /Express/i } },
  { name: 'Fastify', category: 'Framework', headers: { 'x-powered-by': /fastify/i } },
  { name: 'Django', category: 'Framework', html: [/csrfmiddlewaretoken/i], cookies: { csrftoken: /.*/ } },
  { name: 'Rails', category: 'Framework', meta: { 'csrf-param': /authenticity_token/i } },
  { name: 'Laravel', category: 'Framework', cookies: { laravel_session: /.*/, 'XSRF-TOKEN': /.*/ } },
  { name: 'Flask', category: 'Framework', headers: { server: /Werkzeug/i } },
  { name: 'Spring Boot', category: 'Framework', headers: { 'x-application-context': /.*/ } },
  { name: 'ASP.NET', category: 'Framework', headers: { 'x-aspnet-version': /.*/, 'x-powered-by': /ASP\.NET/i } },

  // CSS Framework
  { name: 'Tailwind CSS', category: 'CSS Framework', html: [/\b(sm|md|lg|xl|2xl):[a-z0-9-]+/i, /\btext-(center|left|right)\b/i, /\bflex\b/i] },
  { name: 'Bootstrap', category: 'CSS Framework', html: [/\bcontainer-fluid\b/i, /\bcol-[a-z]{2}-\d+\b/i], scripts: [/bootstrap(?:\.min)?\.js/i] },
  { name: 'Bulma', category: 'CSS Framework', html: [/\bhas-text-centered\b/i, /\bis-primary\b/i] },
  { name: 'Foundation', category: 'CSS Framework', meta: { foundation: /.*/ }, html: [/\blarge-\d+ columns\b/i] },
  { name: 'Materialize', category: 'CSS Framework', scripts: [/materialize(?:\.min)?\.js/i], html: [/\bwaves-effect\b/i] },
  { name: 'Semantic UI', category: 'CSS Framework', html: [/\bui.*\bbutton\b/i] },
  { name: 'Ant Design', category: 'CSS Framework', html: [/\bant-[a-z]+\b/i] },
  { name: 'Chakra UI', category: 'CSS Framework', html: [/chakra-/i] },
  { name: 'MUI (Material UI)', category: 'CSS Framework', html: [/\bMui[A-Z][a-z]+/], jsVars: ['MaterialUI'] },
  { name: 'Styled Components', category: 'CSS Framework', html: [/\bsc-[a-zA-Z0-9-]+\b/i] },
  { name: 'Emotion', category: 'CSS Framework', html: [/\bcss-[a-zA-Z0-9-]+\b/i] },

  // Analytics
  { name: 'Google Analytics', category: 'Analytics', scripts: [/google-analytics\.com\/analytics\.js/i], jsVars: ['ga'] },
  { name: 'GA4', category: 'Analytics', scripts: [/googletagmanager\.com\/gtag\/js/i], jsVars: ['gtag'] },
  { name: 'Hotjar', category: 'Analytics', scripts: [/static\.hotjar\.com/i], jsVars: ['hj'] },
  { name: 'Mixpanel', category: 'Analytics', scripts: [/cdn\.mxpnl\.com/i], jsVars: ['mixpanel'] },
  { name: 'Amplitude', category: 'Analytics', jsVars: ['amplitude'] },
  { name: 'Segment', category: 'Analytics', jsVars: ['analytics'] },
  { name: 'Plausible', category: 'Analytics', scripts: [/plausible\.io\/js/i] },
  { name: 'Fathom', category: 'Analytics', scripts: [/cdn\.usefathom\.com/i], jsVars: ['fathom'] },
  { name: 'Matomo', category: 'Analytics', jsVars: ['_paq', 'Matomo'] },
  { name: 'Heap', category: 'Analytics', jsVars: ['heap'] },
  { name: 'FullStory', category: 'Analytics', jsVars: ['FS'] },
  { name: 'LogRocket', category: 'Analytics', jsVars: ['LogRocket'] },

  // CDN
  { name: 'Cloudflare', category: 'CDN', headers: { server: /cloudflare/i, 'cf-ray': /.*/ } },
  { name: 'AWS CloudFront', category: 'CDN', headers: { via: /cloudfront/i, 'x-amz-cf-id': /.*/ } },
  { name: 'Fastly', category: 'CDN', headers: { 'x-fastly-request-id': /.*/ } },
  { name: 'Akamai', category: 'CDN', headers: { 'x-akamai-request-id': /.*/ } },
  { name: 'KeyCDN', category: 'CDN', headers: { server: /keycdn/i } },
  { name: 'BunnyCDN', category: 'CDN', headers: { server: /BunnyCDN/i } },
  { name: 'StackPath', category: 'CDN', headers: { 'x-sp-isolation-id': /.*/ } },
  { name: 'Azure CDN', category: 'CDN', headers: { 'x-azure-ref': /.*/ } },

  // Hosting
  { name: 'Vercel', category: 'Hosting', headers: { server: /Vercel/i, 'x-vercel-id': /.*/ } },
  { name: 'Netlify', category: 'Hosting', headers: { server: /Netlify/i, 'x-nf-request-id': /.*/ } },
  { name: 'AWS', category: 'Hosting', headers: { server: /AmazonS3/i, 'x-amz-request-id': /.*/ } },
  { name: 'Google Cloud', category: 'Hosting', headers: { server: /Google Frontend/i } },
  { name: 'Azure', category: 'Hosting', headers: { 'x-ms-request-id': /.*/ } },
  { name: 'Heroku', category: 'Hosting', headers: { via: /vegur/i } },
  { name: 'DigitalOcean', category: 'Hosting', headers: { server: /DigitalOcean/i } },
  { name: 'Render', category: 'Hosting', headers: { server: /Render/i } },
  { name: 'Railway', category: 'Hosting', headers: { server: /Railway/i } },
  { name: 'Fly.io', category: 'Hosting', headers: { 'fly-request-id': /.*/, server: /Fly\/[0-9a-f]+/i } },

  // Server
  { name: 'Nginx', category: 'Server', headers: { server: /nginx/i } },
  { name: 'Apache', category: 'Server', headers: { server: /Apache/i } },
  { name: 'LiteSpeed', category: 'Server', headers: { server: /LiteSpeed/i } },
  { name: 'Caddy', category: 'Server', headers: { server: /Caddy/i } },
  { name: 'IIS', category: 'Server', headers: { server: /Microsoft-IIS/i } },
  { name: 'Tomcat', category: 'Server', headers: { server: /Apache-Coyote/i } },
  { name: 'Node.js', category: 'Server', headers: { 'x-powered-by': /Node\.js/i } },
  { name: 'Deno', category: 'Server', headers: { server: /deno/i } },

  // Language
  { name: 'PHP', category: 'Language', headers: { 'x-powered-by': /PHP/i }, cookies: { PHPSESSID: /.*/ } },
  { name: 'Python', category: 'Language', headers: { server: /(Python|Werkzeug|Gunicorn)/i } },
  { name: 'Ruby', category: 'Language', headers: { server: /(Ruby|WEBrick|Puma|Passenger)/i } },
  { name: 'Java', category: 'Language', cookies: { JSESSIONID: /.*/ } },
  { name: 'ASP.NET/C#', category: 'Language', headers: { 'x-powered-by': /ASP\.NET/i } },

  // JavaScript Library
  { name: 'jQuery', category: 'JavaScript Library', jsVars: ['jQuery', '$'] },
  { name: 'Lodash', category: 'JavaScript Library', jsVars: ['_'] },
  { name: 'Axios', category: 'JavaScript Library', jsVars: ['axios'] },
  { name: 'Moment.js', category: 'JavaScript Library', jsVars: ['moment'] },
  { name: 'Day.js', category: 'JavaScript Library', jsVars: ['dayjs'] },
  { name: 'D3.js', category: 'JavaScript Library', jsVars: ['d3'] },
  { name: 'Three.js', category: 'JavaScript Library', jsVars: ['THREE'] },
  { name: 'Chart.js', category: 'JavaScript Library', jsVars: ['Chart'] },
  { name: 'Socket.IO', category: 'JavaScript Library', jsVars: ['io'] },
  { name: 'GSAP', category: 'JavaScript Library', jsVars: ['gsap', 'TweenMax'] },
  { name: 'Lenis', category: 'JavaScript Library', jsVars: ['Lenis'] },
  { name: 'Swiper', category: 'JavaScript Library', jsVars: ['Swiper'] },
  { name: 'Splide', category: 'JavaScript Library', jsVars: ['Splide'] },
  { name: 'AOS', category: 'JavaScript Library', jsVars: ['AOS'] },
  { name: 'ScrollReveal', category: 'JavaScript Library', jsVars: ['ScrollReveal'] },

  // Font Service
  { name: 'Google Fonts', category: 'Font Service', html: [/fonts\.googleapis\.com/i] },
  { name: 'Adobe Fonts (Typekit)', category: 'Font Service', scripts: [/use\.typekit\.net/i], jsVars: ['Typekit'] },
  { name: 'Font Awesome', category: 'Font Service', html: [/font-awesome|fontawesome/i] },
  { name: 'Bootstrap Icons', category: 'Font Service', html: [/bootstrap-icons/i] },
  { name: 'Material Icons', category: 'Font Service', html: [/material-icons/i] },

  // Tag Manager
  { name: 'Google Tag Manager', category: 'Tag Manager', scripts: [/googletagmanager\.com\/gtm\.js/i], jsVars: ['google_tag_manager'] },
  { name: 'Tealium', category: 'Tag Manager', jsVars: ['utag'] },
  { name: 'Adobe Launch', category: 'Tag Manager', jsVars: ['_satellite'] },

  // A/B Testing
  { name: 'Optimizely', category: 'A/B Testing', jsVars: ['optimizely'] },
  { name: 'VWO', category: 'A/B Testing', jsVars: ['_vwo_code'] },
  { name: 'Google Optimize (Legacy)', category: 'A/B Testing', jsVars: ['google_optimize'] },
  { name: 'AB Tasty', category: 'A/B Testing', jsVars: ['ABTasty'] },

  // Payment
  { name: 'Stripe', category: 'Payment', jsVars: ['Stripe'] },
  { name: 'PayPal', category: 'Payment', jsVars: ['paypal'] },
  { name: 'Square', category: 'Payment', jsVars: ['SqPaymentForm'] },
  { name: 'Braintree', category: 'Payment', jsVars: ['braintree'] },
  { name: 'Paddle', category: 'Payment', jsVars: ['Paddle'] },

  // Chat Widget
  { name: 'Intercom', category: 'Chat Widget', jsVars: ['Intercom'] },
  { name: 'Drift', category: 'Chat Widget', jsVars: ['drift'] },
  { name: 'Crisp', category: 'Chat Widget', jsVars: ['$crisp'] },
  { name: 'Zendesk Chat', category: 'Chat Widget', jsVars: ['zE'] },
  { name: 'Tawk.to', category: 'Chat Widget', jsVars: ['Tawk_API'] },
  { name: 'LiveChat', category: 'Chat Widget', jsVars: ['LC_API'] },
  { name: 'HubSpot Chat', category: 'Chat Widget', jsVars: ['HubSpotConversations'] }
];
