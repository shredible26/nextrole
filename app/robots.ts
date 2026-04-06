import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/tracker', '/settings'],
    },
    sitemap: 'https://nextrole-phi.vercel.app/sitemap.xml',
  }
}
