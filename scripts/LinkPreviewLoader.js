export class LinkPreviewLoader {
    constructor() {
        this.links = [];
        this.cache = new Map();
    }

    async loadLinksFromMarkdown(filePath = 'links.md') {
        try {
            const response = await fetch(filePath);
            const content = await response.text();
            
            // Extract URLs from markdown content
            const urlRegex = /https?:\/\/[^\s\)]+/g;
            const matches = content.match(urlRegex);
            
            if (matches) {
                this.links = [...new Set(matches)]; // Remove duplicates
                console.log('Loaded links:', this.links);
            }
            
            return this.links;
        } catch (error) {
            console.error('Failed to load links from markdown:', error);
            return [];
        }
    }

    async fetchLinkPreview(url) {
        if (this.cache.has(url)) {
            return this.cache.get(url);
        }

        try {
            // Try to fetch real metadata with timeout
            const preview = await Promise.race([
                this.fetchRealMetadata(url),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Timeout')), 5000)
                )
            ]);
            this.cache.set(url, preview);
            return preview;
        } catch (error) {
            console.error('Failed to fetch real metadata for:', url, error.message);
            const fallback = this.generateFallbackPreview(url);
            this.cache.set(url, fallback);
            return fallback;
        }
    }

    async fetchRealMetadata(url) {
        console.log('Fetching real metadata for:', url);
        
        try {
            // Use a reliable metadata API service
            const apiUrl = `https://jsonlink.io/api/extract?url=${encodeURIComponent(url)}`;
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; LinkPreview/1.0)'
                }
            });
            
            if (!response.ok) {
                throw new Error(`API responded with ${response.status}`);
            }
            
            const data = await response.json();
            console.log('API response:', data);
            
            if (!data || data.error) {
                throw new Error(data?.error || 'Invalid API response');
            }
            
            const extractedImage = data.images?.[0] || data.image || data.thumbnail;
            console.log('Extracted image for', url, ':', extractedImage);
            
            return {
                title: data.title || data.domain || this.getDomain(url),
                description: data.description || data.excerpt || '',
                image: extractedImage,
                favicon: data.favicon || `${new URL(url).origin}/favicon.ico`,
                siteName: data.domain || this.getDomain(url),
                type: data.type || 'website'
            };
            
        } catch (apiError) {
            console.log('Primary API failed, trying backup method:', apiError.message);
            
            // Fallback to CORS proxy method
            try {
                const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
                const response = await fetch(proxyUrl);
                const data = await response.json();
                
                if (!data.contents) {
                    throw new Error('No content from proxy');
                }

                const parser = new DOMParser();
                const doc = parser.parseFromString(data.contents, 'text/html');
                const metadata = this.extractMetadata(doc, url);
                
                console.log('Extracted metadata via proxy:', metadata);
                
                return {
                    title: metadata.title || this.getDomain(url),
                    description: metadata.description || '',
                    image: metadata.image,
                    favicon: metadata.favicon || `${new URL(url).origin}/favicon.ico`,
                    siteName: metadata.siteName || this.getDomain(url),
                    type: metadata.type || 'website'
                };
                
            } catch (proxyError) {
                console.log('Proxy method also failed:', proxyError.message);
                throw new Error('All metadata fetching methods failed');
            }
        }
    }

    extractMetadata(doc, url) {
        const metadata = {};
        
        // Get title - try multiple sources
        metadata.title = this.getMetaContent(doc, 'og:title') || 
                        this.getMetaContent(doc, 'twitter:title') || 
                        this.getMetaContent(doc, 'title') ||
                        doc.querySelector('title')?.textContent?.trim() ||
                        doc.querySelector('h1')?.textContent?.trim() ||
                        this.getDomain(url);

        // Clean title
        if (metadata.title) {
            metadata.title = metadata.title.replace(/\s+/g, ' ').trim();
        }

        // Get description - try multiple sources
        metadata.description = this.getMetaContent(doc, 'og:description') || 
                              this.getMetaContent(doc, 'twitter:description') || 
                              this.getMetaContent(doc, 'description') ||
                              doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
                              doc.querySelector('.description')?.textContent?.trim() ||
                              doc.querySelector('p')?.textContent?.trim() ||
                              '';

        // Clean description
        if (metadata.description) {
            metadata.description = metadata.description.replace(/\s+/g, ' ').trim().substring(0, 200);
        }

        // Get image - try multiple sources
        let imageUrl = this.getMetaContent(doc, 'og:image') || 
                      this.getMetaContent(doc, 'og:image:url') ||
                      this.getMetaContent(doc, 'twitter:image') ||
                      this.getMetaContent(doc, 'twitter:image:src') ||
                      doc.querySelector('img')?.src;
        
        if (imageUrl) {
            // Convert relative URLs to absolute
            try {
                if (!imageUrl.startsWith('http')) {
                    imageUrl = new URL(imageUrl, url).href;
                }
                // Validate image URL
                if (imageUrl.includes('data:') || imageUrl.includes('svg')) {
                    imageUrl = null;
                }
            } catch (e) {
                imageUrl = null;
            }
        }
        metadata.image = imageUrl;
        console.log('HTML parsing extracted image for', url, ':', imageUrl);

        // Get site name
        metadata.siteName = this.getMetaContent(doc, 'og:site_name') || 
                           this.getMetaContent(doc, 'application-name') ||
                           this.getMetaContent(doc, 'twitter:site') ||
                           doc.querySelector('meta[name="application-name"]')?.getAttribute('content') ||
                           this.getDomain(url);

        // Get type
        metadata.type = this.getMetaContent(doc, 'og:type') || 
                       this.getMetaContent(doc, 'twitter:card') ||
                       'website';

        // Get favicon - try multiple sources
        const faviconSelectors = [
            'link[rel="icon"]',
            'link[rel="shortcut icon"]', 
            'link[rel="apple-touch-icon"]',
            'link[rel*="icon"]'
        ];
        
        let faviconUrl = null;
        for (const selector of faviconSelectors) {
            const faviconLink = doc.querySelector(selector);
            if (faviconLink) {
                faviconUrl = faviconLink.href || faviconLink.getAttribute('href');
                break;
            }
        }
        
        if (faviconUrl && !faviconUrl.startsWith('http')) {
            try {
                faviconUrl = new URL(faviconUrl, url).href;
            } catch (e) {
                faviconUrl = `${new URL(url).origin}/favicon.ico`;
            }
        }
        metadata.favicon = faviconUrl || `${new URL(url).origin}/favicon.ico`;

        return metadata;
    }

    getMetaContent(doc, property) {
        // Try property attribute first (for og: tags)
        let meta = doc.querySelector(`meta[property="${property}"]`);
        if (meta) return meta.getAttribute('content');
        
        // Try name attribute (for standard meta tags)
        meta = doc.querySelector(`meta[name="${property}"]`);
        if (meta) return meta.getAttribute('content');
        
        return null;
    }

    generateFallbackPreview(url) {
        const domain = this.getDomain(url);
        
        return {
            title: domain,
            description: 'Unable to fetch website metadata',
            image: null,
            favicon: `${new URL(url).origin}/favicon.ico`,
            siteName: domain,
            type: 'website'
        };
    }

    getDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch {
            return 'unknown';
        }
    }

    createLinkCard(url, preview, index) {
        const domain = this.getDomain(url);
        
        const card = document.createElement('div');
        card.className = 'link-card';
        card.style.cssText = `
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
            cursor: pointer;
            margin-bottom: 20px;
            max-width: 400px;
        `;
        
        card.addEventListener('mouseenter', () => {
            card.style.transform = 'translateY(-5px)';
            card.style.boxShadow = '0 20px 40px rgba(0,0,0,0.3)';
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'translateY(0)';
            card.style.boxShadow = '0 10px 30px rgba(0,0,0,0.2)';
        });
        
        card.onclick = () => window.open(url, '_blank');
        
        card.innerHTML = `
            <div style="
                height: 200px;
                background: linear-gradient(45deg, #f0f2f5, #e1e8ed);
                display: flex;
                align-items: center;
                justify-content: center;
                position: relative;
                overflow: hidden;
            ">
                <div style="
                    width: 60px;
                    height: 60px;
                    background: linear-gradient(135deg, #667eea, #764ba2);
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    font-size: 24px;
                    z-index: 1;
                ">
                    ${preview.favicon ? `<img src="${preview.favicon}" alt="favicon" style="width: 24px; height: 24px;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">` : ''}
                    <span style="display: ${preview.favicon ? 'none' : 'block'};">🔗</span>
                </div>
            </div>
            <div style="padding: 20px;">
                <div style="
                    font-size: 1.3rem;
                    font-weight: 600;
                    color: #1a1a1a;
                    margin-bottom: 8px;
                    line-height: 1.3;
                ">${preview.title}</div>
                <div style="
                    color: #667eea;
                    font-size: 0.9rem;
                    margin-bottom: 12px;
                    word-break: break-all;
                ">${url}</div>
                <div style="
                    color: #666;
                    font-size: 0.95rem;
                    line-height: 1.5;
                    margin-bottom: 15px;
                ">${preview.description}</div>
                <div style="
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 0.8rem;
                    color: #999;
                ">
                    <span style="
                        background: #f0f2f5;
                        padding: 4px 8px;
                        border-radius: 6px;
                        font-weight: 500;
                    ">${domain}</span>
                    <span>Click to visit</span>
                </div>
            </div>
        `;
        
        return card;
    }

    async renderLinksCanvas(containerId) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error('Container not found:', containerId);
            return;
        }

        // Load links from markdown
        await this.loadLinksFromMarkdown();

        // Create header
        const header = document.createElement('div');
        header.style.cssText = `
            text-align: center;
            margin-bottom: 40px;
            color: white;
        `;
        header.innerHTML = `
            <h1 style="
                font-size: 2.5rem;
                margin-bottom: 10px;
                text-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">🔗 Links Canvas</h1>
            <p style="
                font-size: 1.1rem;
                opacity: 0.9;
            ">Beautiful previews of your favorite links</p>
        `;

        // Create grid container
        const grid = document.createElement('div');
        grid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
            margin-bottom: 40px;
        `;

        // Load and render each link
        for (let i = 0; i < this.links.length; i++) {
            const url = this.links[i];
            const preview = await this.fetchLinkPreview(url);
            const card = this.createLinkCard(url, preview, i);
            grid.appendChild(card);
        }

        // Clear container and add content
        container.innerHTML = '';
        container.appendChild(header);
        container.appendChild(grid);

        // Apply background style to body if not already set
        if (!document.body.style.background) {
            document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            document.body.style.minHeight = '100vh';
            document.body.style.padding = '20px';
            document.body.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        }
    }
}